import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/endpoints.dart';
import '../models/models.dart';
import 'error_banner.dart';

/// Bottom sheet compacto para crear un ingrediente sin salir del formulario
/// de receta (SDD-08 §4-5: "el usuario nunca debe salir de la pantalla de
/// receta para agregar un ingrediente que falta"). Equivalente móvil de
/// app/web/src/features/ingredients/IngredientFormDialog.tsx.
Future<Ingredient?> showIngredientQuickCreateSheet(BuildContext context, IngredientsApi api, {String? initialName}) {
  return showModalBottomSheet<Ingredient>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
      child: _QuickCreateForm(api: api, initialName: initialName),
    ),
  );
}

class _QuickCreateForm extends StatefulWidget {
  final IngredientsApi api;
  final String? initialName;
  const _QuickCreateForm({required this.api, this.initialName});

  @override
  State<_QuickCreateForm> createState() => _QuickCreateFormState();
}

class _QuickCreateFormState extends State<_QuickCreateForm> {
  late final _nameCtrl = TextEditingController(text: widget.initialName ?? '');
  final _priceCtrl = TextEditingController();
  String _baseUnit = 'g';
  bool _submitting = false;
  String? _error;

  Future<void> _submit() async {
    if (_nameCtrl.text.trim().isEmpty || _priceCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Completa el nombre y el precio.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final created = await widget.api.create({
        'name': _nameCtrl.text,
        'baseUnit': _baseUnit,
        'initialPricePerBaseUnit': _priceCtrl.text,
        'currentStock': '0',
        'minStock': '0',
      });
      if (mounted) Navigator.of(context).pop(created);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Crear ingrediente nuevo', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Nombre', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _baseUnit,
            decoration: const InputDecoration(labelText: 'Unidad base', border: OutlineInputBorder()),
            items: const [
              DropdownMenuItem(value: 'g', child: Text('Gramos (g)')),
              DropdownMenuItem(value: 'ml', child: Text('Mililitros (ml)')),
              DropdownMenuItem(value: 'pieza', child: Text('Pieza')),
            ],
            onChanged: (v) => setState(() => _baseUnit = v ?? 'g'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _priceCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Precio inicial por unidad base (Bs)', border: OutlineInputBorder()),
          ),
          ErrorBanner(message: _error),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: Text(_submitting ? 'Creando…' : 'Crear ingrediente'),
          ),
        ],
      ),
    );
  }
}
