import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../models/models.dart';
import '../state/app_state.dart';

class VetAppointmentsScreen extends StatefulWidget {
  const VetAppointmentsScreen({super.key});

  @override
  State<VetAppointmentsScreen> createState() => _VetAppointmentsScreenState();
}

class _VetAppointmentsScreenState extends State<VetAppointmentsScreen> {
  bool _loading = true;
  List<Appointment> _appointments = [];
  String _query = '';
  String _filter = 'All';

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
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final formatter = DateFormat('MMM d, yyyy • h:mm a');
    final today = DateTime.now();
    final filtered = _appointments.where((a) {
      final owner = (a.ownerName ?? '').toLowerCase();
      final pet = (a.petName ?? '').toLowerCase();
      final q = _query.toLowerCase();
      if (q.isNotEmpty && !(owner.contains(q) || pet.contains(q))) return false;
      if (_filter == 'All') return true;
      if (_filter == 'Upcoming') return a.status == 'Scheduled';
      if (_filter == 'In Progress') return a.status == 'In Progress';
      if (_filter == 'Completed') return a.status == 'Completed';
      return true;
    }).toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Appointments'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: OutlinedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.filter_list),
              label: const Text('Filter'),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text('Manage your schedule', style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 12),
          TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Search by pet or owner name...',
            ),
            onChanged: (v) => setState(() => _query = v),
          ),
          const SizedBox(height: 16),
          _CalendarStrip(today: today),
          const SizedBox(height: 16),
          Row(
            children: [
              _FilterChip(
                label: 'All',
                selected: _filter == 'All',
                onTap: () => setState(() => _filter = 'All'),
              ),
              const SizedBox(width: 8),
              _FilterChip(
                label: 'Upcoming',
                selected: _filter == 'Upcoming',
                onTap: () => setState(() => _filter = 'Upcoming'),
              ),
              const SizedBox(width: 8),
              _FilterChip(
                label: 'In Progress',
                selected: _filter == 'In Progress',
                onTap: () => setState(() => _filter = 'In Progress'),
              ),
              const SizedBox(width: 8),
              _FilterChip(
                label: 'Completed',
                selected: _filter == 'Completed',
                onTap: () => setState(() => _filter = 'Completed'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (filtered.isEmpty)
            const Text('No appointments yet.')
          else
            ...filtered.map((appt) => _AppointmentCard(
                  appt: appt,
                  formatter: formatter,
                  onAccept: () async {
                    await context.read<AppState>().updateAppointment(
                          appt.id,
                          {'status': 'Scheduled'},
                        );
                    await _load();
                  },
                  onReject: () async {
                    await context.read<AppState>().updateAppointment(
                          appt.id,
                          {'status': 'Declined'},
                        );
                    await _load();
                  },
                  onStart: () async {
                    await context
                        .read<AppState>()
                        .updateAppointment(appt.id, {'status': 'In Progress'});
                    await _load();
                  },
                  onReschedule: () => _reschedule(context, appt),
                )),
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

  Future<void> _updateStatus(BuildContext context, Appointment appt) async {
    final status = await showDialog<String>(
      context: context,
      builder: (context) => _StatusDialog(current: appt.status),
    );
    if (status == null) return;
    await context.read<AppState>().updateAppointment(appt.id, {'status': status});
    await _load();
  }

  Future<void> _reschedule(BuildContext context, Appointment appt) async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (date == null) return;
    final time =
        await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 10, minute: 0));
    if (time == null) return;
    final dt = DateTime(date.year, date.month, date.day, time.hour, time.minute).toUtc();
    await context.read<AppState>().updateAppointment(appt.id, {'start_time': dt.toIso8601String()});
    await _load();
  }
}

class _StatusDialog extends StatefulWidget {
  final String current;

  const _StatusDialog({required this.current});

  @override
  State<_StatusDialog> createState() => _StatusDialogState();
}

class _CalendarStrip extends StatelessWidget {
  final DateTime today;
  const _CalendarStrip({required this.today});

  @override
  Widget build(BuildContext context) {
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
              children: days.map((d) {
                final selected = d.day == today.day;
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                  decoration: BoxDecoration(
                    color: selected
                        ? Theme.of(context).colorScheme.primary
                        : Theme.of(context).colorScheme.primary.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    children: [
                      Text(DateFormat('EEE').format(d),
                          style: TextStyle(
                            color: selected ? Colors.white : Colors.black87,
                            fontSize: 11,
                          )),
                      const SizedBox(height: 4),
                      Text('${d.day}',
                          style: TextStyle(
                            color: selected ? Colors.white : Colors.black87,
                            fontWeight: FontWeight.bold,
                          )),
                    ],
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _FilterChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? Colors.black : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.black12),
        ),
        child: Text(
          label,
          style: TextStyle(color: selected ? Colors.white : Colors.black87),
        ),
      ),
    );
  }
}

class _AppointmentCard extends StatelessWidget {
  final Appointment appt;
  final DateFormat formatter;
  final VoidCallback onAccept;
  final VoidCallback onReject;
  final VoidCallback onStart;
  final VoidCallback onReschedule;

  const _AppointmentCard({
    required this.appt,
    required this.formatter,
    required this.onAccept,
    required this.onReject,
    required this.onStart,
    required this.onReschedule,
  });

  @override
  Widget build(BuildContext context) {
    final status = appt.status;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.12),
                  child: Text((appt.ownerName ?? 'O')[0]),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(appt.petName ?? 'Pet', style: Theme.of(context).textTheme.titleSmall),
                      Text('Owner: ${appt.ownerName ?? '-'}${appt.ownerId != null ? ' (#${appt.ownerId})' : ''}'),
                      Text('Type: ${appt.type}'),
                      Text('Date: ${_formatDate(appt.startTime, formatter)}'),
                    ],
                  ),
                ),
                _StatusPill(status: status),
              ],
            ),
            const SizedBox(height: 12),
            if (status == 'Pending')
              Row(
                children: [
                  Expanded(
                    child: FilledButton(
                      onPressed: onAccept,
                      child: const Text('Accept'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onReject,
                      child: const Text('Reject'),
                    ),
                  ),
                ],
              )
            else
              Row(
                children: [
                  Expanded(
                    child: FilledButton(
                      onPressed: onStart,
                      child: const Text('Start'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onReschedule,
                      child: const Text('Reschedule'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () async {
                        await context.read<AppState>().updateAppointment(
                              appt.id,
                              {'status': 'Completed'},
                            );
                      },
                      child: const Text('Complete'),
                    ),
                  ),
                ],
              ),
          ],
        ),
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
}

class _StatusPill extends StatelessWidget {
  final String status;
  const _StatusPill({required this.status});

  @override
  Widget build(BuildContext context) {
    final color = status == 'Completed'
        ? const Color(0xFF8FD19E)
        : status == 'In Progress'
            ? const Color(0xFFF9D65D)
            : status == 'Pending'
                ? const Color(0xFFB3C7FF)
                : const Color(0xFFE0E0E0);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.3),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(status, style: const TextStyle(fontSize: 12)),
    );
  }
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
