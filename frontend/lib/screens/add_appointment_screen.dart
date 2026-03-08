import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../models/models.dart';
import '../state/app_state.dart';

class AddAppointmentScreen extends StatefulWidget {
  const AddAppointmentScreen({super.key});

  @override
  State<AddAppointmentScreen> createState() => _AddAppointmentScreenState();
}

class _AddAppointmentScreenState extends State<AddAppointmentScreen> {
  final _formKey = GlobalKey<FormState>();
  final _notes = TextEditingController();
  String _appointmentKind = 'general_checkup';
  String? _vaccineName;

  Pet? _selectedPet;
  Vet? _selectedVet;
  DateTime? _start;
  bool _loading = false;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  List<String> _vaccineOptionsForSpecies(String species) {
    final s = species.trim().toLowerCase();
    if (s == 'dog') return const ['Rabies', 'DHPPiL', 'Corona vaccine'];
    if (s == 'cat') return const ['Rabies', 'Tricat tri vaccine'];
    return const [];
  }

  Future<void> _pickDateTime() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (date == null) return;
    final time = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 10, minute: 0),
    );
    if (time == null) return;
    setState(() {
      _start = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedPet == null || _selectedVet == null || _start == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select pet, vet, and time.')),
      );
      return;
    }

    setState(() => _loading = true);
    final app = context.read<AppState>();
    try {
      final options = _vaccineOptionsForSpecies(_selectedPet!.species);
      if (_appointmentKind == 'vaccination') {
        if (_vaccineName == null || _vaccineName!.isEmpty) {
          throw Exception('Select vaccination name.');
        }
        if (!options.contains(_vaccineName)) {
          throw Exception('Selected vaccine is not valid for this pet species.');
        }
      }
      final type = _appointmentKind == 'vaccination'
          ? 'Vaccination: ${_vaccineName!}'
          : 'General Checkup';
      await app.createAppointment({
        'pet_id': _selectedPet!.id,
        'vet_user_id': _selectedVet!.id,
        'type': type,
        'appointment_kind': _appointmentKind,
        'vaccine_name': _appointmentKind == 'vaccination' ? _vaccineName : null,
        'start_time': _start!.toUtc().toIso8601String(),
        'notes': _notes.text.trim(),
      });
      app.setActivePet(_selectedPet!.id);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.read<AppState>();
    return Scaffold(
      appBar: AppBar(title: const Text('Book appointment')),
      body: FutureBuilder<List<dynamic>>(
        future: Future.wait([app.fetchPets(), app.fetchVets()]),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final pets = snapshot.data![0] as List<Pet>;
          final vets = snapshot.data![1] as List<Vet>;
          if (_selectedPet == null && pets.isNotEmpty) {
            final activeId = app.activePetId;
            _selectedPet =
                pets.firstWhere((p) => p.id == activeId, orElse: () => pets.first);
          }

          if (_selectedPet == null) {
            return const Center(child: Text('Select an active pet in Profile first.'));
          }
          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                children: [
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.pets),
                      title: Text(_selectedPet!.name),
                      subtitle: Text(_selectedPet!.species),
                      trailing: const Text('Active'),
                    ),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<Vet>(
                    value: _selectedVet,
                    decoration: const InputDecoration(labelText: 'Veterinarian'),
                    items: vets
                        .map((vet) => DropdownMenuItem(
                              value: vet,
                              child: Text(vet.fullName),
                            ))
                        .toList(),
                    onChanged: (value) => setState(() => _selectedVet = value),
                    validator: (v) => v == null ? 'Required' : null,
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    value: _appointmentKind,
                    decoration: const InputDecoration(labelText: 'Consultation type'),
                    items: const [
                      DropdownMenuItem(
                        value: 'general_checkup',
                        child: Text('General Checkup'),
                      ),
                      DropdownMenuItem(
                        value: 'vaccination',
                        child: Text('Vaccination Appointment'),
                      ),
                    ],
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() {
                        _appointmentKind = value;
                        if (_appointmentKind != 'vaccination') {
                          _vaccineName = null;
                        }
                      });
                    },
                  ),
                  const SizedBox(height: 16),
                  if (_appointmentKind == 'vaccination')
                    DropdownButtonFormField<String>(
                      value: _vaccineName,
                      decoration: const InputDecoration(labelText: 'Vaccination name'),
                      items: _vaccineOptionsForSpecies(_selectedPet!.species)
                          .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                          .toList(),
                      onChanged: (value) => setState(() => _vaccineName = value),
                      validator: (v) =>
                          _appointmentKind == 'vaccination' && (v == null || v.isEmpty)
                              ? 'Required'
                              : null,
                    ),
                  if (_appointmentKind == 'vaccination') const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: _pickDateTime,
                    icon: const Icon(Icons.calendar_today),
                    label: Text(_start == null
                        ? 'Pick date & time'
                        : DateFormat('MMM d, yyyy • h:mm a').format(_start!)),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _notes,
                    decoration: const InputDecoration(labelText: 'Notes'),
                    maxLines: 3,
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _loading ? null : _submit,
                      child: _loading
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Confirm appointment'),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
