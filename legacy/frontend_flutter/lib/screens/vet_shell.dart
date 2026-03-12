import 'package:flutter/material.dart';

import 'vet_home_screen.dart';
import 'vet_appointments_screen.dart';
import 'vet_patients_screen.dart';
import 'vet_chat_screen.dart';
import 'vet_profile_screen.dart';

class VetShell extends StatefulWidget {
  const VetShell({super.key});

  @override
  State<VetShell> createState() => _VetShellState();
}

class _VetShellState extends State<VetShell> {
  int _index = 0;

  final _screens = const [
    VetHomeScreen(),
    VetAppointmentsScreen(),
    VetPatientsScreen(),
    VetChatScreen(),
    VetProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.calendar_today), label: 'Appointments'),
          NavigationDestination(icon: Icon(Icons.favorite_border), label: 'Patients'),
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline), label: 'Chat'),
          NavigationDestination(icon: Icon(Icons.person_outline), label: 'Profile'),
        ],
      ),
    );
  }
}
