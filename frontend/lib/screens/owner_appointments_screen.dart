import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../models/models.dart';
import '../state/app_state.dart';
import 'add_appointment_screen.dart';

class OwnerAppointmentsScreen extends StatefulWidget {
  const OwnerAppointmentsScreen({super.key});

  @override
  State<OwnerAppointmentsScreen> createState() => _OwnerAppointmentsScreenState();
}

class _OwnerAppointmentsScreenState extends State<OwnerAppointmentsScreen> {
  bool _loading = true;
  List<Appointment> _appointments = [];

  @override
  void initState() {
    super.initState();
    context.read<AppState>().clearNotifications();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final app = context.read<AppState>();
    try {
      final appts = await app.fetchAppointments();
      if (!mounted) return;
      setState(() => _appointments = appts);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final activePetId = app.activePetId;
    final visibleAppointments = (activePetId == null
            ? _appointments
            : _appointments.where((a) => a.petId == activePetId))
        .where((a) => a.status != 'Completed' && a.status != 'Declined')
        .toList();
    final formatter = DateFormat('MMM d, yyyy');
    return Scaffold(
      appBar: AppBar(
        title: const Text('Appointments'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: FilledButton.icon(
              onPressed: () async {
                final result = await Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const AddAppointmentScreen()),
                );
                if (result == true) _load();
              },
              icon: const Icon(Icons.add),
              label: const Text('Book'),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          _CalendarStrip(),
          const SizedBox(height: 24),
          Text('Upcoming', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (visibleAppointments.isEmpty)
            const Text('No upcoming appointments.')
          else
            ...visibleAppointments.map(
              (appt) => Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          CircleAvatar(
                            backgroundColor:
                                Theme.of(context).colorScheme.primary.withOpacity(0.12),
                            child: Text((appt.vetName ?? 'V')[0]),
                          ),
                          const SizedBox(width: 10),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(appt.vetName ?? 'Veterinarian',
                                  style: Theme.of(context).textTheme.titleSmall),
                              Text(appt.type, style: Theme.of(context).textTheme.bodySmall),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text('Date: ${_formatDate(appt.startTime, formatter)}'),
                      Text('Pet: ${appt.petName ?? '-'}'),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton(
                              onPressed: () => _showDetails(context, appt),
                              child: const Text('View Details'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () => _showReschedule(context, appt),
                              child: const Text('Reschedule'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  String _formatDate(String raw, DateFormat formatter) {
    try {
      return formatter.format(DateTime.parse(raw).toLocal());
    } catch (_) {
      return raw;
    }
  }

  Future<void> _showDetails(BuildContext context, Appointment appt) async {
    showModalBottomSheet(
      context: context,
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Appointment Details', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              Text('Doctor: ${appt.vetName ?? '-'}'),
              Text('User: ${context.read<AppState>().fullName ?? '-'}'),
              Text('Pet: ${appt.petName ?? '-'}'),
              Text('Type: ${appt.type}'),
              Text('Status: ${appt.status}'),
              Text('Start: ${appt.startTime}'),
              Text('End: ${appt.endTime ?? '-'}'),
              Text('Notes: ${appt.notes ?? '-'}'),
            ],
          ),
        ),
      ),
    );
  }

  void _showReschedule(BuildContext context, Appointment appt) async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (date == null) return;
    final time = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 10, minute: 0));
    if (time == null) return;
    final dt = DateTime(date.year, date.month, date.day, time.hour, time.minute).toUtc();
    await context.read<AppState>().updateAppointment(appt.id, {'start_time': dt.toIso8601String()});
    await _load();
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Reschedule'),
        content: const Text('Appointment rescheduled.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('OK')),
        ],
      ),
    );
  }
}

class _CalendarStrip extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final days = List.generate(7, (i) => today.add(Duration(days: i)));

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(DateFormat('MMMM yyyy').format(today),
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: days
                  .map(
                    (d) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                      decoration: BoxDecoration(
                        color: d.day == today.day
                            ? Theme.of(context).colorScheme.primary
                            : Theme.of(context).colorScheme.primary.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Column(
                        children: [
                          Text(DateFormat('EEE').format(d),
                              style: TextStyle(
                                color: d.day == today.day ? Colors.white : Colors.black87,
                                fontSize: 11,
                              )),
                          const SizedBox(height: 4),
                          Text('${d.day}',
                              style: TextStyle(
                                color: d.day == today.day ? Colors.white : Colors.black87,
                                fontWeight: FontWeight.bold,
                              )),
                        ],
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }
}
