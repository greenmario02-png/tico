import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/api_client.dart';
import '../../api/endpoints.dart';
import '../../models/models.dart';
import '../../state/auth_state.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/error_banner.dart';
import '../../theme/app_theme.dart';

/// SDD-08 §11.1 — "nuestro módulo principal" (pedido explícito del
/// usuario): explorar el costo de cualquier receta a cualquier cantidad,
/// y el precio de venta sugerido para un margen elegido, SIN producir ni
/// mutar nada. Reusa el mismo patrón de selector de receta + cantidad con
/// recálculo en vivo con debounce que ProduceBatchScreen (ver
/// batches/produce_batch_screen.dart) y llama a los mismos endpoints de
/// solo lectura que RecipeDetailScreen (GET /recipes/:id/cost) más
/// GET /products/:id/suggested-price para el slider de margen.
class CostCalculatorScreen extends StatefulWidget {
  const CostCalculatorScreen({super.key});

  @override
  State<CostCalculatorScreen> createState() => _CostCalculatorScreenState();
}

class _CostCalculatorScreenState extends State<CostCalculatorScreen> {
  List<Recipe> _recipes = [];
  List<Product> _products = [];
  String? _recipeId;
  final _quantityCtrl = TextEditingController();
  RecipeCostPreview? _cost;
  bool _costLoading = false;
  double _margin = 30;
  SuggestedPrice? _suggested;
  bool _suggestedLoading = false;
  bool _loadingOptions = true;
  String? _error;
  Timer? _costDebounce;
  Timer? _marginDebounce;

  RecipesApi get _recipesApi => RecipesApi(context.read<AuthState>().client);
  ProductsApi get _productsApi => ProductsApi(context.read<AuthState>().client);

  @override
  void initState() {
    super.initState();
    _loadOptions();
  }

  @override
  void dispose() {
    _costDebounce?.cancel();
    _marginDebounce?.cancel();
    _quantityCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadOptions() async {
    try {
      final recipes = await _recipesApi.listAll();
      final products = await _productsApi.listAll();
      if (mounted) {
        setState(() {
          _recipes = recipes;
          _products = products;
          _loadingOptions = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loadingOptions = false;
          _error = e is ApiException ? e.message : e.toString();
        });
      }
    }
  }

  Recipe? get _recipe => _recipes.where((r) => r.id == _recipeId).firstOrNull;

  Product? get _product => _products.where((p) => p.recipeId == _recipeId).firstOrNull;

  void _onRecipeChanged(String? recipeId) {
    setState(() {
      _recipeId = recipeId;
      _cost = null;
      _suggested = null;
    });
    final r = _recipes.where((rr) => rr.id == recipeId).firstOrNull;
    if (r != null) {
      _quantityCtrl.text = r.yieldQuantity;
      _recalculateCost(r.yieldQuantity);
    }
  }

  void _onQuantityChanged(String value) {
    _quantityCtrl.text = value;
    _recalculateCost(value);
  }

  void _recalculateCost(String value) {
    _costDebounce?.cancel();
    final qty = double.tryParse(value);
    if (_recipeId == null || qty == null || qty <= 0) {
      setState(() {
        _cost = null;
        _suggested = null;
      });
      return;
    }
    setState(() => _costLoading = true);
    _costDebounce = Timer(const Duration(milliseconds: 350), () async {
      try {
        final cost = await _recipesApi.costPreview(_recipeId!, quantity: value);
        if (mounted) setState(() => _cost = cost);
      } catch (_) {
        if (mounted) setState(() => _cost = null);
      } finally {
        if (mounted) setState(() => _costLoading = false);
      }
      _recalculateSuggestedPrice();
    });
  }

  void _onMarginChanged(double value) {
    setState(() => _margin = value);
    _marginDebounce?.cancel();
    _marginDebounce = Timer(const Duration(milliseconds: 250), _recalculateSuggestedPrice);
  }

  Future<void> _recalculateSuggestedPrice() async {
    final product = _product;
    if (product == null) {
      if (mounted) setState(() => _suggested = null);
      return;
    }
    if (mounted) setState(() => _suggestedLoading = true);
    try {
      final suggested = await _productsApi.suggestedPrice(product.id, margin: _margin.round());
      if (mounted) setState(() => _suggested = suggested);
    } catch (_) {
      if (mounted) setState(() => _suggested = null);
    } finally {
      if (mounted) setState(() => _suggestedLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final recipe = _recipe;
    final product = _product;
    final scheme = Theme.of(context).colorScheme;
    final appColors = context.appColors;
    return Scaffold(
      appBar: AppBar(title: const Text('Calculadora de Costos')),
      drawer: const AppDrawer(),
      body: _loadingOptions
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_error != null) ErrorBanner(message: _error),
                Text(
                  'Explora el costo de cualquier receta sin producir nada: elige una receta y una '
                  'cantidad, y mira el costo total, el costo por unidad y el precio de venta sugerido '
                  'según el margen que quieras. Esto no descuenta stock ni registra ningún lote.',
                  style: TextStyle(color: scheme.onSurfaceVariant),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: _recipeId,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Receta', border: OutlineInputBorder()),
                  items: _recipes.map((r) => DropdownMenuItem(value: r.id, child: Text(r.name))).toList(),
                  onChanged: _onRecipeChanged,
                ),
                if (recipe != null) ...[
                  const SizedBox(height: 20),
                  Text('Cantidad (${recipe.yieldUnit})', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _quantityCtrl,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(border: OutlineInputBorder()),
                    onChanged: _onQuantityChanged,
                  ),
                  const SizedBox(height: 20),
                  Card(
                    color: scheme.primaryContainer,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Costo', style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 8),
                          if (_costLoading)
                            const Text('Calculando…')
                          else if (_cost != null) ...[
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text('Costo total', style: TextStyle(fontWeight: FontWeight.bold)),
                                Text('Bs ${_cost!.totalCost}', style: const TextStyle(fontWeight: FontWeight.bold)),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text('Costo por unidad'),
                                Text('Bs ${_cost!.costPerUnit}'),
                              ],
                            ),
                          ] else
                            const Text('Ingresa una cantidad válida para calcular el costo.'),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text('Margen de ganancia', style: Theme.of(context).textTheme.titleMedium),
                  if (product == null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        'Esta receta no tiene un producto de venta asociado, así que no se puede '
                        'sugerir un precio (solo el costo de arriba).',
                        style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12),
                      ),
                    )
                  else ...[
                    Row(
                      children: [
                        Expanded(
                          child: Slider(
                            value: _margin,
                            min: 5,
                            max: 90,
                            divisions: 85,
                            label: '${_margin.round()}%',
                            onChanged: _onMarginChanged,
                          ),
                        ),
                        SizedBox(
                          width: 48,
                          child: Text('${_margin.round()}%', textAlign: TextAlign.end),
                        ),
                      ],
                    ),
                    Card(
                      color: appColors.success.withValues(alpha: 0.12),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(product.name, style: Theme.of(context).textTheme.titleSmall),
                            const SizedBox(height: 8),
                            if (_suggestedLoading)
                              const Text('Calculando…')
                            else if (_suggested != null) ...[
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('Precio sugerido', style: TextStyle(fontWeight: FontWeight.bold)),
                                  Text('Bs ${_suggested!.suggestedPrice}',
                                      style: const TextStyle(fontWeight: FontWeight.bold)),
                                ],
                              ),
                              if (_suggested!.currentSalePrice != null) ...[
                                const SizedBox(height: 4),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text('Precio de venta actual', style: TextStyle(color: scheme.onSurfaceVariant)),
                                    Text('Bs ${_suggested!.currentSalePrice}',
                                        style: TextStyle(color: scheme.onSurfaceVariant)),
                                  ],
                                ),
                              ],
                            ] else
                              const Text('Mueve el control para calcular el precio sugerido.'),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ],
            ),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
