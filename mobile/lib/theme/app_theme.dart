import 'package:flutter/material.dart';

/// Transición de pantallas consistente: fade + leve deslizamiento vertical,
/// 220 ms. Con "reducir animaciones" el cambio es instantáneo.
class FadeSlidePageTransitionsBuilder extends PageTransitionsBuilder {
  const FadeSlidePageTransitionsBuilder();

  @override
  Duration get transitionDuration => const Duration(milliseconds: 220);

  @override
  Duration get reverseTransitionDuration => const Duration(milliseconds: 180);

  @override
  Widget buildTransitions<T>(PageRoute<T> route, BuildContext context, Animation<double> animation,
      Animation<double> secondaryAnimation, Widget child) {
    if (MediaQuery.of(context).disableAnimations) return child;
    final curved = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic, reverseCurve: Curves.easeIn);
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, 0.03), end: Offset.zero).animate(curved),
        child: child,
      ),
    );
  }
}

/// Tema visual de la app (rediseño SDD-08, ver también
/// `app/web/src/index.css` y `app/web/src/lib/theme-context.tsx`): paleta
/// cálida ámbar/marrón, con juegos de colores separados para modo claro y
/// modo oscuro. Estos valores son una traducción 1:1 (HSL -> hex) de los
/// tokens `--color-*` del CSS de la app web, para que ambas apps luzcan
/// coherentes. NO se toca lógica de negocio en esta pantalla ni en ninguna
/// otra: esto solo define colores/estilos, ver AppTheme.light / AppTheme.dark
/// y su uso en `lib/main.dart`.
///
/// Colores adicionales que no tienen un slot directo en `ColorScheme` de
/// Material (warning, sidebar/drawer, success) se exponen aparte como
/// constantes para que las pantallas y el drawer los puedan usar igual que
/// el web usa `--color-warning` / `--color-sidebar*` / `--color-success`.
class AppColors {
  const AppColors({
    required this.warning,
    required this.warningForeground,
    required this.success,
    required this.successForeground,
    required this.sidebar,
    required this.sidebarForeground,
    required this.sidebarAccent,
    required this.sidebarAccentForeground,
    required this.sidebarBorder,
    required this.sidebarMuted,
  });

  final Color warning;
  final Color warningForeground;
  final Color success;
  final Color successForeground;
  final Color sidebar;
  final Color sidebarForeground;
  final Color sidebarAccent;
  final Color sidebarAccentForeground;
  final Color sidebarBorder;
  final Color sidebarMuted;

  static const light = AppColors(
    warning: Color(0xFFF59F0A),
    warningForeground: Color(0xFF2B1C12),
    success: Color(0xFF218345),
    successForeground: Color(0xFFFAFAFA),
    sidebar: Color(0xFF291C14),
    sidebarForeground: Color(0xFFF1ECE4),
    sidebarAccent: Color(0xFF5A3616),
    sidebarAccentForeground: Color(0xFFF9F6F1),
    sidebarBorder: Color(0xFF423024),
    sidebarMuted: Color(0xFFB3A698),
  );

  static const dark = AppColors(
    warning: Color(0xFFF6A823),
    warningForeground: Color(0xFF24170F),
    success: Color(0xFF39AC63),
    successForeground: Color(0xFF211712),
    sidebar: Color(0xFF16110D),
    sidebarForeground: Color(0xFFECE7DF),
    sidebarAccent: Color(0xFF4F3117),
    sidebarAccentForeground: Color(0xFFF9F6F1),
    sidebarBorder: Color(0xFF312721),
    sidebarMuted: Color(0xFF9A8C7E),
  );
}

/// Acceso rápido a los colores "extra" (warning/success/sidebar) desde
/// cualquier widget, de forma equivalente a como el web lee las custom
/// properties: `AppColors.of(context).warning`.
extension AppColorsX on BuildContext {
  AppColors get appColors =>
      Theme.of(this).brightness == Brightness.dark ? AppColors.dark : AppColors.light;
}

class AppTheme {
  AppTheme._();

  static ThemeData get light => _build(
        brightness: Brightness.light,
        background: const Color(0xFFFAF8F4),
        foreground: const Color(0xFF2E2219),
        card: const Color(0xFFFFFFFF),
        cardForeground: const Color(0xFF2E2219),
        primary: const Color(0xFFC96D1D),
        primaryForeground: const Color(0xFFFCFAF8),
        secondary: const Color(0xFFF0EBE6),
        secondaryForeground: const Color(0xFF3C2B20),
        muted: const Color(0xFFF1EDEA),
        mutedForeground: const Color(0xFF78695E),
        border: const Color(0xFFE7E0DA),
        destructive: const Color(0xFFD32222),
        destructiveForeground: const Color(0xFFFAFAFA),
      );

  static ThemeData get dark => _build(
        brightness: Brightness.dark,
        background: const Color(0xFF191310),
        foreground: const Color(0xFFF4F1EB),
        card: const Color(0xFF221B16),
        cardForeground: const Color(0xFFF4F1EB),
        primary: const Color(0xFFEE932B),
        primaryForeground: const Color(0xFF211712),
        secondary: const Color(0xFF302721),
        secondaryForeground: const Color(0xFFECE7DF),
        muted: const Color(0xFF2F2722),
        mutedForeground: const Color(0xFFB0A69B),
        border: const Color(0xFF3D3129),
        destructive: const Color(0xFFD74242),
        destructiveForeground: const Color(0xFFFAFAFA),
      );

  static ThemeData _build({
    required Brightness brightness,
    required Color background,
    required Color foreground,
    required Color card,
    required Color cardForeground,
    required Color primary,
    required Color primaryForeground,
    required Color secondary,
    required Color secondaryForeground,
    required Color muted,
    required Color mutedForeground,
    required Color border,
    required Color destructive,
    required Color destructiveForeground,
  }) {
    final colorScheme = ColorScheme(
      brightness: brightness,
      primary: primary,
      onPrimary: primaryForeground,
      secondary: secondary,
      onSecondary: secondaryForeground,
      error: destructive,
      onError: destructiveForeground,
      surface: card,
      onSurface: cardForeground,
      surfaceContainerHighest: muted,
      onSurfaceVariant: mutedForeground,
      outline: border,
      outlineVariant: border,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colorScheme,
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: FadeSlidePageTransitionsBuilder(),
        TargetPlatform.iOS: FadeSlidePageTransitionsBuilder(),
        TargetPlatform.windows: FadeSlidePageTransitionsBuilder(),
        TargetPlatform.linux: FadeSlidePageTransitionsBuilder(),
        TargetPlatform.macOS: FadeSlidePageTransitionsBuilder(),
        TargetPlatform.fuchsia: FadeSlidePageTransitionsBuilder(),
      }),
      scaffoldBackgroundColor: background,
      canvasColor: background,
      dividerColor: border,
      cardTheme: CardThemeData(
        color: card,
        surfaceTintColor: Colors.transparent,
        elevation: 1,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: border),
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: card,
        foregroundColor: cardForeground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 1,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: false,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: primary, width: 2),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: primaryForeground,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primary,
          side: BorderSide(color: border),
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: primary),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: primary,
        foregroundColor: primaryForeground,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: muted,
        labelStyle: TextStyle(color: mutedForeground),
        side: BorderSide(color: border),
      ),
      dividerTheme: DividerThemeData(color: border, thickness: 1),
      drawerTheme: DrawerThemeData(backgroundColor: card),
      textTheme: ThemeData(brightness: brightness).textTheme.apply(
            bodyColor: foreground,
            displayColor: foreground,
          ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: brightness == Brightness.dark ? secondary : foreground,
        contentTextStyle: TextStyle(
          color: brightness == Brightness.dark ? secondaryForeground : background,
        ),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
