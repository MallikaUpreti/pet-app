import 'package:flutter/material.dart';

import 'owner_home_screen.dart';
import 'owner_appointments_screen.dart';
import 'owner_diet_screen.dart';
import 'owner_chat_screen.dart';
import 'owner_profile_screen.dart';

class OwnerShell extends StatefulWidget {
  const OwnerShell({super.key});

  @override
  State<OwnerShell> createState() => _OwnerShellState();
}

class _OwnerShellState extends State<OwnerShell> {
  int _index = 0;

  final _screens = const [
    OwnerHomeScreen(),
    OwnerAppointmentsScreen(),
    OwnerDietScreen(),
    OwnerChatScreen(),
    OwnerProfileScreen(),
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
          NavigationDestination(icon: Icon(Icons.restaurant_menu), label: 'Diet'),
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline), label: 'Chat'),
          NavigationDestination(icon: Icon(Icons.person_outline), label: 'Profile'),
        ],
      ),
    );
  }
}
