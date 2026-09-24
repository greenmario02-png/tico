import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/api_client.dart';
import '../../api/endpoints.dart';
import '../../models/models.dart';
import '../../state/auth_state.dart';
import '../../widgets/error_banner.dart';

const _baseUnits = [
  {'value': 'g', 'label': 'Gramos (g)'},
  {'value': 'ml', 'label': 'Mililitros (ml)'},
  {'value': 'pieza', 'label': 'Pieza'},
];

/// Crear/editar ingrediente (SDD-08 §2). categoryId/supplierId son
/// selectores opcionales de solo lectura sobre /api/categories y
/// /api/suppliers (SDD-05 §4-5) — crear categorías/proveedores nuevos es
/// tarea del admin en el web app, no de esta pantalla (alcance móvil
/// intencionalmente chico).
class IngredientFormScreen extends StatefulWidget {
  final Ingredient? ingredient;
  const IngredientFormScreen({super.key, this.ingredient});

  @override
  State<IngredientFormScreen> createState() => _IngredientFormScreenState();
}

class _IngredientFormScreenState extends State<IngredientFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _nameCtrl = TextEditingController(text: widget.ingredient?.name ?? '');
  late final _priceCtrl = TextEditingController(text: widget.ingredient?.currentPricePerBaseUnit ?? '');
  late final _stockCtrl = TextEditingController(text: widget.ingredient?.currentStock ?? '0');
  late final _minStockCtrl = TextEditingController(text: widget.ingredient?.minStock ?? '0');
  String _baseUnit = 'g';
  String? _categoryId;
  String? _supplierId;
  List<Category> _categories = [];
  List<Supplier> _suppliers = [];
  bool _loadingOptions = true;
  bool _submitting = false;
  String? _error;

  bool get _isEdit => widget.ingredient != null;

  @override
  void initState() {
    super.initState();
    if (widget.ingredient != null) {
      _baseUnit = widget.ingredient!.baseUnit;
      _categoryId = widget.ingredient!.categoryId;
      _supplierId = widget.ingredient!.supplierId;
    }
    _loadOptions();
  }

  Future<void> _loadOptions() async {
    try {
      final client = context.read<AuthState>().client;
      final categories = await CategoriesApi(client).list(kind: 'ingrediente');
      final suppliers = await SuppliersApi(client).list();
      if (mounted) {
        setState(() {
          _categories = categories;
          _suppliers = suppliers;
          _loadingOptions = false;
        });
      }
    } catch (e) {
      // Los endpoints de categorías/proveedores pueden todavía no estar
      // desplegados; el formulario sigue funcionando sin esos selectores.
      if (mounted) setState(() => _loadingOptions = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final api = IngredientsApi(context.read<AuthState>().client);
      if (_isEdit) {
        await api.update(widget.ingredient!.id, {
          'name': _nameCtrl.text,
          'baseUnit': _baseUnit,
          'minStock': _minStockCtrl.text,
          if (_categoryId != null) 'categoryId': _categoryId,
          if (_supplierId != null) 'supplierId': _supplierId,
        });
      } else {
        await api.create({
          'name': _nameCtrl.text,
          'baseUnit': _baseUnit,
          'initialPricePerBaseUnit': _priceCtrl.text,
          'currentStock': _stockCtrl.text,
          'minStock': _minStockCtrl.text,
          if (_categoryId != null) 'categoryId': _categoryId,
          if (_supplierId != null) 'supplierId': _supplierId,
        });
      }
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isEdit ? 'Editar ingrediente' : 'Nuevo ingrediente')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(labelText: 'Nombre', border: OutlineInputBorder()),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Ingresa un nombre' : null,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _baseUnit,
              decoration: const InputDecoration(labelText: 'Unidad base', border: OutlineInputBorder()),
              items: _baseUnits
                  .map((u) => DropdownMenuItem(value: u['value'], child: Text(u['label']!)))
                  .toList(),
              onChanged: (v) => setState(() => _baseUnit = v ?? 'g'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String?>(
              initialValue: _categoryId,
              decoration: const InputDecoration(labelText: 'Categoría (opcional)', border: OutlineInputBorder()),
              items: [
                const DropdownMenuItem<String?>(value: null, child: Text('Sin categoría')),
                ..._categories.map((c) => DropdownMenuItem<String?>(value: c.id, child: Text(c.name))),
              ],
              onChanged: _loadingOptions ? null : (v) => setState(() => _categoryId = v),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String?>(
              initialValue: _supplierId,
              decoration: const InputDecoration(labelText: 'Proveedor (opcional)', border: OutlineInputBorder()),
              items: [
                const DropdownMenuItem<String?>(value: null, child: Text('Sin proveedor')),
                ..._suppliers.map((s) => DropdownMenuItem<String?>(value: s.id, child: Text(s.name))),
              ],
              onChanged: _loadingOptions ? null : (v) => setState(() => _supplierId = v),
            ),
            if (!_isEdit) ...[
              const SizedBox(height: 12),
              TextFormField(
                controller: _priceCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Precio inicial por unidad base (Bs)', border: OutlineInputBorder()),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Ingresa un precio' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _stockCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Stock inicial', border: OutlineInputBorder()),
              ),
            ],
            const SizedBox(height: 12),
            TextFormField(
              controller: _minStockCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Stock mínimo (para alertas)', border: OutlineInputBorder()),
            ),
            ErrorBanner(message: _error),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: Text(_submitting ? 'Guardando…' : (_isEdit ? 'Guardar cambios' : 'Crear ingrediente')),
            ),
          ],
        ),
      ),
    );
  }
}
