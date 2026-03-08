import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../state/app_state.dart';

class VetPatientsScreen extends StatefulWidget {
  const VetPatientsScreen({super.key});

  @override
  State<VetPatientsScreen> createState() => _VetPatientsScreenState();
}

class _VetPatientsScreenState extends State<VetPatientsScreen> {
  bool _loading = true;
  List<dynamic> _patients = [];
  String _query = '';
  String _selectedTab = 'All';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final app = context.read<AppState>();
    try {
      final patients = await app.fetchVetPatients();
      if (!mounted) return;
      setState(() => _patients = patients);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _patients.where((p) {
      final name = (p['PetName'] ?? '').toString().toLowerCase();
      final owner = (p['OwnerName'] ?? '').toString().toLowerCase();
      return name.contains(_query) || owner.contains(_query);
    }).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Patients')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text('${filtered.length} total patients',
              style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 12),
          TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Search patients...',
            ),
            onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
          ),
          const SizedBox(height: 16),
          _SegmentTabs(
            tabs: const ['All', 'Needs Attention', 'Upcoming'],
            selected: _selectedTab,
            onSelected: (v) => setState(() => _selectedTab = v),
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (filtered.isEmpty)
            const Text('No patients yet.')
          else
            ...filtered.where(_matchTab).map((p) {
              final status = _statusFor(p);
              return Card(
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
                            child: Text((p['PetName'] ?? 'P')[0]),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(p['PetName'] ?? 'Pet',
                                    style: Theme.of(context).textTheme.titleSmall),
                                Text(
                                  '${p['Species'] ?? ''}${p['Breed'] != null ? ' • ${p['Breed']}' : ''}',
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                                Text(
                                  'Owner: ${p['OwnerName'] ?? '-'} (#${p['OwnerId'] ?? '-'})',
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              ],
                            ),
                          ),
                          _StatusPill(status: status),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text('Last visit: ${_formatDate(p['LastVisit'])}'),
                      Text('Next: ${_formatDate(p['NextVisit'])}'),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () => _viewRecords(context, p['PetId']),
                              child: const Text('View Record'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
        ],
      ),
    );
  }

  bool _matchTab(dynamic p) {
    if (_selectedTab == 'All') return true;
    final status = _statusFor(p);
    if (_selectedTab == 'Needs Attention') return status == 'attention';
    if (_selectedTab == 'Upcoming') return _hasUpcoming(p);
    return true;
  }

  bool _hasUpcoming(dynamic p) {
    final next = p['NextVisit'];
    return next != null && next.toString().isNotEmpty;
  }

  String _statusFor(dynamic p) {
    final last = p['LastVisit'];
    if (last == null) return 'attention';
    try {
      final dt = DateTime.parse(last.toString()).toLocal();
      final days = DateTime.now().difference(dt).inDays;
      if (days > 60) return 'attention';
      if (days > 30) return 'fair';
      return 'good';
    } catch (_) {
      return 'fair';
    }
  }

  String _formatDate(dynamic raw) {
    if (raw == null) return '-';
    try {
      final dt = DateTime.parse(raw.toString()).toLocal();
      return DateFormat('MMM d, yyyy').format(dt);
    } catch (_) {
      return raw.toString();
    }
  }

  Future<void> _viewRecords(BuildContext context, int petId) async {
    final app = context.read<AppState>();
    final records = await app.fetchRecords(petId);
    if (!mounted) return;
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Patient Records'),
        content: SizedBox(
          width: double.maxFinite,
          child: ListView(
            shrinkWrap: true,
            children: records
                .map((r) => ListTile(
                      title: Text(r.title),
                      subtitle: Text(r.notes ?? ''),
                    ))
                .toList(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Close')),
        ],
      ),
    );
  }
}

class _SegmentTabs extends StatelessWidget {
  final List<String> tabs;
  final String selected;
  final ValueChanged<String> onSelected;
  const _SegmentTabs({required this.tabs, required this.selected, required this.onSelected});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: tabs.map((t) {
          final active = t == selected;
          return Expanded(
            child: InkWell(
              onTap: () => onSelected(t),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: active ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  t,
                  textAlign: TextAlign.center,
                  style: TextStyle(fontWeight: active ? FontWeight.bold : FontWeight.normal),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final String status;
  const _StatusPill({required this.status});

  @override
  Widget build(BuildContext context) {
    final color = status == 'good'
        ? const Color(0xFF8FD19E)
        : status == 'attention'
            ? const Color(0xFFFFA3A3)
            : const Color(0xFFF9D65D);
    final label = status == 'good'
        ? 'good'
        : status == 'attention'
            ? 'attention'
            : 'fair';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.3),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(label, style: const TextStyle(fontSize: 12)),
    );
  }
}
