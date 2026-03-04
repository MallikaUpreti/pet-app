import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/models.dart';

class AppointmentCard extends StatelessWidget {
  final Appointment appointment;
  final String role;
  final VoidCallback? onUpdate;

  const AppointmentCard({
    super.key,
    required this.appointment,
    required this.role,
    this.onUpdate,
  });

  @override
  Widget build(BuildContext context) {
    final formatter = DateFormat('MMM d, yyyy • h:mm a');
    final start = _formatDate(appointment.startTime, formatter);
    final subtitle = role == 'owner'
        ? 'Vet: ${appointment.vetName ?? 'Unknown'}'
        : 'Owner: ${appointment.ownerName ?? 'Unknown'}';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    appointment.type,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0B7A75).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    appointment.status,
                    style: Theme.of(context).textTheme.labelMedium,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text('${appointment.petName ?? ''} • $subtitle'),
            const SizedBox(height: 6),
            Text(start, style: Theme.of(context).textTheme.bodySmall),
            if (appointment.notes != null && appointment.notes!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(appointment.notes!),
              ),
            if (onUpdate != null) ...[
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: onUpdate,
                  child: const Text('Update Status'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatDate(String raw, DateFormat formatter) {
    try {
      final dt = DateTime.parse(raw).toLocal();
      return formatter.format(dt);
    } catch (_) {
      return raw;
    }
  }
}
