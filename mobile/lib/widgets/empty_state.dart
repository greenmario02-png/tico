import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'motion.dart';

enum EmptyIllustration { shelf, box }

/// Estado vacío reutilizable: ilustración + título + mensaje + acción
/// opcional. Entra con fade/slide y la ilustración flota lento.
///
/// Es seguro dentro de Expanded/RefreshIndicator: se centra y hace scroll
/// si el alto disponible es chico (la ilustración se reduce). Con
/// `compact: true` se puede embeber en una tarjeta.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    this.message,
    this.illustration = EmptyIllustration.shelf,
    this.actionLabel,
    this.onAction,
    this.compact = false,
  });

  final String title;
  final String? message;
  final EmptyIllustration illustration;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool compact;

  String get _asset => illustration == EmptyIllustration.shelf
      ? 'assets/illustrations/empty-shelf.svg'
      : 'assets/illustrations/empty-box.svg';

  Widget _content(BuildContext context, double artSize) {
    final scheme = Theme.of(context).colorScheme;
    return FadeSlideIn(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Floating(
            period: const Duration(seconds: 5),
            child: Container(
              width: artSize,
              height: artSize,
              padding: EdgeInsets.all(artSize * 0.06),
              decoration: BoxDecoration(
                // Superficie suave para que la ilustración se lea también en oscuro.
                color: Color.alphaBlend(scheme.primary.withValues(alpha: 0.10), scheme.surface),
                borderRadius: BorderRadius.circular(28),
              ),
              child: SvgPicture.asset(_asset, fit: BoxFit.contain),
            ),
          ),
          const SizedBox(height: 14),
          Text(title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
          if (message != null) ...[
            const SizedBox(height: 4),
            Text(message!, textAlign: TextAlign.center, style: TextStyle(color: scheme.onSurfaceVariant)),
          ],
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 14),
            FilledButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (compact) {
      return Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Center(child: _content(context, 110)));
    }
    return LayoutBuilder(builder: (context, box) {
      final art = box.hasBoundedHeight ? (box.maxHeight - 150).clamp(60.0, 190.0) : 190.0;
      return SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: box.hasBoundedHeight ? box.maxHeight : 0),
          child: Center(
            child: Padding(padding: const EdgeInsets.all(20), child: _content(context, art)),
          ),
        ),
      );
    });
  }
}
