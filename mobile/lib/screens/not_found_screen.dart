import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../widgets/motion.dart';

/// Pantalla para rutas desconocidas. "Volver al inicio" limpia la pila y
/// vuelve a la ruta raíz (el _AuthGate decide Login o Dashboard).
class NotFoundScreen extends StatelessWidget {
  const NotFoundScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Panadería')),
      body: SafeArea(
        child: LayoutBuilder(builder: (context, box) {
          final art = (box.maxHeight - 260).clamp(90.0, 260.0);
          return SingleChildScrollView(
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: box.maxHeight),
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: FadeSlideIn(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Floating(
                          child: Container(
                            height: art,
                            width: double.infinity,
                            constraints: const BoxConstraints(maxWidth: 360),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Color.alphaBlend(scheme.primary.withValues(alpha: 0.10), scheme.surface),
                              borderRadius: BorderRadius.circular(28),
                            ),
                            child: SvgPicture.asset('assets/illustrations/not-found.svg', fit: BoxFit.contain),
                          ),
                        ),
                        const SizedBox(height: 20),
                        Text('Ups, no encontramos esa pantalla',
                            textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge),
                        const SizedBox(height: 6),
                        Text('Puede que el enlace ya no exista. Vuelve al inicio y sigue horneando.',
                            textAlign: TextAlign.center, style: TextStyle(color: scheme.onSurfaceVariant)),
                        const SizedBox(height: 20),
                        FilledButton.icon(
                          onPressed: () => Navigator.of(context).pushNamedAndRemoveUntil('/', (route) => false),
                          icon: const Icon(Icons.home),
                          label: const Text('Volver al inicio'),
                        ),
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
