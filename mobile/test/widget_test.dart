// Pruebas de widgets/unitarias que no dependen de plugins de plataforma
// real (flutter_secure_storage, red) — esas rutas ya se verificaron con un
// `flutter run -d chrome` real contra el backend real (login -> producir
// lote -> registrar venta, ver informe final). Acá se cubre lo que SÍ se
// puede probar de forma determinística en el entorno de `flutter test`
// (VM de Dart, sin canal de plataforma para flutter_secure_storage):
// - que la pantalla de login se renderiza con sus campos,
// - que la configuración de accesos rápidos del dashboard difiere por rol
//   (SDD-08 §8 / SDD-11 §2 / 01-PROJECT_SPEC.md §4).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/screens/login_screen.dart';
import 'package:mobile/screens/dashboard_screen.dart';

void main() {
  testWidgets('Login screen has email and password fields with a submit button', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: LoginScreen()));
    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(find.widgetWithText(FilledButton, 'Ingresar'), findsOneWidget);
  });

  testWidgets('Login shows a validation message when submitting empty fields', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: LoginScreen()));
    await tester.tap(find.widgetWithText(FilledButton, 'Ingresar'));
    await tester.pump();
    expect(find.text('Ingresa tu correo'), findsOneWidget);
    expect(find.text('Ingresa tu contraseña'), findsOneWidget);
  });

  group('Dashboard role-based shortcuts (SDD-08 §8)', () {
    test('operario sees only Producir Lote and Registrar Venta, no admin tools', () {
      final titles = shortcutTitlesForRole('operario');
      expect(titles, containsAll(['Producir Lote', 'Registrar Venta']));
      expect(titles, isNot(contains('Ingredientes')));
      expect(titles, isNot(contains('Recetas')));
      expect(titles, isNot(contains('Reportes')));
    });

    test('admin sees Ingredientes/Recetas plus Producir Lote/Registrar Venta, no Reportes', () {
      final titles = shortcutTitlesForRole('admin');
      expect(titles, containsAll(['Ingredientes', 'Recetas', 'Producir Lote', 'Registrar Venta']));
      expect(titles, isNot(contains('Reportes')));
    });

    test('dueño sees everything admin sees plus Reportes', () {
      final titles = shortcutTitlesForRole('dueño');
      expect(titles, containsAll(['Reportes', 'Ingredientes', 'Recetas', 'Producir Lote', 'Registrar Venta']));
    });

    test('the three roles do not all get the same set of shortcuts', () {
      final operario = shortcutTitlesForRole('operario').toSet();
      final admin = shortcutTitlesForRole('admin').toSet();
      final dueno = shortcutTitlesForRole('dueño').toSet();
      expect(operario, isNot(equals(admin)));
      expect(admin, isNot(equals(dueno)));
      expect(operario, isNot(equals(dueno)));
    });

    test('unknown role gets no shortcuts (fails closed, not open)', () {
      expect(shortcutTitlesForRole('nadie'), isEmpty);
    });
  });
}
