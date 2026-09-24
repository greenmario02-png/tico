import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/endpoints.dart';
import '../../models/models.dart';
import '../../state/auth_state.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/empty_state.dart';
import 'recipe_detail_screen.dart';
import 'recipe_form_screen.dart';

/// SDD-08 §4 — listado de recetas. Crear/editar/eliminar solo admin/dueño.
class RecipesListScreen extends StatefulWidget {
  const RecipesListScreen({super.key});

  @override
  State<RecipesListScreen> createState() => _RecipesListScreenState();
}

class _RecipesListScreenState extends State<RecipesListScreen> {
  final _searchCtrl = TextEditingController();
  List<Recipe>? _all;
  List<Recipe> _filtered = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final api = RecipesApi(context.read<AuthState>().client);
      final items = await api.listAll();
      items.sort((a, b) => a.name.compareTo(b.name));
      if (mounted) setState(() {
        _all = items;
        _applyFilter();
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  void _applyFilter() {
    final q = _searchCtrl.text.trim().toLowerCase();
    final all = _all ?? [];
    _filtered = q.isEmpty ? all : all.where((r) => r.name.toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final role = context.watch<AuthState>().user?.role;
    final canEdit = role == 'admin' || role == 'dueño';
    return Scaffold(
      appBar: AppBar(title: const Text('Recetas')),
      drawer: const AppDrawer(),
      floatingActionButton: canEdit
          ? FloatingActionButton(
              onPressed: () async {
                final created = await Navigator.of(context)
                    .push<bool>(MaterialPageRoute(builder: (_) => const RecipeFormScreen()));
                if (created == true) _load();
              },
              child: const Icon(Icons.add),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: _load,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                controller: _searchCtrl,
                decoration: const InputDecoration(
                  hintText: 'Buscar receta…',
                  prefixIcon: Icon(Icons.search),
                  border: OutlineInputBorder(),
                ),
                onChanged: (_) => setState(_applyFilter),
              ),
            ),
            if (_error != null) Padding(padding: const EdgeInsets.all(12), child: Text(_error!)),
            Expanded(
              child: _all == null
                  ? const Center(child: CircularProgressIndicator())
                  : _filtered.isEmpty
                      ? const EmptyState(
                          title: 'No se encontraron recetas',
                          message: 'Prueba con otra búsqueda o crea una receta nueva.',
                          illustration: EmptyIllustration.box,
                        )
                      : ListView.separated(
                          itemCount: _filtered.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, i) {
                            final r = _filtered[i];
                            return ListTile(
                              title: Text(r.name),
                              subtitle: Text('Rendimiento: ${r.yieldQuantity} ${r.yieldUnit} · Merma ${r.wastePercent}%'),
                              trailing: const Icon(Icons.chevron_right),
                              onTap: () async {
                                await Navigator.of(context)
                                    .push(MaterialPageRoute(builder: (_) => RecipeDetailScreen(recipeId: r.id)));
                                _load();
                              },
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
