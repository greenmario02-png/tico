import 'package:flutter/material.dart';
import '../widgets/exchange_rate_card.dart';
import 'package:provider/provider.dart';
import '../api/endpoints.dart';
import '../models/models.dart';
import '../state/auth_state.dart';
import '../widgets/app_drawer.dart';
import '../widgets/empty_state.dart';
import '../widgets/motion.dart';
import '../theme/app_theme.dart';
import 'ingredients/ingredients_list_screen.dart';
import 'recipes/recipes_list_screen.dart';
import 'batches/produce_batch_screen.dart';
import 'sales/register_sale_screen.dart';
import 'reports/reports_screen.dart';
import 'calculator/cost_calculator_screen.dart';

class _Shortcut {
  final String title;
  final String description;
  final IconData icon;
  final WidgetBuilder builder;
  final bool big;
  const _Shortcut(this.title, this.description, this.icon, this.builder, {this.big = false});
}

/// SDD-08 §8 — un solo dashboard con mapeo rol -> tarjetas, igual de
/// simple que app/web/src/pages/DashboardPage.tsx (instrucción explícita
/// del usuario de no sobre-construir esto con pantallas separadas por rol).
///
/// operario: accesos grandes a Producir Lote / Registrar Venta (sus
/// acciones diarias, SDD-08 §0.2) + alertas de stock bajo.
/// admin: Ingredientes/Recetas + alertas de stock bajo.
/// dueño: Reportes + resumen de rentabilidad del mes + lo mismo que admin.
/// Expuesto (sin '_') para poder verificar en un widget test que los 3
/// roles (SDD-11 §2 / 01-PROJECT_SPEC.md §4) reciben efectivamente
/// distintos accesos rápidos en el dashboard.
List<String> shortcutTitlesForRole(String role) =>
    (shortcutsByRole[role] ?? []).map((s) => s.title).toList();

final Map<String, List<_Shortcut>> shortcutsByRole = {
  'admin': [
    _Shortcut('Ingredientes', 'Ver y editar ingredientes, precios y stock.', Icons.egg_alt,
        (_) => const IngredientsListScreen()),
    _Shortcut('Recetas', 'Crear y editar recetas y sub-recetas.', Icons.menu_book, (_) => const RecipesListScreen()),
    _Shortcut('Calculadora de Costos', 'Explora el costo de cualquier receta sin producir nada.', Icons.calculate,
        (_) => const CostCalculatorScreen()),
    _Shortcut('Producir Lote', 'Registrar una nueva producción.', Icons.local_fire_department,
        (_) => const ProduceBatchScreen()),
    _Shortcut('Registrar Venta', 'Registrar una venta de un producto.', Icons.point_of_sale,
        (_) => const RegisterSaleScreen()),
  ],
  'operario': [
    _Shortcut('Producir Lote', 'Registrar una nueva producción.', Icons.local_fire_department,
        (_) => const ProduceBatchScreen(),
        big: true),
    _Shortcut('Registrar Venta', 'Registrar una venta de un producto.', Icons.point_of_sale,
        (_) => const RegisterSaleScreen(),
        big: true),
  ],
  'dueño': [
    _Shortcut('Reportes', 'Rentabilidad, producción y costos.', Icons.analytics, (_) => const ReportsScreen()),
    _Shortcut('Ingredientes', 'Ver y editar ingredientes, precios y stock.', Icons.egg_alt,
        (_) => const IngredientsListScreen()),
    _Shortcut('Recetas', 'Crear y editar recetas y sub-recetas.', Icons.menu_book, (_) => const RecipesListScreen()),
    _Shortcut('Calculadora de Costos', 'Explora el costo de cualquier receta sin producir nada.', Icons.calculate,
        (_) => const CostCalculatorScreen()),
    _Shortcut('Producir Lote', 'Registrar una nueva producción.', Icons.local_fire_department,
        (_) => const ProduceBatchScreen()),
    _Shortcut('Registrar Venta', 'Registrar una venta de un producto.', Icons.point_of_sale,
        (_) => const RegisterSaleScreen()),
  ],
};

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List<Ingredient>? _lowStock;
  ProfitabilityReport? _profitability;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  void _load() {
    final auth = context.read<AuthState>();
    final user = auth.user;
    if (user == null) return;
    if (user.role == 'admin' || user.role == 'operario') {
      IngredientsApi(auth.client).lowStock().then((r) {
        if (mounted) setState(() => _lowStock = r.data);
      }).catchError((_) {
        if (mounted) setState(() => _lowStock = []);
      });
    }
    if (user.role == 'dueño') {
      final now = DateTime.now();
      final from = DateTime(now.year, now.month, 1);
      final to = DateTime(now.year, now.month, now.day + 1);
      String fmt(DateTime d) => d.toIso8601String().substring(0, 10);
      ReportsApi(auth.client).profitability(from: fmt(from), to: fmt(to)).then((r) {
        if (mounted) setState(() => _profitability = r);
      }).catchError((_) {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final user = auth.user;
    if (user == null) return const SizedBox.shrink();
    final shortcuts = shortcutsByRole[user.role] ?? [];
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Inicio')),
      drawer: const AppDrawer(),
      body: RefreshIndicator(
        onRefresh: () async => _load(),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Hola, ${user.name.split(' ').first}', style: Theme.of(context).textTheme.headlineSmall),
            Text('Rol: ${user.role}', style: TextStyle(color: scheme.onSurfaceVariant)),
            const SizedBox(height: 16),
            const ExchangeRateCard(),
            const SizedBox(height: 16),
            if (user.role == 'dueño') _profitabilityCard(),
            if (user.role == 'dueño') const SizedBox(height: 16),
            GridView.count(
              crossAxisCount: user.role == 'operario' ? 1 : 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              // Antes: 2.6 / 1.3. A esa relación de aspecto, la Column de
              // _ShortcutCard (icono + título + hasta 3 líneas de
              // descripción, padding 16) no entra en la celda a densidades
              // más altas / pantallas más chicas que las usadas al armar
              // esto (Nexus 5 real: "BOTTOM OVERFLOWED BY 15/32 PIXELS").
              // Se le da más alto a la celda y además el propio contenido
              // de la tarjeta ahora se defiende con Flexible (ver abajo),
              // así que esto no puede volver a pasar aunque cambie el
              // texto o se agregue un accesor más.
              childAspectRatio: user.role == 'operario' ? 2.2 : 1.0,
              children: [
                for (var i = 0; i < shortcuts.length; i++)
                  FadeSlideIn(
                    delay: Duration(milliseconds: 70 * i),
                    child: PressScale(child: _ShortcutCard(shortcut: shortcuts[i])),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            if (user.role == 'admin' || user.role == 'operario') _lowStockCard(),
          ],
        ),
      ),
    );
  }

  Widget _profitabilityCard() {
    final p = _profitability;
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Resumen del mes', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (p == null)
              Text('Cargando…', style: TextStyle(color: scheme.onSurfaceVariant))
            else
              Wrap(
                spacing: 24,
                runSpacing: 8,
                children: [
                  _metric('Ingresos', 'Bs ${p.totals.totalRevenue}'),
                  _metric('Costo', 'Bs ${p.totals.totalCost}'),
                  _metric('Ganancia real', 'Bs ${p.totals.totalRealProfit}'),
                  _metric('Margen real', '${p.totals.realMarginPercent}%'),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _metric(String label, String value) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(), style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)),
        Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
      ],
    );
  }

  Widget _lowStockCard() {
    final scheme = Theme.of(context).colorScheme;
    final appColors = context.appColors;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Alertas de stock bajo', style: Theme.of(context).textTheme.titleMedium),
            Text('Ingredientes por debajo de su nivel mínimo configurado.',
                style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12)),
            const SizedBox(height: 8),
            if (_lowStock == null)
              Text('Cargando…', style: TextStyle(color: scheme.onSurfaceVariant))
            else if (_lowStock!.isEmpty)
              const EmptyState(
                title: 'Todo el stock está en orden',
                message: 'Ningún ingrediente está por debajo de su mínimo.',
                illustration: EmptyIllustration.shelf,
                compact: true,
              )
            else
              ..._lowStock!.map((ing) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(child: Text(ing.name)),
                        Chip(
                          label: Text('${ing.currentStock} / mín ${ing.minStock} ${ing.baseUnit}'),
                          backgroundColor: appColors.warning.withValues(alpha: 0.18),
                          labelStyle: TextStyle(color: appColors.warningForeground),
                        ),
                      ],
                    ),
                  )),
          ],
        ),
      ),
    );
  }
}

class _ShortcutCard extends StatelessWidget {
  final _Shortcut shortcut;
  const _ShortcutCard({required this.shortcut});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: InkWell(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: shortcut.builder)),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          // La celda del GridView le da a esta Column una altura FIJA (no
          // "lo que necesite"), así que mainAxisSize.min no evita el
          // overflow por sí solo: lo que evita el overflow de verdad es
          // que el texto que puede crecer (la descripción) esté en un
          // Flexible con maxLines + ellipsis, para que en el peor caso
          // (pantalla chica, fuente grande del sistema) se trunque en vez
          // de desbordar el Card.
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(shortcut.icon, size: shortcut.big ? 32 : 26, color: scheme.primary),
              const SizedBox(height: 6),
              Text(shortcut.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: shortcut.big ? 18 : 15, fontWeight: FontWeight.w600)),
              const SizedBox(height: 3),
              Flexible(
                child: Text(shortcut.description,
                    style: TextStyle(fontSize: 11.5, color: scheme.onSurfaceVariant),
                    maxLines: shortcut.big ? 2 : 3,
                    overflow: TextOverflow.ellipsis),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
