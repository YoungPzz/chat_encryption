# Android客户端使用服务器功能文档

## 1. 服务器架构概述

### 1.1 服务器功能

本服务器是一个基于Node.js的WebSocket服务器，提供以下核心功能：

- **实时通信**：基于WebSocket的即时消息传递
- **房间管理**：创建、加入、退出聊天室
- **消息加密**：使用国密算法（SM2/SM4）进行加密通信
- **密钥管理**：基础密钥BK管理、组密钥派生、Shamir密钥分片
- **HTTP API**：提供房间列表、密钥状态等查询接口

### 1.2 服务器地址和端口

- **WebSocket地址**：`ws://服务器IP:3000`
- **HTTP API地址**：`http://服务器IP:3000`
- **默认端口**：3000

## 2. Android客户端开发准备

### 2.1 依赖库

在Android项目的`build.gradle`文件中添加以下依赖：

```gradle
dependencies {
    // WebSocket客户端
    implementation "com.neovisionaries:nv-websocket-client:2.14"
    
    // HTTP客户端
    implementation "com.squareup.okhttp3:okhttp:4.9.3"
    
    // JSON解析
    implementation "com.google.code.gson:gson:2.9.0"
    
    // 国密算法支持（需要自行集成）
    // 可选：使用开源的国密算法库，如GMSSL或BouncyCastle扩展
}
```

### 2.2 权限配置

在`AndroidManifest.xml`中添加网络权限：

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

## 3. WebSocket连接管理

### 3.1 建立WebSocket连接

```java
import com.neovisionaries.ws.client.WebSocket;
import com.neovisionaries.ws.client.WebSocketAdapter;
import com.neovisionaries.ws.client.WebSocketFactory;
import com.neovisionaries.ws.client.WebSocketFrame;

public class WebSocketManager {
    private WebSocket ws;
    private static final String SERVER_URL = "ws://服务器IP:3000";
    
    public void connect() {
        try {
            ws = new WebSocketFactory()
                .createSocket(SERVER_URL)
                .addListener(new WebSocketAdapter() {
                    @Override
                    public void onTextMessage(WebSocket websocket, String message) {
                        // 处理收到的消息
                        handleMessage(message);
                    }
                    
                    @Override
                    public void onConnected(WebSocket websocket, Map<String, List<String>> headers) {
                        // 连接成功
                        Log.d("WebSocket", "连接成功");
                    }
                    
                    @Override
                    public void onDisconnected(WebSocket websocket, WebSocketFrame serverCloseFrame, WebSocketFrame clientCloseFrame, boolean closedByServer) {
                        // 连接断开
                        Log.d("WebSocket", "连接断开");
                    }
                })
                .connect();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    private void handleMessage(String message) {
        // 解析JSON消息
        try {
            JSONObject json = new JSONObject(message);
            String type = json.getString("type");
            
            switch (type) {
                case "welcome":
                    // 处理欢迎消息和服务器公钥
                    handleWelcomeMessage(json);
                    break;
                case "room_list":
                    // 处理房间列表
                    handleRoomList(json);
                    break;
                case "room_message":
                    // 处理房间消息
                    handleRoomMessage(json);
                    break;
                // 其他消息类型处理...
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }
    
    public void disconnect() {
        if (ws != null) {
            ws.disconnect();
        }
    }
    
    public void sendMessage(String message) {
        if (ws != null && ws.isOpen()) {
            ws.sendText(message);
        }
    }
}
```

### 3.2 心跳检测

为了保持连接活跃，客户端需要定期发送心跳消息：

```java
private void startHeartbeat() {
    new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
        @Override
        public void run() {
            if (ws != null && ws.isOpen()) {
                sendMessage("{\"type\":\"ping\"}");
            }
            startHeartbeat();
        }
    }, 30000); // 每30秒发送一次心跳
}
```

## 4. 消息通信协议

### 4.1 消息格式

所有WebSocket消息均为JSON格式，包含以下基本字段：

```json
{
  "type": "消息类型",
  "data": "消息数据",
  "timestamp": "时间戳"
}
```

### 4.2 常用消息类型

| 消息类型 | 方向 | 描述 |
|---------|------|------|
| welcome | 服务器→客户端 | 连接成功，包含服务器公钥 |
| room_list | 服务器→客户端 | 房间列表信息 |
| room_message | 双向 | 房间消息 |
| encrypted_message | 双向 | 加密房间消息 |
| join_room | 客户端→服务器 | 加入房间 |
| leave_room | 客户端→服务器 | 退出房间 |
| set_username | 客户端→服务器 | 设置用户名 |
| client_keys_ready | 客户端→服务器 | 客户端密钥准备就绪 |
| request_client_keys | 客户端→服务器 | 请求服务器生成客户端密钥 |

## 5. 密钥管理与加密通信

### 5.1 密钥交换流程

1. **客户端连接**：服务器发送`welcome`消息，包含服务器SM2公钥
2. **客户端密钥生成**：
   - 方式1：客户端自己生成SM2密钥对
   - 方式2：请求服务器生成密钥对
3. **密钥注册**：客户端发送`client_keys_ready`消息，包含客户端公钥
4. **房间密钥分发**：加入房间时，服务器分发加密的房间密钥

### 5.2 客户端密钥生成示例

#### 方式1：请求服务器生成密钥

```java
public void requestClientKeys() {
    String message = "{\"type\":\"request_client_keys\"}";
    sendMessage(message);
}

// 处理服务器生成的密钥
private void handleClientKeysGenerated(JSONObject json) {
    try {
        JSONObject clientKeys = json.getJSONObject("clientKeys");
        String publicKey = clientKeys.getString("publicKey");
        String privateKey = clientKeys.getString("privateKey");
        
        // 保存密钥
        saveClientKeys(publicKey, privateKey);
    } catch (JSONException e) {
        e.printStackTrace();
    }
}
```

#### 方式2：客户端自己生成密钥

> 注意：需要集成国密算法库实现SM2密钥生成

### 5.3 加密消息发送

```java
public void sendEncryptedMessage(String roomId, String message) {
    // 使用SM4密钥加密消息
    String encryptedData = encryptWithSM4(message, sm4Key);
    
    String jsonMessage = "{" +
        "\"type\":\"encrypted_message\"," +
        "\"encryptedData\":\"" + encryptedData + "\"," +
        "\"timestamp\":\"" + new Date().toISOString() + "\"" +
        "}";
    
    sendMessage(jsonMessage);
}
```

## 6. HTTP API接口

### 6.1 房间管理API

| API路径 | 方法 | 功能 |
|---------|------|------|
| `/api/rooms` | GET | 获取房间列表 |
| `/api/rooms/:roomId` | GET | 获取特定房间信息 |
| `/api/rooms/:roomId/messages` | GET | 获取房间消息历史 |
| `/api/rooms` | POST | 创建房间 |
| `/api/rooms/:roomId` | DELETE | 删除房间 |

### 6.2 密钥管理API

| API路径 | 方法 | 功能 |
|---------|------|------|
| `/api/keys/base-key-info` | GET | 获取基础密钥BK信息 |
| `/api/keys/group-key/:groupId` | GET | 为指定组派生密钥 |
| `/api/keys/verify-group-key/:groupId/:key` | GET | 验证组密钥 |
| `/api/keys/regenerate-base-key` | POST | 重新生成基础密钥BK |
| `/api/keys/status` | GET | 获取服务器密钥管理状态 |

### 6.3 API调用示例

```java
public void getRooms() {
    OkHttpClient client = new OkHttpClient();
    Request request = new Request.Builder()
        .url("http://服务器IP:3000/api/rooms")
        .build();
    
    client.newCall(request).enqueue(new Callback() {
        @Override
        public void onResponse(Call call, Response response) throws IOException {
            String responseData = response.body().string();
            // 处理房间列表数据
        }
        
        @Override
        public void onFailure(Call call, IOException e) {
            e.printStackTrace();
        }
    });
}
```

## 7. 房间操作

### 7.1 创建房间

```java
public void createRoom(String roomId, String roomName) {
    String message = "{" +
        "\"type\":\"create_room\"," +
        "\"roomId\":\"" + roomId + "\"," +
        "\"roomName\":\"" + roomName + "\"" +
        "}";
    sendMessage(message);
}
```

### 7.2 加入房间

```java
public void joinRoom(String roomId, String username) {
    String message = "{" +
        "\"type\":\"join_room\"," +
        "\"roomId\":\"" + roomId + "\"," +
        "\"username\":\"" + username + "\"" +
        "}";
    sendMessage(message);
}
```

### 7.3 发送房间消息

```java
public void sendRoomMessage(String message) {
    String jsonMessage = "{" +
        "\"type\":\"room_message\"," +
        "\"message\":\"" + message + "\"" +
        "}";
    sendMessage(jsonMessage);
}
```

## 8. 完整代码示例

### 8.1 WebSocketClient类

```java
public class WebSocketClient {
    private WebSocket ws;
    private static final String SERVER_URL = "ws://服务器IP:3000";
    private String userId;
    private String sm4Key;
    private String clientPublicKey;
    private String clientPrivateKey;
    
    public interface MessageListener {
        void onMessageReceived(String message);
        void onError(String error);
    }
    
    private MessageListener listener;
    
    public void setMessageListener(MessageListener listener) {
        this.listener = listener;
    }
    
    public void connect() {
        try {
            ws = new WebSocketFactory()
                .createSocket(SERVER_URL)
                .addListener(new WebSocketAdapter() {
                    @Override
                    public void onTextMessage(WebSocket websocket, String message) {
                        handleMessage(message);
                    }
                    
                    @Override
                    public void onConnected(WebSocket websocket, Map<String, List<String>> headers) {
                        Log.d("WebSocket", "连接成功");
                    }
                    
                    @Override
                    public void onDisconnected(WebSocket websocket, WebSocketFrame serverCloseFrame, WebSocketFrame clientCloseFrame, boolean closedByServer) {
                        Log.d("WebSocket", "连接断开");
                    }
                })
                .connect();
            
            // 启动心跳
            startHeartbeat();
        } catch (Exception e) {
            e.printStackTrace();
            if (listener != null) {
                listener.onError("连接失败: " + e.getMessage());
            }
        }
    }
    
    private void startHeartbeat() {
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                if (ws != null && ws.isOpen()) {
                    sendMessage("{\"type\":\"ping\"}");
                }
                startHeartbeat();
            }
        }, 30000);
    }
    
    private void handleMessage(String message) {
        try {
            JSONObject json = new JSONObject(message);
            String type = json.getString("type");
            
            switch (type) {
                case "welcome":
                    handleWelcomeMessage(json);
                    break;
                case "room_list":
                    handleRoomList(json);
                    break;
                case "room_message":
                    handleRoomMessage(json);
                    break;
                case "encrypted_message":
                    handleEncryptedMessage(json);
                    break;
                case "room_joined":
                    handleRoomJoined(json);
                    break;
                case "client_keys_generated":
                    handleClientKeysGenerated(json);
                    break;
                case "room_key_info":
                    handleRoomKeyInfo(json);
                    break;
                case "error":
                    handleError(json);
                    break;
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }
    
    private void handleWelcomeMessage(JSONObject json) {
        try {
            userId = json.getString("userId");
            JSONObject serverKeyInfo = json.getJSONObject("serverKeyInfo");
            String serverPublicKey = serverKeyInfo.getString("publicKey");
            
            // 保存服务器公钥
            saveServerPublicKey(serverPublicKey);
            
            // 请求客户端密钥
            requestClientKeys();
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }
    
    private void requestClientKeys() {
        sendMessage("{\"type\":\"request_client_keys\"}");
    }
    
    private void handleClientKeysGenerated(JSONObject json) {
        try {
            JSONObject clientKeys = json.getJSONObject("clientKeys");
            clientPublicKey = clientKeys.getString("publicKey");
            clientPrivateKey = clientKeys.getString("privateKey");
            
            // 保存客户端密钥
            saveClientKeys(clientPublicKey, clientPrivateKey);
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }
    
    private void handleRoomKeyInfo(JSONObject json) {
        try {
            String encryptedKeyInfo = json.getString("encryptedKeyInfo");
            // 使用客户端私钥解密房间密钥
            sm4Key = decryptRoomKey(encryptedKeyInfo, clientPrivateKey);
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }
    
    private void handleRoomMessage(JSONObject json) {
        try {
            String message = json.getString("message");
            String from = json.getString("from");
            if (listener != null) {
                listener.onMessageReceived(from + ": " + message);
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }
    
    private void handleEncryptedMessage(JSONObject json) {
        try {
            String encryptedData = json.getString("encryptedData");
            String from = json.getString("from");
            
            // 解密消息
            String decryptedMessage = decryptWithSM4(encryptedData, sm4Key);
            
            if (listener != null) {
                listener.onMessageReceived("[加密] " + from + ": " + decryptedMessage);
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }
    
    private void handleRoomJoined(JSONObject json) {
        try {
            JSONObject room = json.getJSONObject("room");
            String roomId = room.getString("id");
            String roomName = room.getString("name");
            
            if (listener != null) {
                listener.onMessageReceived("成功加入房间: " + roomName);
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }
    
    private void handleRoomList(JSONObject json) {
        // 处理房间列表
    }
    
    private void handleError(JSONObject json) {
        try {
            String errorMessage = json.getString("message");
            if (listener != null) {
                listener.onError(errorMessage);
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }
    
    public void sendMessage(String message) {
        if (ws != null && ws.isOpen()) {
            ws.sendText(message);
        }
    }
    
    public void joinRoom(String roomId, String username) {
        String message = "{" +
            "\"type\":\"join_room\"," +
            "\"roomId\":\"" + roomId + "\"," +
            "\"username\":\"" + username + "\"" +
            "}";
        sendMessage(message);
    }
    
    public void sendRoomMessage(String message) {
        String jsonMessage = "{" +
            "\"type\":\"room_message\"," +
            "\"message\":\"" + message + "\"" +
            "}";
        sendMessage(jsonMessage);
    }
    
    public void sendEncryptedMessage(String message) {
        if (sm4Key == null) {
            if (listener != null) {
                listener.onError("SM4密钥未初始化");
            }
            return;
        }
        
        String encryptedData = encryptWithSM4(message, sm4Key);
        String jsonMessage = "{" +
            "\"type\":\"encrypted_message\"," +
            "\"encryptedData\":\"" + encryptedData + "\"," +
            "\"timestamp\":\"" + new Date().toISOString() + "\"" +
            "}";
        sendMessage(jsonMessage);
    }
    
    public void disconnect() {
        if (ws != null) {
            ws.disconnect();
        }
    }
    
    // 加密解密方法（需要实现）
    private String encryptWithSM4(String message, String key) {
        // 实现SM4加密
        return "encrypted_data"; // 占位符
    }
    
    private String decryptWithSM4(String encryptedData, String key) {
        // 实现SM4解密
        return "decrypted_message"; // 占位符
    }
    
    private String decryptRoomKey(String encryptedKeyInfo, String privateKey) {
        // 实现使用SM2私钥解密房间密钥
        return "sm4_key"; // 占位符
    }
    
    // 保存方法（需要实现）
    private void saveServerPublicKey(String publicKey) {
        // 保存到SharedPreferences或安全存储
    }
    
    private void saveClientKeys(String publicKey, String privateKey) {
        // 保存到SharedPreferences或安全存储
    }
}
```

### 8.2 MainActivity示例

```java
public class MainActivity extends AppCompatActivity {
    private WebSocketClient webSocketClient;
    private EditText messageInput;
    private TextView messageList;
    private Button sendButton;
    private Button encryptedSendButton;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        messageInput = findViewById(R.id.message_input);
        messageList = findViewById(R.id.message_list);
        sendButton = findViewById(R.id.send_button);
        encryptedSendButton = findViewById(R.id.encrypted_send_button);
        
        // 初始化WebSocket客户端
        webSocketClient = new WebSocketClient();
        webSocketClient.setMessageListener(new WebSocketClient.MessageListener() {
            @Override
            public void onMessageReceived(String message) {
                runOnUiThread(() -> {
                    messageList.append(message + "\n");
                });
            }
            
            @Override
            public void onError(String error) {
                runOnUiThread(() -> {
                    messageList.append("错误: " + error + "\n");
                });
            }
        });
        
        // 连接服务器
        webSocketClient.connect();
        
        // 加入房间
        new Handler().postDelayed(() -> {
            webSocketClient.joinRoom("general", "Android客户端");
        }, 1000);
        
        // 发送普通消息
        sendButton.setOnClickListener(v -> {
            String message = messageInput.getText().toString();
            if (!message.isEmpty()) {
                webSocketClient.sendRoomMessage(message);
                messageInput.setText("");
            }
        });
        
        // 发送加密消息
        encryptedSendButton.setOnClickListener(v -> {
            String message = messageInput.getText().toString();
            if (!message.isEmpty()) {
                webSocketClient.sendEncryptedMessage(message);
                messageInput.setText("");
            }
        });
    }
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (webSocketClient != null) {
            webSocketClient.disconnect();
        }
    }
}
```

## 9. 多客户端部署注意事项

### 9.1 客户端标识

- 每个客户端连接时会获得唯一的`userId`
- 建议为每个客户端设置不同的用户名，便于识别
- 客户端应保存自己的密钥对，避免重复生成

### 9.2 网络配置

- 确保服务器防火墙开放3000端口
- 如果使用局域网，确保所有客户端在同一网络中
- 如需外网访问，需要配置端口映射

### 9.3 安全性

- 客户端密钥应安全存储，避免明文传输
- 建议使用Android KeyStore存储密钥
- 定期更新密钥，特别是基础密钥BK

## 10. 故障排查

### 10.1 连接问题

- **无法连接服务器**：检查网络连接、服务器IP和端口
- **连接断开**：检查网络稳定性、心跳机制是否正常
- **认证失败**：检查密钥是否正确，服务器是否正常运行

### 10.2 消息问题

- **消息发送失败**：检查WebSocket连接状态
- **加密消息解密失败**：检查SM4密钥是否正确
- **消息丢失**：检查网络稳定性，考虑实现消息重发机制

### 10.3 密钥问题

- **密钥生成失败**：检查国密算法库是否正确集成
- **密钥分发失败**：检查客户端密钥是否正确设置
- **解密失败**：检查密钥是否匹配，加密算法是否正确

## 11. 总结

本服务器提供了完整的实时通信和加密功能，支持多个Android客户端同时连接使用。主要功能包括：

- **实时聊天**：基于WebSocket的即时消息传递
- **房间管理**：创建和管理多个聊天室
- **加密通信**：使用国密算法保护消息安全
- **密钥管理**：完整的密钥生成、分发和管理流程

Android客户端需要实现以下核心功能：

1. **WebSocket连接管理**：建立和维护WebSocket连接
2. **密钥交换**：与服务器进行SM2密钥交换
3. **消息处理**：发送和接收普通/加密消息
4. **房间操作**：加入、退出房间，管理房间状态
5. **错误处理**：处理各种异常情况

通过本文档的指导，您可以开发出功能完整、安全可靠的Android客户端，充分利用服务器提供的所有功能。
