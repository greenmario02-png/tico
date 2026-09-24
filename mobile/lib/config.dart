import 'package:flutter/foundation.dart' show kIsWeb, defaultTargetPlatform, TargetPlatform;

/// Base URL del backend real (app/backend). Se puede sobreescribir con
/// --dart-define=API_BASE_URL=http://host:3000/api al compilar/correr.
///
/// Por defecto:
/// - Web/Windows/desktop: localhost, porque comparten el mismo host que el
///   backend cuando se corre todo en la misma máquina de desarrollo.
/// - Android (emulador): 10.0.2.2 es el alias que el emulador de Android usa
///   para apuntar al "localhost" de la máquina anfitriona.
String get apiBaseUrl {
  const override = String.fromEnvironment('API_BASE_URL');
  if (override.isNotEmpty) return override;
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
    return 'http://10.0.2.2:3000/api';
  }
  return 'http://localhost:3000/api';
}
