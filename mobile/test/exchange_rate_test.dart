import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/exchange_rate.dart';
import 'package:mobile/widgets/exchange_rate_card.dart';

const _full = {
  'currency': 'USD',
  'official': {'buy': '6.86', 'sell': '6.96', 'source': 'BCB (oficial)'},
  'parallel': {'buy': '9.10', 'sell': '9.50', 'source': 'Binance P2P (USDT/BOB)'},
  'updatedAt': '2026-09-25T18:05:00.000Z',
  'stale': false,
};

Widget _wrap(Map<String, dynamic> json, {bool fail = false}) => MaterialApp(
      home: Scaffold(
        body: SizedBox(
          width: 360,
          child: ExchangeRateCard(
            compact: true,
            loader: () async {
              if (fail) throw Exception('net');
              return ExchangeRate.fromJson(json);
            },
          ),
        ),
      ),
    );

void main() {
  test('parseo completo', () {
    final r = ExchangeRate.fromJson(_full);
    expect(r.official.sell, '6.96');
    expect(r.parallel!.source, 'Binance P2P (USDT/BOB)');
    expect(r.stale, false);
  });

  test('parallel null y stale', () {
    final r = ExchangeRate.fromJson({..._full, 'parallel': null, 'stale': true});
    expect(r.parallel, isNull);
    expect(r.stale, true);
  });

  test('formato es-BO y hora La Paz', () {
    expect(formatBs('6.9'), 'Bs 6,90');
    expect(formatBs('6.96'), 'Bs 6,96');
    expect(formatLaPaz(DateTime.parse('2026-09-25T18:05:00Z')), '25/09/2026 14:05');
    expect(formatLaPaz(DateTime.parse('2026-01-01T02:00:00Z')), '31/12/2025 22:00');
  });

  testWidgets('muestra oficial y paralelo sin overflow', (t) async {
    await t.binding.setSurfaceSize(const Size(360, 640));
    await t.pumpWidget(_wrap(_full));
    await t.pumpAndSettle();
    expect(find.textContaining('Oficial'), findsOneWidget);
    expect(find.textContaining('Paralelo'), findsOneWidget);
    expect(find.textContaining('Bs 9,50'), findsOneWidget);
    expect(find.text('dato no actualizado'), findsNothing);
    expect(t.takeException(), isNull);
  });

  testWidgets('stale y parallel null', (t) async {
    await t.pumpWidget(_wrap({..._full, 'parallel': null, 'stale': true}));
    await t.pumpAndSettle();
    expect(find.text('dato no actualizado'), findsOneWidget);
    expect(find.textContaining('Paralelo'), findsNothing);
  });

  testWidgets('falla de red no rompe', (t) async {
    await t.pumpWidget(_wrap(_full, fail: true));
    await t.pumpAndSettle();
    expect(find.text('Tipo de cambio no disponible'), findsOneWidget);
    expect(t.takeException(), isNull);
  });
}
