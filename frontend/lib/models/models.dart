class Pet {
  final int id;
  final int ownerId;
  final String name;
  final String species;
  final String? breed;
  final int? ageMonths;
  final double? weightKg;
  final String? allergies;
  final String? diseases;
  final String? photoUrl;

  Pet({
    required this.id,
    required this.ownerId,
    required this.name,
    required this.species,
    this.breed,
    this.ageMonths,
    this.weightKg,
    this.allergies,
    this.diseases,
    this.photoUrl,
  });

  factory Pet.fromJson(Map<String, dynamic> json) {
    return Pet(
      id: json["Id"] ?? json["id"],
      ownerId: json["OwnerId"] ?? json["owner_id"],
      name: json["Name"] ?? json["name"],
      species: json["Species"] ?? json["species"],
      breed: json["Breed"] ?? json["breed"],
      ageMonths: json["AgeMonths"] ?? json["age_months"],
      weightKg: (json["WeightKg"] ?? json["weight_kg"])?.toDouble(),
      allergies: json["Allergies"] ?? json["allergies"],
      diseases: json["Diseases"] ?? json["diseases"],
      photoUrl: json["PhotoUrl"] ?? json["photo_url"],
    );
  }
}

class Vet {
  final int id;
  final String fullName;
  final String? clinicName;
  final String? licenseNo;
  final String? clinicPhone;
  final String? bio;

  Vet({
    required this.id,
    required this.fullName,
    this.clinicName,
    this.licenseNo,
    this.clinicPhone,
    this.bio,
  });

  factory Vet.fromJson(Map<String, dynamic> json) {
    return Vet(
      id: json["Id"] ?? json["id"],
      fullName: json["FullName"] ?? json["full_name"],
      clinicName: json["ClinicName"] ?? json["clinic_name"],
      licenseNo: json["LicenseNo"] ?? json["license_no"],
      clinicPhone: json["ClinicPhone"] ?? json["clinic_phone"],
      bio: json["Bio"] ?? json["bio"],
    );
  }
}

class Appointment {
  final int id;
  final String type;
  final String status;
  final String startTime;
  final String? endTime;
  final String? notes;
  final int? petId;
  final int? ownerId;
  final String? petName;
  final String? vetName;
  final String? ownerName;

  Appointment({
    required this.id,
    required this.type,
    required this.status,
    required this.startTime,
    this.endTime,
    this.notes,
    this.petId,
    this.ownerId,
    this.petName,
    this.vetName,
    this.ownerName,
  });

  factory Appointment.fromJson(Map<String, dynamic> json) {
    return Appointment(
      id: json["Id"] ?? json["id"],
      type: json["Type"] ?? json["type"],
      status: json["Status"] ?? json["status"],
      startTime: json["StartTime"] ?? json["start_time"],
      endTime: json["EndTime"] ?? json["end_time"],
      notes: json["Notes"] ?? json["notes"],
      petId: json["PetId"] ?? json["pet_id"],
      ownerId: json["OwnerId"] ?? json["owner_id"],
      petName: json["PetName"] ?? json["pet_name"],
      vetName: json["VetName"] ?? json["vet_name"],
      ownerName: json["OwnerName"] ?? json["owner_name"],
    );
  }
}

class DietPlan {
  final int id;
  final String title;
  final String details;
  final int? calories;
  final String? allergies;
  final String? createdAt;

  DietPlan({
    required this.id,
    required this.title,
    required this.details,
    this.calories,
    this.allergies,
    this.createdAt,
  });

  factory DietPlan.fromJson(Map<String, dynamic> json) {
    return DietPlan(
      id: json["Id"] ?? json["id"],
      title: json["Title"] ?? json["title"],
      details: json["Details"] ?? json["details"],
      calories: json["Calories"] ?? json["calories"],
      allergies: json["Allergies"] ?? json["allergies"],
      createdAt: json["CreatedAt"] ?? json["created_at"],
    );
  }
}

class Medication {
  final int id;
  final String name;
  final String? dosage;
  final String? frequency;
  final String? startDate;
  final String? endDate;
  final String? notes;

  Medication({
    required this.id,
    required this.name,
    this.dosage,
    this.frequency,
    this.startDate,
    this.endDate,
    this.notes,
  });

  factory Medication.fromJson(Map<String, dynamic> json) {
    return Medication(
      id: json["Id"] ?? json["id"],
      name: json["Name"] ?? json["name"],
      dosage: json["Dosage"] ?? json["dosage"],
      frequency: json["Frequency"] ?? json["frequency"],
      startDate: json["StartDate"] ?? json["start_date"],
      endDate: json["EndDate"] ?? json["end_date"],
      notes: json["Notes"] ?? json["notes"],
    );
  }
}

class Vaccination {
  final int id;
  final String name;
  final String? dueDate;
  final String status;
  final String? notes;

  Vaccination({
    required this.id,
    required this.name,
    required this.status,
    this.dueDate,
    this.notes,
  });

  factory Vaccination.fromJson(Map<String, dynamic> json) {
    return Vaccination(
      id: json["Id"] ?? json["id"],
      name: json["Name"] ?? json["name"],
      dueDate: json["DueDate"] ?? json["due_date"],
      status: json["Status"] ?? json["status"],
      notes: json["Notes"] ?? json["notes"],
    );
  }
}

class RecordItem {
  final int id;
  final String title;
  final String? fileUrl;
  final String? notes;
  final String? visitDate;

  RecordItem({
    required this.id,
    required this.title,
    this.fileUrl,
    this.notes,
    this.visitDate,
  });

  factory RecordItem.fromJson(Map<String, dynamic> json) {
    return RecordItem(
      id: json["Id"] ?? json["id"],
      title: json["Title"] ?? json["title"],
      fileUrl: json["FileUrl"] ?? json["file_url"],
      notes: json["Notes"] ?? json["notes"],
      visitDate: json["VisitDate"] ?? json["visit_date"],
    );
  }
}
