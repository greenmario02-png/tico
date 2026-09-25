import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/exchange_rate_service.dart';
import '../models/exchange_rate.dart';
import '../state/auth_state.dart';
import '../theme/app_theme.dart';

/// Tarjeta de tipo de cambio USD/BOB. Si la red falla muestra un estado
/// discreto y nunca rompe la pantalla.
class ExchangeRateCard extends StatefulWidget {
  final bool compact;

  /// Inyectable para pruebas; por defecto usa el ApiClient de AuthState.
  final Future<ExchangeRate> Function()? loader;
  const ExchangeRateCard({super.key, this.compact = false, this.loader});

  @override
  State<ExchangeRateCard> createState() => _ExchangeRateCardState();
}

class _ExchangeRateCardState extends State<ExchangeRateCard> {
  ExchangeRate? _rate;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final loader = widget.loader ?? ExchangeRateService(context.read<AuthState>().client).fetch;
      final r = await loader();
      if (mounted) setState(() { _rate = r; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final muted = TextStyle(fontSize: 11, color: scheme.onSurfaceVariant);
    final rate = _rate;
    Widget body;
    if (rate == null) {
      body = Text(
        _loading ? 'Cargando tipo de cambio…' : 'Tipo de cambio no disponible',
        style: muted,
      );
    } else {
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          _row(context, 'Oficial', rate.official),
          if (rate.parallel != null) ...[
            SizedBox(height: widget.compact ? 4 : 8),
            _row(context, 'Paralelo', rate.parallel!),
          ],
          const SizedBox(height: 4),
          Wrap(
            spacing: 8,
            children: [
              Text('Actualizado ${formatLaPaz(rate.updatedAt)}', style: muted),
              if (rate.stale)
                Text('dato no actualizado',
                    style: muted.copyWith(color: context.appColors.warning, fontStyle: FontStyle.italic)),
            ],
          ),
        ],
      );
    }
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: EdgeInsets.all(widget.compact ? 10 : 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Dólar (USD) en Bolivia',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: widget.compact ? 12 : 14)),
            const SizedBox(height: 4),
            body,
          ],
        ),
      ),
    );
  }

  Widget _row(BuildContext context, String label, RateQuote q) {
    final scheme = Theme.of(context).colorScheme;
    final size = widget.compact ? 12.0 : 14.0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 10,
          children: [
            Text(label, style: TextStyle(fontSize: size, fontWeight: FontWeight.w600)),
            Text('Compra ${formatBs(q.buy)}', style: TextStyle(fontSize: size)),
            Text('Venta ${formatBs(q.sell)}', style: TextStyle(fontSize: size)),
          ],
        ),
        Text(q.source, style: TextStyle(fontSize: 10, color: scheme.onSurfaceVariant)),
      ],
    );
  }
}
