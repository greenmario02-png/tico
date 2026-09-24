import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Estado del tema claro/oscuro, equivalente mobile de
/// `app/web/src/lib/theme-context.tsx`: persiste la preferencia elegida por
/// el usuario (aquí con `shared_preferences`, que es apto para una
/// preferencia de UI no sensible — a diferencia del JWT, que sigue en
/// `flutter_secure_storage`, ver `lib/state/auth_state.dart`) y, si nunca
/// eligió una, sigue el tema del sistema (`ThemeMode.system`) la primera vez
/// que se abre la app.
class ThemeState extends ChangeNotifier {
  static const _prefsKey = 'panaderia-theme';

  ThemeMode _themeMode = ThemeMode.system;
  ThemeMode get themeMode => _themeMode;

  /// Solo tiene sentido cuando `_themeMode != ThemeMode.system`; se usa para
  /// decidir el icono/etiqueta del switch en el drawer sin depender del
  /// brightness resuelto por la plataforma.
  bool get isDark => _themeMode == ThemeMode.dark;

  Future<void> restorePreference() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getString(_prefsKey);
      if (stored == 'light') {
        _themeMode = ThemeMode.light;
      } else if (stored == 'dark') {
        _themeMode = ThemeMode.dark;
      } else {
        _themeMode = ThemeMode.system;
      }
      notifyListeners();
    } catch (_) {
      // shared_preferences puede fallar en algunos entornos de prueba; no es
      // crítico, simplemente nos quedamos con ThemeMode.system.
    }
  }

  Future<void> setTheme(ThemeMode mode) async {
    _themeMode = mode;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      if (mode == ThemeMode.system) {
        await prefs.remove(_prefsKey);
      } else {
        await prefs.setString(_prefsKey, mode == ThemeMode.dark ? 'dark' : 'light');
      }
    } catch (_) {
      // No crítico: la preferencia simplemente no persiste esta sesión.
    }
  }

  /// Alterna entre claro y oscuro (si estaba en "sistema", usa el brightness
  /// actual como punto de partida para decidir hacia dónde alternar).
  Future<void> toggle(Brightness currentPlatformBrightness) async {
    final effectiveIsDark = _themeMode == ThemeMode.system
        ? currentPlatformBrightness == Brightness.dark
        : _themeMode == ThemeMode.dark;
    await setTheme(effectiveIsDark ? ThemeMode.light : ThemeMode.dark);
  }
}
