import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../state/app_state.dart';
import '../widgets/section_header.dart';
import '../widgets/empty_state.dart';
import '../widgets/pet_card.dart';
import '../widgets/appointment_card.dart';
import 'add_pet_screen.dart';
import 'add_appointment_screen.dart';
import 'pet_detail_screen.dart';
import 'settings_screen.dart';
import 'vet_directory_screen.dart';

class OwnerHomeScreen extends StatefulWidget {
  const OwnerHomeScreen({super.key});

  @override
  State<OwnerHomeScreen> createState() => _OwnerHomeScreenState();
}

class _OwnerHomeScreenState extends State<OwnerHomeScreen> {
  bool _loading = true;
  List<Pet> _pets = [];
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
      final pets = await app.fetchPets();
      final appts = await app.fetchAppointments();
      if (!mounted) return;
      setState(() {
        _pets = pets;
        _appointments = appts;
      });
    } catch (_) {
      if (!mounted) return;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(
        title: Text('Welcome, ${app.fullName ?? ''}'),
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
                if (_pets.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  SizedBox(
                    height: 72,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _pets.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 12),
                      itemBuilder: (context, index) {
                        final pet = _pets[index];
                        return InkWell(
                          onTap: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => PetDetailScreen(pet: pet),
                              ),
                            );
                          },
                          borderRadius: BorderRadius.circular(999),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: Colors.grey.shade300),
                            ),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  radius: 20,
                                  backgroundColor:
                                      const Color(0xFFDB6C3D).withOpacity(0.15),
                                  child: Text(
                                    pet.name.isNotEmpty
                                        ? pet.name[0].toUpperCase()
                                        : '?',
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Text(
                                  pet.name,
                                  style: Theme.of(context).textTheme.titleSmall,
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
                SectionHeader(
                  title: 'Pets',
                  subtitle: 'Track profiles and health details.',
                  action: TextButton.icon(
                    onPressed: () async {
                      final result = await Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const AddPetScreen()),
                      );
                      if (result == true) _load();
                    },
                    icon: const Icon(Icons.add),
                    label: const Text('Add'),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const VetDirectoryScreen(),
                            ),
                          );
                        },
                        icon: const Icon(Icons.local_hospital),
                        label: const Text('Find Vets'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () async {
                          final result = await Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const AddAppointmentScreen(),
                            ),
                          );
                          if (result == true) _load();
                        },
                        icon: const Icon(Icons.calendar_today),
                        label: const Text('Book Visit'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                if (_loading)
                  const Center(child: CircularProgressIndicator())
                else if (_pets.isEmpty)
                  EmptyState(
                    title: 'No pets yet',
                    body: 'Add a pet profile to start tracking care plans and records.',
                    icon: Icons.pets,
                    action: ElevatedButton(
                      onPressed: () async {
                        final result = await Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const AddPetScreen()),
                        );
                        if (result == true) _load();
                      },
                      child: const Text('Add pet'),
                    ),
                  )
                else
                  ..._pets.map(
                    (pet) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: PetCard(
                        pet: pet,
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => PetDetailScreen(pet: pet),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                const SizedBox(height: 28),
                SectionHeader(
                  title: 'Appointments',
                  subtitle: 'Upcoming and past visits.',
                  action: TextButton.icon(
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
                const SizedBox(height: 16),
                if (_loading)
                  const SizedBox.shrink()
                else if (_appointments.isEmpty)
                  const EmptyState(
                    title: 'No appointments',
                    body: 'Book a vet visit and keep everything organized.',
                    icon: Icons.calendar_today,
                  )
                else
                  ..._appointments.map(
                    (appt) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: AppointmentCard(
                        appointment: appt,
                        role: 'owner',
                      ),
                    ),
                  ),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
