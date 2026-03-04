import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../state/app_state.dart';
import '../widgets/empty_state.dart';

class PetDetailScreen extends StatelessWidget {
  final Pet pet;

  const PetDetailScreen({super.key, required this.pet});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: Text(pet.name),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Diet'),
              Tab(text: 'Meds'),
              Tab(text: 'Vaccines'),
              Tab(text: 'Records'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _DietTab(petId: pet.id),
            _MedsTab(petId: pet.id),
            _VaccinesTab(petId: pet.id),
            _RecordsTab(petId: pet.id),
          ],
        ),
      ),
    );
  }
}

class _DietTab extends StatefulWidget {
  final int petId;

  const _DietTab({required this.petId});

  @override
  State<_DietTab> createState() => _DietTabState();
}

class _DietTabState extends State<_DietTab> {
  late Future<List<DietPlan>> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<AppState>().fetchDietPlans(widget.petId);
  }

  void _reload() {
    setState(() {
      _future = context.read<AppState>().fetchDietPlans(widget.petId);
    });
  }

  Future<void> _addDietPlan() async {
    final app = context.read<AppState>();
    final result = await showModalBottomSheet<_DietInput>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _DietForm(),
    );
    if (result == null) return;
    await app.createDietPlan(widget.petId, {
      'title': result.title,
      'details': result.details,
      'calories': result.calories,
      'allergies': result.allergies,
    });
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<DietPlan>>(
      future: _future,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final items = snapshot.data!;
        if (items.isEmpty) {
          return _EmptyWithAction(
            icon: Icons.restaurant,
            title: 'No diet plans yet',
            body: 'Add a diet plan to track food, calories, and allergies.',
            actionLabel: 'Add diet plan',
            onAction: _addDietPlan,
          );
        }
        return ListView(
          padding: const EdgeInsets.all(24),
          children: [
            ...items.map(
              (plan) => Card(
                child: ListTile(
                  title: Text(plan.title),
                  subtitle: Text(plan.details),
                  trailing: plan.calories != null
                      ? Text('${plan.calories} kcal')
                      : null,
                ),
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _addDietPlan,
              icon: const Icon(Icons.add),
              label: const Text('Add diet plan'),
            ),
          ],
        );
      },
    );
  }
}

class _MedsTab extends StatefulWidget {
  final int petId;

  const _MedsTab({required this.petId});

  @override
  State<_MedsTab> createState() => _MedsTabState();
}

class _MedsTabState extends State<_MedsTab> {
  late Future<List<Medication>> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<AppState>().fetchMedications(widget.petId);
  }

  void _reload() {
    setState(() {
      _future = context.read<AppState>().fetchMedications(widget.petId);
    });
  }

  Future<void> _addMedication() async {
    final app = context.read<AppState>();
    final result = await showModalBottomSheet<_MedicationInput>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _MedicationForm(),
    );
    if (result == null) return;
    await app.createMedication(widget.petId, {
      'name': result.name,
      'dosage': result.dosage,
      'frequency': result.frequency,
      'notes': result.notes,
    });
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Medication>>(
      future: _future,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final items = snapshot.data!;
        if (items.isEmpty) {
          return _EmptyWithAction(
            icon: Icons.medication,
            title: 'No medications yet',
            body: 'Track dosages and schedules here.',
            actionLabel: 'Add medication',
            onAction: _addMedication,
          );
        }
        return ListView(
          padding: const EdgeInsets.all(24),
          children: [
            ...items.map(
              (med) => Card(
                child: ListTile(
                  title: Text(med.name),
                  subtitle: Text(
                    [med.dosage, med.frequency]
                        .where((e) => e != null && e.isNotEmpty)
                        .join(' • '),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _addMedication,
              icon: const Icon(Icons.add),
              label: const Text('Add medication'),
            ),
          ],
        );
      },
    );
  }
}

class _VaccinesTab extends StatefulWidget {
  final int petId;

  const _VaccinesTab({required this.petId});

  @override
  State<_VaccinesTab> createState() => _VaccinesTabState();
}

class _VaccinesTabState extends State<_VaccinesTab> {
  late Future<List<Vaccination>> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<AppState>().fetchVaccinations(widget.petId);
  }

  void _reload() {
    setState(() {
      _future = context.read<AppState>().fetchVaccinations(widget.petId);
    });
  }

  Future<void> _addVaccine() async {
    final app = context.read<AppState>();
    final result = await showModalBottomSheet<_VaccineInput>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _VaccineForm(),
    );
    if (result == null) return;
    await app.createVaccination(widget.petId, {
      'name': result.name,
      'status': result.status,
      'notes': result.notes,
    });
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Vaccination>>(
      future: _future,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final items = snapshot.data!;
        if (items.isEmpty) {
          return _EmptyWithAction(
            icon: Icons.vaccines,
            title: 'No vaccines yet',
            body: 'Keep vaccine history and next due dates here.',
            actionLabel: 'Add vaccine',
            onAction: _addVaccine,
          );
        }
        return ListView(
          padding: const EdgeInsets.all(24),
          children: [
            ...items.map(
              (vac) => Card(
                child: ListTile(
                  title: Text(vac.name),
                  subtitle: Text('Status: ${vac.status}'),
                ),
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _addVaccine,
              icon: const Icon(Icons.add),
              label: const Text('Add vaccine'),
            ),
          ],
        );
      },
    );
  }
}

class _RecordsTab extends StatefulWidget {
  final int petId;

  const _RecordsTab({required this.petId});

  @override
  State<_RecordsTab> createState() => _RecordsTabState();
}

class _RecordsTabState extends State<_RecordsTab> {
  late Future<List<RecordItem>> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<AppState>().fetchRecords(widget.petId);
  }

  void _reload() {
    setState(() {
      _future = context.read<AppState>().fetchRecords(widget.petId);
    });
  }

  Future<void> _addRecord() async {
    final app = context.read<AppState>();
    final result = await showModalBottomSheet<_RecordInput>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _RecordForm(),
    );
    if (result == null) return;
    await app.createRecord(widget.petId, {
      'title': result.title,
      'notes': result.notes,
      'file_url': result.fileUrl,
    });
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<RecordItem>>(
      future: _future,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final items = snapshot.data!;
        if (items.isEmpty) {
          return _EmptyWithAction(
            icon: Icons.folder_copy,
            title: 'No records yet',
            body: 'Store prescriptions, receipts, and visit notes.',
            actionLabel: 'Add record',
            onAction: _addRecord,
          );
        }
        return ListView(
          padding: const EdgeInsets.all(24),
          children: [
            ...items.map(
              (rec) => Card(
                child: ListTile(
                  title: Text(rec.title),
                  subtitle: rec.notes != null ? Text(rec.notes!) : null,
                ),
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _addRecord,
              icon: const Icon(Icons.add),
              label: const Text('Add record'),
            ),
          ],
        );
      },
    );
  }
}

class _EmptyWithAction extends StatelessWidget {
  final IconData icon;
  final String title;
  final String body;
  final String actionLabel;
  final VoidCallback onAction;

  const _EmptyWithAction({
    required this.icon,
    required this.title,
    required this.body,
    required this.actionLabel,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: EmptyState(
        icon: icon,
        title: title,
        body: body,
        action: ElevatedButton(
          onPressed: onAction,
          child: Text(actionLabel),
        ),
      ),
    );
  }
}

class _DietForm extends StatefulWidget {
  const _DietForm();

  @override
  State<_DietForm> createState() => _DietFormState();
}

class _DietFormState extends State<_DietForm> {
  final _title = TextEditingController();
  final _details = TextEditingController();
  final _calories = TextEditingController();
  final _allergies = TextEditingController();

  @override
  void dispose() {
    _title.dispose();
    _details.dispose();
    _calories.dispose();
    _allergies.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _BottomSheetContainer(
      title: 'Add diet plan',
      onSubmit: () {
        Navigator.of(context).pop(
          _DietInput(
            title: _title.text.trim(),
            details: _details.text.trim(),
            calories: int.tryParse(_calories.text.trim()),
            allergies: _allergies.text.trim(),
          ),
        );
      },
      child: Column(
        children: [
          TextField(
            controller: _title,
            decoration: const InputDecoration(labelText: 'Title'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _details,
            decoration: const InputDecoration(labelText: 'Details'),
            maxLines: 3,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _calories,
            decoration: const InputDecoration(labelText: 'Calories'),
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _allergies,
            decoration: const InputDecoration(labelText: 'Allergies'),
          ),
        ],
      ),
    );
  }
}

class _MedicationForm extends StatefulWidget {
  const _MedicationForm();

  @override
  State<_MedicationForm> createState() => _MedicationFormState();
}

class _MedicationFormState extends State<_MedicationForm> {
  final _name = TextEditingController();
  final _dosage = TextEditingController();
  final _frequency = TextEditingController();
  final _notes = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    _dosage.dispose();
    _frequency.dispose();
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _BottomSheetContainer(
      title: 'Add medication',
      onSubmit: () {
        Navigator.of(context).pop(
          _MedicationInput(
            name: _name.text.trim(),
            dosage: _dosage.text.trim(),
            frequency: _frequency.text.trim(),
            notes: _notes.text.trim(),
          ),
        );
      },
      child: Column(
        children: [
          TextField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'Name'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _dosage,
            decoration: const InputDecoration(labelText: 'Dosage'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _frequency,
            decoration: const InputDecoration(labelText: 'Frequency'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _notes,
            decoration: const InputDecoration(labelText: 'Notes'),
            maxLines: 2,
          ),
        ],
      ),
    );
  }
}

class _VaccineForm extends StatefulWidget {
  const _VaccineForm();

  @override
  State<_VaccineForm> createState() => _VaccineFormState();
}

class _VaccineFormState extends State<_VaccineForm> {
  final _name = TextEditingController();
  final _status = TextEditingController(text: 'Due');
  final _notes = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    _status.dispose();
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _BottomSheetContainer(
      title: 'Add vaccine',
      onSubmit: () {
        Navigator.of(context).pop(
          _VaccineInput(
            name: _name.text.trim(),
            status: _status.text.trim(),
            notes: _notes.text.trim(),
          ),
        );
      },
      child: Column(
        children: [
          TextField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'Name'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _status,
            decoration: const InputDecoration(labelText: 'Status'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _notes,
            decoration: const InputDecoration(labelText: 'Notes'),
            maxLines: 2,
          ),
        ],
      ),
    );
  }
}

class _RecordForm extends StatefulWidget {
  const _RecordForm();

  @override
  State<_RecordForm> createState() => _RecordFormState();
}

class _RecordFormState extends State<_RecordForm> {
  final _title = TextEditingController();
  final _fileUrl = TextEditingController();
  final _notes = TextEditingController();

  @override
  void dispose() {
    _title.dispose();
    _fileUrl.dispose();
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _BottomSheetContainer(
      title: 'Add record',
      onSubmit: () {
        Navigator.of(context).pop(
          _RecordInput(
            title: _title.text.trim(),
            fileUrl: _fileUrl.text.trim(),
            notes: _notes.text.trim(),
          ),
        );
      },
      child: Column(
        children: [
          TextField(
            controller: _title,
            decoration: const InputDecoration(labelText: 'Title'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _fileUrl,
            decoration: const InputDecoration(labelText: 'File URL'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _notes,
            decoration: const InputDecoration(labelText: 'Notes'),
            maxLines: 2,
          ),
        ],
      ),
    );
  }
}

class _BottomSheetContainer extends StatelessWidget {
  final String title;
  final Widget child;
  final VoidCallback onSubmit;

  const _BottomSheetContainer({
    required this.title,
    required this.child,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          child,
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: onSubmit,
              child: const Text('Save'),
            ),
          ),
        ],
      ),
    );
  }
}

class _DietInput {
  final String title;
  final String details;
  final int? calories;
  final String? allergies;

  _DietInput({
    required this.title,
    required this.details,
    this.calories,
    this.allergies,
  });
}

class _MedicationInput {
  final String name;
  final String? dosage;
  final String? frequency;
  final String? notes;

  _MedicationInput({
    required this.name,
    this.dosage,
    this.frequency,
    this.notes,
  });
}

class _VaccineInput {
  final String name;
  final String status;
  final String? notes;

  _VaccineInput({
    required this.name,
    required this.status,
    this.notes,
  });
}

class _RecordInput {
  final String title;
  final String? fileUrl;
  final String? notes;

  _RecordInput({
    required this.title,
    this.fileUrl,
    this.notes,
  });
}
