import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/dashboard_screen.dart';
import 'screens/about_screen.dart';
import 'screens/login_screen.dart';
import 'screens/not_found_screen.dart';
import 'state/auth_state.dart';
import 'state/theme_state.dart';
import 'theme/app_theme.dart';

void main() {
  runApp(const PanaderiaApp());
}

class PanaderiaApp extends StatelessWidget {
  const PanaderiaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthState()..restoreSession()),
        // SDD-08 redesign: paridad visual con app/web (ver
        // src/lib/theme-context.tsx) — modo claro/oscuro persistido,
        // por defecto sigue la preferencia del sistema.
        ChangeNotifierProvider(create: (_) => ThemeState()..restorePreference()),
      ],
      child: Consumer<ThemeState>(
        builder: (context, themeState, _) {
          return MaterialApp(
            title: 'Panadería',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.light,
            darkTheme: AppTheme.dark,
            themeMode: themeState.themeMode,
            home: const _AuthGate(),
            routes: {'/acerca-de': (_) => const AboutScreen()},
            // Cualquier ruta con nombre que no exista cae en la pantalla 404.
            onUnknownRoute: (_) => MaterialPageRoute(builder: (_) => const NotFoundScreen()),
          );
        },
      ),
    );
  }
}

/// Punto de entrada único: muestra Login o Dashboard según el estado de
/// sesión (AuthState). restoreSession() intenta reusar el token guardado
/// en flutter_secure_storage antes de forzar un login nuevo.
class _AuthGate extends StatelessWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    if (auth.isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return auth.isAuthenticated ? const DashboardScreen() : const LoginScreen();
  }
}
