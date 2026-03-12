import 'package:flutter/material.dart';

import '../models/models.dart';

class PetCard extends StatelessWidget {
  final Pet pet;
  final VoidCallback? onTap;

  const PetCard({
    super.key,
    required this.pet,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: const Color(0xFFDB6C3D).withOpacity(0.15),
                child: Text(
                  pet.name.isNotEmpty ? pet.name[0].toUpperCase() : '?',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(pet.name, style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 4),
                    Text(
                      '${pet.species}${pet.breed != null ? ' • ${pet.breed}' : ''}',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    if (pet.ageMonths != null || pet.weightKg != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          '${pet.ageMonths != null ? '${pet.ageMonths} mo' : ''}'
                          '${pet.ageMonths != null && pet.weightKg != null ? ' • ' : ''}'
                          '${pet.weightKg != null ? '${pet.weightKg} kg' : ''}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}
