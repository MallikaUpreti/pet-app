import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../models/models.dart';

class AppState extends ChangeNotifier {
  String baseUrl = 'http://10.0.2.2:5000';
  String? token;
  String? role;
  int? userId;
  String? fullName;

  bool get isAuthenticated => token != null && role != null && userId != null;

  void setBaseUrl(String value) {
    baseUrl = value.trim();
    notifyListeners();
  }

  void logout() {
    token = null;
    role = null;
    userId = null;
    fullName = null;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    final data = await _post('/api/auth/login', {
      'email': email,
      'password': password,
    });

    token = data['token'];
    role = data['role'];
    userId = data['user_id'];
    fullName = data['full_name'];
    notifyListeners();
  }

  Future<void> signup(Map<String, dynamic> payload) async {
    final data = await _post('/api/auth/signup', payload);
    token = data['token'];
    role = data['role'];
    userId = data['user_id'];
    fullName = data['full_name'];
    notifyListeners();
  }

  Future<List<Vet>> fetchVets() async {
    final data = await _get('/api/vets');
    return (data as List).map((e) => Vet.fromJson(e)).toList();
  }

  Future<List<Pet>> fetchPets({int? ownerId}) async {
    final path = ownerId == null ? '/api/pets' : '/api/pets?owner_id=$ownerId';
    final data = await _get(path);
    return (data as List).map((e) => Pet.fromJson(e)).toList();
  }

  Future<int> createPet(Map<String, dynamic> payload) async {
    final data = await _post('/api/pets', payload);
    return data['id'];
  }

  Future<List<Appointment>> fetchAppointments() async {
    final data = await _get('/api/appointments');
    return (data as List).map((e) => Appointment.fromJson(e)).toList();
  }

  Future<int> createAppointment(Map<String, dynamic> payload) async {
    final data = await _post('/api/appointments', payload);
    return data['id'];
  }

  Future<void> updateAppointment(int id, Map<String, dynamic> payload) async {
    await _patch('/api/appointments/$id', payload);
  }

  Future<List<DietPlan>> fetchDietPlans(int petId) async {
    final data = await _get('/api/pets/$petId/diet-plans');
    return (data as List).map((e) => DietPlan.fromJson(e)).toList();
  }

  Future<int> createDietPlan(int petId, Map<String, dynamic> payload) async {
    final data = await _post('/api/pets/$petId/diet-plans', payload);
    return data['id'];
  }

  Future<List<Medication>> fetchMedications(int petId) async {
    final data = await _get('/api/pets/$petId/medications');
    return (data as List).map((e) => Medication.fromJson(e)).toList();
  }

  Future<int> createMedication(int petId, Map<String, dynamic> payload) async {
    final data = await _post('/api/pets/$petId/medications', payload);
    return data['id'];
  }

  Future<List<Vaccination>> fetchVaccinations(int petId) async {
    final data = await _get('/api/pets/$petId/vaccinations');
    return (data as List).map((e) => Vaccination.fromJson(e)).toList();
  }

  Future<int> createVaccination(int petId, Map<String, dynamic> payload) async {
    final data = await _post('/api/pets/$petId/vaccinations', payload);
    return data['id'];
  }

  Future<List<RecordItem>> fetchRecords(int petId) async {
    final data = await _get('/api/pets/$petId/records');
    return (data as List).map((e) => RecordItem.fromJson(e)).toList();
  }

  Future<int> createRecord(int petId, Map<String, dynamic> payload) async {
    final data = await _post('/api/pets/$petId/records', payload);
    return data['id'];
  }

  Future<dynamic> _get(String path) async {
    final uri = Uri.parse('$baseUrl$path');
    final res = await http.get(uri, headers: _headers());
    return _handle(res);
  }

  Future<dynamic> _post(String path, Map<String, dynamic> payload) async {
    final uri = Uri.parse('$baseUrl$path');
    final res = await http.post(uri, headers: _headers(), body: jsonEncode(payload));
    return _handle(res);
  }

  Future<dynamic> _patch(String path, Map<String, dynamic> payload) async {
    final uri = Uri.parse('$baseUrl$path');
    final res = await http.patch(uri, headers: _headers(), body: jsonEncode(payload));
    return _handle(res);
  }

  Map<String, String> _headers() {
    final headers = {
      'Content-Type': 'application/json',
    };
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  dynamic _handle(http.Response res) {
    final body = res.body.isNotEmpty ? jsonDecode(res.body) : {};
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return body;
    }
    final message = body is Map && body['error'] != null
        ? body['error'].toString()
        : 'Request failed (${res.statusCode}).';
    throw Exception(message);
  }
}
