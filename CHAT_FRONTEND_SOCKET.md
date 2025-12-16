# Frontend Socket Guide (Chat)

This is a frontend-focused guide for integrating the chat WebSocket (Socket.IO). Use WebSocket for real-time messaging; use REST only for initial fetches and as fallback.

## Endpoints & URLs
- WebSocket base (local): `ws://localhost:3100`
- WebSocket base (prod): `wss://api.ulearnandearn.com`
- REST base (local): `http://localhost:3100/api`
- REST base (prod): `https://api.ulearnandearn.com/api`

## Auth
- Send JWT access token in the Socket.IO `auth` field at connection time.
- Same token as REST. If invalid/missing → `connect_error` with auth message.

## Core Client Flow
1) Connect socket with token.  
2) After connect, `join:conversation` for each conversation to receive events.  
3) Send messages with `send:message`.  
4) Listen for `new:message`, `message:sent`, `message:delivered`, `messages:read`, `typing:start/stop`, `user:online/offline`, `message:deleted`, `error`.  
5) Emit `typing:start/stop` and `message:read` as the user types/reads.  

### Payloads
- `join:conversation`: `{ conversationId }`
- `send:message`: `{ conversationId, text?, media?: [{ url, type: 'image'|'video'|'file', filename?, size? }], messageType: 'text'|'image'|'video'|'file', replyTo? }`
  - Audio is not supported and will be rejected.
  - At least one of `text` or `media` is required.
- `typing:start` / `typing:stop`: `{ conversationId }`
- `message:read`: `{ messageIds: ['id1','id2'], conversationId }`

### Key Server Events
- `new:message` → `{ message }`
- `message:sent` → `{ messageId, conversationId }`
- `message:delivered` → `{ messageId }`
- `messages:read` → `{ messageIds, readBy, conversationId }`
- `typing:start` / `typing:stop` → `{ userId, conversationId }`
- `user:online` / `user:offline` → `{ userId }`
- `message:deleted` → `{ messageId }`
- `error` → `{ message }`

## JS/Web Example (socket.io-client)
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3100', {
  auth: { token: 'YOUR_JWT' },
  transports: ['websocket', 'polling'] // polling fallback
});

socket.on('connect', () => {
  socket.emit('join:conversation', { conversationId: 'CONVO_ID' });
});

socket.on('new:message', ({ message }) => console.log(message));
socket.on('message:sent', console.log);
socket.on('message:delivered', console.log);
socket.on('messages:read', console.log);
socket.on('typing:start', console.log);
socket.on('typing:stop', console.log);
socket.on('user:online', console.log);
socket.on('user:offline', console.log);
socket.on('message:deleted', console.log);
socket.on('connect_error', (err) => console.error('connect_error', err.message));
socket.on('error', (err) => console.error('error', err));

export const sendMessage = () => {
  socket.emit('send:message', {
    conversationId: 'CONVO_ID',
    text: 'Hello from web',
    media: [], // or [{ url, type: 'image'|'video'|'file', filename, size }]
    messageType: 'text'
  });
};
```

## Flutter Example (socket_io_client)
```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

final socket = IO.io(
  'http://localhost:3100', // prod: wss://api.ulearnandearn.com
  IO.OptionBuilder()
    .setTransports(['websocket', 'polling'])
    .setAuth({'token': 'YOUR_JWT'})
    .build(),
);

void initSocket() {
  socket.onConnect((_) {
    socket.emit('join:conversation', {'conversationId': 'CONVO_ID'});
  });

  socket.on('new:message', (data) => print('new:message $data'));
  socket.on('message:sent', (data) => print('sent $data'));
  socket.on('message:delivered', (data) => print('delivered $data'));
  socket.on('messages:read', (data) => print('read $data'));
  socket.on('typing:start', (data) => print('typing:start $data'));
  socket.on('typing:stop', (data) => print('typing:stop $data'));
  socket.on('user:online', (data) => print('online $data'));
  socket.on('user:offline', (data) => print('offline $data'));
  socket.on('message:deleted', (data) => print('deleted $data'));
  socket.onConnectError((err) => print('connect_error $err'));
  socket.onError((err) => print('error $err'));
}

void sendMessage() {
  socket.emit('send:message', {
    'conversationId': 'CONVO_ID',
    'text': 'Hello from Flutter',
    'media': [], // or [{'url': '...', 'type': 'image'|'video'|'file', 'filename': 'pic.jpg', 'size': 12345}]
    'messageType': 'text',
  });
}
```

## 📸 Sending Media in Chats

### Overview
To send images or videos in chat, you need to:
1. **Upload the file first** via REST API (`POST /api/media/upload`)
2. **Send the message** via WebSocket with the uploaded file's URL

### Step-by-Step Flow

```
User selects file → Upload to server → Get URL → Send message via WebSocket
```

### Media Upload API

**Endpoint:** `POST /api/media/upload`  
**Content-Type:** `multipart/form-data`  
**Field Name:** `media`  
**Max File Size:** 20MB  
**Supported Types:** Images (JPEG, PNG, GIF, WebP) and Videos (MP4, MOV, AVI, etc.)  
**⚠️ Audio files are NOT supported**

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://res.cloudinary.com/.../image.jpg",
    "type": "image",  // or "video"
    "format": "jpg",
    "fileSize": 245678,
    "filename": "image.jpg"
  }
}
```

---

### JavaScript/Web Implementation

#### Complete Example: Send Image/Video

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3100', {
  auth: { token: 'YOUR_JWT' },
  transports: ['websocket', 'polling']
});

// Function to upload media and send message
async function sendMediaMessage(conversationId, file, caption = '') {
  try {
    // Step 1: Upload file to server
    const formData = new FormData();
    formData.append('media', file);

    const uploadResponse = await fetch('http://localhost:3100/api/media/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YOUR_JWT_TOKEN}`
        // Don't set Content-Type - browser will set it with boundary
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error('Upload failed');
    }

    const uploadData = await uploadResponse.json();
    
    if (!uploadData.success) {
      throw new Error(uploadData.message || 'Upload failed');
    }

    // Step 2: Send message via WebSocket with uploaded media
    const mediaType = uploadData.data.type; // 'image' or 'video'
    
    socket.emit('send:message', {
      conversationId: conversationId,
      text: caption || null, // Optional caption
      media: [{
        url: uploadData.data.url,
        type: mediaType,
        filename: file.name,
        size: uploadData.data.fileSize
      }],
      messageType: mediaType // 'image' or 'video'
    });

    return { success: true, url: uploadData.data.url };
  } catch (error) {
    console.error('Error sending media:', error);
    return { success: false, error: error.message };
  }
}

// Usage Example
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file size (20MB max)
  if (file.size > 20 * 1024 * 1024) {
    alert('File size must be less than 20MB');
    return;
  }

  // Validate file type
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  
  if (!isImage && !isVideo) {
    alert('Only images and videos are supported');
    return;
  }

  // Show loading indicator
  console.log('Uploading...');

  const result = await sendMediaMessage('CONVERSATION_ID', file, 'Check this out!');
  
  if (result.success) {
    console.log('Media sent successfully!');
  } else {
    alert('Failed to send media: ' + result.error);
  }
});
```

#### React Example with Progress

```javascript
import { useState } from 'react';
import io from 'socket.io-client';

function ChatMediaUpload({ conversationId, socket }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate
    if (file.size > 20 * 1024 * 1024) {
      alert('File too large (max 20MB)');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Upload file
      const formData = new FormData();
      formData.append('media', file);

      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setProgress(percentComplete);
        }
      });

      const uploadPromise = new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error('Upload failed'));
          }
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
        
        xhr.open('POST', 'http://localhost:3100/api/media/upload');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });

      const uploadData = await uploadPromise;
      
      // Send message via WebSocket
      socket.emit('send:message', {
        conversationId,
        text: '', // Optional caption
        media: [{
          url: uploadData.data.url,
          type: uploadData.data.type,
          filename: file.name,
          size: uploadData.data.fileSize
        }],
        messageType: uploadData.data.type
      });

      setUploading(false);
      setProgress(0);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to upload: ' + error.message);
      setUploading(false);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept="image/*,video/*" 
        onChange={handleFileSelect}
        disabled={uploading}
      />
      {uploading && (
        <div>
          <p>Uploading... {Math.round(progress)}%</p>
          <progress value={progress} max="100" />
        </div>
      )}
    </div>
  );
}
```

---

### Flutter Implementation

#### Complete Example: Send Image/Video

```dart
import 'package:http/http.dart' as http;
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'dart:io';
import 'package:path/path.dart';

class ChatMediaService {
  final IO.Socket socket;
  final String baseUrl;
  final String token;

  ChatMediaService({
    required this.socket,
    required this.baseUrl,
    required this.token,
  });

  // Upload media file
  Future<Map<String, dynamic>?> uploadMedia(File file) async {
    try {
      // Validate file size (20MB max)
      final fileSize = await file.length();
      if (fileSize > 20 * 1024 * 1024) {
        throw Exception('File size must be less than 20MB');
      }

      // Create multipart request
      var request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/api/media/upload'),
      );

      // Add authorization header
      request.headers['Authorization'] = 'Bearer $token';

      // Add file
      var multipartFile = await http.MultipartFile.fromPath(
        'media',
        file.path,
        filename: basename(file.path),
      );
      request.files.add(multipartFile);

      // Send request
      var streamedResponse = await request.send();
      var response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        var jsonData = json.decode(response.body);
        if (jsonData['success'] == true) {
          return jsonData['data'];
        } else {
          throw Exception(jsonData['message'] ?? 'Upload failed');
        }
      } else {
        throw Exception('Upload failed: ${response.statusCode}');
      }
    } catch (e) {
      print('Upload error: $e');
      return null;
    }
  }

  // Send media message via WebSocket
  Future<bool> sendMediaMessage({
    required String conversationId,
    required File file,
    String? caption,
  }) async {
    try {
      // Step 1: Upload file
      final uploadData = await uploadMedia(file);
      
      if (uploadData == null) {
        return false;
      }

      // Step 2: Send message via WebSocket
      socket.emit('send:message', {
        'conversationId': conversationId,
        'text': caption,
        'media': [
          {
            'url': uploadData['url'],
            'type': uploadData['type'], // 'image' or 'video'
            'filename': basename(file.path),
            'size': uploadData['fileSize'],
          }
        ],
        'messageType': uploadData['type'],
      });

      return true;
    } catch (e) {
      print('Error sending media: $e');
      return false;
    }
  }
}

// Usage Example
class ChatScreen extends StatefulWidget {
  @override
  _ChatScreenState createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  late IO.Socket socket;
  late ChatMediaService mediaService;
  bool uploading = false;

  @override
  void initState() {
    super.initState();
    
    // Initialize socket
    socket = IO.io(
      'http://localhost:3100',
      IO.OptionBuilder()
        .setTransports(['websocket', 'polling'])
        .setAuth({'token': 'YOUR_JWT_TOKEN'})
        .build(),
    );

    mediaService = ChatMediaService(
      socket: socket,
      baseUrl: 'http://localhost:3100',
      token: 'YOUR_JWT_TOKEN',
    );
  }

  Future<void> pickAndSendMedia(String conversationId) async {
    // Use image_picker or file_picker package
    final ImagePicker picker = ImagePicker();
    final XFile? file = await picker.pickMedia(
      imageQuality: 85,
    );

    if (file == null) return;

    setState(() => uploading = true);

    final success = await mediaService.sendMediaMessage(
      conversationId: conversationId,
      file: File(file.path),
      caption: 'Check this out!',
    );

    setState(() => uploading = false);

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Media sent successfully')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to send media')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          // Chat messages list
          Expanded(child: MessagesList()),
          
          // Upload button
          if (uploading)
            LinearProgressIndicator()
          else
            IconButton(
              icon: Icon(Icons.attach_file),
              onPressed: () => pickAndSendMedia('CONVERSATION_ID'),
            ),
        ],
      ),
    );
  }
}
```

#### Flutter with Progress Indicator

```dart
import 'package:http/http.dart' as http;

Future<Map<String, dynamic>?> uploadMediaWithProgress(
  File file,
  String token,
  Function(double) onProgress,
) async {
  try {
    var request = http.MultipartRequest(
      'POST',
      Uri.parse('http://localhost:3100/api/media/upload'),
    );

    request.headers['Authorization'] = 'Bearer $token';
    
    var multipartFile = await http.MultipartFile.fromPath(
      'media',
      file.path,
    );
    request.files.add(multipartFile);

    // Track progress
    var totalBytes = await file.length();
    var bytesUploaded = 0;

    var streamedResponse = await request.send();
    
    streamedResponse.stream.listen(
      (chunk) {
        bytesUploaded += chunk.length;
        var progress = (bytesUploaded / totalBytes) * 100;
        onProgress(progress);
      },
      onDone: () => onProgress(100),
    );

    var response = await http.Response.fromStream(streamedResponse);
    
    if (response.statusCode == 200) {
      var jsonData = json.decode(response.body);
      return jsonData['data'];
    }
    
    return null;
  } catch (e) {
    print('Error: $e');
    return null;
  }
}
```

---

### Media Message Format

When sending media via WebSocket, use this format:

```javascript
{
  conversationId: 'conversation_id',
  text: 'Optional caption', // Can be empty string or null
  media: [
    {
      url: 'https://res.cloudinary.com/.../image.jpg', // From upload response
      type: 'image', // or 'video' or 'file'
      filename: 'image.jpg', // Original filename
      size: 245678 // File size in bytes
    }
  ],
  messageType: 'image' // or 'video' or 'file'
}
```

**Important Notes:**
- `messageType` should match the `type` in the media array
- At least one of `text` or `media` must be provided
- You can send multiple media items in one message (array)
- Audio files are **NOT supported** and will be rejected

---

### Error Handling

```javascript
async function sendMediaMessage(conversationId, file) {
  try {
    // Upload
    const formData = new FormData();
    formData.append('media', file);

    const response = await fetch('/api/media/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const data = await response.json();

    if (!data.success) {
      // Handle upload errors
      if (response.status === 400) {
        throw new Error('Invalid file type or size');
      } else if (response.status === 401) {
        throw new Error('Authentication failed');
      } else {
        throw new Error(data.message || 'Upload failed');
      }
    }

    // Send via WebSocket
    socket.emit('send:message', {
      conversationId,
      media: [{
        url: data.data.url,
        type: data.data.type,
        filename: file.name,
        size: data.data.fileSize
      }],
      messageType: data.data.type
    });

    // Listen for confirmation
    socket.once('message:sent', (data) => {
      console.log('Media message sent:', data.messageId);
    });

    socket.once('error', (error) => {
      console.error('Failed to send message:', error.message);
    });

  } catch (error) {
    console.error('Error:', error);
    // Show error to user
  }
}
```

---

### Best Practices

1. **Validate before upload:**
   - Check file size (max 20MB)
   - Check file type (images/videos only)
   - Show preview before sending

2. **Show progress:**
   - Display upload progress to user
   - Show loading state during upload

3. **Handle errors gracefully:**
   - Network errors
   - Upload failures
   - WebSocket disconnections

4. **Optimize images:**
   - Compress images before upload
   - Resize large images
   - Use appropriate quality settings

5. **User experience:**
   - Allow canceling uploads
   - Show thumbnail preview
   - Support multiple file selection

## Lifecycle Tips
- Always `join:conversation` before expecting `new:message`.
- Emit `message:read` after displaying messages to update read status.
- Show typing indicators using `typing:start/stop`.
- Handle presence via `user:online/offline`.
- Handle `connect_error` and `error` to surface auth or network issues.

## Quick Checklist
- [ ] Use correct base URL (ws:// localhost, wss:// prod)
- [ ] Provide JWT in `auth` on connect
- [ ] Join conversations on connect
- [ ] Send messages with `conversationId` and text or media
- [ ] Handle read receipts, typing, presence events
- [ ] Upload media via REST before sending (audio not supported)

