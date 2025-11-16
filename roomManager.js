// 房间管理模块
class RoomManager {
  constructor(sm2KeyManager) {
    this.rooms = new Map(); // 房间ID -> 房间信息
    this.userRooms = new Map(); // 用户ID -> 房间ID
    this.sm2KeyManager = sm2KeyManager; // SM2密钥管理器引用
  }

  /**
   * 创建房间
   * @param {string} roomId - 房间ID
   * @param {string} roomName - 房间名称
   * @param {Object} options - 房间选项
   * @returns {Object} 房间信息
   */
  createRoom(roomId, roomName, options = {}) {
    if (this.rooms.has(roomId)) {
      throw new Error(`房间 ${roomId} 已存在`);
    }

    // 生成房间级基础密钥K_room和房间动态因子F_room
    const roomKeys = this.generateRoomKeys(roomId);

    const room = {
      id: roomId,
      name: roomName,
      users: new Set(), // 用户ID集合
      createdAt: new Date().toISOString(),
      maxUsers: options.maxUsers || 50,
      isPrivate: options.isPrivate || false,
      description: options.description || '',
      messages: [], // 最近消息历史
      // 房间密钥管理
      baseKey: roomKeys.baseKey, // 房间级基础密钥K_room
      dynamicFactor: roomKeys.dynamicFactor, // 房间动态因子F_room
      keyVersion: 1, // 密钥版本
      keyCreatedAt: new Date().toISOString()
    };

    this.rooms.set(roomId, room);
    console.log(`房间创建成功: ${roomName} (${roomId})`);
    console.log(`🔐 房间密钥初始化完成`);
    console.log(`   K_room预览: ${roomKeys.baseKey.substring(0, 16)}...`);
    console.log(`   F_room: ${roomKeys.dynamicFactor}`);
    return room;
  }

  /**
   * 删除房间
   * @param {string} roomId - 房间ID
   * @returns {boolean} 是否成功删除
   */
  deleteRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`房间 ${roomId} 不存在`);
    }

    // 移除所有用户
    room.users.forEach(userId => {
      this.userRooms.delete(userId);
    });

    this.rooms.delete(roomId);
    console.log(`房间删除成功: ${room.name} (${roomId})`);
    return true;
  }

  /**
   * 用户加入房间
   * @param {string} userId - 用户ID
   * @param {string} roomId - 房间ID
   * @param {Object} userInfo - 用户信息
   * @returns {Object} 房间信息
   */
  joinRoom(userId, roomId, userInfo = {}) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`房间 ${roomId} 不存在`);
    }

    if (room.users.size >= room.maxUsers) {
      throw new Error(`房间 ${room.name} 已满员`);
    }

    // 如果用户已在其他房间，先退出
    if (this.userRooms.has(userId)) {
      this.leaveRoom(userId);
    }

    room.users.add(userId);
    this.userRooms.set(userId, roomId);

    console.log(`用户 ${userId} 加入房间 ${roomId}`);
    
    // 添加系统消息
    this.addSystemMessage(roomId, `${userInfo.username || '用户'} 加入了房间`);

    return {
      ...room,
      users: Array.from(room.users),
      isJoined: true
    };
  }

  /**
   * 用户退出房间
   * @param {string} userId - 用户ID
   * @returns {boolean} 是否成功退出
   */
  leaveRoom(userId) {
    const roomId = this.userRooms.get(userId);
    if (!roomId) {
      return false;
    }

    const room = this.rooms.get(roomId);
    if (room) {
      room.users.delete(userId);
      
      // 添加系统消息
      this.addSystemMessage(roomId, `用户 ${userId} 离开了房间`);

      // 如果房间为空，删除房间
      if (room.users.size === 0) {
        this.deleteRoom(roomId);
      }
    }

    this.userRooms.delete(userId);
    console.log(`用户 ${userId} 退出房间 ${roomId}`);
    return true;
  }

  /**
   * 获取用户所在房间
   * @param {string} userId - 用户ID
   * @returns {string|null} 房间ID
   */
  getUserRoom(userId) {
    return this.userRooms.get(userId) || null;
  }

  /**
   * 获取房间信息
   * @param {string} roomId - 房间ID
   * @returns {Object|null} 房间信息
   */
  getRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    // 返回用户详细信息列表
    const users = Array.from(room.users).map(userId => {
      return {
        userId: userId,
        username: `用户${userId.slice(-4)}`  // 为每个用户ID生成用户名
      };
    });

    return {
      ...room,
      users: users,  // 返回用户详细信息数组
      userCount: room.users.size
    };
  }

  /**
   * 获取所有房间列表
   * @returns {Array} 房间列表
   */
  getAllRooms() {
    const rooms = [];
    this.rooms.forEach((room, roomId) => {
      rooms.push({
        id: roomId,
        name: room.name,
        userCount: room.users.size,
        maxUsers: room.maxUsers,
        isPrivate: room.isPrivate,
        description: room.description,
        createdAt: room.createdAt
      });
    });
    return rooms;
  }

  /**
   * 获取房间内的用户列表
   * @param {string} roomId - 房间ID
   * @returns {Array} 用户列表
   */
  getRoomUsers(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return [];
    }
    return Array.from(room.users);
  }

  /**
   * 向房间添加消息
   * @param {string} roomId - 房间ID
   * @param {Object} message - 消息对象
   */
  addMessage(roomId, message) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`房间 ${roomId} 不存在`);
    }

    // 添加时间戳
    const messageWithTimestamp = {
      ...message,
      timestamp: new Date().toISOString(),
      id: this.generateMessageId()
    };

    // 添加到房间消息历史
    room.messages.push(messageWithTimestamp);

    // 限制消息历史数量（保留最近100条）
    if (room.messages.length > 100) {
      room.messages = room.messages.slice(-100);
    }

    return messageWithTimestamp;
  }

  /**
   * 向房间添加系统消息
   * @param {string} roomId - 房间ID
   * @param {string} content - 消息内容
   */
  addSystemMessage(roomId, content) {
    return this.addMessage(roomId, {
      type: 'system',
      content,
      username: '系统'
    });
  }

  /**
   * 获取房间消息历史
   * @param {string} roomId - 房间ID
   * @param {number} limit - 消息数量限制
   * @returns {Array} 消息列表
   */
  getRoomMessages(roomId, limit = 50) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return [];
    }

    return room.messages.slice(-limit);
  }

  /**
   * 生成消息ID
   * @returns {string} 消息ID
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 检查用户是否在指定房间
   * @param {string} userId - 用户ID
   * @param {string} roomId - 房间ID
   * @returns {boolean} 是否在房间中
   */
  isUserInRoom(userId, roomId) {
    const userRoomId = this.userRooms.get(userId);
    return userRoomId === roomId;
  }

  /**
   * 获取连接统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      totalRooms: this.rooms.size,
      totalUsers: this.userRooms.size,
      rooms: this.getAllRooms()
    };
  }

  /**
   * 生成房间级基础密钥K_room和房间动态因子F_room
   * @param {string} roomId - 房间ID
   * @returns {Object} 房间密钥信息
   */
  generateRoomKeys(roomId) {
    try {
      // 生成房间级基础密钥K_room（128位SM4密钥）
      const baseKeyHex = this.sm2KeyManager.generateRoomBaseKey(roomId);

      // 生成房间动态因子F_room（房间ID + 时间戳）
      const timestamp = Date.now();
      const dynamicFactor = `${roomId}_${timestamp}`;

      console.log(`🔐 为房间 ${roomId} 生成密钥:`);
      console.log(`   K_room: ${baseKeyHex.substring(0, 16)}...`);
      console.log(`   F_room: ${dynamicFactor}`);

      return {
        baseKey: baseKeyHex,
        dynamicFactor: dynamicFactor,
        timestamp: timestamp
      };
    } catch (error) {
      console.error(`生成房间 ${roomId} 密钥失败:`, error.message);
      throw error;
    }
  }

  /**
   * 为用户派生房间基础值S_i
   * @param {string} roomId - 房间ID
   * @param {string} userId - 用户ID
   * @returns {string} 用户房间基础值
   */
  deriveUserRoomBaseValue(roomId, userId) {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        throw new Error(`房间 ${roomId} 不存在`);
      }

      // 调用SM2KeyManager的派生方法
      const baseValue = this.sm2KeyManager.deriveUserRoomBaseValue(
        room.baseKey, 
        userId
      );

      console.log(`🔑 为用户 ${userId} 在房间 ${roomId} 派生房间基础值`);
      console.log(`   S_i预览: ${baseValue.substring(0, 16)}...`);
      
      return baseValue;
    } catch (error) {
      console.error(`派生用户房间基础值失败:`, error.message);
      throw error;
    }
  }

  /**
   * 打包加密房间密钥信息（用于发送给用户）
   * @param {string} roomId - 房间ID
   * @param {string} userId - 用户ID
   * @param {string} userPublicKey - 用户SM2公钥（十六进制）
   * @returns {Object} 加密后的密钥信息
   */
  packageRoomKeyForUser(roomId, userId, userPublicKey) {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        throw new Error(`房间 ${roomId} 不存在`);
      }

      // 派生用户的房间基础值S_i
      const userBaseValue = this.deriveUserRoomBaseValue(roomId, userId);

      // 打包房间密钥信息
      const keyInfo = {
        roomId: roomId,
        userId: userId,
        baseValue: userBaseValue,
        dynamicFactor: room.dynamicFactor,
        baseKeyVersion: room.keyVersion,
        timestamp: Date.now()
      };

      // 调用SM2KeyManager加密
      const encrypted = this.sm2KeyManager.packageRoomKeyInfo(
        keyInfo,
        userPublicKey
      );

      console.log(`📦 为用户 ${userId} 打包房间 ${roomId} 密钥信息`);
      console.log(`   加密数据大小: ${JSON.stringify(encrypted).length} 字节`);

      return encrypted;
    } catch (error) {
      console.error(`打包房间密钥信息失败:`, error.message);
      throw error;
    }
  }

  /**
   * 获取房间密钥信息
   * @param {string} roomId - 房间ID
   * @returns {Object|null} 房间密钥信息
   */
  getRoomKeyInfo(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    return {
      roomId: roomId,
      baseKeyPreview: room.baseKey.substring(0, 16) + '...',
      dynamicFactor: room.dynamicFactor,
      keyVersion: room.keyVersion,
      keyCreatedAt: room.keyCreatedAt,
      hasBaseKey: !!room.baseKey,
      hasDynamicFactor: !!room.dynamicFactor
    };
  }
}

module.exports = RoomManager;