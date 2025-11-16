// WebSocket处理模块
const WebSocket = require('ws');
const sm2 = require('sm-crypto').sm2;

class WebSocketHandler {
  constructor(wss, roomManager, sm2KeyManager) {
    this.wss = wss;
    this.roomManager = roomManager;
    this.sm2KeyManager = sm2KeyManager;
    this.connections = new Map(); // 用户ID -> WebSocket连接
    this.userInfo = new Map(); // 用户ID -> 用户信息
    this.clientKeys = new Map(); // 用户ID -> 客户端密钥信息
    this.setupEventHandlers();
  }

  /**
   * 设置WebSocket事件处理器
   */
  setupEventHandlers() {
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });
  }

  /**
   * 处理新的WebSocket连接
   * @param {WebSocket} ws - WebSocket连接
   * @param {Object} req - HTTP请求对象
   */
  handleConnection(ws, req) {
    const userId = this.generateUserId();
    const clientIp = req.socket.remoteAddress;
    
    // 保存连接信息
    this.connections.set(userId, ws);
    
    console.log(`新的WebSocket连接: ${userId} 来自 ${clientIp}`);

    // 监听消息事件
    ws.on('message', (message) => {
      this.handleMessage(userId, message);
    });

    // 监听关闭事件
    ws.on('close', () => {
      this.handleDisconnect(userId);
    });

    // 监听错误事件
    ws.on('error', (error) => {
      console.error(`WebSocket错误 (${userId}):`, error);
    });

    // 发送欢迎消息和服务器公钥
    this.sendServerPublicKey(userId);

    // 发送当前房间列表
    this.sendRoomList(userId);
  }

  /**
   * 处理接收到的消息
   * @param {string} userId - 用户ID
   * @param {string} message - 消息内容
   */
  handleMessage(userId, message) {
    let data;
    try {
      data = JSON.parse(message);
      
      switch (data.type) {
        case 'ping':
          this.handlePing(userId);
          break;
        case 'set_username':
          this.handleSetUsername(userId, data);
          break;
        case 'create_room':
          this.handleCreateRoom(userId, data);
          break;
        case 'join_room':
          this.handleJoinRoom(userId, data);
          break;
        case 'leave_room':
          this.handleLeaveRoom(userId);
          break;
        case 'room_message':
          this.handleRoomMessage(userId, data);
          break;
        case 'get_rooms':
          this.handleGetRooms(userId);
          break;
        case 'get_room_users':
          this.handleGetRoomUsers(userId, data);
          break;
        case 'get_room_messages':
          this.handleGetRoomMessages(userId, data);
          break;
        case 'broadcast':
          this.handleBroadcast(userId, data);
          break;
        case 'client_keys_ready':
          this.handleClientKeysReady(userId, data);
          break;
        case 'request_client_keys':
          this.handleRequestClientKeys(userId, data);
          break;
        case 'request_room_keys':
          this.handleRequestRoomKeys(userId, data);
          break;
        default:
          this.handleEcho(userId, data);
      }
    } catch (error) {
      console.error('消息解析错误:', error);
      this.sendError(userId, '消息格式错误');
    }
  }

  /**
   * 处理心跳检测
   * @param {string} userId - 用户ID
   */
  handlePing(userId) {
    this.sendToUser(userId, {
      type: 'pong',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 处理设置用户名
   * @param {string} userId - 用户ID
   * @param {Object} data - 消息数据
   */
  handleSetUsername(userId, data) {
    const username = data.username || `用户${userId.slice(-4)}`;
    
    this.userInfo.set(userId, {
      username: username,
      connectedAt: new Date().toISOString()
    });

    this.sendToUser(userId, {
      type: 'username_set',
      username: username,
      timestamp: new Date().toISOString()
    });

    console.log(`用户 ${userId} 设置用户名为: ${username}`);
  }

  /**
   * 处理创建房间
   * @param {string} userId - 用户ID
   * @param {Object} data - 消息数据
   */
  handleCreateRoom(userId, data) {
    try {
      const { roomId, roomName, description, options = {} } = data;
      const userInfo = this.userInfo.get(userId) || { username: `用户${userId.slice(-4)}` };

      // 将description添加到options中
      if (description) {
        options.description = description;
      }

      const room = this.roomManager.createRoom(roomId, roomName, options);
      
      // 创建者自动加入房间
      this.roomManager.joinRoom(userId, roomId, userInfo);

      this.sendToUser(userId, {
        type: 'room_created',
        room: this.roomManager.getRoom(roomId),
        timestamp: new Date().toISOString()
      });

      // 发送加入房间的响应
      this.sendToUser(userId, {
        type: 'room_joined',
        room: this.roomManager.getRoom(roomId),
        timestamp: new Date().toISOString()
      });

      // 通知所有用户房间列表更新
      this.broadcastToAll({
        type: 'room_list_update',
        rooms: this.roomManager.getAllRooms(),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.sendError(userId, error.message);
    }
  }

  /**
   * 处理加入房间
   * @param {string} userId - 用户ID
   * @param {Object} data - 消息数据
   */
  handleJoinRoom(userId, data) {
    try {
      const { roomId, username } = data;
      const userInfo = this.userInfo.get(userId) || { 
        username: username || `用户${userId.slice(-4)}` 
      };

      // 更新用户信息
      this.userInfo.set(userId, userInfo);

      const room = this.roomManager.joinRoom(userId, roomId, userInfo);

      // 发送房间信息给用户
      this.sendToUser(userId, {
        type: 'room_joined',
        room: this.roomManager.getRoom(roomId),
        messages: this.roomManager.getRoomMessages(roomId, 20),
        timestamp: new Date().toISOString()
      });

      // 通知房间内其他用户
      this.broadcastToRoom(roomId, {
        type: 'user_joined',
        userId: userId,
        username: userInfo.username,
        userCount: this.roomManager.getRoomUsers(roomId).length,
        timestamp: new Date().toISOString()
      }, userId); // 排除自己

      // 🔐 分发房间密钥信息（如果用户有客户端密钥对）
      this.distributeRoomKeys(userId, roomId);

      // 发送更新后的房间列表
      this.sendRoomList(userId);

    } catch (error) {
      this.sendError(userId, error.message);
    }
  }

  /**
   * 处理退出房间
   * @param {string} userId - 用户ID
   */
  handleLeaveRoom(userId) {
    const roomId = this.roomManager.getUserRoom(userId);
    if (!roomId) {
      this.sendError(userId, '您当前不在任何房间中');
      return;
    }

    const userInfo = this.userInfo.get(userId) || { username: `用户${userId.slice(-4)}` };
    
    this.roomManager.leaveRoom(userId);

    // 通知房间内其他用户
    this.broadcastToRoom(roomId, {
      type: 'user_left',
      userId: userId,
      username: userInfo.username,
      timestamp: new Date().toISOString()
    });

    this.sendToUser(userId, {
      type: 'room_left',
      roomId: roomId,
      timestamp: new Date().toISOString()
    });

    // 发送更新后的房间列表
    this.sendRoomList(userId);
  }

  /**
   * 处理房间消息
   * @param {string} userId - 用户ID
   * @param {Object} data - 消息数据
   */
  handleRoomMessage(userId, data) {
    const roomId = this.roomManager.getUserRoom(userId);
    if (!roomId) {
      this.sendError(userId, '请先加入房间');
      return;
    }

    if (!this.roomManager.isUserInRoom(userId, roomId)) {
      this.sendError(userId, '您不在当前房间中');
      return;
    }

    const userInfo = this.userInfo.get(userId) || { username: `用户${userId.slice(-4)}` };
    const room = this.roomManager.getRoom(roomId);
    
    const message = {
      type: 'room_message',
      roomId: roomId,
      roomName: room ? room.name : '未知房间',
      from: userInfo.username,
      username: userInfo.username,
      userId: userId,
      message: data.message
    };

    // 添加到房间消息历史
    const savedMessage = this.roomManager.addMessage(roomId, message);

    // 广播给房间内所有用户
    this.broadcastToRoom(roomId, {
      ...savedMessage,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 处理获取房间列表
   * @param {string} userId - 用户ID
   */
  handleGetRooms(userId) {
    this.sendRoomList(userId);
  }

  /**
   * 处理获取房间用户列表
   * @param {string} userId - 用户ID
   * @param {Object} data - 消息数据
   */
  handleGetRoomUsers(userId, data) {
    try {
      const { roomId } = data;
      const users = this.roomManager.getRoomUsers(roomId);
      
      this.sendToUser(userId, {
        type: 'room_users',
        roomId: roomId,
        users: users.map(uid => ({
          userId: uid,
          username: (this.userInfo.get(uid) || { username: `用户${uid.slice(-4)}` }).username
        })),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.sendError(userId, error.message);
    }
  }

  /**
   * 处理获取房间消息历史
   * @param {string} userId - 用户ID
   * @param {Object} data - 消息数据
   */
  handleGetRoomMessages(userId, data) {
    try {
      const { roomId, limit } = data;
      const messages = this.roomManager.getRoomMessages(roomId, limit);
      
      this.sendToUser(userId, {
        type: 'room_messages',
        roomId: roomId,
        messages: messages,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.sendError(userId, error.message);
    }
  }

  /**
   * 处理广播消息
   * @param {string} userId - 用户ID
   * @param {Object} data - 消息数据
   */
  handleBroadcast(userId, data) {
    const userInfo = this.userInfo.get(userId) || { username: `用户${userId.slice(-4)}` };
    
    this.broadcastToAll({
      type: 'broadcast',
      message: data.message,
      from: userInfo.username,
      userId: userId,
      timestamp: new Date().toISOString()
    });

    console.log(`广播消息 from ${userInfo.username}: ${data.message}`);
  }

  /**
   * 处理回显消息
   * @param {string} userId - 用户ID
   * @param {Object} data - 消息数据
   */
  handleEcho(userId, data) {
    this.sendToUser(userId, {
      type: 'echo',
      data: data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 处理用户断开连接
   * @param {string} userId - 用户ID
   */
  handleDisconnect(userId) {
    console.log(`用户 ${userId} 断开连接`);
    
    // 从房间中移除用户
    this.roomManager.leaveRoom(userId);
    
    // 清理数据
    this.connections.delete(userId);
    this.userInfo.delete(userId);
  }

  /**
   * 向指定用户发送消息
   * @param {string} userId - 用户ID
   * @param {Object} message - 消息对象
   */
  sendToUser(userId, message) {
    const ws = this.connections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`发送消息给用户 ${userId} 失败:`, error);
      }
    }
  }

  /**
   * 向房间内所有用户广播消息
   * @param {string} roomId - 房间ID
   * @param {Object} message - 消息对象
   * @param {string} excludeUserId - 排除的用户ID（可选）
   */
  broadcastToRoom(roomId, message, excludeUserId = null) {
    const roomUsers = this.roomManager.getRoomUsers(roomId);
    
    roomUsers.forEach(userId => {
      if (userId !== excludeUserId) {
        this.sendToUser(userId, message);
      }
    });
  }

  /**
   * 向所有用户广播消息
   * @param {Object} message - 消息对象
   */
  broadcastToAll(message) {
    this.connections.forEach((ws, userId) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(message));
        } catch (error) {
          console.error(`广播消息给用户 ${userId} 失败:`, error);
        }
      }
    });
  }

  /**
   * 发送房间列表给用户
   * @param {string} userId - 用户ID
   */
  sendRoomList(userId) {
    const currentRoomId = this.roomManager.getUserRoom(userId);
    
    this.sendToUser(userId, {
      type: 'room_list',
      rooms: this.roomManager.getAllRooms(),
      currentRoomId: currentRoomId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 发送错误消息
   * @param {string} userId - 用户ID
   * @param {string} errorMessage - 错误消息
   */
  sendError(userId, errorMessage) {
    this.sendToUser(userId, {
      type: 'error',
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 生成用户ID
   * @returns {string} 用户ID
   */
  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取连接统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const roomStats = this.roomManager.getStats();
    
    return {
      ...roomStats,
      totalConnections: this.connections.size,
      connectedUsers: Array.from(this.connections.keys())
    };
  }

  /**
   * 发送服务器公钥给客户端
   * @param {string} userId - 用户ID
   */
  sendServerPublicKey(userId) {
    try {
      console.log(`=== 发送服务器公钥给用户 ${userId} ===`);
      
      // 获取服务器密钥信息
      const serverKeyInfo = this.sm2KeyManager.getKeyInfo();
      console.log('服务器密钥信息:', serverKeyInfo);
      
      const welcomeMessage = {
        type: 'welcome',
        message: '欢迎连接到WebSocket服务器!',
        userId: userId,
        serverKeyInfo: {
          publicKey: serverKeyInfo.publicKey,
          algorithm: serverKeyInfo.algorithm,
          curve: serverKeyInfo.curve,
          createdAt: serverKeyInfo.createdAt
        },
        timestamp: new Date().toISOString()
      };
      
      console.log('准备发送的欢迎消息:', welcomeMessage);
      
      // 发送欢迎消息和服务器公钥
      this.sendToUser(userId, welcomeMessage);

      console.log(`✅ 用户 ${userId} 连接，服务器公钥已发送: ${serverKeyInfo.publicKey.slice(0, 20)}...`);
    } catch (error) {
      console.error('❌ 发送服务器公钥失败:', error);
      console.error('错误堆栈:', error.stack);
      this.sendError(userId, '密钥初始化失败');
    }
  }

  /**
   * 处理客户端密钥准备就绪
   * @param {string} userId - 用户ID
   * @param {Object} data - 消息数据
   */
  handleClientKeysReady(userId, data) {
    try {
      const { publicKey, privateKey } = data;
      
      if (!publicKey || !privateKey) {
        this.sendError(userId, '客户端密钥信息不完整');
        return;
      }

      // 保存客户端密钥信息
      this.clientKeys.set(userId, {
        publicKey: publicKey,
        privateKey: privateKey,
        algorithm: 'SM2',
        curve: 'sm2p256v1',
        createdAt: new Date().toISOString()
      });

      // 获取服务器密钥信息
      const serverKeyInfo = this.sm2KeyManager.getKeyInfo();
      
      // 发送完整的密钥信息到聊天栏
      this.sendKeyInfoToChat(userId, serverKeyInfo, this.clientKeys.get(userId));

      console.log(`用户 ${userId} 客户端密钥对已生成并保存`);
    } catch (error) {
      console.error('处理客户端密钥失败:', error);
      this.sendError(userId, '客户端密钥处理失败');
    }
  }

  /**
   * 发送密钥信息到聊天栏显示
   * @param {string} userId - 用户ID
   * @param {Object} serverKeyInfo - 服务器密钥信息
   * @param {Object} clientKeyInfo - 客户端密钥信息
   */
  sendKeyInfoToChat(userId, serverKeyInfo, clientKeyInfo) {
    const keyInfoMessage = {
      type: 'key_info',
      message: '=== SM2密钥交换信息 ===',
      serverKey: {
        publicKey: serverKeyInfo.publicKey,
        algorithm: serverKeyInfo.algorithm,
        curve: serverKeyInfo.curve,
        createdAt: serverKeyInfo.createdAt,
        keyLength: serverKeyInfo.keyLength
      },
      clientKey: {
        publicKey: clientKeyInfo.publicKey,
        privateKey: clientKeyInfo.privateKey,
        algorithm: clientKeyInfo.algorithm,
        curve: clientKeyInfo.curve,
        createdAt: clientKeyInfo.createdAt
      },
      summary: {
        serverPublicKeyLength: serverKeyInfo.publicKey.length,
        clientPublicKeyLength: clientKeyInfo.publicKey.length,
        clientPrivateKeyLength: clientKeyInfo.privateKey.length,
        exchangeCompleted: true
      },
      timestamp: new Date().toISOString()
    };

    // 发送密钥信息到用户聊天栏
    this.sendToUser(userId, keyInfoMessage);

    // 同时在服务器控制台输出
    console.log('\n=== SM2密钥交换完成 ===');
    console.log(`用户 ${userId} 密钥信息:`);
    console.log('服务器公钥:', serverKeyInfo.publicKey);
    console.log('客户端公钥:', clientKeyInfo.publicKey);
    console.log('客户端私钥:', clientKeyInfo.privateKey);
    console.log('========================\n');
  }

  /**
   * 处理客户端密钥生成请求 - 服务端集中生成
   * @param {string} userId - 用户ID
   * @param {Object} data - 消息数据
   */
  handleRequestClientKeys(userId, data) {
    try {
      console.log(`\n=== 服务端生成客户端密钥对给用户 ${userId} ===`);
      console.log('收到请求数据:', data);
      
      // 检查sm2KeyManager是否正确初始化
      if (!this.sm2KeyManager) {
        throw new Error('SM2KeyManager未初始化');
      }
      
      console.log('✅ SM2KeyManager已正确初始化');
      console.log('正在调用generateClientKeyPair方法...');
      
      // 使用SM2KeyManager生成客户端密钥对
      const clientKeyPair = this.sm2KeyManager.generateClientKeyPair();
      
      console.log('🔑 generateClientKeyPair方法调用成功，返回:', {
        hasPublicKey: !!clientKeyPair?.publicKey,
        hasPrivateKey: !!clientKeyPair?.privateKey,
        publicKeyLength: clientKeyPair?.publicKey?.length,
        privateKeyLength: clientKeyPair?.privateKey?.length
      });
      
      if (!clientKeyPair || !clientKeyPair.publicKey || !clientKeyPair.privateKey) {
        throw new Error('客户端密钥对生成失败: 密钥不完整');
      }

      console.log('服务端生成的客户端密钥对:', {
        publicKey: clientKeyPair.publicKey,
        privateKey: clientKeyPair.privateKey,
        keyLength: clientKeyPair.publicKey.length
      });

      // 保存客户端密钥信息
      this.clientKeys.set(userId, {
        publicKey: clientKeyPair.publicKey,
        privateKey: clientKeyPair.privateKey,
        algorithm: 'SM2',
        curve: 'sm2p256v1',
        createdAt: new Date().toISOString(),
        generatedBy: 'server'
      });

      console.log('✅ 客户端密钥信息已保存到内存');

      // 获取服务器密钥信息
      const serverKeyInfo = this.sm2KeyManager.getKeyInfo();
      console.log('服务器密钥信息获取成功:', serverKeyInfo?.publicKey?.substring(0, 20) + '...');

      // 发送密钥信息给客户端
      const keyInfoMessage = {
        type: 'client_keys_generated',
        message: '服务端已为您生成SM2密钥对',
        clientKeys: {
          publicKey: clientKeyPair.publicKey,
          privateKey: clientKeyPair.privateKey,
          algorithm: 'SM2',
          curve: 'sm2p256v1',
          createdAt: new Date().toISOString(),
          generatedBy: 'server'
        },
        serverKey: {
          publicKey: serverKeyInfo.publicKey,
          algorithm: serverKeyInfo.algorithm,
          curve: serverKeyInfo.curve,
          createdAt: serverKeyInfo.createdAt
        },
        summary: {
          exchangeMethod: 'server_generated',
          serverPublicKeyLength: serverKeyInfo.publicKey.length,
          clientPublicKeyLength: clientKeyPair.publicKey.length,
          clientPrivateKeyLength: clientKeyPair.privateKey.length,
          exchangeCompleted: true
        },
        timestamp: new Date().toISOString()
      };

      console.log('正在发送client_keys_generated消息给客户端...');
      
      // 发送密钥信息到客户端
      this.sendToUser(userId, keyInfoMessage);

      console.log(`✅ 用户 ${userId} 客户端密钥对已由服务端生成并下发`);
      console.log('=== 客户端密钥生成完成 ===\n');
      
    } catch (error) {
      console.error('❌ 服务端生成客户端密钥失败:', error);
      console.error('错误堆栈:', error.stack);
      this.sendError(userId, '服务端密钥生成失败: ' + error.message);
    }
  }

  /**
   * 分发房间密钥信息给用户
   * @param {string} userId - 用户ID
   * @param {string} roomId - 房间ID
   */
  async distributeRoomKeys(userId, roomId) {
    console.log(`\n=== 开始分发房间密钥 ===`);
    console.log(`🔑 为用户 ${userId} 分发房间 ${roomId} 密钥信息`);

    try {
      // 检查用户是否有客户端密钥对
      const clientKeyInfo = this.clientKeys.get(userId);
      console.log(`用户客户端密钥信息:`, {
        hasKey: !!clientKeyInfo,
        hasPublicKey: !!clientKeyInfo?.publicKey,
        publicKeyLength: clientKeyInfo?.publicKey?.length
      });
      
      if (!clientKeyInfo || !clientKeyInfo.publicKey) {
        console.log(`❌ 用户 ${userId} 尚未设置客户端密钥，跳过房间密钥分发`);
        this.sendError(userId, '客户端密钥未设置，无法分发房间密钥');
        return;
      }

      console.log(`✅ 用户 ${userId} 客户端密钥验证通过`);

      // 获取房间信息
      const roomInfo = this.roomManager.getRoom(roomId);
      console.log(`房间信息:`, {
        hasRoom: !!roomInfo,
        roomName: roomInfo?.name,
        hasBaseKey: !!roomInfo?.baseKey,
        hasDynamicFactor: !!roomInfo?.dynamicFactor
      });
      
      if (!roomInfo) {
        console.log(`❌ 房间 ${roomId} 不存在`);
        this.sendError(userId, `房间 ${roomId} 不存在`);
        return;
      }

      console.log(`✅ 房间 ${roomId} 存在且有密钥信息`);

      // 使用RoomManager的packageRoomKeyForUser方法
      console.log(`🔐 正在调用RoomManager.packageRoomKeyForUser...`);
      const encryptedKeyInfo = this.roomManager.packageRoomKeyForUser(
        roomId,
        userId,
        clientKeyInfo.publicKey
      );
      
      console.log(`🔐 加密结果:`, {
        hasEncryptedData: !!encryptedKeyInfo,
        encryptedDataType: typeof encryptedKeyInfo,
        dataLength: encryptedKeyInfo?.length || 0,
        dataPreview: encryptedKeyInfo ? encryptedKeyInfo.substring(0, 32) + '...' : null
      });

      // 发送加密的房间密钥信息给用户
      const roomKeyMessage = {
        type: 'room_key_info',
        roomId: roomId,
        roomName: roomInfo.name,
        encryptedKeyInfo: encryptedKeyInfo,
        message: '房间密钥信息已加密发送，请使用客户端密钥解密',
        timestamp: new Date().toISOString()
      };

      console.log(`📤 正在发送room_key_info消息给用户 ${userId}...`);
      this.sendToUser(userId, roomKeyMessage);
      console.log(`✅ room_key_info消息发送成功`);

      // 发送房间密钥信息摘要
      console.log(`📤 正在发送room_key_summary消息给用户 ${userId}...`);
      const summaryMessage = {
        type: 'room_key_summary',
        roomId: roomId,
        keyInfo: {
          baseKeyPreview: roomInfo.baseKey?.substring(0, 16) + '...',
          dynamicFactor: roomInfo.dynamicFactor,
          keyVersion: roomInfo.keyVersion,
          hasBaseKey: !!roomInfo.baseKey,
          hasDynamicFactor: !!roomInfo.dynamicFactor
        },
        derivationSteps: [
          '1. 服务器生成房间级基础密钥K_room',
          '2. 服务器生成房间动态因子F_room（房间ID+时间戳）',
          '3. 派生用户房间基础值S_i = KDF(K_room, 用户ID)',
          '4. 服务器用用户SM2公钥加密S_i和F_room',
          '5. 客户端解密后计算组密钥GK = KDF(S_i, F_room)'
        ],
        timestamp: new Date().toISOString()
      };
      
      this.sendToUser(userId, summaryMessage);
      console.log(`✅ room_key_summary消息发送成功`);

      console.log(`✅ 房间密钥分发完成`);

    } catch (error) {
      console.error(`❌ 分发房间密钥失败 (${userId}, ${roomId}):`, error);
      console.error(`❌ 错误堆栈:`, error.stack);
      this.sendError(userId, '房间密钥分发失败: ' + error.message);
    }
  }

  /**
   * 处理获取房间密钥信息
   * @param {string} userId - 用户ID
   * @param {Object} data - 消息数据
   */
  handleRequestRoomKeys(userId, data) {
    console.log(`\n=== 处理房间密钥请求 ===`);
    console.log(`用户ID: ${userId}`);
    console.log(`请求数据:`, data);
    console.log('🚨 handleRequestRoomKeys方法被调用');
    
    if (!data || !data.roomId) {
      console.error(`❌ 请求数据无效:`, data);
      this.sendError(userId, '请求数据无效');
      return;
    }
    
    const { roomId } = data;
    console.log(`请求房间ID: ${roomId}`);
    
    try {
      // 检查roomManager是否初始化
      if (!this.roomManager) {
        console.error(`❌ roomManager未初始化`);
        this.sendError(userId, '服务器内部错误: roomManager未初始化');
        return;
      }
      
      // 安全地检查用户是否在房间中
      let userInRoom = false;
      try {
        userInRoom = this.roomManager.isUserInRoom(userId, roomId);
        console.log(`用户是否在房间中: ${userInRoom}`);
      } catch (error) {
        console.error(`❌ isUserInRoom检查失败:`, error);
        this.sendError(userId, '房间状态检查失败');
        return;
      }
      
      if (!userInRoom) {
        console.log(`❌ 用户 ${userId} 不在房间 ${roomId} 中`);
        this.sendError(userId, '您不在当前房间中');
        return;
      }

      console.log(`✅ 用户 ${userId} 在房间 ${roomId} 中，开始分发密钥`);
      
      // 安全地分发房间密钥
      try {
        this.distributeRoomKeys(userId, roomId);
        console.log(`✅ 密钥分发完成`);
      } catch (error) {
        console.error(`❌ 密钥分发失败:`, error);
        this.sendError(userId, '密钥分发失败: ' + error.message);
      }

    } catch (error) {
      console.error(`❌ 获取房间密钥失败 (${userId}):`, error);
      console.error(`❌ 错误堆栈:`, error.stack);
      this.sendError(userId, '获取房间密钥失败: ' + error.message);
    }
  }
}

module.exports = WebSocketHandler;