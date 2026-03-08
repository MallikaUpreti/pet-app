import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../state/app_state.dart';
import 'pet_detail_screen.dart';

class OwnerProfileScreen extends StatefulWidget {
  const OwnerProfileScreen({super.key});

  @override
  State<OwnerProfileScreen> createState() => _OwnerProfileScreenState();
}

class _OwnerProfileScreenState extends State<OwnerProfileScreen> {
  late Future<_ProfileCounts> _future;
  Map<String, dynamic>? _settings;

  @override
  void initState() {
    super.initState();
    _future = _loadCounts();
  }

  Future<_ProfileCounts> _loadCounts() async {
    final app = context.read<AppState>();
    final pets = await app.fetchPets();
    final appts = await app.fetchAppointments();
    int records = 0;
    for (final pet in pets) {
      final items = await app.fetchRecords(pet.id);
      records += items.length;
    }
    return _ProfileCounts(pets: pets.length, appts: appts.length, records: records);
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: FutureBuilder<_ProfileCounts>(
        future: _future,
        builder: (context, snapshot) {
          final counts = snapshot.data;
          return ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 30,
                        backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.15),
                        child: Icon(Icons.person, color: Theme.of(context).colorScheme.primary),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(app.fullName ?? 'Pet Owner',
                                style: Theme.of(context).textTheme.titleMedium),
                            const Text('Pet Owner'),
                          ],
                        ),
                      ),
                      OutlinedButton.icon(
                        onPressed: () async {
                          final name = TextEditingController(text: app.fullName ?? '');
                          final phone = TextEditingController();
                          final result = await showDialog<bool>(
                            context: context,
                            builder: (_) => AlertDialog(
                              title: const Text('Edit Profile'),
                              content: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  TextField(controller: name, decoration: const InputDecoration(labelText: 'Full Name')),
                                  TextField(controller: phone, decoration: const InputDecoration(labelText: 'Phone')),
                                ],
                              ),
                              actions: [
                                TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
                                FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Save')),
                              ],
                            ),
                          );
                          if (result == true) {
                            await app.updateMe({'full_name': name.text.trim(), 'phone': phone.text.trim()});
                            if (!mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Profile updated.')),
                            );
                          }
                        },
                        icon: const Icon(Icons.edit),
                        label: const Text('Edit'),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _StatTile(label: 'Pets', value: counts?.pets ?? 0),
                      _StatTile(label: 'Appointments', value: counts?.appts ?? 0),
                      _StatTile(label: 'Reports', value: counts?.records ?? 0),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text('Account Information', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 10),
              const _InfoTile(icon: Icons.email, label: 'Email', value: 'john.smith@email.com'),
              const _InfoTile(icon: Icons.phone, label: 'Phone', value: '(555) 123-4567'),
              const _InfoTile(icon: Icons.location_on, label: 'Location', value: 'New York, NY 10001'),
              const SizedBox(height: 16),
              Text('Settings', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 10),
              FutureBuilder<Map<String, dynamic>>(
                future: app.fetchSettings(),
                builder: (context, settingsSnap) {
                  if (settingsSnap.hasData) _settings = settingsSnap.data;
                  final notifications = _settings?['notifications'] ?? true;
                  final diet = _settings?['diet_reminders'] ?? true;
                  return Column(
                    children: [
                      _ToggleTile(
                        label: 'Notifications',
                        subtitle: 'Appointment reminders',
                        value: notifications,
                        onChanged: (v) async {
                          _settings = {
                            'notifications': v,
                            'diet_reminders': diet,
                          };
                          await app.updateSettings(_settings!);
                          setState(() {});
                        },
                      ),
                      _ToggleTile(
                        label: 'Diet Reminders',
                        subtitle: 'Feeding time alerts',
                        value: diet,
                        onChanged: (v) async {
                          _settings = {
                            'notifications': notifications,
                            'diet_reminders': v,
                          };
                          await app.updateSettings(_settings!);
                          setState(() {});
                        },
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () => app.logout(),
                child: const Text('Logout'),
              ),
              const SizedBox(height: 20),
              FutureBuilder<List<Pet>>(
                future: app.fetchPets(),
                builder: (context, petSnap) {
                  if (!petSnap.hasData) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final pets = petSnap.data!;
                  if (pets.isEmpty) {
                    return const Text('No pets yet.');
                  }
                  final activeId = app.activePetId ?? pets.first.id;
                  final selectedPet =
                      pets.firstWhere((p) => p.id == activeId, orElse: () => pets.first);
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Pet Profiles', style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 10),
                      SizedBox(
                        height: 56,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemBuilder: (context, i) {
                            final pet = pets[i];
                            final selected = selectedPet.id == pet.id;
                            return ChoiceChip(
                              selected: selected,
                              label: Text(pet.name),
                              onSelected: (_) => app.setActivePet(pet.id),
                            );
                          },
                          separatorBuilder: (_, __) => const SizedBox(width: 8),
                          itemCount: pets.length,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            children: [
                              ListTile(
                                title: Text(selectedPet.name),
                                subtitle: Text(
                                  '${selectedPet.species}${selectedPet.breed != null ? ' • ${selectedPet.breed}' : ''}',
                                ),
                                trailing: IconButton(
                                  icon: const Icon(Icons.arrow_forward_ios),
                                  onPressed: () {
                                    Navigator.of(context).push(
                                      MaterialPageRoute(
                                        builder: (_) => PetDetailScreen(pet: selectedPet),
                                      ),
                                    );
                                  },
                                ),
                              ),
                              const SizedBox(height: 8),
                              SizedBox(
                                width: double.infinity,
                                child: OutlinedButton.icon(
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: Colors.redAccent,
                                  ),
                                  onPressed: () async {
                                    final ok = await showDialog<bool>(
                                      context: context,
                                      builder: (_) => AlertDialog(
                                        title: const Text('Delete Pet'),
                                        content: const Text(
                                          'Delete this pet and all related appointments, records, chats, and diet data?',
                                        ),
                                        actions: [
                                          TextButton(
                                            onPressed: () => Navigator.of(context).pop(false),
                                            child: const Text('Cancel'),
                                          ),
                                          FilledButton(
                                            onPressed: () => Navigator.of(context).pop(true),
                                            child: const Text('Delete'),
                                          ),
                                        ],
                                      ),
                                    );
                                    if (ok != true) return;
                                    try {
                                      await app.deletePet(selectedPet.id);
                                      final updatedPets = await app.fetchPets();
                                      if (updatedPets.isNotEmpty) {
                                        app.setActivePet(updatedPets.first.id);
                                      } else {
                                        app.setActivePet(null);
                                      }
                                      setState(() {
                                        _future = _loadCounts();
                                      });
                                      if (!mounted) return;
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('Pet deleted.')),
                                      );
                                    } catch (e) {
                                      if (!mounted) return;
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(content: Text(e.toString())),
                                      );
                                    }
                                  },
                                  icon: const Icon(Icons.delete_outline),
                                  label: const Text('Delete Pet'),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
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

class _StatTile extends StatelessWidget {
  final String label;
  final int value;

  const _StatTile({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text('$value', style: Theme.of(context).textTheme.titleLarge),
        Text(label),
      ],
    );
  }
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoTile({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.12),
          child: Icon(icon, color: Theme.of(context).colorScheme.primary),
        ),
        title: Text(label),
        subtitle: Text(value),
        trailing: const Icon(Icons.chevron_right),
      ),
    );
  }
}

class _ToggleTile extends StatelessWidget {
  final String label;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _ToggleTile({
    required this.label,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Theme.of(context).colorScheme.tertiary.withOpacity(0.2),
          child: Icon(Icons.notifications, color: Theme.of(context).colorScheme.primary),
        ),
        title: Text(label),
        subtitle: Text(subtitle),
        trailing: Switch(
          value: value,
          onChanged: onChanged,
        ),
      ),
    );
  }
}

class _ProfileCounts {
  final int pets;
  final int appts;
  final int records;

  _ProfileCounts({required this.pets, required this.appts, required this.records});
}
