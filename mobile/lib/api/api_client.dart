import 'package:dio/dio.dart';
import '../config.dart';

/// Error de aplicación: SIEMPRE usa el mensaje exacto que devolvió el
/// backend (SDD-06), nunca texto inventado en la UI (mismo criterio que
/// app/web/src/lib/api.ts -> AppApiError).
class ApiException implements Exception {
  final int statusCode;
  final String code;
  final String message;
  final List<Map<String, dynamic>>? details;

  ApiException(this.statusCode, this.code, this.message, [this.details]);

  @override
  String toString() => message;
}

typedef TokenProvider = String? Function();

class ApiClient {
  final Dio _dio;
  TokenProvider? tokenProvider;
  void Function()? onUnauthorized;

  ApiClient({TokenProvider? tokenProvider})
      : tokenProvider = tokenProvider,
        _dio = Dio(BaseOptions(baseUrl: apiBaseUrl, connectTimeout: const Duration(seconds: 15))) {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = this.tokenProvider?.call();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
    ));
  }

  ApiException _toApiException(DioException e) {
    final response = e.response;
    if (response == null) {
      return ApiException(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor. Revisa tu conexión.');
    }
    final data = response.data;
    Map<String, dynamic>? error;
    if (data is Map<String, dynamic>) {
      error = data['error'] as Map<String, dynamic>?;
    }
    final message = error?['message'] as String? ?? 'Ocurrió un error inesperado. Intenta de nuevo.';
    final code = error?['code'] as String? ?? 'INTERNAL_ERROR';
    final details = (error?['details'] as List?)?.cast<Map<String, dynamic>>();
    if (response.statusCode == 401) {
      onUnauthorized?.call();
    }
    return ApiException(response.statusCode ?? 0, code, message, details);
  }

  Future<T> get<T>(String path, {Map<String, dynamic>? query, required T Function(dynamic) parse}) async {
    try {
      final res = await _dio.get(path, queryParameters: _cleanQuery(query));
      return parse(res.data);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<T> post<T>(String path, {Object? body, required T Function(dynamic) parse}) async {
    try {
      final res = await _dio.post(path, data: body);
      return parse(res.data);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<T> put<T>(String path, {Object? body, required T Function(dynamic) parse}) async {
    try {
      final res = await _dio.put(path, data: body);
      return parse(res.data);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<T> delete<T>(String path, {required T Function(dynamic) parse}) async {
    try {
      final res = await _dio.delete(path);
      return parse(res.data);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Map<String, dynamic>? _cleanQuery(Map<String, dynamic>? query) {
    if (query == null) return null;
    final out = <String, dynamic>{};
    query.forEach((k, v) {
      if (v != null && v != '') out[k] = v;
    });
    return out;
  }

  /// El backend limita pageSize a 100 sin importar qué se pida (ver
  /// app/backend/src/lib/pagination.ts) — para selectores que necesitan
  /// "todos los registros" hay que paginar hasta agotar totalPages, igual
  /// que fetchAllPages en app/web/src/lib/api.ts.
  Future<List<T>> fetchAllPages<T>(
    String path,
    T Function(Map<String, dynamic>) fromJson, {
    Map<String, dynamic>? query,
  }) async {
    const pageSize = 100;
    final items = <T>[];
    var page = 1;
    var totalPages = 1;
    do {
      final res = await get<Map<String, dynamic>>(
        path,
        query: {...?query, 'page': page, 'pageSize': pageSize},
        parse: (d) => d as Map<String, dynamic>,
      );
      final list = (res['data'] as List).map((e) => fromJson(e as Map<String, dynamic>)).toList();
      items.addAll(list);
      totalPages = (res['pagination'] as Map<String, dynamic>)['totalPages'] as int;
      page += 1;
    } while (page <= totalPages);
    return items;
  }
}
