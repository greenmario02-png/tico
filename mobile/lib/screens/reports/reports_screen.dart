import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/endpoints.dart';
import '../../models/models.dart';
import '../../state/auth_state.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/error_banner.dart';

/// SDD-08 §9 — reportes de solo lectura para dueño (rentabilidad por
/// producto, producción por receta). Listas simples, sin librería de
/// gráficos (no era requisito, mantiene la app liviana).
class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  ProfitabilityReport? _profitability;
  List<ProductionRow>? _production;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final api = ReportsApi(context.read<AuthState>().client);
    final now = DateTime.now();
    final from = DateTime(now.year, now.month, 1);
    final to = DateTime(now.year, now.month, now.day + 1);
    String fmt(DateTime d) => d.toIso8601String().substring(0, 10);
    try {
      final profitability = await api.profitability(from: fmt(from), to: fmt(to));
      final production = await api.production(from: fmt(from), to: fmt(to));
      if (mounted) setState(() {
        _profitability = profitability;
        _production = production;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reportes'),
        bottom: TabBar(controller: _tabController, tabs: const [
          Tab(text: 'Rentabilidad'),
          Tab(text: 'Producción'),
        ]),
      ),
      drawer: const AppDrawer(),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _error != null
            ? ListView(children: [ErrorBanner(message: _error)])
            : TabBarView(
                controller: _tabController,
                children: [_profitabilityTab(), _productionTab()],
              ),
      ),
    );
  }

  Widget _profitabilityTab() {
    final report = _profitability;
    if (report == null) return const Center(child: CircularProgressIndicator());
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Wrap(
              spacing: 24,
              runSpacing: 8,
              children: [
                _metric('Ingresos', 'Bs ${report.totals.totalRevenue}'),
                _metric('Costo', 'Bs ${report.totals.totalCost}'),
                _metric('Ganancia real', 'Bs ${report.totals.totalRealProfit}'),
                _metric('Margen real', '${report.totals.realMarginPercent}%'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        if (report.lowProfitabilityThresholdPercent != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              'Se marca "poco rentable" un producto con margen real menor a '
              '${report.lowProfitabilityThresholdPercent}%.',
              style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 12),
            ),
          ),
        if (report.data.isEmpty)
          const EmptyState(
            title: 'Aún no hay ventas este mes',
            message: 'Cuando registres ventas, aquí verás la rentabilidad.',
            illustration: EmptyIllustration.box,
            compact: true,
          )
        else
          ...report.data.map((row) => Card(
                child: ListTile(
                  title: Row(
                    children: [
                      Flexible(child: Text(row.productName ?? 'Producto')),
                      if (row.isLowProfitability) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade700,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Text('poco rentable', style: TextStyle(color: Colors.white, fontSize: 11)),
                        ),
                      ],
                    ],
                  ),
                  subtitle: Text('Vendidos: ${row.unitsSold} · Ingresos: Bs ${row.totalRevenue}'),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('Bs ${row.totalRealProfit}', style: const TextStyle(fontWeight: FontWeight.bold)),
                      Text('${row.realMarginPercent}%',
                          style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 12)),
                    ],
                  ),
                ),
              )),
      ],
    );
  }

  Widget _productionTab() {
    final rows = _production;
    if (rows == null) return const Center(child: CircularProgressIndicator());
    if (rows.isEmpty) return const EmptyState(
          title: 'Aún no hay producción este mes',
          message: 'Produce un lote y aparecerá en este reporte.',
          illustration: EmptyIllustration.shelf,
        );
    return ListView(
      padding: const EdgeInsets.all(16),
      children: rows
          .map((row) => Card(
                child: ListTile(
                  title: Text(row.recipeName ?? 'Receta'),
                  subtitle: Text('Unidades producidas: ${row.unitsProduced} · Costo: Bs ${row.totalProductionCost}'),
                  trailing: Text('Vendidas: ${row.unitsSold}'),
                ),
              ))
          .toList(),
    );
  }

  Widget _metric(String label, String value) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant)),
          Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        ],
      );
}
