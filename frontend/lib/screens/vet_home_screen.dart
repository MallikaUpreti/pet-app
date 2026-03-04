import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../state/app_state.dart';
import '../widgets/appointment_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/section_header.dart';
import 'settings_screen.dart';

class VetHomeScreen extends StatefulWidget {
  const VetHomeScreen({super.key});

  @override
  State<VetHomeScreen> createState() => _VetHomeScreenState();
}

class _VetHomeScreenState extends State<VetHomeScreen> {
  bool _loading = true;
  List<Appointment> _appointments = [];

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
      setState(() => _appointments = appts);
    } catch (_) {
      if (!mounted) return;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _updateStatus(Appointment appt) async {
    final status = await showDialog<String>(
      context: context,
      builder: (context) => _StatusDialog(current: appt.status),
    );
    if (status == null) return;
    final app = context.read<AppState>();
    await app.updateAppointment(appt.id, {'status': status});
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(
        title: Text('Vet dashboard • ${app.fullName ?? ''}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const SettingsScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => app.logout(),
          ),
        ],
      ),
      body: Stack(
        children: [
          Positioned.fill(
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFFF7F4EF),
                    Color(0xFFE9F5F4),
                  ],
                ),
              ),
            ),
          ),
          RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                const SectionHeader(
                  title: 'Appointments',
                  subtitle: 'Today and upcoming bookings.',
                ),
                const SizedBox(height: 16),
                if (_loading)
                  const Center(child: CircularProgressIndicator())
                else if (_appointments.isEmpty)
                  const EmptyState(
                    title: 'No appointments yet',
                    body: 'Once owners book you, appointments will show here.',
                    icon: Icons.calendar_today,
                  )
                else
                  ..._appointments.map(
                    (appt) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: AppointmentCard(
                        appointment: appt,
                        role: 'vet',
                        onUpdate: () => _updateStatus(appt),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusDialog extends StatefulWidget {
  final String current;

  const _StatusDialog({required this.current});

  @override
  State<_StatusDialog> createState() => _StatusDialogState();
}

class _StatusDialogState extends State<_StatusDialog> {
  late String _value;

  @override
  void initState() {
    super.initState();
    _value = widget.current;
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Update status'),
      content: DropdownButtonFormField<String>(
        value: _value,
        items: const [
          DropdownMenuItem(value: 'Scheduled', child: Text('Scheduled')),
          DropdownMenuItem(value: 'Completed', child: Text('Completed')),
          DropdownMenuItem(value: 'Cancelled', child: Text('Cancelled')),
        ],
        onChanged: (value) => setState(() => _value = value ?? _value),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () => Navigator.of(context).pop(_value),
          child: const Text('Save'),
        ),
      ],
    );
  }
}
