import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:convert';

import '../models/models.dart';
import '../state/app_state.dart';

class OwnerDietScreen extends StatefulWidget {
  const OwnerDietScreen({super.key});

  @override
  State<OwnerDietScreen> createState() => _OwnerDietScreenState();
}

class _OwnerDietScreenState extends State<OwnerDietScreen> {
  Pet? _selectedPet;
  Future<List<dynamic>>? _mealsFuture;
  DietPlan? _latestPlan;
  Map<String, dynamic>? _planJson;

  @override
  Widget build(BuildContext context) {
    final app = context.read<AppState>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Diet Chart'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: OutlinedButton.icon(
              onPressed: () async {
                if (_selectedPet == null) return;
                await app.generateDietPlan(_selectedPet!.id);
                if (_selectedPet != null) {
                  final plans = await app.fetchDietPlans(_selectedPet!.id);
                  if (plans.isNotEmpty) {
                    _latestPlan = plans.first;
                    _planJson = _decodePlan(plans.first.details);
                  }
                }
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Generated a diet plan from your data.')),
                );
                setState(() {});
              },
              icon: const Icon(Icons.auto_awesome),
              label: const Text('Generate'),
            ),
          ),
        ],
      ),
      body: FutureBuilder<List<Pet>>(
        future: app.fetchPets(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final pets = snapshot.data!;
          if (pets.isEmpty) {
            return const Center(child: Text('Add a pet first.'));
          }
          final activeId = app.activePetId ?? pets.first.id;
          final resolved = pets.firstWhere((p) => p.id == activeId, orElse: () => pets.first);
          if (_selectedPet == null || _selectedPet!.id != resolved.id) {
            _selectedPet = resolved;
            _mealsFuture = app.fetchMeals(_selectedPet!.id);
            app.fetchDietPlans(_selectedPet!.id).then((plans) {
              if (!mounted) return;
              if (plans.isNotEmpty) {
                _latestPlan = plans.first;
                _planJson = _decodePlan(plans.first.details);
              } else {
                _latestPlan = null;
                _planJson = null;
              }
              setState(() {});
            });
          }
          return ListView(
            padding: const EdgeInsets.all(24),
            children: [
              if (_latestPlan == null)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: const [
                        Text('No diet chart yet. Click Generate to create one.'),
                      ],
                    ),
                  ),
                )
              else
                Column(
                  children: [
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            const Icon(Icons.pets),
                            const SizedBox(width: 12),
                            Text(
                              '${_selectedPet!.name} • ${_selectedPet!.species}',
                              style: Theme.of(context).textTheme.titleSmall,
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Weekly Diet Chart',
                                style: Theme.of(context).textTheme.titleMedium),
                            const SizedBox(height: 12),
                            _WeeklyTable(planJson: _planJson),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => _editPlan(context, app),
                            child: const Text('Edit'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
            ],
          );
        },
      ),
    );
  }

  Map<String, dynamic>? _decodePlan(String details) {
    try {
      return Map<String, dynamic>.from(jsonDecode(details));
    } catch (_) {
      return null;
    }
  }

  Future<void> _editPlan(BuildContext context, AppState app) async {
    if (_latestPlan == null) return;
    final controller = TextEditingController(text: _latestPlan!.details);
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Edit Diet Plan'),
        content: TextField(
          controller: controller,
          maxLines: 10,
          decoration: const InputDecoration(hintText: 'Plan JSON'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Save')),
        ],
      ),
    );
    if (ok == true) {
      await app.updateDietPlan(_latestPlan!.id, {'details': controller.text});
      final plans = await app.fetchDietPlans(_selectedPet!.id);
      if (plans.isNotEmpty) {
        _latestPlan = plans.first;
        _planJson = _decodePlan(plans.first.details);
      }
      setState(() {});
    }
  }
}

class _WeeklyTable extends StatelessWidget {
  final Map<String, dynamic>? planJson;
  const _WeeklyTable({required this.planJson});

  @override
  Widget build(BuildContext context) {
    final weekly = (planJson?['weekly_plan'] as List?) ?? [];
    if (weekly.isEmpty) {
      return const Text('No plan data available.');
    }
    return Table(
      border: TableBorder.all(color: Colors.grey.shade200),
      columnWidths: const {
        0: FlexColumnWidth(2),
        1: FlexColumnWidth(3),
        2: FlexColumnWidth(3),
        3: FlexColumnWidth(3),
      },
      children: [
        const TableRow(children: [
          Padding(padding: EdgeInsets.all(8), child: Text('Day', style: TextStyle(fontWeight: FontWeight.bold))),
          Padding(padding: EdgeInsets.all(8), child: Text('Breakfast', style: TextStyle(fontWeight: FontWeight.bold))),
          Padding(padding: EdgeInsets.all(8), child: Text('Lunch', style: TextStyle(fontWeight: FontWeight.bold))),
          Padding(padding: EdgeInsets.all(8), child: Text('Dinner', style: TextStyle(fontWeight: FontWeight.bold))),
        ]),
        ...weekly.map((day) {
          final meals = (day['meals'] as List?) ?? [];
          String item(int i) {
            if (meals.length <= i) return '-';
            final items = meals[i]['items'] as List?;
            if (items == null || items.isEmpty) return '-';
            return items.first.toString();
          }
          return TableRow(children: [
            Padding(padding: const EdgeInsets.all(8), child: Text(day['day'].toString())),
            Padding(padding: const EdgeInsets.all(8), child: Text(item(0))),
            Padding(padding: const EdgeInsets.all(8), child: Text(item(1))),
            Padding(padding: const EdgeInsets.all(8), child: Text(item(2))),
          ]);
        }).toList(),
      ],
    );
  }
}

class _Macro extends StatelessWidget {
  final String label;
  final String value;

  const _Macro({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        Text(label, style: const TextStyle(color: Colors.white70)),
      ],
    );
  }
}

class _ProgressRow extends StatelessWidget {
  final String label;
  final double value;
  final Color color;

  const _ProgressRow({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label),
            Text('${(value * 100).round()}%'),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            value: value,
            minHeight: 8,
            backgroundColor: color.withOpacity(0.2),
            valueColor: AlwaysStoppedAnimation(color),
          ),
        ),
      ],
    );
  }
}

class _MealCard extends StatelessWidget {
  final String time;
  final String title;
  final String calories;
  final VoidCallback? onMarkFed;

  const _MealCard({
    required this.time,
    required this.title,
    required this.calories,
    this.onMarkFed,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(time),
                ),
                Text(calories, style: const TextStyle(color: Colors.deepOrange)),
              ],
            ),
            const SizedBox(height: 12),
            Text(title, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 6),
            const Text('Portion: 1.5 cups'),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: onMarkFed,
                child: const Text('Mark as Fed'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> _openMealForm(BuildContext context, AppState app) async {
  final state = context.findAncestorStateOfType<_OwnerDietScreenState>();
  final pet = state?._selectedPet;
  if (pet == null) return;
  final title = TextEditingController();
  final time = TextEditingController();
  final calories = TextEditingController();
  final portion = TextEditingController();

  await showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    builder: (_) => Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(controller: title, decoration: const InputDecoration(labelText: 'Title')),
          const SizedBox(height: 10),
          TextField(controller: time, decoration: const InputDecoration(labelText: 'Time')),
          const SizedBox(height: 10),
          TextField(
            controller: calories,
            decoration: const InputDecoration(labelText: 'Calories'),
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 10),
          TextField(controller: portion, decoration: const InputDecoration(labelText: 'Portion')),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () async {
                await app.createMeal(pet.id, {
                  'title': title.text.trim(),
                  'meal_time': time.text.trim(),
                  'calories': int.tryParse(calories.text.trim()),
                  'portion': portion.text.trim(),
                });
                if (context.mounted) Navigator.of(context).pop(true);
              },
              child: const Text('Save Meal'),
            ),
          ),
        ],
      ),
    ),
  );

  if (state != null) {
    state._mealsFuture = app.fetchMeals(pet.id);
    state.setState(() {});
  }
}
