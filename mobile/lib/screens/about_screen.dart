import 'package:flutter/material.dart';
import '../widgets/baker_mascot.dart';

/// Pantalla "Acerca de": desarrollador, tecnologías y créditos de recursos.
class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  static const version = '1.0.0';

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    Widget section(String title, List<Widget> children) => Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: text.titleMedium?.copyWith(fontWeight: FontWeight.w600, color: scheme.primary)),
                const SizedBox(height: 8),
                ...children,
              ],
            ),
          ),
        );

    Widget line(String label, String value) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant)),
              Text(value, style: text.bodyMedium),
            ],
          ),
        );

    return Scaffold(
      appBar: AppBar(title: const Text('Acerca de')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Center(child: BakerMascot(state: BakerState.idle, size: 120)),
            const SizedBox(height: 8),
            Text('Panadería — Costeo e Inventario',
                textAlign: TextAlign.center, style: text.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text('Sistema de costeo de recetas, control de inventario y producción de lotes para panaderías.',
                textAlign: TextAlign.center, style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant)),
            const SizedBox(height: 4),
            Text('Versión $version',
                textAlign: TextAlign.center, style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant)),
            const SizedBox(height: 16),
            section('Desarrollador', [const Text('Alvaro Diaz Vallejos — Karma.py')]),
            section('Tecnologías', [
              line('Móvil', 'Flutter'),
              line('Web', 'React / TypeScript / Vite / Tailwind'),
              line('Backend', 'Node.js / Fastify / Drizzle / PostgreSQL'),
            ]),
            section('Créditos de recursos', [
              line('Ilustraciones (404 y estados vacíos)', 'Storyset — https://storyset.com'),
              line('Íconos', 'Google Material Icons / Material Symbols'),
              line('Fotografías de recetas e ingredientes', 'Wikimedia Commons (licencias libres)'),
              line('Mascota', 'Diseño propio'),
            ]),
            const SizedBox(height: 8),
            Text('© 2026 Karma.py. Todos los derechos reservados.',
                textAlign: TextAlign.center, style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant)),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}
