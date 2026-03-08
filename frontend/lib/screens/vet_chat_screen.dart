import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';

class VetChatScreen extends StatefulWidget {
  const VetChatScreen({super.key});

  @override
  State<VetChatScreen> createState() => _VetChatScreenState();
}

class _VetChatScreenState extends State<VetChatScreen> {
  final _controller = TextEditingController();
  int? _activeChatId;
  List<dynamic> _chats = [];
  List<dynamic> _messages = [];
  Timer? _poller;
  String _query = '';

  @override
  void initState() {
    super.initState();
    context.read<AppState>().clearNotifications();
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
    final filtered = _chats.where((c) {
      final owner = (c['OwnerName'] ?? '').toString().toLowerCase();
      final pet = (c['PetName'] ?? '').toString().toLowerCase();
      return owner.contains(_query) || pet.contains(_query);
    }).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Chat')),
      body: _chats.isEmpty
          ? const Center(child: Text('No active chats. Accept a request first.'))
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: TextField(
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search),
                      hintText: 'Search',
                    ),
                    onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
                  ),
                ),
                SizedBox(
                  height: 70,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    scrollDirection: Axis.horizontal,
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (context, i) {
                      final chat = filtered[i];
                      final selected = chat['Id'] == _activeChatId;
                      final pet = chat['PetName'];
                      final owner = chat['OwnerName'] ?? 'Owner';
                      final ownerId = chat['OwnerId'];
                      final ownerLabel = ownerId != null ? '$owner (#$ownerId)' : owner;
                      final label = pet == null ? ownerLabel : '$ownerLabel ($pet)';
                      return InkWell(
                        onTap: () async {
                          setState(() => _activeChatId = chat['Id']);
                          await _loadMessages();
                          _startPolling();
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: selected ? Colors.black : Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.black12),
                          ),
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: 16,
                                backgroundColor: selected ? Colors.white : Colors.black12,
                                child: Text(
                                  owner[0],
                                  style: TextStyle(
                                    color: selected ? Colors.black : Colors.black87,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                label,
                                style: TextStyle(
                                  color: selected ? Colors.white : Colors.black87,
                                ),
                              ),
                              if (chat['LastSenderRole'] == 'owner')
                                Container(
                                  margin: const EdgeInsets.only(left: 6),
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.redAccent,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Text('New',
                                      style: TextStyle(color: Colors.white, fontSize: 10)),
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
                const Divider(height: 1),
                if (_activeChatId == null)
                  const Expanded(
                    child: Center(child: Text('Select a conversation to open the chat.')),
                  )
                else ...[
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.all(24),
                      children: _messages
                          .map((m) => _ChatBubble(
                                isVet: m['SenderRole'] == 'vet',
                                message: m['Body'] ?? '',
                                time: m['CreatedAt'] ?? '',
                              ))
                          .toList(),
                    ),
                  ),
                  SafeArea(
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 12)],
                      ),
                      child: Row(
                        children: [
                          IconButton(
                            onPressed: () async {
                              final url = await _promptAttachment(context);
                              if (url == null || url.isEmpty) return;
                              await context
                                  .read<AppState>()
                                  .sendMessage(_activeChatId!, 'Attachment: $url');
                              await _loadMessages();
                            },
                            icon: const Icon(Icons.attach_file),
                          ),
                          Expanded(
                            child: TextField(
                              controller: _controller,
                              decoration: InputDecoration(
                                hintText: 'Type a message...',
                                filled: true,
                                fillColor: Colors.grey.shade100,
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
                                await context.read<AppState>().sendMessage(_activeChatId!, text);
                                _controller.clear();
                                await _loadMessages();
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}

class _ChatBubble extends StatelessWidget {
  final bool isVet;
  final String message;
  final String time;

  const _ChatBubble({required this.isVet, required this.message, required this.time});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isVet ? Alignment.centerRight : Alignment.centerLeft,
      child: Column(
        crossAxisAlignment: isVet ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isVet ? const Color(0xFF2E6CF6) : Colors.grey.shade200,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              message,
              style: TextStyle(color: isVet ? Colors.white : Colors.black87),
            ),
          ),
          Text(time, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

Future<String?> _promptAttachment(BuildContext context) async {
  final controller = TextEditingController();
  final ok = await showDialog<bool>(
    context: context,
    builder: (_) => AlertDialog(
      title: const Text('Attach link'),
      content: TextField(
        controller: controller,
        decoration: const InputDecoration(hintText: 'https://...'),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
        FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Attach')),
      ],
    ),
  );
  if (ok == true) return controller.text.trim();
  return null;
}
