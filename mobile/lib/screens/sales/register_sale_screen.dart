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

/// SDD-08 §7 — registrar venta: producto, cantidad y precio; el
/// profit/margen reales se muestran tal cual los devuelve el backend (no
/// se recalculan en el cliente, igual que RegisterSalePage.tsx).
class RegisterSaleScreen extends StatefulWidget {
  const RegisterSaleScreen({super.key});

  @override
  State<RegisterSaleScreen> createState() => _RegisterSaleScreenState();
}

class _RegisterSaleScreenState extends State<RegisterSaleScreen> {
  List<Product> _products = [];
  String? _productId;
  final _quantityCtrl = TextEditingController(text: '1');
  final _priceCtrl = TextEditingController();
  bool _loadingOptions = true;
  bool _submitting = false;
  String? _error;
  Sale? _result;

  ProductsApi get _productsApi => ProductsApi(context.read<AuthState>().client);
  SalesApi get _salesApi => SalesApi(context.read<AuthState>().client);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final products = await _productsApi.listAll();
      if (mounted)
        setState(() {
          _products = products;
          _loadingOptions = false;
        });
    } catch (e) {
      if (mounted) setState(() => _loadingOptions = false);
    }
  }

  double get _revenue =>
      (double.tryParse(_quantityCtrl.text) ?? 0) *
      (double.tryParse(_priceCtrl.text) ?? 0);

  Future<void> _submit() async {
    if (_productId == null) return;
    setState(() {
      _submitting = true;
      _error = null;
      _result = null;
    });
    try {
      final sale = await _salesApi.register(
        productId: _productId!,
        quantity: _quantityCtrl.text,
        salePricePerUnit: _priceCtrl.text,
      );
      if (mounted) setState(() => _result = sale);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Registrar Venta')),
      drawer: const AppDrawer(),
      body: _loadingOptions
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                DropdownButtonFormField<String>(
                  initialValue: _productId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Producto',
                    border: OutlineInputBorder(),
                  ),
                  items: _products
                      .map(
                        (p) =>
                            DropdownMenuItem(value: p.id, child: Text(p.name)),
                      )
                      .toList(),
                  onChanged: (v) {
                    setState(() {
                      _productId = v;
                      final p = _products.where((pp) => pp.id == v).firstOrNull;
                      if (p?.salePrice != null) _priceCtrl.text = p!.salePrice!;
                    });
                  },
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _quantityCtrl,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  style: const TextStyle(fontSize: 18),
                  decoration: const InputDecoration(
                    labelText: 'Cantidad',
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _priceCtrl,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  style: const TextStyle(fontSize: 18),
                  decoration: const InputDecoration(
                    labelText: 'Precio de venta por unidad (Bs)',
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 12),
                Text(
                  'Total a cobrar: Bs ${_revenue.toStringAsFixed(2)}',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                ErrorBanner(message: _error),
                const SizedBox(height: 16),
                SizedBox(
                  height: 52,
                  child: FilledButton(
                    onPressed: (_submitting || _productId == null)
                        ? null
                        : _submit,
                    child: Text(
                      _submitting ? 'Registrando…' : 'Registrar venta',
                      style: const TextStyle(fontSize: 16),
                    ),
                  ),
                ),
                if (_result != null) ...[
                  const SizedBox(height: 20),
                  PopIn(
                    child: Card(
                      color: context.appColors.success.withValues(alpha: 0.12),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Venta registrada',
                              style: TextStyle(
                                color: context.appColors.success,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text('Cantidad: ${_result!.quantity}'),
                            Text(
                              'Precio de venta: Bs ${_result!.salePricePerUnit}',
                            ),
                            Text(
                              'Costo (snapshot): Bs ${_result!.costPerUnitSnapshot}',
                            ),
                            Text('Ingreso total: Bs ${_result!.revenue}'),
                            Text(
                              'Ganancia real: Bs ${_result!.realProfit} (${_result!.realMarginPercent}%)',
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
