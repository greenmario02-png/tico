import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/endpoints.dart';
import '../../models/models.dart';
import '../../state/auth_state.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/empty_state.dart';
import '../../theme/app_theme.dart';
import 'ingredient_detail_screen.dart';
import 'ingredient_form_screen.dart';

/// SDD-08 §2 — listado de ingredientes con búsqueda. CRUD completo
/// (crear/editar/desactivar) solo disponible para admin/dueño, igual que
/// en el backend (requireRole("admin","dueño") en ingredients.ts).
class IngredientsListScreen extends StatefulWidget {
  const IngredientsListScreen({super.key});

  @override
  State<IngredientsListScreen> createState() => _IngredientsListScreenState();
}

class _IngredientsListScreenState extends State<IngredientsListScreen> {
  final _searchCtrl = TextEditingController();
  List<Ingredient>? _all;
  List<Ingredient> _filtered = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final api = IngredientsApi(context.read<AuthState>().client);
      final items = await api.listAllActive();
      items.sort((a, b) => a.name.compareTo(b.name));
      if (mounted) {
        setState(() {
          _all = items;
          _applyFilter();
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  void _applyFilter() {
    final q = _searchCtrl.text.trim().toLowerCase();
    final all = _all ?? [];
    _filtered = q.isEmpty ? all : all.where((i) => i.name.toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final role = context.watch<AuthState>().user?.role;
    final canEdit = role == 'admin' || role == 'dueño';
    return Scaffold(
      appBar: AppBar(title: const Text('Ingredientes')),
      drawer: const AppDrawer(),
      floatingActionButton: canEdit
          ? FloatingActionButton(
              onPressed: () async {
                final created = await Navigator.of(context)
                    .push<bool>(MaterialPageRoute(builder: (_) => const IngredientFormScreen()));
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
                  hintText: 'Buscar ingrediente…',
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
                          title: 'No se encontraron ingredientes',
                          message: 'Prueba con otra búsqueda o agrega un ingrediente nuevo.',
                          illustration: EmptyIllustration.shelf,
                        )
                      : ListView.separated(
                          itemCount: _filtered.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, i) {
                            final ing = _filtered[i];
                            return ListTile(
                              title: Text(ing.name),
                              subtitle: Text(
                                  '${ing.categoryName ?? "Sin categoría"} · Bs ${ing.currentPricePerBaseUnit ?? "-"} / ${ing.baseUnit}'),
                              trailing: Chip(
                                label: Text('${ing.currentStock} ${ing.baseUnit}'),
                                backgroundColor:
                                    ing.isBelowMin ? context.appColors.warning.withValues(alpha: 0.18) : null,
                                labelStyle: ing.isBelowMin
                                    ? TextStyle(color: context.appColors.warningForeground)
                                    : null,
                              ),
                              onTap: () async {
                                await Navigator.of(context)
                                    .push(MaterialPageRoute(builder: (_) => IngredientDetailScreen(ingredientId: ing.id)));
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
