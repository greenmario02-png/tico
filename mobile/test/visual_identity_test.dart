import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/screens/about_screen.dart';
import 'package:mobile/screens/not_found_screen.dart';
import 'package:mobile/theme/app_theme.dart';
import 'package:mobile/widgets/baker_mascot.dart';
import 'package:mobile/widgets/empty_state.dart';

Widget _wrap(Widget child, {ThemeData? theme, bool disableAnimations = false}) => MaterialApp(
      theme: theme ?? AppTheme.light,
      home: MediaQuery(
        data: MediaQueryData(disableAnimations: disableAnimations),
        child: child,
      ),
    );

void main() {
  testWidgets('BakerMascot renders and transitions between states (light and dark)', (tester) async {
    for (final theme in [AppTheme.light, AppTheme.dark]) {
      var state = BakerState.idle;
      late StateSetter set;
      await tester.pumpWidget(_wrap(
        Scaffold(
          body: StatefulBuilder(builder: (context, setState) {
            set = setState;
            return BakerMascot(state: state);
          }),
        ),
        theme: theme,
      ));
      for (final s in BakerState.values) {
        set(() => state = s);
        await tester.pump(const Duration(milliseconds: 350));
        expect(find.byType(BakerMascot), findsOneWidget);
      }
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    }
  });

  testWidgets('BakerMascot with reduced motion does not loop', (tester) async {
    await tester.pumpWidget(_wrap(const Scaffold(body: BakerMascot(state: BakerState.coverEyes)),
        disableAnimations: true));
    // Sin animaciones en bucle: pumpAndSettle termina.
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('NotFoundScreen shows Spanish copy and home button', (tester) async {
    await tester.pumpWidget(_wrap(const NotFoundScreen()));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Ups, no encontramos esa pantalla'), findsOneWidget);
    expect(find.text('Volver al inicio'), findsOneWidget);
  });

  testWidgets('EmptyState does not overflow at a tiny height', (tester) async {
    await tester.pumpWidget(_wrap(const Scaffold(
      body: Column(children: [
        SizedBox(height: 40),
        Expanded(
          child: EmptyState(
            title: 'No se encontraron recetas',
            message: 'Prueba con otra búsqueda o crea una receta nueva.',
            actionLabel: 'Crear',
            onAction: null,
          ),
        ),
        SizedBox(height: 150),
      ]),
    )));
    await tester.binding.setSurfaceSize(const Size(360, 400));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('No se encontraron recetas'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.binding.setSurfaceSize(null);
  });

  testWidgets('Compact EmptyState works inside a ListView', (tester) async {
    await tester.pumpWidget(_wrap(Scaffold(
      body: ListView(children: const [
        EmptyState(title: 'Todo el stock está en orden', compact: true, illustration: EmptyIllustration.box),
      ]),
    )));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Todo el stock está en orden'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('AboutScreen shows developer and Storyset credit without overflow', (tester) async {
    await tester.binding.setSurfaceSize(const Size(360, 640));
    for (final theme in [AppTheme.light, AppTheme.dark]) {
      await tester.pumpWidget(_wrap(const AboutScreen(), theme: theme));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.scrollUntilVisible(find.text('Alvaro Diaz Vallejos — Karma.py'), 100, scrollable: find.byType(Scrollable).first);
      expect(find.text('Alvaro Diaz Vallejos — Karma.py'), findsOneWidget);
      await tester.scrollUntilVisible(find.textContaining('Storyset'), 200, scrollable: find.byType(Scrollable).first);
      expect(find.textContaining('Storyset'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    }
    await tester.binding.setSurfaceSize(null);
  });
}
