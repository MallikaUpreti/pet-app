import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../state/app_state.dart';

class OwnerChatScreen extends StatefulWidget {
  const OwnerChatScreen({super.key});

  @override
  State<OwnerChatScreen> createState() => _OwnerChatScreenState();
}

class _OwnerChatScreenState extends State<OwnerChatScreen> {
  final _controller = TextEditingController();
  int? _activeChatId;
  List<dynamic> _chats = [];
  List<dynamic> _messages = [];
  Timer? _poller;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _loadChats();
  }

  @override
  void dispose() {
    _controller.dispose();
    _poller?.cancel();
    super.dispose();
  }

  Future<void> _loadChats() async {
    final app = context.read<AppState>();
    final chats = await app.fetchChats();
    if (!mounted) return;
    setState(() => _chats = chats);
  }

  Future<void> _loadMessages() async {
    if (_activeChatId == null) return;
    final app = context.read<AppState>();
    final msgs = await app.fetchMessages(_activeChatId!);
    if (!mounted) return;
    setState(() => _messages = msgs);
  }

  void _startPolling() {
    _poller?.cancel();
    _poller = Timer.periodic(const Duration(seconds: 2), (_) => _loadMessages());
  }

  @override
  Widget build(BuildContext context) {
    final app = context.read<AppState>();
    final filtered = _chats.where((c) {
      final name = (c['VetName'] ?? '').toString().toLowerCase();
      final pet = (c['PetName'] ?? '').toString().toLowerCase();
      return name.contains(_query) || pet.contains(_query);
    }).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Chat')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Search',
            ),
            onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
          ),
          const SizedBox(height: 12),
          if (filtered.isEmpty)
            const Text('No conversations yet.')
          else
            ...filtered.map((c) {
              final vet = c['VetName'] ?? 'Vet';
              final pet = c['PetName'];
              final label = pet == null ? vet : '$vet ($pet)';
              final last = c['LastBody'] ?? 'Say hello!';
              return Card(
                child: ListTile(
                  leading: CircleAvatar(child: Text(vet[0])),
                  title: Text(label),
                  subtitle: Text(last, maxLines: 1, overflow: TextOverflow.ellipsis),
                  trailing: Text((c['LastAt'] ?? '').toString()),
                  onTap: () async {
                    setState(() => _activeChatId = c['Id']);
                    await _loadMessages();
                    _startPolling();
                  },
                ),
              );
            }),
          const SizedBox(height: 16),
          if (_activeChatId != null)
            Column(
              children: [
                ..._messages.map((m) => _ChatBubble(
                      isOwner: m['SenderRole'] == 'owner',
                      message: m['Body'] ?? '',
                      time: m['CreatedAt'] ?? '',
                    )),
                const SizedBox(height: 80),
              ],
            )
          else
            _RequestVetView(onRequestSent: _loadChats),
        ],
      ),
      bottomNavigationBar: _activeChatId == null
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Attachment picker coming soon.')),
                        );
                      },
                      icon: const Icon(Icons.attach_file),
                    ),
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        decoration: InputDecoration(
                          hintText: 'Type a message...',
                          filled: true,
                          fillColor: Colors.white,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(24),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    CircleAvatar(
                      backgroundColor: Colors.black,
                      child: IconButton(
                        icon: const Icon(Icons.send, color: Colors.white),
                        onPressed: () async {
                          if (_activeChatId == null) return;
                          final text = _controller.text.trim();
                          if (text.isEmpty) return;
                          await app.sendMessage(_activeChatId!, text);
                          _controller.clear();
                          await _loadMessages();
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

class _RequestVetView extends StatefulWidget {
  final VoidCallback onRequestSent;
  const _RequestVetView({required this.onRequestSent});

  @override
  State<_RequestVetView> createState() => _RequestVetViewState();
}

class _RequestVetViewState extends State<_RequestVetView> {
  late Future<List<dynamic>> _future;

  @override
  void initState() {
    super.initState();
    final app = context.read<AppState>();
    _future = Future.wait([app.fetchVets(), app.fetchChatRequests()]);
  }

  @override
  Widget build(BuildContext context) {
    final app = context.read<AppState>();
    return FutureBuilder<List<dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        final vets = snapshot.data![0] as List<Vet>;
        final requests = snapshot.data![1] as List<dynamic>;
        return ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const Text('Request a vet to start chatting.'),
            const SizedBox(height: 12),
            ...vets.map((v) {
              final req = requests.where((r) => r['VetUserId'] == v.id).toList();
              final status = req.isNotEmpty ? req.first['Status'] : null;
              return Card(
                child: ListTile(
                  title: Text(v.fullName),
                  subtitle: Text(v.clinicName ?? 'Veterinarian'),
                  trailing: status == null
                      ? FilledButton(
                          onPressed: () async {
                            await app.createChatRequest({
                              'vet_user_id': v.id,
                              'pet_id': app.activePetId,
                            });
                            if (!mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Request sent.')),
                            );
                            widget.onRequestSent();
                          },
                          child: const Text('Request'),
                        )
                      : Text(status.toString()),
                ),
              );
            }),
          ],
        );
      },
    );
  }
}

class _ChatBubble extends StatelessWidget {
  final bool isOwner;
  final String message;
  final String time;

  const _ChatBubble({required this.isOwner, required this.message, required this.time});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isOwner ? Alignment.centerRight : Alignment.centerLeft,
      child: Column(
        crossAxisAlignment: isOwner ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isOwner ? const Color(0xFF4A90E2) : Colors.grey.shade200,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              message,
              style: TextStyle(color: isOwner ? Colors.white : Colors.black87),
            ),
          ),
          Text(time, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}
