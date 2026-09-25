import '../models/exchange_rate.dart';
import 'api_client.dart';

/// Consume GET /exchange-rate (público, sin auth).
class ExchangeRateService {
  final ApiClient client;
  ExchangeRateService(this.client);

  Future<ExchangeRate> fetch() => client.get(
        '/exchange-rate',
        timeout: const Duration(seconds: 15),
        parse: (d) => ExchangeRate.fromJson(d as Map<String, dynamic>),
      );
}
