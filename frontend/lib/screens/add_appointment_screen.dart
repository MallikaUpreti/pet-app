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
  final _type = TextEditingController(text: 'Consultation');
  final _notes = TextEditingController();

  Pet? _selectedPet;
  Vet? _selectedVet;
  DateTime? _start;
  bool _loading = false;

  @override
  void dispose() {
    _type.dispose();
    _notes.dispose();
    super.dispose();
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
      await app.createAppointment({
        'pet_id': _selectedPet!.id,
        'vet_user_id': _selectedVet!.id,
        'type': _type.text.trim(),
        'start_time': _start!.toUtc().toIso8601String(),
        'notes': _notes.text.trim(),
      });
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

          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                children: [
                  DropdownButtonFormField<Pet>(
                    value: _selectedPet,
                    decoration: const InputDecoration(labelText: 'Pet'),
                    items: pets
                        .map((pet) => DropdownMenuItem(
                              value: pet,
                              child: Text(pet.name),
                            ))
                        .toList(),
                    onChanged: (value) => setState(() => _selectedPet = value),
                    validator: (v) => v == null ? 'Required' : null,
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
                  TextFormField(
                    controller: _type,
                    decoration: const InputDecoration(labelText: 'Appointment type'),
                  ),
                  const SizedBox(height: 16),
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
