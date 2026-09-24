import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../api/api_client.dart';
import '../api/endpoints.dart';
import '../models/models.dart';

/// Estado de autenticación de toda la app (Provider + ChangeNotifier).
///
/// Elegido en vez de Riverpod/Bloc porque el alcance de esta app (login +
/// ~7 pantallas, un solo estado global real: sesión/usuario) no justifica
/// la sobrecarga de generación de código o de un patrón más pesado — un
/// ChangeNotifier expuesto vía provider ya es un patrón estándar de Flutter
/// y mantiene el código legible para este tamaño de proyecto.
///
/// El JWT se guarda con flutter_secure_storage (Keychain/Keystore/DPAPI
/// nativo) en vez de shared_preferences, porque es un token de sesión: en
/// Android shared_preferences es un XML plano legible por cualquier proceso
/// con acceso root o por un backup mal configurado, mientras que
/// flutter_secure_storage lo cifra usando el almacenamiento seguro del SO
/// (Keystore en Android, Keychain en iOS/macOS, DPAPI en Windows).
class AuthState extends ChangeNotifier {
  static const _tokenKey = 'panaderia_access_token';

  final ApiClient client;
  late final AuthApi authApi;
  final _storage = const FlutterSecureStorage();

  String? _token;
  AppUser? _user;
  bool _loading = true;

  AuthState() : client = ApiClient() {
    authApi = AuthApi(client);
    client.tokenProvider = () => _token;
    client.onUnauthorized = () {
      // Sesión expirada/inválida (SDD-11): limpiar y forzar vuelta a login.
      _token = null;
      _user = null;
      _storage.delete(key: _tokenKey);
      notifyListeners();
    };
  }

  AppUser? get user => _user;
  bool get isLoading => _loading;
  bool get isAuthenticated => _user != null && _token != null;

  Future<void> restoreSession() async {
    _loading = true;
    notifyListeners();
    try {
      final saved = await _storage.read(key: _tokenKey);
      if (saved != null && saved.isNotEmpty) {
        _token = saved;
        _user = await authApi.me();
      }
    } catch (_) {
      _token = null;
      _user = null;
      // No relanzar: si el storage seguro no está disponible (p. ej. en un
      // widget test sin canal de plataforma) esto no debe tumbar la app,
      // solo se queda sin sesión restaurada.
      try {
        await _storage.delete(key: _tokenKey);
      } catch (_) {
        // ignorado a propósito
      }
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> login(String email, String password) async {
    final result = await authApi.login(email, password);
    _token = result.accessToken;
    _user = result.user;
    await _storage.write(key: _tokenKey, value: _token);
    notifyListeners();
  }

  Future<void> logout() async {
    try {
      await authApi.logout();
    } catch (_) {
      // si falla la llamada de red, igual cerramos sesión localmente
    }
    _token = null;
    _user = null;
    await _storage.delete(key: _tokenKey);
    notifyListeners();
  }
}
