/// Contrato de GET /exchange-rate (público). Los montos llegan como string
/// decimal para no perder precisión.
class RateQuote {
  final String buy;
  final String sell;
  final String source;
  const RateQuote({required this.buy, required this.sell, required this.source});

  factory RateQuote.fromJson(Map<String, dynamic> j) => RateQuote(
        buy: j['buy'].toString(),
        sell: j['sell'].toString(),
        source: (j['source'] ?? '').toString(),
      );
}

class ExchangeRate {
  final String currency;
  final RateQuote? parallel;
  final DateTime updatedAt;
  final bool stale;

  const ExchangeRate({
    required this.currency,
    required this.parallel,
    required this.updatedAt,
    required this.stale,
  });

  factory ExchangeRate.fromJson(Map<String, dynamic> j) => ExchangeRate(
        currency: (j['currency'] ?? 'USD').toString(),
        parallel: j['parallel'] == null ? null : RateQuote.fromJson(j['parallel'] as Map<String, dynamic>),
        updatedAt: DateTime.parse(j['updatedAt'] as String),
        stale: j['stale'] == true,
      );
}

/// "6.96" -> "Bs 6,96" (es-BO: coma decimal, siempre 2 decimales).
String formatBs(String amount) {
  final n = double.tryParse(amount);
  if (n == null) return 'Bs $amount';
  return 'Bs ${n.toStringAsFixed(2).replaceAll('.', ',')}';
}

/// Hora de America/La_Paz (UTC-4 fijo, sin horario de verano): "25/09/2026 14:05".
String formatLaPaz(DateTime utc) {
  final d = utc.toUtc().subtract(const Duration(hours: 4));
  String t(int v) => v.toString().padLeft(2, '0');
  return '${t(d.day)}/${t(d.month)}/${d.year} ${t(d.hour)}:${t(d.minute)}';
}
