import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/auth_state.dart';
import '../state/theme_state.dart';
import '../theme/app_theme.dart';
import '../screens/dashboard_screen.dart';
import '../screens/ingredients/ingredients_list_screen.dart';
import '../screens/recipes/recipes_list_screen.dart';
import '../screens/batches/produce_batch_screen.dart';
import '../screens/sales/register_sale_screen.dart';
import '../screens/reports/reports_screen.dart';
import '../screens/calculator/cost_calculator_screen.dart';

class _NavItem {
  final String title;
  final IconData icon;
  final WidgetBuilder builder;
  const _NavItem(this.title, this.icon, this.builder);
}

/// Navegación lateral con roles (SDD-11 §2 / 01-PROJECT_SPEC.md §4): cada
/// rol ve solo los accesos que puede usar. El backend igual reforzará el
/// permiso real en cada endpoint — esto es solo para no confundir al
/// usuario con botones que después le van a fallar por 403.
List<_NavItem> _itemsForRole(String role) {
  final items = <_NavItem>[
    _NavItem('Inicio', Icons.home, (_) => const DashboardScreen()),
  ];
  if (role == 'admin' || role == 'dueño') {
    items.add(_NavItem('Ingredientes', Icons.egg_alt, (_) => const IngredientsListScreen()));
    items.add(_NavItem('Recetas', Icons.menu_book, (_) => const RecipesListScreen()));
    // Mismo rol-gating que "Recetas": la calculadora es de solo lectura
    // pero opera sobre datos de recetas/productos que operario no ve.
    items.add(_NavItem('Calculadora de Costos', Icons.calculate, (_) => const CostCalculatorScreen()));
  }
  items.add(_NavItem('Producir Lote', Icons.local_fire_department, (_) => const ProduceBatchScreen()));
  items.add(_NavItem('Registrar Venta', Icons.point_of_sale, (_) => const RegisterSaleScreen()));
  // "monitoring" en app/web/src/components/layout/AppShell.tsx (Material
  // Symbols) -> Icons.analytics en Material Icons clásico (mismo nombre,
  // variante distinta del mismo set de Google).
  if (role == 'dueño') {
    items.add(_NavItem('Reportes', Icons.analytics, (_) => const ReportsScreen()));
  }
  return items;
}

/// Equivalente mobile de la barra lateral de app/web
/// (`AppShell.tsx`): incluye el mismo fondo oscuro/cálido fijo
/// (`AppColors.sidebar*`, igual en ambos temas, ver `theme/app_theme.dart`),
/// navegación filtrada por rol, selector de tema y datos del usuario +
/// cerrar sesión al pie. Solo re-tematizado — la navegación y el filtrado
/// por rol no cambian.
class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final themeState = context.watch<ThemeState>();
    final user = auth.user;
    final items = _itemsForRole(user?.role ?? '');
    final sidebar = context.appColors;
    final platformBrightness = MediaQuery.platformBrightnessOf(context);
    final resolvedIsDark = themeState.themeMode == ThemeMode.system
        ? platformBrightness == Brightness.dark
        : themeState.isDark;

    return Drawer(
      backgroundColor: sidebar.sidebar,
      child: SafeArea(
        child: Column(
          children: [
            // Antes: DrawerHeader (impone un alto mínimo fijo grande, pensado
            // para un account switcher tipo Gmail). En un Nexus 5 real esto
            // por sí solo se comía tanto alto disponible que la lista de
            // navegación de abajo (Expanded) quedaba con tan poco espacio
            // que el último item terminaba pegado/superpuesto al pie fijo
            // (toggle de tema + usuario + logout). Un Container compacto de
            // alto propio (no impuesto por el framework) le devuelve ese
            // espacio a la navegación, que es lo que de verdad necesita
            // crecer cuando se agregan más accesos (como Calculadora de
            // Costos).
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
              color: sidebar.sidebar,
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.bakery_dining, color: Theme.of(context).colorScheme.onPrimary),
                  ),
                  const SizedBox(width: 12),
                  Text('Panadería',
                      style: TextStyle(
                        color: sidebar.sidebarForeground,
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      )),
                ],
              ),
            ),
            Divider(height: 1, color: sidebar.sidebarBorder),
            // Expanded (no shrinkWrap) es lo que hace que esta lista se
            // desplace de forma INDEPENDIENTE del pie fijo de abajo: sin
            // importar cuántos items de navegación haya (este archivo agrega
            // uno más, "Calculadora de Costos"), el pie nunca se mueve ni se
            // superpone, la lista simplemente scrollea.
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                children: items
                    .map((it) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 1),
                          child: ListTile(
                            dense: true,
                            visualDensity: VisualDensity.compact,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            leading: Icon(it.icon, color: sidebar.sidebarMuted),
                            title: Text(it.title, style: TextStyle(color: sidebar.sidebarMuted)),
                            onTap: () {
                              Navigator.pop(context);
                              Navigator.of(context).pushReplacement(MaterialPageRoute(builder: it.builder));
                            },
                          ),
                        ))
                    .toList(),
              ),
            ),
            Divider(height: 1, color: sidebar.sidebarBorder),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ListTile(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    leading: Icon(
                      resolvedIsDark ? Icons.light_mode : Icons.dark_mode,
                      color: sidebar.sidebarMuted,
                    ),
                    title: Text(
                      resolvedIsDark ? 'Modo claro' : 'Modo oscuro',
                      style: TextStyle(color: sidebar.sidebarMuted),
                    ),
                    onTap: () => themeState.toggle(platformBrightness),
                  ),
                  Container(
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: sidebar.sidebarAccent.withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 16,
                          backgroundColor: sidebar.sidebarAccent,
                          child: Icon(Icons.person, size: 18, color: sidebar.sidebarAccentForeground),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(user?.name ?? '',
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(color: sidebar.sidebarForeground, fontWeight: FontWeight.w500)),
                              Text(user?.role ?? '',
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(color: sidebar.sidebarMuted, fontSize: 12)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  OutlinedButton.icon(
                    onPressed: () async {
                      Navigator.pop(context);
                      await context.read<AuthState>().logout();
                    },
                    icon: Icon(Icons.logout, size: 18, color: sidebar.sidebarForeground),
                    label: Text('Cerrar sesión', style: TextStyle(color: sidebar.sidebarForeground)),
                    style: OutlinedButton.styleFrom(side: BorderSide(color: sidebar.sidebarBorder)),
                  ),
                  ListTile(
                    dense: true,
                    visualDensity: VisualDensity.compact,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    leading: Icon(Icons.info_outline, color: sidebar.sidebarMuted),
                    title: Text('Acerca de', style: TextStyle(color: sidebar.sidebarMuted)),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.of(context).pushNamed('/acerca-de');
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
