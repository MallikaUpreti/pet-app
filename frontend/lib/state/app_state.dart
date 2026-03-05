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
  int? activePetId;

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
    activePetId = null;
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
    final pets = (data as List).map((e) => Pet.fromJson(e)).toList();
    if (ownerId == null) {
      if (pets.isEmpty) {
        activePetId = null;
      } else if (activePetId == null || !pets.any((p) => p.id == activePetId)) {
        activePetId = pets.first.id;
      }
    }
    return pets;
  }

  void setActivePet(int? petId) {
    activePetId = petId;
    notifyListeners();
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

  Future<Map<String, dynamic>> generateDietPlan(int petId) async {
    final data = await _post('/api/pets/$petId/diet-plans/generate', {});
    return data as Map<String, dynamic>;
  }

  Future<void> updateDietPlan(int planId, Map<String, dynamic> payload) async {
    await _put('/api/diet-plans/$planId', payload);
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

  Future<List<dynamic>> fetchChatRequests() async {
    return await _get('/api/chat/requests') as List<dynamic>;
  }

  Future<int> createChatRequest(Map<String, dynamic> payload) async {
    final data = await _post('/api/chat/requests', payload);
    return data['id'];
  }

  Future<void> acceptChatRequest(int id) async {
    await _post('/api/chat/requests/$id/accept', {});
  }

  Future<void> declineChatRequest(int id) async {
    await _post('/api/chat/requests/$id/decline', {});
  }

  Future<List<dynamic>> fetchChats() async {
    return await _get('/api/chats') as List<dynamic>;
  }

  Future<List<dynamic>> fetchVetPatients() async {
    return await _get('/api/vet/patients') as List<dynamic>;
  }

  Future<List<dynamic>> fetchMessages(int chatId) async {
    return await _get('/api/chats/$chatId/messages') as List<dynamic>;
  }

  Future<void> sendMessage(int chatId, String body) async {
    await _post('/api/chats/$chatId/messages', {'body': body});
  }

  Future<List<dynamic>> fetchHealthLogs(int petId) async {
    return await _get('/api/pets/$petId/health-logs') as List<dynamic>;
  }

  Future<int> createHealthLog(int petId, Map<String, dynamic> payload) async {
    final data = await _post('/api/pets/$petId/health-logs', payload);
    return data['id'];
  }

  Future<List<dynamic>> fetchMeals(int petId) async {
    return await _get('/api/pets/$petId/meals') as List<dynamic>;
  }

  Future<int> createMeal(int petId, Map<String, dynamic> payload) async {
    final data = await _post('/api/pets/$petId/meals', payload);
    return data['id'];
  }

  Future<void> markMealFed(int mealId) async {
    await _post('/api/meals/$mealId/fed', {});
  }

  Future<Map<String, dynamic>> fetchSettings() async {
    return await _get('/api/settings') as Map<String, dynamic>;
  }

  Future<void> updateSettings(Map<String, dynamic> payload) async {
    await _patch('/api/settings', payload);
  }

  Future<void> updateMe(Map<String, dynamic> payload) async {
    await _put('/api/me', payload);
    if (payload['full_name'] != null) {
      fullName = payload['full_name'];
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> fetchVetProfile() async {
    return await _get('/api/vet/profile') as Map<String, dynamic>;
  }

  Future<void> updateVetProfile(Map<String, dynamic> payload) async {
    await _put('/api/vet/profile', payload);
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

  Future<dynamic> _put(String path, Map<String, dynamic> payload) async {
    final uri = Uri.parse('$baseUrl$path');
    final res = await http.put(uri, headers: _headers(), body: jsonEncode(payload));
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
