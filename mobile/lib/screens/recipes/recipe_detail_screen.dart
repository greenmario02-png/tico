import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/api_client.dart';
import '../../api/endpoints.dart';
import '../../models/models.dart';
import '../../state/auth_state.dart';
import '../../widgets/error_banner.dart';
import 'recipe_form_screen.dart';

/// SDD-08 §5 — detalle de receta con costo calculado en vivo (llama al
/// endpoint real GET /recipes/:id/cost, nunca recalcula en el cliente) y
/// las líneas de ingredientes/sub-recetas, distinguiendo "(receta)".
class RecipeDetailScreen extends StatefulWidget {
  final String recipeId;
  const RecipeDetailScreen({super.key, required this.recipeId});

  @override
  State<RecipeDetailScreen> createState() => _RecipeDetailScreenState();
}

class _RecipeDetailScreenState extends State<RecipeDetailScreen> {
  Recipe? _recipe;
  RecipeCostPreview? _cost;
  String? _error;

  RecipesApi get _api => RecipesApi(context.read<AuthState>().client);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final recipe = await _api.getById(widget.recipeId);
      final cost = await _api.costPreview(widget.recipeId);
      if (mounted) setState(() {
        _recipe = recipe;
        _cost = cost;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e is ApiException ? e.message : e.toString());
    }
  }

  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Eliminar receta'),
        content: Text('¿Seguro que quieres eliminar "${_recipe!.name}"? Esta acción no se puede deshacer.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Eliminar')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _api.delete(widget.recipeId);
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = context.watch<AuthState>().user?.role;
    final canEdit = role == 'admin' || role == 'dueño';
    final recipe = _recipe;
    return Scaffold(
      appBar: AppBar(
        title: Text(recipe?.name ?? 'Receta'),
        actions: [
          if (canEdit && recipe != null)
            IconButton(
              icon: const Icon(Icons.edit),
              onPressed: () async {
                final updated = await Navigator.of(context)
                    .push<bool>(MaterialPageRoute(builder: (_) => RecipeFormScreen(recipe: recipe)));
                if (updated == true) _load();
              },
            ),
          if (canEdit && recipe != null)
            IconButton(icon: const Icon(Icons.delete_outline), onPressed: _confirmDelete),
        ],
      ),
      body: recipe == null
          ? Center(child: _error != null ? ErrorBanner(message: _error) : const CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) ErrorBanner(message: _error),
                  if (recipe.description != null && recipe.description!.isNotEmpty) Text(recipe.description!),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 16,
                    runSpacing: 8,
                    children: [
                      _stat('Rendimiento', '${recipe.yieldQuantity} ${recipe.yieldUnit}'),
                      _stat('Merma', '${recipe.wastePercent}%'),
                      if (recipe.prepTimeMinutes != null) _stat('Preparación', '${recipe.prepTimeMinutes} min'),
                      if (recipe.bakeTimeMinutes != null) _stat('Horneado', '${recipe.bakeTimeMinutes} min'),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Card(
                    color: Theme.of(context).colorScheme.primaryContainer,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Costo calculado', style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 8),
                          if (_cost != null) ...[
                            Text('Costo total: Bs ${_cost!.totalCost}'),
                            Text('Costo por unidad: Bs ${_cost!.costPerUnit}'),
                          ] else
                            const Text('Calculando…'),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text('Ingredientes', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  if (recipe.ingredients == null || recipe.ingredients!.isEmpty)
                    const Text('Esta receta no tiene ingredientes cargados.')
                  else
                    ...recipe.ingredients!.map((line) => ListTile(
                          dense: true,
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(line.type == 'sub_recipe' ? Icons.menu_book : Icons.egg_alt, size: 20),
                          title: Text(line.type == 'sub_recipe'
                              ? '${line.subRecipeName ?? "?"} (receta)'
                              : (line.ingredientName ?? '?')),
                          trailing: Text('${line.quantity} ${line.unit}'),
                        )),
                  if (recipe.instructions != null && recipe.instructions!.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text('Instrucciones', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(recipe.instructions!),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _stat(String label, String value) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      );
}
