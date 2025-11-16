const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// 引入自定义模块
const RoomManager = require('./roomManager');
const WebSocketHandler = require('./websocketHandler');
const SM2KeyManager = require('./sm2KeyManager');

// 创建全局SM2密钥管理器实例
const sm2KeyManager = new SM2KeyManager();

// 创建Express应用
const app = express();
const server = http.createServer(app);

// 创建房间管理器
const roomManager = new RoomManager(sm2KeyManager);

// 创建WebSocket服务器并附加到HTTP服务器
const wss = new WebSocket.Server({ server });

// 创建WebSocket处理器
const wsHandler = new WebSocketHandler(wss, roomManager, sm2KeyManager);

// 静态文件服务 - 用于提供HTML测试页面
app.use(express.static(__dirname));

// ==================== HTTP 路由 ====================

// 主页 - 返回测试客户端页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// 连接统计
app.get('/connections', (req, res) => {
  res.json({
    connections: wsHandler.getStats().totalConnections,
    rooms: wsHandler.getStats().totalRooms,
    users: wsHandler.getStats().totalUsers,
    timestamp: new Date().toISOString()
  });
});

// 房间列表API
app.get('/api/rooms', (req, res) => {
  res.json({
    rooms: roomManager.getAllRooms(),
    timestamp: new Date().toISOString()
  });
});

// 特定房间信息API
app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = roomManager.getRoom(roomId);
  
  if (!room) {
    return res.status(404).json({
      error: '房间不存在',
      timestamp: new Date().toISOString()
    });
  }
  
  res.json({
    room: room,
    timestamp: new Date().toISOString()
  });
});

// 获取房间消息历史API
app.get('/api/rooms/:roomId/messages', (req, res) => {
  const { roomId } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  
  const messages = roomManager.getRoomMessages(roomId, limit);
  
  res.json({
    roomId: roomId,
    messages: messages,
    timestamp: new Date().toISOString()
  });
});

// 创建房间API (HTTP接口)
app.post('/api/rooms', (req, res) => {
  try {
    const { roomId, roomName, options = {} } = req.query;
    
    if (!roomId || !roomName) {
      return res.status(400).json({
        error: '缺少必要参数: roomId 和 roomName',
        timestamp: new Date().toISOString()
      });
    }
    
    const room = roomManager.createRoom(roomId, roomName, options);
    
    res.status(201).json({
      room: roomManager.getRoom(roomId),
      message: '房间创建成功',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(400).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 删除房间API
app.delete('/api/rooms/:roomId', (req, res) => {
  try {
    const { roomId } = req.params;
    roomManager.deleteRoom(roomId);
    
    res.json({
      message: '房间删除成功',
      roomId: roomId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(400).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== 密钥管理API ====================

// 获取基础密钥BK信息API
app.get('/api/keys/base-key-info', (req, res) => {
  try {
    const baseKeyInfo = sm2KeyManager.getBaseKeyInfo();
    
    if (!baseKeyInfo) {
      return res.status(404).json({
        error: '基础密钥BK未初始化',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      baseKeyInfo: {
        algorithm: baseKeyInfo.algorithm,
        keyLength: baseKeyInfo.keyLength,
        format: baseKeyInfo.format,
        keyPreview: baseKeyInfo.keyPreview,
        createdAt: baseKeyInfo.createdAt,
        description: baseKeyInfo.description
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('获取基础密钥BK信息失败:', error);
    res.status(500).json({
      error: '获取基础密钥BK信息失败',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 为指定组派生密钥API
app.get('/api/keys/group-key/:groupId', (req, res) => {
  try {
    const { groupId } = req.params;
    const { salt } = req.query;
    
    if (!groupId) {
      return res.status(400).json({
        error: '缺少必要参数: groupId',
        timestamp: new Date().toISOString()
      });
    }
    
    const groupKeyInfo = sm2KeyManager.deriveGroupKey(groupId, salt);
    
    res.json({
      success: true,
      groupKeyInfo: {
        groupId: groupKeyInfo.groupId,
        key: groupKeyInfo.key,
        keyLength: groupKeyInfo.keyLength,
        algorithm: groupKeyInfo.algorithm,
        derivationMethod: groupKeyInfo.derivationMethod,
        baseKeyPreview: groupKeyInfo.baseKeyPreview,
        derivedAt: groupKeyInfo.derivedAt,
        salt: groupKeyInfo.salt || null
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('派生组密钥失败:', error);
    res.status(500).json({
      error: '派生组密钥失败',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 验证组密钥API
app.get('/api/keys/verify-group-key/:groupId/:key', (req, res) => {
  try {
    const { groupId, key } = req.params;
    const { salt } = req.query;
    
    if (!groupId || !key) {
      return res.status(400).json({
        error: '缺少必要参数: groupId 和 key',
        timestamp: new Date().toISOString()
      });
    }
    
    const isValid = sm2KeyManager.verifyGroupKey(groupId, key, salt);
    
    res.json({
      success: true,
      valid: isValid,
      groupId: groupId,
      keyPreview: key.substring(0, 16) + '...',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('验证组密钥失败:', error);
    res.status(500).json({
      error: '验证组密钥失败',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 重新生成基础密钥BK API
app.post('/api/keys/regenerate-base-key', (req, res) => {
  try {
    console.log('🔄 正在重新生成基础密钥BK...');
    
    const oldKeyInfo = sm2KeyManager.getBaseKeyInfo();
    sm2KeyManager.regenerateBaseKey();
    const newKeyInfo = sm2KeyManager.getBaseKeyInfo();
    
    console.log('✅ 基础密钥BK重新生成成功');
    
    res.json({
      success: true,
      message: '基础密钥BK重新生成成功',
      oldKeyPreview: oldKeyInfo ? oldKeyInfo.keyPreview : null,
      newKeyPreview: newKeyInfo.keyPreview,
      regenerationTime: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });
    
    console.log(`🔑 旧密钥预览: ${oldKeyInfo ? oldKeyInfo.keyPreview : 'N/A'}`);
    console.log(`🔑 新密钥预览: ${newKeyInfo.keyPreview}`);
    
  } catch (error) {
    console.error('重新生成基础密钥BK失败:', error);
    res.status(500).json({
      error: '重新生成基础密钥BK失败',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 获取服务器密钥管理状态API
app.get('/api/keys/status', (req, res) => {
  try {
    const baseKeyInfo = sm2KeyManager.getBaseKeyInfo();
    const sm2KeyInfo = sm2KeyManager.getKeyInfo();
    
    res.json({
      success: true,
      keyManagement: {
        baseKey: {
          available: !!baseKeyInfo,
          algorithm: baseKeyInfo?.algorithm || null,
          keyLength: baseKeyInfo?.keyLength || null,
          format: baseKeyInfo?.format || null,
          createdAt: baseKeyInfo?.createdAt || null,
          description: baseKeyInfo?.description || null
        },
        sm2Key: {
          available: !!sm2KeyInfo,
          algorithm: sm2KeyInfo?.algorithm || null,
          curve: sm2KeyInfo?.curve || null,
          createdAt: sm2KeyInfo?.createdAt || null,
          publicKeyPreview: sm2KeyInfo?.publicKeyPreview || null
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('获取密钥管理状态失败:', error);
    res.status(500).json({
      error: '获取密钥管理状态失败',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== 错误处理中间件 ====================

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: '页面未找到',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('Express错误:', error);
  res.status(500).json({
    error: '服务器内部错误',
    timestamp: new Date().toISOString()
  });
});

// ==================== 服务器启动 ====================

const PORT = process.env.PORT || 3000;

// 启动服务器
server.listen(PORT, () => {
  console.log('🚀 服务器启动成功!');
  console.log('========================================');
  console.log(`🌐 HTTP访问地址: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket端点: ws://localhost:${PORT}`);
  console.log(`📊 服务器统计: http://localhost:${PORT}/stats`);
  console.log(`👥 连接信息: http://localhost:${PORT}/connections`);
  console.log(`🏠 房间列表: http://localhost:${PORT}/api/rooms`);
  console.log(`🔑 密钥管理API: http://localhost:${PORT}/api/keys/status`);
  console.log(`   📄 基础密钥BK信息: /api/keys/base-key-info`);
  console.log(`   🔗 派生组密钥: /api/keys/group-key/:groupId`);
  console.log(`   ✅ 验证组密钥: /api/keys/verify-group-key/:groupId/:key`);
  console.log(`   🔄 重新生成BK: /api/keys/regenerate-base-key`);
  console.log('========================================');
  
  // SM2密钥管理初始化
  console.log('\n🔐 SM2国密算法密钥管理:');
  try {
    // 验证密钥对完整性
    const keyInfo = sm2KeyManager.getKeyInfo();
    if (keyInfo) {
      console.log(`✅ 算法: ${keyInfo.algorithm}`);
      console.log(`   曲线: ${keyInfo.curve}`);
      console.log(`   创建时间: ${keyInfo.createdAt}`);
      console.log(`   公钥预览: ${keyInfo.publicKeyPreview}`);
      
      // 执行完整性测试
      const testResult = sm2KeyManager.testKeyPair();
      if (testResult) {
        console.log('🔒 SM2密钥系统已就绪，支持加密/解密/签名/验证');
      }
    }
  } catch (error) {
    console.error('❌ SM2密钥系统初始化失败:', error);
  }
  
  // 基础密钥BK初始化
  console.log('\n🔑 基础密钥BK管理:');
  try {
    const baseKeyInfo = sm2KeyManager.getBaseKeyInfo();
    if (baseKeyInfo) {
      console.log(`✅ 算法: ${baseKeyInfo.algorithm}`);
      console.log(`   密钥长度: ${baseKeyInfo.keyLength} 位`);
      console.log(`   格式: ${baseKeyInfo.format}`);
      console.log(`   BK预览: ${baseKeyInfo.keyPreview}`);
      console.log(`   创建时间: ${baseKeyInfo.createdAt}`);
      console.log(`   用途: ${baseKeyInfo.description}`);
      console.log('🗝️ 基础密钥BK已就绪，支持组密钥派生功能');
    }
  } catch (error) {
    console.error('❌ 基础密钥BK系统初始化失败:', error);
  }
  
  // 创建默认房间
  try {
    roomManager.createRoom('general', '公共聊天室', {
      description: '默认公共聊天室，欢迎大家聊天！',
      maxUsers: 100
    });
    console.log('✅ 默认房间 "公共聊天室" 创建成功');
  } catch (error) {
    console.log('ℹ️ 默认房间已存在，跳过创建');
  }
});

// ==================== 优雅关闭处理 ====================

// 优雅关闭函数
function gracefulShutdown(signal) {
  console.log(`\n📴 收到 ${signal} 信号，开始优雅关闭服务器...`);
  
  server.close(() => {
    console.log('✅ HTTP服务器已关闭');
    
    // 强制退出（防止僵尸进程）
    setTimeout(() => {
      console.log('🔚 服务器进程退出');
      process.exit(0);
    }, 1000);
  });
  
  // 如果2秒后仍未关闭，强制退出
  setTimeout(() => {
    console.error('❌ 强制关闭服务器');
    process.exit(1);
  }, 2000);
}

// 监听关闭信号
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// 捕获未处理的异常
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

console.log('🎉 WebSocket服务器模块化版本已准备就绪！');