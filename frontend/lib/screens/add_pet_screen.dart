import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';

class AddPetScreen extends StatefulWidget {
  const AddPetScreen({super.key});

  @override
  State<AddPetScreen> createState() => _AddPetScreenState();
}

class _AddPetScreenState extends State<AddPetScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _species = TextEditingController();
  final _breed = TextEditingController();
  final _ageMonths = TextEditingController();
  final _weight = TextEditingController();
  final _allergies = TextEditingController();
  final _diseases = TextEditingController();

  bool _loading = false;

  @override
  void dispose() {
    _name.dispose();
    _species.dispose();
    _breed.dispose();
    _ageMonths.dispose();
    _weight.dispose();
    _allergies.dispose();
    _diseases.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    final app = context.read<AppState>();
    try {
      final petId = await app.createPet({
        'name': _name.text.trim(),
        'species': _species.text.trim(),
        'breed': _breed.text.trim(),
        'age_months': int.tryParse(_ageMonths.text.trim()),
        'weight_kg': double.tryParse(_weight.text.trim()),
        'allergies': _allergies.text.trim(),
        'diseases': _diseases.text.trim(),
      });
      app.setActivePet(petId);
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
    return Scaffold(
      appBar: AppBar(title: const Text('Add pet')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Pet name'),
                validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _species,
                decoration: const InputDecoration(labelText: 'Species'),
                validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _breed,
                decoration: const InputDecoration(labelText: 'Breed'),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _ageMonths,
                decoration: const InputDecoration(labelText: 'Age (months)'),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _weight,
                decoration: const InputDecoration(labelText: 'Weight (kg)'),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _allergies,
                decoration: const InputDecoration(labelText: 'Allergies'),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _diseases,
                decoration: const InputDecoration(labelText: 'Diseases'),
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
                      : const Text('Save'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
