import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../state/app_state.dart';
import 'vet_patients_screen.dart';
import 'vet_analytics_screen.dart';

class VetHomeScreen extends StatefulWidget {
  const VetHomeScreen({super.key});

  @override
  State<VetHomeScreen> createState() => _VetHomeScreenState();
}

class _VetHomeScreenState extends State<VetHomeScreen> {
  bool _loading = true;
  List<Appointment> _appointments = [];
  List<dynamic> _chatRequests = [];
  Map<String, dynamic>? _profile;
  int _patientsCount = 0;
  int _notifCount = 0;

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
      final requests = await app.fetchChatRequests();
      final profile = await app.fetchVetProfile();
      final patients = await app.fetchVetPatients();
      final chats = await app.fetchChats();
      if (!mounted) return;
      setState(() {
        _appointments = appts;
        _chatRequests = requests;
        _profile = profile;
        _patientsCount = patients.length;
        _notifCount = chats.where((c) => c['LastSenderRole'] == 'owner').length +
            appts.where((a) => a.status == 'Pending').length;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final pending = _chatRequests.length;
    final upcoming = _appointments.length;
    final isOnline = (_profile?['IsOnline'] ?? 0) == 1 || (_profile?['IsOnline'] == true);
    final completedToday =
        upcomingToday.where((a) => a.status == 'Completed').length;
    final totalToday = upcomingToday.isEmpty ? 1 : upcomingToday.length;
    final progress = (completedToday / totalToday).clamp(0.0, 1.0);
    final today = DateTime.now();
    final upcomingToday = _appointments.where((a) {
      try {
        final dt = DateTime.parse(a.startTime).toLocal();
        return dt.year == today.year && dt.month == today.month && dt.day == today.day;
      } catch (_) {
        return false;
      }
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pet Care App Development'),
        actions: [
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_none),
                onPressed: () {
                  final msg = _notifCount > 0
                      ? 'You have $_notifCount notifications.'
                      : 'No new notifications.';
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(msg)),
                  );
                },
              ),
              if (_notifCount > 0)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.redAccent,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      _notifCount.toString(),
                      style: const TextStyle(color: Colors.white, fontSize: 10),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(
              'Welcome back,',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey),
            ),
            const SizedBox(height: 4),
            Text(
              'Dr. ${app.fullName ?? ''}',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 16),
            _ProgressCard(
              progress: progress,
              completed: completedToday,
              remaining: upcomingToday.length - completedToday,
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _StatTile(label: 'Completed', value: completedToday.toString()),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _StatTile(label: 'Today', value: upcomingToday.length.toString()),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _StatTile(label: 'Patients', value: _patientsCount.toString()),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Upcoming Today', style: Theme.of(context).textTheme.titleMedium),
                TextButton(onPressed: () {}, child: const Text('See All')),
              ],
            ),
            const SizedBox(height: 12),
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (upcomingToday.isEmpty)
              const Text('No appointments today.')
            else
              ...upcomingToday.map(
                (appt) => _VetUpcomingCard(
                  appt: appt,
                  onStart: () async {
                    await context
                        .read<AppState>()
                        .updateAppointment(appt.id, {'status': 'In Progress'});
                    _load();
                  },
                ),
              ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: _QuickAction(
                    icon: Icons.people_alt_outlined,
                    label: 'Patient Records',
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const VetPatientsScreen()),
                      );
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _QuickAction(
                    icon: Icons.show_chart_outlined,
                    label: 'Analytics',
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const VetAnalyticsScreen()),
                      );
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Card(
              child: SwitchListTile(
                title: const Text('Available for Appointments'),
                subtitle: const Text('Patients can book slots'),
                value: isOnline,
                onChanged: (value) async {
                  await app.updateVetProfile({'is_online': value ? 1 : 0});
                  await _load();
                },
              ),
            ),
            const SizedBox(height: 24),
            Text('Chat Requests', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (_chatRequests.isEmpty)
              const Text('No chat requests yet.')
            else
              ..._chatRequests.map(
                (r) => Card(
                  child: ListTile(
                    title: Text(r['OwnerName'] ?? 'Owner'),
                    subtitle: Text(r['Message'] ?? 'No message'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextButton(
                          onPressed: () async {
                            await context.read<AppState>().acceptChatRequest(r['Id']);
                            _load();
                          },
                          child: const Text('Accept'),
                        ),
                        TextButton(
                          onPressed: () async {
                            await context.read<AppState>().declineChatRequest(r['Id']);
                            _load();
                          },
                          child: const Text('Decline'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _scrollTo(BuildContext context, String anchor) {
    // Placeholder for simple navigation in a single list
  }
}

class _VetStatsCard extends StatelessWidget {
class _ProgressCard extends StatelessWidget {
  final double progress;
  final int completed;
  final int remaining;

  const _ProgressCard({
    required this.progress,
    required this.completed,
    required this.remaining,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          colors: [Color(0xFF2E6CF6), Color(0xFF1E5AF0)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Today's Schedule",
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.white70),
          ),
          const SizedBox(height: 6),
          Text(
            'Progress',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 18),
          Center(
            child: Container(
              height: 120,
              width: 120,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('${(progress * 100).round()}%',
                        style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.bold)),
                    const Text('Complete', style: TextStyle(color: Colors.white70)),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 18),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('$completed Completed', style: const TextStyle(color: Colors.white)),
              Text('$remaining Remaining', style: const TextStyle(color: Colors.white)),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  final String label;
  final String value;
  const _StatTile({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 12),
        ],
      ),
      child: Column(
        children: [
          Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Text(label, style: const TextStyle(color: Colors.grey)),
        ],
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _QuickAction({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 12),
          ],
        ),
        child: Column(
          children: [
            CircleAvatar(
              backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.12),
              child: Icon(icon, color: Theme.of(context).colorScheme.primary),
            ),
            const SizedBox(height: 10),
            Text(label),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;
  final String anchor;

  const _SectionTitle({required this.title, required this.anchor});

  @override
  Widget build(BuildContext context) {
    return Text(title, style: Theme.of(context).textTheme.titleMedium);
  }
}

class _VetUpcomingCard extends StatelessWidget {
  final Appointment appt;
  final VoidCallback onStart;

  const _VetUpcomingCard({required this.appt, required this.onStart});

  @override
  Widget build(BuildContext context) {
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
                      Text(appt.petName ?? 'Pet',
                          style: Theme.of(context).textTheme.titleSmall),
                      Text(appt.ownerName ?? 'Owner'),
                      Text(appt.type),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(_timeLabel(appt.startTime)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {},
                    child: const Text('View Details'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: onStart,
                    child: const Text('Start'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _timeLabel(String raw) {
    try {
      final dt = DateTime.parse(raw).toLocal();
      final h = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
      final m = dt.minute.toString().padLeft(2, '0');
      final ap = dt.hour >= 12 ? 'PM' : 'AM';
      return '$h:$m $ap';
    } catch (_) {
      return raw;
    }
  }
}
