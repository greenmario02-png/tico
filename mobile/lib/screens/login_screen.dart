import 'dart:async';
import 'package:flutter/material.dart';
import '../widgets/exchange_rate_card.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../state/auth_state.dart';
import '../widgets/baker_mascot.dart';
import '../widgets/bakery_backdrop.dart';
import '../widgets/error_banner.dart';

/// Login simple, sin jerga técnica (SDD-08 §1): solo correo y contraseña,
/// campos grandes y fáciles de tocar, y el mensaje de error EXACTO que
/// devuelve el backend si algo falla.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _passwordFocus = FocusNode();
  bool _obscure = true;
  bool _loading = false;
  String? _error;
  bool _slow = false;
  Timer? _slowTimer;

  @override
  void initState() {
    super.initState();
    _passwordFocus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _passwordFocus.dispose();
    _slowTimer?.cancel();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _slow = false;
      _error = null;
    });
    _slowTimer?.cancel();
    _slowTimer = Timer(const Duration(seconds: 4), () {
      if (mounted && _loading) setState(() => _slow = true);
    });
    try {
      await context.read<AuthState>().login(
        _emailCtrl.text.trim(),
        _passwordCtrl.text,
      );
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(
        () =>
            _error = 'No se pudo conectar con el servidor. Revisa tu conexión.',
      );
    } finally {
      _slowTimer?.cancel();
      if (mounted) {
        setState(() {
          _loading = false;
          _slow = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final keyboardOpen = MediaQuery.of(context).viewInsets.bottom > 0;
    final mascotState = !_obscure
        ? BakerState.peek
        : (_passwordFocus.hasFocus ? BakerState.coverEyes : BakerState.idle);
    return Scaffold(
      body: Stack(
        children: [
          const Positioned.fill(child: BakeryBackdrop()),
          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 12, bottom: 8),
                  child: AnimatedSize(
                    duration: const Duration(milliseconds: 250),
                    curve: Curves.easeInOut,
                    child: BakerMascot(
                      state: mascotState,
                      size: keyboardOpen ? 92 : 150,
                    ),
                  ),
                ),
                Expanded(
                  child: Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(24),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 420),
                        child: Form(
                          key: _formKey,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              if (!keyboardOpen) ...[
                                Text(
                                  'Panadería',
                                  textAlign: TextAlign.center,
                                  style: Theme.of(context)
                                      .textTheme
                                      .headlineMedium,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Ingresa con tu correo y contraseña',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: scheme.onSurfaceVariant,
                                  ),
                                ),
                                const SizedBox(height: 24),
                              ],
                              TextFormField(
                                controller: _emailCtrl,
                                keyboardType: TextInputType.emailAddress,
                                autofillHints: const [AutofillHints.email],
                                style: const TextStyle(fontSize: 18),
                                decoration: const InputDecoration(
                                  labelText: 'Correo electrónico',
                                  prefixIcon: Icon(Icons.email_outlined),
                                  border: OutlineInputBorder(),
                                ),
                                validator: (v) =>
                                    (v == null || v.trim().isEmpty)
                                    ? 'Ingresa tu correo'
                                    : null,
                              ),
                              const SizedBox(height: 16),
                              TextFormField(
                                controller: _passwordCtrl,
                                focusNode: _passwordFocus,
                                obscureText: _obscure,
                                autofillHints: const [AutofillHints.password],
                                style: const TextStyle(fontSize: 18),
                                decoration: InputDecoration(
                                  labelText: 'Contraseña',
                                  prefixIcon: const Icon(Icons.lock_outline),
                                  border: const OutlineInputBorder(),
                                  suffixIcon: IconButton(
                                    icon: Icon(
                                      _obscure
                                          ? Icons.visibility_off
                                          : Icons.visibility,
                                    ),
                                    onPressed: () =>
                                        setState(() => _obscure = !_obscure),
                                  ),
                                ),
                                validator: (v) => (v == null || v.isEmpty)
                                    ? 'Ingresa tu contraseña'
                                    : null,
                                onFieldSubmitted: (_) => _submit(),
                              ),
                              if (_slow)
                                Padding(
                                  padding: const EdgeInsets.only(top: 12),
                                  child: Text(
                                    'Despertando el servidor… puede tardar hasta un minuto la primera vez',
                                    key: const Key('login-slow-notice'),
                                    textAlign: TextAlign.center,
                                    style: TextStyle(color: scheme.onSurfaceVariant),
                                  ),
                                ),
                              ErrorBanner(message: _error),
                              const SizedBox(height: 16),
                              SizedBox(
                                height: 52,
                                child: FilledButton(
                                  onPressed: _loading ? null : _submit,
                                  child: _loading
                                      ? SizedBox(
                                          height: 22,
                                          width: 22,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2.5,
                                            color: scheme.onPrimary,
                                          ),
                                        )
                                      : const Text(
                                          'Ingresar',
                                          style: TextStyle(fontSize: 18),
                                        ),
                                ),
                              ),
                              const SizedBox(height: 16),
                              const ExchangeRateCard(compact: true),
                              const SizedBox(height: 16),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
