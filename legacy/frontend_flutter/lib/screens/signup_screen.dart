import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';

class SignupScreen extends StatefulWidget {
  final String initialRole;
  const SignupScreen({super.key, this.initialRole = 'owner'});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _clinic = TextEditingController();
  final _license = TextEditingController();
  final _clinicPhone = TextEditingController();
  final _bio = TextEditingController();
  late String _role;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _role = widget.initialRole;
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _password.dispose();
    _clinic.dispose();
    _license.dispose();
    _clinicPhone.dispose();
    _bio.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    final app = context.read<AppState>();

    try {
      await app.signup({
        'full_name': _name.text.trim(),
        'email': _email.text.trim(),
        'phone': _phone.text.trim(),
        'password': _password.text.trim(),
        'role': _role,
        'clinic_name': _role == 'vet' ? _clinic.text.trim() : null,
        'license_no': _role == 'vet' ? _license.text.trim() : null,
        'clinic_phone': _role == 'vet' ? _clinicPhone.text.trim() : null,
        'bio': _role == 'vet' ? _bio.text.trim() : null,
      });
      if (!mounted) return;
      Navigator.of(context).popUntil((route) => route.isFirst);
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
      appBar: AppBar(title: const Text('Create account')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Full name'),
                validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _email,
                decoration: const InputDecoration(labelText: 'Email'),
                keyboardType: TextInputType.emailAddress,
                validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _phone,
                decoration: const InputDecoration(labelText: 'Phone'),
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 16),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('I am a', style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: ChoiceChip(
                          label: const Text('Pet Owner'),
                          selected: _role == 'owner',
                          onSelected: (_) => setState(() => _role = 'owner'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ChoiceChip(
                          label: const Text('Veterinarian'),
                          selected: _role == 'vet',
                          onSelected: (_) => setState(() => _role = 'vet'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _password,
                decoration: const InputDecoration(labelText: 'Password'),
                obscureText: true,
                validator: (v) => (v == null || v.length < 6) ? 'Min 6 chars' : null,
              ),
              if (_role == 'vet') ...[
                const SizedBox(height: 20),
                TextFormField(
                  controller: _clinic,
                  decoration: const InputDecoration(labelText: 'Clinic name'),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _license,
                  decoration: const InputDecoration(labelText: 'License number'),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _clinicPhone,
                  decoration: const InputDecoration(labelText: 'Clinic phone'),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _bio,
                  decoration: const InputDecoration(labelText: 'Bio'),
                  maxLines: 3,
                ),
              ],
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
                      : const Text('Create account'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
