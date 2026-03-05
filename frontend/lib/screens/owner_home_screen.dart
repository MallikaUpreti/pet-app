import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../state/app_state.dart';
import 'add_pet_screen.dart';
import 'pet_detail_screen.dart';
import 'owner_health_log_screen.dart';

class OwnerHomeScreen extends StatefulWidget {
  const OwnerHomeScreen({super.key});

  @override
  State<OwnerHomeScreen> createState() => _OwnerHomeScreenState();
}

class _OwnerHomeScreenState extends State<OwnerHomeScreen> {
  bool _loading = true;
  List<Pet> _pets = [];
  List<Appointment> _appointments = [];
  int _healthScore = 0;
  final Map<int, int> _petScores = {};

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
      final now = DateTime.now();
      _petScores.clear();
      for (final pet in pets) {
        final vaccinations = await app.fetchVaccinations(pet.id);
        final meds = await app.fetchMedications(pet.id);
        final diets = await app.fetchDietPlans(pet.id);

        int weightScore() {
          final weight = pet.weightKg;
          if (weight == null) return 60;
          final avg = {
            'dog': 20.0,
            'cat': 4.5,
            'bird': 0.5,
            'rabbit': 2.0,
            'other': 10.0,
          }[(pet.species ?? '').toLowerCase()] ?? 10.0;
          final ratio = avg == 0 ? 1.0 : weight / avg;
          if (ratio >= 0.8 && ratio <= 1.2) return 100;
          if (ratio >= 0.65 && ratio <= 1.35) return 70;
          return 40;
        }

        int vaccineScore() {
          if (vaccinations.isEmpty) return 0;
          final latest = vaccinations.first;
          final status = (latest.status ?? '').toLowerCase();
          final raw = latest.createdAt;
          if (status == 'done' || status == 'completed' || status == 'given') {
            if (raw != null) {
              try {
                final dt = DateTime.parse(raw).toLocal();
                final days = now.difference(dt).inDays;
                return days <= 365 ? 100 : 40;
              } catch (_) {}
            }
            return 40;
          }
          return 20;
        }

        int medsScore() {
          if (meds.isEmpty) return 90;
          final latest = meds.first;
          if (latest.endDate != null) {
            try {
              final dt = DateTime.parse(latest.endDate!).toLocal();
              if (dt.isBefore(DateTime.now())) return 70;
            } catch (_) {}
          }
          return 100;
        }

        int dietScore() {
          if (diets.isEmpty) return 50;
          final latest = diets.first;
          if (latest.createdAt != null) {
            try {
              final dt = DateTime.parse(latest.createdAt!).toLocal();
              final days = now.difference(dt).inDays;
              return days <= 60 ? 100 : 70;
            } catch (_) {}
          }
          return 70;
        }

        final total = (0.15 * weightScore() +
                0.35 * vaccineScore() +
                0.30 * medsScore() +
                0.20 * dietScore())
            .round();
        _petScores[pet.id] = total;
      }
      final score = _petScores.isEmpty
          ? 0
          : (_petScores.values.reduce((a, b) => a + b) / _petScores.length).round();
      if (!mounted) return;
      setState(() {
        _pets = pets;
        _appointments = appts;
        _healthScore = score;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final activePets = _pets.length;
    final activePetId = app.activePetId;
    final filteredAppts = activePetId == null
        ? _appointments
        : _appointments.where((a) => a.petId == activePetId).toList();
    final upcoming = filteredAppts
        .where((a) {
          try {
            final dt = DateTime.parse(a.startTime).toLocal();
            return dt.isAfter(DateTime.now()) &&
                (a.status == 'Scheduled' || a.status == 'Pending' || a.status == 'In Progress');
          } catch (_) {
            return false;
          }
        })
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: Text('Hello, ${app.fullName ?? ''}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none),
            onPressed: () {},
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            _HealthCard(activePets: activePets, upcoming: upcoming.length, score: _healthScore),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _QuickAction(
                    icon: Icons.add,
                    label: 'Add Pet',
                    onTap: () async {
                      final result = await Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const AddPetScreen()),
                      );
                      if (result == true) _load();
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _QuickAction(
                    icon: Icons.monitor_heart_outlined,
                    label: 'Health Log',
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const OwnerHealthLogScreen()),
                      );
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('My Pets', style: Theme.of(context).textTheme.titleMedium),
                TextButton(onPressed: () {}, child: const Text('See All')),
              ],
            ),
            const SizedBox(height: 12),
            if (_pets.isEmpty)
              const _EmptyPets()
            else
              ..._pets.map(
                (pet) => _PetRow(
                  pet: pet,
                  score: _petScores[pet.id] ?? 0,
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => PetDetailScreen(pet: pet)),
                    );
                  },
                ),
              ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _HealthCard extends StatelessWidget {
  final int activePets;
  final int upcoming;
  final int score;

  const _HealthCard({required this.activePets, required this.upcoming, required this.score});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          colors: [Color(0xFF4A90E2), Color(0xFF8FD19E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Your Pets' Health",
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.white70),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Overall Score',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Colors.white),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Text(
                  'View Task',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Center(
            child: Container(
              height: 120,
              width: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 10),
              ),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('$score%',
                        style: const TextStyle(
                            color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
                    Text(score >= 70 ? 'Healthy' : 'Needs Care',
                        style: const TextStyle(color: Colors.white70)),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('$activePets Active Pets', style: const TextStyle(color: Colors.white70)),
              Text('$upcoming Upcoming', style: const TextStyle(color: Colors.white70)),
            ],
          ),
        ],
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  const _QuickAction({required this.icon, required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Column(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.12),
              child: Icon(icon, color: Theme.of(context).colorScheme.primary),
            ),
            const SizedBox(height: 10),
            Text(label, style: Theme.of(context).textTheme.titleSmall),
          ],
        ),
      ),
    );
  }
}

class _ProgressCard extends StatelessWidget {
  final String title;
  final String vet;
  final String time;

  const _ProgressCard({required this.title, required this.vet, required this.time});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 170,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFE8F0FF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFD0E2FF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          ),
          const SizedBox(height: 14),
          Text(vet, style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 12),
          Text(time, style: Theme.of(context).textTheme.bodySmall),
          const Spacer(),
          Container(
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(4),
            ),
            child: FractionallySizedBox(
              widthFactor: 0.55,
              alignment: Alignment.centerLeft,
              child: Container(
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primary,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PetRow extends StatelessWidget {
  final Pet pet;
  final int score;
  final VoidCallback onTap;

  const _PetRow({required this.pet, required this.score, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.12),
          child: const Icon(Icons.favorite_border),
        ),
        title: Text(pet.name),
        subtitle: Text(pet.species),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '$score%',
              style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF4A90E2)),
            ),
            const Text('Health', style: TextStyle(fontSize: 12, color: Colors.black54)),
          ],
        ),
      ),
    );
  }
}

class _EmptyPets extends StatelessWidget {
  const _EmptyPets();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: const Text('No pets yet. Add your first pet to get started.'),
    );
  }
}
