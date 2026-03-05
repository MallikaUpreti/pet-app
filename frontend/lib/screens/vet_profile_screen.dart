import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';

class VetProfileScreen extends StatefulWidget {
  const VetProfileScreen({super.key});

  @override
  State<VetProfileScreen> createState() => _VetProfileScreenState();
}

class _VetProfileScreenState extends State<VetProfileScreen> {
  Map<String, dynamic>? _profile;

  Future<void> _load() async {
    final app = context.read<AppState>();
    final profile = await app.fetchVetProfile();
    if (!mounted) return;
    setState(() => _profile = profile);
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final isOnline = (_profile?['IsOnline'] ?? 0) == 1 || (_profile?['IsOnline'] == true);
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text('Manage your professional profile',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey)),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const CircleAvatar(
                    radius: 30,
                    backgroundImage: NetworkImage(
                      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop',
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(app.fullName ?? 'Dr. Veterinarian',
                            style: Theme.of(context).textTheme.titleMedium),
                        Text(_profile?['ClinicName'] ?? 'General Practice'),
                        const SizedBox(height: 6),
                        Row(
                          children: const [
                            Icon(Icons.star, size: 16, color: Color(0xFFFFC107)),
                            SizedBox(width: 4),
                            Text('4.9 rating'),
                          ],
                        ),
                      ],
                    ),
                  ),
                  OutlinedButton.icon(
                    onPressed: () async {
                      final name = TextEditingController(text: app.fullName ?? '');
                      final phone = TextEditingController(text: _profile?['Phone'] ?? '');
                      final clinic = TextEditingController(text: _profile?['ClinicName'] ?? '');
                      final license = TextEditingController(text: _profile?['LicenseNo'] ?? '');
                      final clinicPhone =
                          TextEditingController(text: _profile?['ClinicPhone'] ?? '');
                      final bio = TextEditingController(text: _profile?['Bio'] ?? '');
                      final result = await showDialog<bool>(
                        context: context,
                        builder: (_) => AlertDialog(
                          title: const Text('Edit Profile'),
                          content: SingleChildScrollView(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                TextField(controller: name, decoration: const InputDecoration(labelText: 'Full Name')),
                                TextField(controller: phone, decoration: const InputDecoration(labelText: 'Phone')),
                                TextField(controller: clinic, decoration: const InputDecoration(labelText: 'Clinic Name')),
                                TextField(controller: license, decoration: const InputDecoration(labelText: 'License No')),
                                TextField(controller: clinicPhone, decoration: const InputDecoration(labelText: 'Clinic Phone')),
                                TextField(controller: bio, decoration: const InputDecoration(labelText: 'Bio')),
                              ],
                            ),
                          ),
                          actions: [
                            TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
                            FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Save')),
                          ],
                        ),
                      );
                      if (result == true) {
                        await app.updateVetProfile({
                          'full_name': name.text.trim(),
                          'phone': phone.text.trim(),
                          'clinic_name': clinic.text.trim(),
                          'license_no': license.text.trim(),
                          'clinic_phone': clinicPhone.text.trim(),
                          'bio': bio.text.trim(),
                        });
                        await _load();
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
                children: const [
                  _StatItem(label: 'Years Exp', value: '12'),
                  _StatItem(label: 'Patients', value: '156'),
                  _StatItem(label: 'Completed', value: '1247'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text('Credentials', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          Card(
            child: Column(
              children: const [
                ListTile(
                  leading: CircleAvatar(child: Icon(Icons.verified)),
                  title: Text('Board Certified Veterinarian'),
                  subtitle: Text('AVMA, 2015'),
                ),
                Divider(height: 0),
                ListTile(
                  leading: CircleAvatar(child: Icon(Icons.school)),
                  title: Text('Specialty Certification'),
                  subtitle: Text('General Practice'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text('Contact Information', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.email)),
                  title: const Text('Email'),
                  subtitle: Text(_profile?['Email'] ?? '-'),
                  trailing: const Icon(Icons.chevron_right),
                ),
                const Divider(height: 0),
                ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.phone)),
                  title: const Text('Phone'),
                  subtitle: Text(_profile?['Phone'] ?? '-'),
                  trailing: const Icon(Icons.chevron_right),
                ),
                const Divider(height: 0),
                ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.location_on)),
                  title: const Text('Clinic Location'),
                  subtitle: Text(_profile?['ClinicName'] ?? '-'),
                  trailing: const Icon(Icons.chevron_right),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text('Availability', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  SwitchListTile(
                    title: const Text('Available for Appointments'),
                    subtitle: const Text('Patients can book slots'),
                    value: isOnline,
                    onChanged: (v) async {
                      await app.updateVetProfile({'is_online': v ? 1 : 0});
                      await _load();
                    },
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: const [
                      _DayChip(label: 'Mon', selected: true),
                      _DayChip(label: 'Tue', selected: true),
                      _DayChip(label: 'Wed', selected: true),
                      _DayChip(label: 'Thu', selected: true),
                      _DayChip(label: 'Fri', selected: true),
                      _DayChip(label: 'Sat', selected: false),
                      _DayChip(label: 'Sun', selected: false),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text('Settings', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          Card(
            child: Column(
              children: [
                SwitchListTile(
                  title: const Text('Push Notifications'),
                  subtitle: const Text('Appointment alerts'),
                  value: true,
                  onChanged: (_) {},
                ),
                const Divider(height: 0),
                ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.lock)),
                  title: const Text('Security'),
                  subtitle: const Text('Password & 2FA'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {},
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () => app.logout(),
            child: const Text('Logout'),
          ),
        ],
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final String label;
  final String value;
  const _StatItem({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(color: Colors.grey)),
      ],
    );
  }
}

class _DayChip extends StatelessWidget {
  final String label;
  final bool selected;
  const _DayChip({required this.label, required this.selected});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: selected ? Colors.black : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.black12),
      ),
      child: Text(label, style: TextStyle(color: selected ? Colors.white : Colors.black87)),
    );
  }
}
