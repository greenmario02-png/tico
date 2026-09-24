import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Estados de la mascota panadera de la pantalla de login.
enum BakerState { idle, coverEyes, peek }

/// Panadero de caricatura dibujado 100% con código (CustomPainter), sin
/// assets. Los colores salen del tema (ColorScheme + AppColors) para que
/// se vea bien en modo claro y oscuro.
///
/// - idle: respira/flota suavemente, parpadea de vez en cuando y sostiene
///   una hogaza en la mano levantada.
/// - coverEyes: ambas manos suben a cubrir los ojos (la hogaza acompaña).
/// - peek: las manos cubren los ojos pero una se abre y deja ver un ojo.
///
/// Respeta "reducir animaciones": sin bucle ni parpadeo y con transiciones
/// instantáneas.
class BakerMascot extends StatefulWidget {
  const BakerMascot({super.key, this.state = BakerState.idle, this.size = 150});

  final BakerState state;

  /// Alto del dibujo; el ancho es proporcional (1.2 x alto).
  final double size;

  @override
  State<BakerMascot> createState() => _BakerMascotState();
}

class _BakerMascotState extends State<BakerMascot> with TickerProviderStateMixin {
  late final AnimationController _cover =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 300));
  late final AnimationController _peek =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 300));
  late final AnimationController _loop =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 3200));
  late final AnimationController _blink =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 160));
  Timer? _blinkTimer;
  bool? _reduced;
  final _rng = math.Random();

  @override
  void initState() {
    super.initState();
    _cover.value = widget.state == BakerState.idle ? 0 : 1;
    _peek.value = widget.state == BakerState.peek ? 1 : 0;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduced = MediaQuery.of(context).disableAnimations;
    if (reduced == _reduced) return;
    _reduced = reduced;
    if (reduced) {
      _loop.stop();
      _loop.value = 0;
      _blinkTimer?.cancel();
      _blink.value = 0;
      _cover.value = widget.state == BakerState.idle ? 0 : 1;
      _peek.value = widget.state == BakerState.peek ? 1 : 0;
    } else {
      _loop.repeat();
      _scheduleBlink();
    }
  }

  void _scheduleBlink() {
    _blinkTimer?.cancel();
    _blinkTimer = Timer(Duration(milliseconds: 2500 + _rng.nextInt(2500)), () async {
      if (!mounted || _reduced == true) return;
      await _blink.forward();
      if (!mounted) return;
      await _blink.reverse();
      if (mounted && _reduced != true) _scheduleBlink();
    });
  }

  @override
  void didUpdateWidget(BakerMascot old) {
    super.didUpdateWidget(old);
    if (old.state == widget.state) return;
    final coverTarget = widget.state == BakerState.idle ? 0.0 : 1.0;
    final peekTarget = widget.state == BakerState.peek ? 1.0 : 0.0;
    if (_reduced == true) {
      _cover.value = coverTarget;
      _peek.value = peekTarget;
    } else {
      _cover.animateTo(coverTarget, curve: Curves.easeInOut);
      _peek.animateTo(peekTarget, curve: Curves.easeInOut);
    }
  }

  @override
  void dispose() {
    _blinkTimer?.cancel();
    _cover.dispose();
    _peek.dispose();
    _loop.dispose();
    _blink.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dark = scheme.brightness == Brightness.dark;
    final colors = context.appColors;
    final palette = _Palette(
      skin: dark ? const Color(0xFFE9B48A) : const Color(0xFFF3C6A0),
      hat: dark ? const Color(0xFFF4F1EB) : Colors.white,
      outline: dark ? const Color(0xFF6B5443) : const Color(0xFFCDBBA8),
      apron: colors.sidebarAccent,
      apronStrap: colors.sidebarBorder,
      loaf: colors.warning,
      loafScore: scheme.primary,
      cheek: const Color(0xFFE8747C),
      ink: const Color(0xFF3A2618),
    );
    return ExcludeSemantics(
      child: SizedBox(
        width: widget.size * 1.2,
        height: widget.size,
        child: RepaintBoundary(
          child: AnimatedBuilder(
            animation: Listenable.merge([_cover, _peek, _loop, _blink]),
            builder: (context, _) => CustomPaint(
              painter: _BakerPainter(
                cover: _cover.value,
                peek: _peek.value,
                blink: _blink.value,
                loop: _loop.value,
                palette: palette,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Palette {
  const _Palette({
    required this.skin,
    required this.hat,
    required this.outline,
    required this.apron,
    required this.apronStrap,
    required this.loaf,
    required this.loafScore,
    required this.cheek,
    required this.ink,
  });
  final Color skin, hat, outline, apron, apronStrap, loaf, loafScore, cheek, ink;
}

/// Dibuja en un lienzo lógico de 200 x 170 y lo escala al tamaño real.
class _BakerPainter extends CustomPainter {
  _BakerPainter({
    required this.cover,
    required this.peek,
    required this.blink,
    required this.loop,
    required this.palette,
  });

  final double cover, peek, blink, loop;
  final _Palette palette;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.height / 170;
    canvas.translate((size.width - 200 * s) / 2, 0);
    canvas.scale(s);
    canvas.translate(0, math.sin(loop * 2 * math.pi) * 2.0);

    final p = palette;
    final line = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = p.outline;

    // Cuerpo + delantal.
    final body = RRect.fromRectAndCorners(const Rect.fromLTWH(52, 122, 96, 60),
        topLeft: const Radius.circular(34), topRight: const Radius.circular(34));
    canvas.drawRRect(body, Paint()..color = p.apron);
    canvas.drawRRect(body, line);
    final strap = Paint()
      ..color = p.apronStrap
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(const Offset(80, 124), const Offset(84, 142), strap);
    canvas.drawLine(const Offset(120, 124), const Offset(116, 142), strap);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(86, 150, 28, 16), const Radius.circular(4)),
        Paint()..color = p.apronStrap.withValues(alpha: 0.6));

    // Cuello y cabeza.
    canvas.drawRect(const Rect.fromLTWH(90, 116, 20, 14), Paint()..color = p.skin);
    const headC = Offset(100, 86);
    canvas.drawCircle(headC, 40, Paint()..color = p.skin);
    canvas.drawCircle(headC, 40, line);

    // Gorro alto.
    final hatPaint = Paint()..color = p.hat;
    for (final c in const [Offset(78, 30), Offset(100, 22), Offset(122, 30)]) {
      final r = c.dx == 100 ? 19.0 : 16.0;
      canvas.drawCircle(c, r, hatPaint);
      canvas.drawCircle(c, r, line);
    }
    final hatBand = RRect.fromRectAndRadius(const Rect.fromLTWH(68, 32, 64, 26), const Radius.circular(5));
    canvas.drawRRect(hatBand, hatPaint);
    canvas.drawRRect(hatBand, line);
    canvas.drawRect(const Rect.fromLTWH(70, 33, 60, 8), hatPaint);
    canvas.drawLine(const Offset(68, 50), const Offset(132, 50), Paint()
      ..color = p.outline.withValues(alpha: 0.6)
      ..strokeWidth = 1.5);

    // Mejillas.
    final cheek = Paint()..color = p.cheek.withValues(alpha: 0.45);
    canvas.drawCircle(const Offset(75, 100), 7, cheek);
    canvas.drawCircle(const Offset(125, 100), 7, cheek);

    // Ojos con parpadeo.
    final eye = Paint()..color = p.ink;
    final eyeH = 4.2 * (1 - blink) + 0.7;
    for (final x in const [86.0, 114.0]) {
      canvas.drawOval(Rect.fromCenter(center: Offset(x, 88), width: 8.4, height: eyeH * 2), eye);
    }

    // Sonrisa.
    final smile = Paint()
      ..color = p.ink
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.6
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(Rect.fromCenter(center: const Offset(100, 100), width: 24 - 4 * cover, height: 16), 0.25,
        math.pi - 0.5, false, smile);

    // Manos y brazos.
    const shoulderL = Offset(62, 138);
    const shoulderR = Offset(138, 138);
    const restL = Offset(52, 152);
    const restR = Offset(160, 100); // mano derecha levantada con la hogaza
    const coverL = Offset(87, 88);
    final coverR = const Offset(113, 88) + Offset(16 * peek, -13 * peek);
    final handL = Offset.lerp(restL, coverL, cover)!;
    final handR = Offset.lerp(restR, coverR, cover)!;

    final armOutline = Paint()
      ..color = p.outline
      ..style = PaintingStyle.stroke
      ..strokeWidth = 19
      ..strokeCap = StrokeCap.round;
    final arm = Paint()
      ..color = p.skin
      ..style = PaintingStyle.stroke
      ..strokeWidth = 15
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(shoulderL, handL, armOutline);
    canvas.drawLine(shoulderR, handR, armOutline);
    canvas.drawLine(shoulderL, handL, arm);
    canvas.drawLine(shoulderR, handR, arm);

    // Hogaza sobre la mano derecha; al cubrirse se encoge y se acomoda al
    // costado de la cabeza para no verse rota.
    final loafOffset = Offset.lerp(const Offset(2, -24), const Offset(28, -4), cover)!;
    canvas.save();
    canvas.translate(handR.dx + loafOffset.dx, handR.dy + loafOffset.dy);
    canvas.rotate(-0.25 + 0.6 * cover);
    canvas.scale(1 - 0.35 * cover);
    _drawLoaf(canvas);
    canvas.restore();

    for (final h in [handL, handR]) {
      canvas.drawCircle(h, 13.5, Paint()..color = p.skin);
      canvas.drawCircle(h, 13.5, line);
    }
    // Dedos: rayitas sobre las manos cuando cubren.
    if (cover > 0.6) {
      final fing = Paint()
        ..color = p.outline
        ..strokeWidth = 1.6
        ..strokeCap = StrokeCap.round;
      for (final h in [handL, handR]) {
        for (final dx in const [-4.0, 0.0, 4.0]) {
          canvas.drawLine(h + Offset(dx, -3), h + Offset(dx, 6), fing);
        }
      }
    }
  }

  void _drawLoaf(Canvas canvas) {
    final p = palette;
    final loaf = RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset.zero, width: 46, height: 24), const Radius.circular(12));
    canvas.drawRRect(loaf, Paint()..color = p.loaf);
    canvas.drawRRect(
        loaf,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..color = p.loafScore);
    final score = Paint()
      ..color = p.loafScore
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round;
    for (final dx in const [-12.0, 0.0, 12.0]) {
      canvas.drawLine(Offset(dx - 3, 5), Offset(dx + 3, -5), score);
    }
  }

  @override
  bool shouldRepaint(_BakerPainter o) =>
      o.cover != cover ||
      o.peek != peek ||
      o.blink != blink ||
      o.loop != loop ||
      o.palette.skin != palette.skin ||
      o.palette.hat != palette.hat ||
      o.palette.apron != palette.apron;
}
