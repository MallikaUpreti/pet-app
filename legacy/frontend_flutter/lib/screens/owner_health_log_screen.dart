import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../state/app_state.dart';

class OwnerHealthLogScreen extends StatefulWidget {
  const OwnerHealthLogScreen({super.key});

  @override
  State<OwnerHealthLogScreen> createState() => _OwnerHealthLogScreenState();
}

class _OwnerHealthLogScreenState extends State<OwnerHealthLogScreen> {
  Pet? _selectedPet;
  final _mood = TextEditingController();
  final _appetite = TextEditingController();
  final _notes = TextEditingController();

  @override
  void dispose() {
    _mood.dispose();
    _appetite.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final pet = _selectedPet;
    if (pet == null) return;
    final app = context.read<AppState>();
    await app.createHealthLog(pet.id, {
      'mood': _mood.text.trim(),
      'appetite': _appetite.text.trim(),
      'notes': _notes.text.trim(),
    });
    if (!mounted) return;
    _mood.clear();
    _appetite.clear();
    _notes.clear();
    setState(() {});
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Log saved.')));
  }

  @override
  Widget build(BuildContext context) {
    final app = context.read<AppState>();
    return Scaffold(
      appBar: AppBar(title: const Text('Health Log')),
      body: FutureBuilder<List<Pet>>(
        future: app.fetchPets(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final pets = snapshot.data!;
          if (pets.isEmpty) {
            return const Padding(
              padding: EdgeInsets.all(24),
              child: Text('Add a pet first.'),
            );
          }
          final activeId = app.activePetId ?? pets.first.id;
          final resolved = pets.firstWhere((p) => p.id == activeId, orElse: () => pets.first);
          _selectedPet ??= resolved;
          if (_selectedPet!.id != resolved.id) {
            _selectedPet = resolved;
          }
          return ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      const Icon(Icons.pets),
                      const SizedBox(width: 12),
                      Text(
                        _selectedPet!.name,
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      TextField(
                        controller: _mood,
                        decoration: const InputDecoration(labelText: 'Mood'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _appetite,
                        decoration: const InputDecoration(labelText: 'Appetite'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _notes,
                        decoration: const InputDecoration(labelText: 'Notes'),
                        maxLines: 3,
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(onPressed: _save, child: const Text('Save Log')),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text('Recent Logs', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 10),
              FutureBuilder<List<dynamic>>(
                future: app.fetchHealthLogs(_selectedPet!.id),
                builder: (context, logSnap) {
                  if (!logSnap.hasData) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final logs = logSnap.data!;
                  if (logs.isEmpty) return const Text('No logs yet.');
                  return Column(
                    children: logs.map((l) {
                      return Card(
                        child: ListTile(
                          title: Text(l['Mood'] ?? 'Mood'),
                          subtitle: Text(l['Notes'] ?? ''),
                          trailing: Text(l['CreatedAt'] ?? ''),
                        ),
                      );
                    }).toList(),
                  );
                },
              ),
            ],
          );
        },
      ),
    );
  }
}
