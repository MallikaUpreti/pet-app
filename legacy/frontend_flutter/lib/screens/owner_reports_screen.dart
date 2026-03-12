import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../state/app_state.dart';

class OwnerReportsScreen extends StatefulWidget {
  const OwnerReportsScreen({super.key});

  @override
  State<OwnerReportsScreen> createState() => _OwnerReportsScreenState();
}

class _OwnerReportsScreenState extends State<OwnerReportsScreen> {
  bool _loading = true;
  List<Appointment> _reportAppointments = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final app = context.read<AppState>();
    try {
      final appts = await app.fetchAppointments();
      if (!mounted) return;
      setState(() {
        _reportAppointments = appts.where((a) => a.hasReport).toList();
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final formatter = DateFormat('MMM d, yyyy • h:mm a');
    return Scaffold(
      appBar: AppBar(title: const Text('Reports')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text('Completed appointment reports',
                style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 12),
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (_reportAppointments.isEmpty)
              const Text('No reports available yet.')
            else
              ..._reportAppointments.map((appt) => _ReportCard(appt: appt, formatter: formatter)),
          ],
        ),
      ),
    );
  }
}

class _ReportCard extends StatefulWidget {
  final Appointment appt;
  final DateFormat formatter;

  const _ReportCard({required this.appt, required this.formatter});

  @override
  State<_ReportCard> createState() => _ReportCardState();
}

class _ReportCardState extends State<_ReportCard> {
  bool _loading = true;
  Map<String, dynamic>? _report;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await context.read<AppState>().fetchAppointmentReport(widget.appt.id);
      if (!mounted) return;
      setState(() => _report = data['report'] as Map<String, dynamic>?);
    } catch (_) {
      if (!mounted) return;
      setState(() => _report = null);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _fmt(String raw) {
    try {
      return widget.formatter.format(DateTime.parse(raw).toLocal());
    } catch (_) {
      return raw;
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.read<AppState>();
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${widget.appt.type} • ${widget.appt.petName ?? '-'}',
                style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),
            Text('Doctor: ${widget.appt.vetName ?? '-'}'),
            Text('User: ${app.fullName ?? '-'}'),
            Text('Pet: ${widget.appt.petName ?? '-'}'),
            Text('Status: ${widget.appt.status}'),
            Text('Start: ${_fmt(widget.appt.startTime)}'),
            Text('End: ${widget.appt.endTime == null ? '-' : _fmt(widget.appt.endTime!)}'),
            Text('Notes: ${widget.appt.notes ?? '-'}'),
            const SizedBox(height: 12),
            if (_loading)
              const Text('Loading report...')
            else if (_report == null)
              const Text('Report is not added yet.')
            else ...[
              Text('Diagnosis: ${_report!['Diagnosis'] ?? '-'}'),
              const SizedBox(height: 6),
              Text('Medication and doses: ${_report!['MedicationsAndDoses'] ?? '-'}'),
              const SizedBox(height: 6),
              Text('Diet recommendation: ${_report!['DietRecommendation'] ?? '-'}'),
              const SizedBox(height: 6),
              Text('General recommendation: ${_report!['GeneralRecommendation'] ?? '-'}'),
            ],
          ],
        ),
      ),
    );
  }
}
