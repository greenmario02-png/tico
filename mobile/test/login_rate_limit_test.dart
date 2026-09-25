import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:mobile/api/api_client.dart';
import 'package:mobile/screens/login_screen.dart';
import 'package:mobile/state/auth_state.dart';

class _LimitedAuth extends AuthState {
  int calls = 0;
  @override
  Future<void> login(String email, String password) async {
    calls++;
    throw ApiException(429, 'LOGIN_RATE_LIMITED', 'Demasiados intentos', null, 3);
  }
}

void main() {
  testWidgets('429: cuenta regresiva en vivo, botón deshabilitado y rehabilitado en 0', (t) async {
    final auth = _LimitedAuth();
    await t.pumpWidget(ChangeNotifierProvider<AuthState>.value(
      value: auth,
      child: const MaterialApp(home: LoginScreen()),
    ));
    await t.enterText(find.byType(TextFormField).at(0), 'a@b.com');
    await t.enterText(find.byType(TextFormField).at(1), 'x');
    await t.tap(find.widgetWithText(FilledButton, 'Ingresar'));
    await t.pump();
    await t.pump();

    final btn = find.widgetWithText(FilledButton, 'Ingresar');
    expect(find.text('Demasiados intentos. Vuelve a intentar en 3 s'), findsOneWidget);
    expect(t.widget<FilledButton>(btn).onPressed, isNull);

    await t.pump(const Duration(seconds: 1));
    expect(find.text('Demasiados intentos. Vuelve a intentar en 2 s'), findsOneWidget);
    await t.pump(const Duration(seconds: 2));
    expect(find.textContaining('Demasiados intentos'), findsNothing);
    expect(t.widget<FilledButton>(btn).onPressed, isNotNull);
    expect(auth.calls, 1);
  });
}
