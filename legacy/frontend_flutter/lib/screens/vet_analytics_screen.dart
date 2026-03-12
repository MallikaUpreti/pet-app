import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';

class VetAnalyticsScreen extends StatefulWidget {
  const VetAnalyticsScreen({super.key});

  @override
  State<VetAnalyticsScreen> createState() => _VetAnalyticsScreenState();
}

class _VetAnalyticsScreenState extends State<VetAnalyticsScreen> {
  bool _loading = true;
  int completed = 0;
  int scheduled = 0;
  int pending = 0;
  int inProgress = 0;
  int total = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final app = context.read<AppState>();
    final appts = await app.fetchAppointments();
    if (!mounted) return;
    setState(() {
      completed = appts.where((a) => a.status == 'Completed').length;
      scheduled = appts.where((a) => a.status == 'Scheduled').length;
      pending = appts.where((a) => a.status == 'Pending').length;
      inProgress = appts.where((a) => a.status == 'In Progress').length;
      total = appts.length;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Analytics')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(24),
              children: [
                _StatCard(label: 'Completed', value: completed),
                _StatCard(label: 'Scheduled', value: scheduled),
                _StatCard(label: 'Pending', value: pending),
                _StatCard(label: 'In Progress', value: inProgress),
                _StatCard(label: 'Total', value: total),
              ],
            ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final int value;
  const _StatCard({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(label),
        trailing: Text(
          value.toString(),
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
      ),
    );
  }
}
