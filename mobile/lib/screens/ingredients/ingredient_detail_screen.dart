import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/api_client.dart';
import '../../api/endpoints.dart';
import '../../models/models.dart';
import '../../state/auth_state.dart';
import '../../widgets/error_banner.dart';
import '../../theme/app_theme.dart';
import 'ingredient_form_screen.dart';

/// SDD-08 §3 — detalle de ingrediente con historial de precios (lista
/// simple; un gráfico completo es "nice to have" y se deja fuera para no
/// sumar una dependencia de charting solo para esto) y acciones de
/// compra/cambio de precio.
class IngredientDetailScreen extends StatefulWidget {
  final String ingredientId;
  const IngredientDetailScreen({super.key, required this.ingredientId});

  @override
  State<IngredientDetailScreen> createState() => _IngredientDetailScreenState();
}

class _IngredientDetailScreenState extends State<IngredientDetailScreen> {
  Ingredient? _ingredient;
  List<PriceHistoryEntry> _history = [];
  String? _error;

  IngredientsApi get _api => IngredientsApi(context.read<AuthState>().client);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final ing = await _api.getById(widget.ingredientId);
      final hist = await _api.priceHistory(widget.ingredientId);
      if (mounted) setState(() {
        _ingredient = ing;
        _history = hist.data;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e is ApiException ? e.message : e.toString());
    }
  }

  Future<void> _showPurchaseDialog() async {
    final qtyCtrl = TextEditingController();
    final noteCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    bool updatePrice = false;
    String? error;
    final ing = _ingredient!;

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSt) {
        return AlertDialog(
          title: const Text('Registrar compra'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: qtyCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(labelText: 'Cantidad comprada (${ing.baseUnit})'),
                ),
                TextField(controller: noteCtrl, decoration: const InputDecoration(labelText: 'Nota (opcional)')),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: updatePrice,
                  title: const Text('Actualizar precio con esta compra'),
                  onChanged: (v) => setSt(() => updatePrice = v ?? false),
                ),
                if (updatePrice)
                  TextField(
                    controller: priceCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(labelText: 'Nuevo precio por ${ing.baseUnit} (Bs)'),
                  ),
                if (error != null) ErrorBanner(message: error),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
            FilledButton(
              onPressed: () async {
                try {
                  await _api.registerPurchase(
                    ing.id,
                    quantityBaseUnit: qtyCtrl.text,
                    note: noteCtrl.text.isEmpty ? null : noteCtrl.text,
                    newPrice: updatePrice ? priceCtrl.text : null,
                  );
                  if (context.mounted) Navigator.pop(ctx);
                  _load();
                } on ApiException catch (e) {
                  setSt(() => error = e.message);
                }
              },
              child: const Text('Registrar'),
            ),
          ],
        );
      }),
    );
  }

  Future<void> _showPriceDialog() async {
    final priceCtrl = TextEditingController();
    String? error;
    final ing = _ingredient!;
    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSt) {
        return AlertDialog(
          title: const Text('Registrar cambio de precio'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: priceCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(labelText: 'Nuevo precio por ${ing.baseUnit} (Bs)'),
              ),
              if (error != null) ErrorBanner(message: error),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
            FilledButton(
              onPressed: () async {
                try {
                  await _api.registerPriceChange(
                    ing.id,
                    pricePerBaseUnit: priceCtrl.text,
                    effectiveAt: DateTime.now().toIso8601String(),
                  );
                  if (context.mounted) Navigator.pop(ctx);
                  _load();
                } on ApiException catch (e) {
                  setSt(() => error = e.message);
                }
              },
              child: const Text('Guardar'),
            ),
          ],
        );
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final role = context.watch<AuthState>().user?.role;
    final canEdit = role == 'admin' || role == 'dueño';
    final ing = _ingredient;
    return Scaffold(
      appBar: AppBar(
        title: Text(ing?.name ?? 'Ingrediente'),
        actions: [
          if (canEdit && ing != null)
            IconButton(
              icon: const Icon(Icons.edit),
              onPressed: () async {
                final updated = await Navigator.of(context).push<bool>(
                    MaterialPageRoute(builder: (_) => IngredientFormScreen(ingredient: ing)));
                if (updated == true) _load();
              },
            ),
        ],
      ),
      body: ing == null
          ? Center(child: _error != null ? ErrorBanner(message: _error) : const CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) ErrorBanner(message: _error),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(ing.categoryName ?? 'Sin categoría',
                              style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              _stat('Stock actual', '${ing.currentStock} ${ing.baseUnit}'),
                              _stat('Stock mínimo', '${ing.minStock} ${ing.baseUnit}'),
                              _stat('Precio actual', 'Bs ${ing.currentPricePerBaseUnit ?? "-"}'),
                            ],
                          ),
                          if (ing.isBelowMin)
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text('Stock por debajo del mínimo',
                                  style: TextStyle(color: context.appColors.warning, fontWeight: FontWeight.w600)),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _showPurchaseDialog,
                          icon: const Icon(Icons.add_shopping_cart),
                          label: const Text('Registrar compra'),
                        ),
                      ),
                      if (canEdit) const SizedBox(width: 8),
                      if (canEdit)
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _showPriceDialog,
                            icon: const Icon(Icons.price_change),
                            label: const Text('Cambiar precio'),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text('Historial de precios', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text('Nunca se sobrescribe: cada cambio queda registrado.',
                      style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 12)),
                  const SizedBox(height: 8),
                  if (_history.isEmpty)
                    const Text('Aún no hay historial de precios.')
                  else
                    ..._history.map((h) => ListTile(
                          dense: true,
                          contentPadding: EdgeInsets.zero,
                          title: Text('Bs ${h.pricePerBaseUnit} / ${ing.baseUnit}'),
                          trailing: Text(h.effectiveAt.substring(0, 10)),
                        )),
                ],
              ),
            ),
    );
  }

  Widget _stat(String label, String value) => Column(
        children: [
          Text(label, style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      );
}
