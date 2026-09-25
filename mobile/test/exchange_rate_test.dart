import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/api/api_client.dart';
import 'package:mobile/models/exchange_rate.dart';
import 'package:mobile/widgets/exchange_rate_card.dart';

const _full = {
  'currency': 'USD',
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
  test('parseo del 429 (cuerpo y cabecera)', () {
    expect(parseRetryAfter(12, '30'), 12);
    expect(parseRetryAfter(null, '30'), 30);
    expect(parseRetryAfter('7', null), 7);
    expect(parseRetryAfter(null, null), isNull);
  });

  test('parseo completo', () {
    final r = ExchangeRate.fromJson(_full);
    expect(r.parallel!.sell, '9.50');
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

  testWidgets('muestra solo Binance P2P sin overflow', (t) async {
    await t.binding.setSurfaceSize(const Size(360, 640));
    await t.pumpWidget(_wrap(_full));
    await t.pumpAndSettle();
    expect(find.textContaining('Oficial'), findsNothing);
    expect(find.textContaining('Binance P2P'), findsWidgets);
    expect(find.textContaining('Compra Bs 9,10'), findsOneWidget);
    expect(find.textContaining('Bs 9,50'), findsOneWidget);
    expect(find.text('dato no actualizado'), findsNothing);
    expect(t.takeException(), isNull);
  });

  testWidgets('stale muestra dato no actualizado', (t) async {
    await t.pumpWidget(_wrap({..._full, 'stale': true}));
    await t.pumpAndSettle();
    expect(find.text('dato no actualizado'), findsOneWidget);
  });

  testWidgets('parallel null muestra no disponible', (t) async {
    await t.pumpWidget(_wrap({..._full, 'parallel': null}));
    await t.pumpAndSettle();
    expect(find.text('Cotización no disponible por ahora'), findsOneWidget);
  });

  testWidgets('refresca en intervalo aleatorio de 5 a 10 min y cancela timer al salir', (t) async {
    var n = 0;
    await t.pumpWidget(MaterialApp(
      home: Scaffold(
        body: ExchangeRateCard(random: Random(1), loader: () async {
          n++;
          return ExchangeRate.fromJson(_full);
        }),
      ),
    ));
    await t.pump();
    await t.pump();
    expect(n, 1);
    await t.pump(const Duration(minutes: 4));
    expect(n, 1); // no antes de 5 min
    await t.pump(const Duration(minutes: 6));
    expect(n, 2); // dentro de 10 min
    await t.pumpWidget(const SizedBox());
    await t.pump(const Duration(minutes: 20));
    expect(n, 2);
  });

  testWidgets('falla de red no rompe', (t) async {
    await t.pumpWidget(_wrap(_full, fail: true));
    await t.pumpAndSettle();
    expect(find.text('Cotización no disponible por ahora'), findsOneWidget);
    expect(t.takeException(), isNull);
  });
}
