import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Fondo decorativo: manchas suaves y espigas de trigo grandes con muy poca
/// opacidad (~8-12 %), con colores del tema. Va detrás del contenido.
class BakeryBackdrop extends StatelessWidget {
  const BakeryBackdrop({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return IgnorePointer(
      child: ExcludeSemantics(
        child: CustomPaint(
          size: Size.infinite,
          painter: _BackdropPainter(primary: scheme.primary, accent: context.appColors.warning),
        ),
      ),
    );
  }
}

class _BackdropPainter extends CustomPainter {
  _BackdropPainter({required this.primary, required this.accent});
  final Color primary, accent;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    // Manchas suaves.
    void blob(Offset c, double r, Color color, double a) {
      canvas.drawCircle(
        c,
        r,
        Paint()
          ..shader = RadialGradient(colors: [color.withValues(alpha: a), color.withValues(alpha: 0)])
              .createShader(Rect.fromCircle(center: c, radius: r)),
      );
    }

    blob(Offset(w * 0.9, h * 0.08), w * 0.7, accent, 0.12);
    blob(Offset(w * 0.05, h * 0.95), w * 0.8, primary, 0.10);

    // Espigas de trigo.
    _wheat(canvas, Offset(w * 0.86, h * 0.98), h * 0.42, -0.25, primary.withValues(alpha: 0.10));
    _wheat(canvas, Offset(w * 0.98, h * 0.92), h * 0.34, 0.12, accent.withValues(alpha: 0.10));
    _wheat(canvas, Offset(w * 0.03, h * 0.30), h * 0.26, 0.5, accent.withValues(alpha: 0.08));

    // Hogaza grande, apenas visible.
    canvas.save();
    canvas.translate(w * 0.12, h * 0.2);
    canvas.rotate(-0.4);
    final loaf = RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset.zero, width: w * 0.55, height: w * 0.26), Radius.circular(w * 0.13));
    canvas.drawRRect(loaf, Paint()..color = primary.withValues(alpha: 0.08));
    final score = Paint()
      ..color = primary.withValues(alpha: 0.10)
      ..style = PaintingStyle.stroke
      ..strokeWidth = w * 0.02
      ..strokeCap = StrokeCap.round;
    for (final dx in [-0.14, 0.0, 0.14]) {
      canvas.drawLine(Offset(w * (dx - 0.03), w * 0.05), Offset(w * (dx + 0.03), -w * 0.05), score);
    }
    canvas.restore();
  }

  void _wheat(Canvas canvas, Offset base, double len, double angle, Color color) {
    canvas.save();
    canvas.translate(base.dx, base.dy);
    canvas.rotate(angle);
    final stem = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = len * 0.018
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset.zero, Offset(0, -len), stem);
    final grain = Paint()..color = color;
    final gw = len * 0.055, gh = len * 0.11;
    for (var i = 0; i < 7; i++) {
      final y = -len * (0.45 + i * 0.075);
      for (final side in [-1.0, 1.0]) {
        canvas.save();
        canvas.translate(side * gw * 0.9, y);
        canvas.rotate(side * math.pi / 7);
        canvas.drawOval(Rect.fromCenter(center: Offset.zero, width: gw, height: gh), grain);
        canvas.restore();
      }
    }
    canvas.drawOval(Rect.fromCenter(center: Offset(0, -len - gh * 0.4), width: gw, height: gh), grain);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_BackdropPainter o) => o.primary != primary || o.accent != accent;
}
