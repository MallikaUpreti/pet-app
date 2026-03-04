import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../state/app_state.dart';
import '../widgets/empty_state.dart';

class VetDirectoryScreen extends StatelessWidget {
  const VetDirectoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.read<AppState>();
    return Scaffold(
      appBar: AppBar(title: const Text('Vet Directory')),
      body: FutureBuilder<List<Vet>>(
        future: app.fetchVets(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final vets = snapshot.data!;
          if (vets.isEmpty) {
            return const Padding(
              padding: EdgeInsets.all(24),
              child: EmptyState(
                title: 'No vets yet',
                body: 'Add vet profiles from the backend portal.',
                icon: Icons.local_hospital,
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(24),
            itemBuilder: (_, i) {
              final vet = vets[i];
              return Card(
                child: ListTile(
                  title: Text(vet.fullName),
                  subtitle: Text(
                    [
                      vet.clinicName,
                      vet.licenseNo,
                      vet.clinicPhone,
                    ].where((e) => e != null && e.isNotEmpty).join(' • '),
                  ),
                  trailing: const Text('Chat soon'),
                ),
              );
            },
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemCount: vets.length,
          );
        },
      ),
    );
  }
}
