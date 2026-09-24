import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/api_client.dart';
import '../../api/endpoints.dart';
import '../../models/models.dart';
import '../../state/auth_state.dart';
import '../../widgets/error_banner.dart';
import '../../widgets/ingredient_quick_create_sheet.dart';

const _yieldUnits = ['pieza', 'docena'];
const _ingredientUnits = ['g', 'kg', 'ml', 'l', 'pieza', 'docena', 'cucharada', 'cucharadita', 'taza'];

class _Line {
  String kind; // ingredient | sub_recipe
  String ingredientId;
  String ingredientName;
  String subRecipeId;
  String quantity;
  String unit;
  late final TextEditingController quantityCtrl = TextEditingController(text: quantity);
  _Line({this.kind = 'ingredient', this.ingredientId = '', this.ingredientName = '', this.subRecipeId = '', this.quantity = '', this.unit = 'g'});

  factory _Line.fromExisting(RecipeIngredientLine l) => _Line(
        kind: l.type,
        ingredientId: l.ingredientId ?? '',
        ingredientName: l.ingredientName ?? '',
        subRecipeId: l.subRecipeId ?? '',
        quantity: l.quantity,
        unit: l.unit,
      );
}

/// SDD-08 §4-5 — crear/editar receta con líneas de ingrediente o sub-receta
/// ("(receta)"), y creación inline de ingrediente nuevo sin salir de esta
/// pantalla (equivalente móvil de RecipeForm.tsx + IngredientPicker.tsx).
class RecipeFormScreen extends StatefulWidget {
  final Recipe? recipe;
  const RecipeFormScreen({super.key, this.recipe});

  @override
  State<RecipeFormScreen> createState() => _RecipeFormScreenState();
}

class _RecipeFormScreenState extends State<RecipeFormScreen> {
  bool get _isEdit => widget.recipe != null;

  late final _nameCtrl = TextEditingController(text: widget.recipe?.name ?? '');
  late final _descCtrl = TextEditingController(text: widget.recipe?.description ?? '');
  late final _yieldCtrl = TextEditingController(text: widget.recipe?.yieldQuantity ?? '1');
  late final _wasteCtrl = TextEditingController(text: widget.recipe?.wastePercent ?? '0');
  late final _prepCtrl = TextEditingController(text: widget.recipe?.prepTimeMinutes?.toString() ?? '');
  late final _bakeCtrl = TextEditingController(text: widget.recipe?.bakeTimeMinutes?.toString() ?? '');
  late final _instrCtrl = TextEditingController(text: widget.recipe?.instructions ?? '');
  String _yieldUnit = 'pieza';
  String? _categoryId;

  late List<_Line> _lines =
      widget.recipe?.ingredients?.map(_Line.fromExisting).toList() ?? [];

  List<Ingredient> _ingredients = [];
  List<Recipe> _recipes = [];
  List<Category> _categories = [];
  bool _loadingOptions = true;
  bool _submitting = false;
  String? _error;

  IngredientsApi get _ingredientsApi => IngredientsApi(context.read<AuthState>().client);
  RecipesApi get _recipesApi => RecipesApi(context.read<AuthState>().client);

  @override
  void initState() {
    super.initState();
    if (widget.recipe != null) {
      _yieldUnit = widget.recipe!.yieldUnit;
      _categoryId = widget.recipe!.categoryId;
    }
    _loadOptions();
  }

  Future<void> _loadOptions() async {
    try {
      final ingredients = await _ingredientsApi.listAllActive();
      final recipes = await _recipesApi.listAll();
      // Las categorías son opcionales y este endpoint puede no estar
      // desplegado todavía (ver nota de alcance en ingredient_form_screen.dart);
      // si falla, la receta sigue creándose/editándose sin selector.
      List<Category> categories = [];
      try {
        categories = await CategoriesApi(context.read<AuthState>().client).list(kind: 'receta');
      } catch (_) {}
      if (mounted) setState(() {
        _ingredients = ingredients;
        _recipes = recipes.where((r) => r.id != widget.recipe?.id).toList();
        _categories = categories;
        _loadingOptions = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loadingOptions = false);
    }
  }

  Future<void> _submit() async {
    if (_nameCtrl.text.trim().isEmpty || _yieldCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Completa el nombre y el rendimiento.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final body = {
      'name': _nameCtrl.text,
      'description': _descCtrl.text.isEmpty ? null : _descCtrl.text,
      if (_categoryId != null) 'categoryId': _categoryId,
      'yieldQuantity': _yieldCtrl.text,
      'yieldUnit': _yieldUnit,
      'wastePercent': _wasteCtrl.text,
      'prepTimeMinutes': _prepCtrl.text.isEmpty ? null : int.tryParse(_prepCtrl.text),
      'bakeTimeMinutes': _bakeCtrl.text.isEmpty ? null : int.tryParse(_bakeCtrl.text),
      'instructions': _instrCtrl.text.isEmpty ? null : _instrCtrl.text,
      'ingredients': _lines
          .map((l) => {
                'ingredientId': l.kind == 'ingredient' && l.ingredientId.isNotEmpty ? l.ingredientId : null,
                'subRecipeId': l.kind == 'sub_recipe' && l.subRecipeId.isNotEmpty ? l.subRecipeId : null,
                'quantity': l.quantity,
                'unit': l.unit,
              })
          .toList(),
    };
    try {
      if (_isEdit) {
        await _recipesApi.update(widget.recipe!.id, body);
      } else {
        await _recipesApi.create(body);
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
      appBar: AppBar(title: Text(_isEdit ? 'Editar receta' : 'Nueva receta')),
      body: _loadingOptions
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Nombre de la receta', border: OutlineInputBorder())),
                const SizedBox(height: 12),
                DropdownButtonFormField<String?>(
                  initialValue: _categoryId,
                  decoration: const InputDecoration(labelText: 'Categoría (opcional)', border: OutlineInputBorder()),
                  items: [
                    const DropdownMenuItem<String?>(value: null, child: Text('Sin categoría')),
                    ..._categories.map((c) => DropdownMenuItem<String?>(value: c.id, child: Text(c.name))),
                  ],
                  onChanged: (v) => setState(() => _categoryId = v),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _yieldCtrl,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(labelText: 'Rendimiento', border: OutlineInputBorder()),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _yieldUnit,
                        decoration: const InputDecoration(labelText: 'Unidad', border: OutlineInputBorder()),
                        items: _yieldUnits.map((u) => DropdownMenuItem(value: u, child: Text(u))).toList(),
                        onChanged: (v) => setState(() => _yieldUnit = v ?? 'pieza'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _wasteCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Merma (%)', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _prepCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Prep. (min)', border: OutlineInputBorder()),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _bakeCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Horneado (min)', border: OutlineInputBorder()),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _descCtrl,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: 'Descripción', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _instrCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Instrucciones', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Ingredientes de la receta', style: Theme.of(context).textTheme.titleMedium),
                    Row(
                      children: [
                        TextButton(
                          onPressed: () => setState(() => _lines.add(_Line(kind: 'ingredient'))),
                          child: const Text('+ Ingrediente'),
                        ),
                        TextButton(
                          onPressed: () => setState(() => _lines.add(_Line(kind: 'sub_recipe'))),
                          child: const Text('+ Sub-receta'),
                        ),
                      ],
                    ),
                  ],
                ),
                if (_lines.isEmpty)
                  Text('Agrega al menos un ingrediente o sub-receta.',
                      style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                ..._lines.asMap().entries.map((entry) => _lineCard(entry.key, entry.value)),
                ErrorBanner(message: _error),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _submitting ? null : _submit,
                  child: Text(_submitting ? 'Guardando…' : (_isEdit ? 'Guardar cambios' : 'Crear receta')),
                ),
              ],
            ),
    );
  }

  Widget _lineCard(int index, _Line line) {
    return Card(
      margin: const EdgeInsets.only(top: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (line.kind == 'ingredient')
              _ingredientField(line)
            else
              DropdownButtonFormField<String>(
                initialValue: line.subRecipeId.isEmpty ? null : line.subRecipeId,
                decoration: const InputDecoration(labelText: 'Sub-receta (receta)', border: OutlineInputBorder()),
                items: _recipes.map((r) => DropdownMenuItem(value: r.id, child: Text('${r.name} (receta)'))).toList(),
                onChanged: (v) => setState(() => line.subRecipeId = v ?? ''),
              ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: line.quantityCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Cantidad', border: OutlineInputBorder()),
                    onChanged: (v) => line.quantity = v,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: line.unit,
                    decoration: const InputDecoration(labelText: 'Unidad', border: OutlineInputBorder()),
                    items: _ingredientUnits.map((u) => DropdownMenuItem(value: u, child: Text(u))).toList(),
                    onChanged: (v) => setState(() => line.unit = v ?? 'g'),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () => setState(() => _lines.removeAt(index)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _ingredientField(_Line line) {
    return Row(
      children: [
        Expanded(
          child: DropdownButtonFormField<String>(
            initialValue: line.ingredientId.isEmpty ? null : line.ingredientId,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Ingrediente', border: OutlineInputBorder()),
            items: _ingredients
                .map((i) => DropdownMenuItem(value: i.id, child: Text('${i.name} (${i.baseUnit})')))
                .toList(),
            onChanged: (v) => setState(() {
              line.ingredientId = v ?? '';
              line.ingredientName = _ingredients.firstWhere((i) => i.id == v, orElse: () => _ingredients.first).name;
            }),
          ),
        ),
        IconButton(
          tooltip: 'Crear ingrediente nuevo',
          icon: const Icon(Icons.add_circle_outline),
          onPressed: () async {
            final created = await showIngredientQuickCreateSheet(context, _ingredientsApi);
            if (created != null) {
              setState(() {
                _ingredients.add(created);
                line.ingredientId = created.id;
                line.ingredientName = created.name;
              });
            }
          },
        ),
      ],
    );
  }
}
