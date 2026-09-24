import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../api/api_client.dart';
import '../../api/endpoints.dart';
import '../../models/models.dart';
import '../../state/auth_state.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/error_banner.dart';
import '../../widgets/motion.dart';
import '../../theme/app_theme.dart';

class _Need {
  final String ingredientId;
  final String name;
  double neededAfterWaste;
  final String unit;
  _Need({
    required this.ingredientId,
    required this.name,
    required this.neededAfterWaste,
    required this.unit,
  });
}

void _collectNeeds(List<CostDetail> details, Map<String, _Need> acc) {
  for (final d in details) {
    if (d.type == 'ingredient' && d.ingredientId != null) {
      final qty = double.tryParse(d.quantityAfterWaste) ?? 0;
      final existing = acc[d.ingredientId];
      if (existing != null) {
        existing.neededAfterWaste += qty;
      } else {
        acc[d.ingredientId!] = _Need(
          ingredientId: d.ingredientId!,
          name: d.ingredientName ?? 'Ingrediente',
          neededAfterWaste: qty,
          unit: d.unit,
        );
      }
    } else if (d.subBreakdown != null) {
      _collectNeeds(d.subBreakdown!, acc);
    }
  }
}

/// SDD-08 §6 — la pantalla más importante del móvil (SDD-08 §0.2): elegir
/// receta, cantidad con +/- grandes (pensado para manos con harina) y
/// atajos ×1/×2/×3/×5 (SDD-08 §11.1), recálculo en vivo con debounce
/// (SDD-08 §0.4) contra el endpoint real de costo, manejo explícito de
/// faltantes de stock nombrando cada ingrediente corto con cantidades
/// reales, y confirmación explícita antes de descontar stock de verdad.
class ProduceBatchScreen extends StatefulWidget {
  const ProduceBatchScreen({super.key});

  @override
  State<ProduceBatchScreen> createState() => _ProduceBatchScreenState();
}

class _ProduceBatchScreenState extends State<ProduceBatchScreen> {
  List<Recipe> _recipes = [];
  List<Ingredient> _ingredients = [];
  String? _recipeId;
  final _quantityCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  RecipeCostPreview? _cost;
  bool _costLoading = false;
  bool _submitting = false;
  String? _error;
  Batch? _result;
  Timer? _debounce;
  bool _loadingOptions = true;

  RecipesApi get _recipesApi => RecipesApi(context.read<AuthState>().client);
  BatchesApi get _batchesApi => BatchesApi(context.read<AuthState>().client);

  @override
  void initState() {
    super.initState();
    _loadOptions();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _loadOptions() async {
    try {
      final recipes = await _recipesApi.listAll();
      final ingredients = await IngredientsApi(context.read<AuthState>().client)
          .listAllActive();
      if (mounted)
        setState(() {
          _recipes = recipes;
          _ingredients = ingredients;
          _loadingOptions = false;
        });
    } catch (e) {
      if (mounted) setState(() => _loadingOptions = false);
    }
  }

  Recipe? get _recipe => _recipes.where((r) => r.id == _recipeId).firstOrNull;

  Map<String, Ingredient> get _ingredientById => {
    for (final i in _ingredients) i.id: i,
  };

  void _onQuantityChanged(String value) {
    _quantityCtrl.text = value;
    setState(() => _result = null);
    _debounce?.cancel();
    final qty = double.tryParse(value);
    if (_recipeId == null || qty == null || qty <= 0) {
      setState(() => _cost = null);
      return;
    }
    setState(() => _costLoading = true);
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      try {
        final cost = await _recipesApi.costPreview(_recipeId!, quantity: value);
        if (mounted) setState(() => _cost = cost);
      } catch (_) {
        if (mounted) setState(() => _cost = null);
      } finally {
        if (mounted) setState(() => _costLoading = false);
      }
    });
  }

  void _setQuantity(double value) {
    final v = value < 0 ? 0.0 : value;
    final text = v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString();
    _onQuantityChanged(text);
  }

  void _applyQuickScale(int multiplier) {
    final r = _recipe;
    if (r == null) return;
    final base = double.tryParse(r.yieldQuantity) ?? 1;
    _setQuantity(base * multiplier);
  }

  List<_Need> get _needs {
    if (_cost == null) return [];
    final acc = <String, _Need>{};
    _collectNeeds(_cost!.breakdown, acc);
    return acc.values.toList();
  }

  List<_Need> get _shortages {
    final byId = _ingredientById;
    return _needs.where((n) {
      final ing = byId[n.ingredientId];
      if (ing == null) return false;
      return ing.stockNum < n.neededAfterWaste;
    }).toList();
  }

  bool get _canConfirm {
    final qty = double.tryParse(_quantityCtrl.text);
    return _cost != null &&
        !_costLoading &&
        _shortages.isEmpty &&
        qty != null &&
        qty > 0;
  }

  Future<void> _openConfirmDialog() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirmar producción de lote'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Esta acción descuenta stock de forma inmediata y no se puede deshacer. '
                'Revisa lo que se va a descontar:',
              ),
              const SizedBox(height: 12),
              ..._needs.map(
                (n) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(child: Text(n.name)),
                      Text(
                        '−${n.neededAfterWaste.toStringAsFixed(3)} ${_ingredientById[n.ingredientId]?.baseUnit ?? n.unit}',
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Producirás ${_quantityCtrl.text} ${_recipe?.yieldUnit} de "${_recipe?.name}" '
                'por un costo total de Bs ${_cost?.totalCost}.',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Confirmar y descontar stock'),
          ),
        ],
      ),
    );
    if (confirmed == true) _confirmProduce();
  }

  Future<void> _confirmProduce() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final batch = await _batchesApi.produce(
        recipeId: _recipeId!,
        requestedUnits: _quantityCtrl.text,
        notes: _notesCtrl.text.isEmpty ? null : _notesCtrl.text,
      );
      if (mounted) setState(() => _result = batch);
      _loadOptions(); // refresca stock local para futuras validaciones
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final recipe = _recipe;
    final scheme = Theme.of(context).colorScheme;
    final appColors = context.appColors;
    return Scaffold(
      appBar: AppBar(title: const Text('Producir Lote')),
      drawer: const AppDrawer(),
      body: _loadingOptions
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  'Elige una receta y cuánto quieres producir. El sistema calcula los ingredientes '
                  'necesarios y descuenta el stock al confirmar.',
                  style: TextStyle(color: scheme.onSurfaceVariant),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: _recipeId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Receta',
                    border: OutlineInputBorder(),
                  ),
                  items: _recipes
                      .map(
                        (r) =>
                            DropdownMenuItem(value: r.id, child: Text(r.name)),
                      )
                      .toList(),
                  onChanged: (v) {
                    setState(() {
                      _recipeId = v;
                      _result = null;
                    });
                    final r = _recipes.where((rr) => rr.id == v).firstOrNull;
                    if (r != null) _onQuantityChanged(r.yieldQuantity);
                  },
                ),
                if (recipe != null) ...[
                  const SizedBox(height: 20),
                  Text(
                    'Cantidad a producir (${recipe.yieldUnit})',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _stepButton(Icons.remove, () {
                        final cur = double.tryParse(_quantityCtrl.text) ?? 0;
                        _setQuantity(cur - 1);
                      }),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _quantityCtrl,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                          ),
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          decoration: const InputDecoration(
                            border: OutlineInputBorder(),
                          ),
                          onChanged: _onQuantityChanged,
                        ),
                      ),
                      const SizedBox(width: 8),
                      _stepButton(Icons.add, () {
                        final cur = double.tryParse(_quantityCtrl.text) ?? 0;
                        _setQuantity(cur + 1);
                      }),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    children: [1, 2, 3, 5]
                        .map(
                          (m) => OutlinedButton(
                            onPressed: () => _applyQuickScale(m),
                            child: Text('×$m'),
                          ),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _notesCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Notas (opcional)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Ingredientes necesarios',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(
                    'Se recalcula automáticamente al cambiar la cantidad.',
                    style: TextStyle(
                      color: scheme.onSurfaceVariant,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_costLoading)
                    const Padding(
                      padding: EdgeInsets.all(8),
                      child: Text('Calculando…'),
                    )
                  else if (_cost != null) ...[
                    ..._needs.map((n) {
                      final ing = _ingredientById[n.ingredientId];
                      final short = _shortages.any(
                        (s) => s.ingredientId == n.ingredientId,
                      );
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            Expanded(child: Text(n.name)),
                            Text(
                              '${n.neededAfterWaste.toStringAsFixed(3)} ${ing?.baseUnit ?? n.unit}',
                            ),
                            if (short) ...[
                              const SizedBox(width: 8),
                              Chip(
                                label: Text(
                                  'faltan ${(n.neededAfterWaste - (ing?.stockNum ?? 0)).toStringAsFixed(3)} ${ing?.baseUnit}',
                                ),
                                backgroundColor: scheme.errorContainer,
                                labelStyle: TextStyle(
                                  color: scheme.onErrorContainer,
                                ),
                              ),
                            ],
                          ],
                        ),
                      );
                    }),
                    const Divider(),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Costo total',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                        Text(
                          'Bs ${_cost!.totalCost}',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Costo por unidad',
                          style: TextStyle(color: scheme.onSurfaceVariant),
                        ),
                        Text(
                          'Bs ${_cost!.costPerUnit}',
                          style: TextStyle(color: scheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                    if (_shortages.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          'No hay stock suficiente para esta cantidad. Resuelve el faltante (registra una compra) antes de confirmar.',
                          style: TextStyle(color: scheme.error),
                        ),
                      ),
                  ],
                ],
                ErrorBanner(message: _error),
                if (_result != null)
                  PopIn(
                    child: Card(
                      color: appColors.success.withValues(alpha: 0.12),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Lote producido correctamente',
                              style: TextStyle(
                                color: appColors.success,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              'Costo total del lote: Bs ${_result!.totalCostSnapshot}',
                            ),
                            Text(
                              'Costo por unidad: Bs ${_result!.costPerUnitSnapshot}',
                            ),
                            if (_result!.unitsRemaining != null)
                              Text(
                                'Unidades restantes en el lote: ${_result!.unitsRemaining}',
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                const SizedBox(height: 20),
                SizedBox(
                  height: 52,
                  child: FilledButton(
                    onPressed: (_canConfirm && !_submitting)
                        ? _openConfirmDialog
                        : null,
                    child: Text(
                      _submitting ? 'Produciendo…' : 'Producir lote',
                      style: const TextStyle(fontSize: 16),
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _stepButton(IconData icon, VoidCallback onTap) => SizedBox(
    width: 56,
    height: 56,
    child: OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(padding: EdgeInsets.zero),
      child: Icon(icon, size: 28),
    ),
  );
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
