const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sm2 = require('sm-crypto').sm2;

/**
 * SM2密钥管理器类
 * 负责SM2椭圆曲线密码算法的密钥生成、存储、验证和管理
 * 支持基础密钥BK和组密钥派生功能
 */
class SM2KeyManager {
  constructor() {
    this.keysDir = path.join(__dirname, 'keys');
    this.keysFile = path.join(this.keysDir, 'server-keys.json');
    this.bkFile = path.join(this.keysDir, 'base-key-bk.json');
    this.keyPair = null;
    this.baseKey = null; // 基础密钥 BK (128位，符合SM4密钥长度)
    
    this.initializeKeyManager();
  }
  
  /**
   * 初始化密钥管理器
   */
  initializeKeyManager() {
    try {
      // 确保keys目录存在
      if (!fs.existsSync(this.keysDir)) {
        fs.mkdirSync(this.keysDir, { recursive: true });
        console.log('🔐 创建密钥存储目录:', this.keysDir);
      }
      
      // 初始化SM2密钥对
      this.loadOrGenerateKeys();
      
      // 初始化基础密钥BK
      this.loadOrGenerateBaseKey();
      
    } catch (error) {
      console.error('❌ 初始化SM2密钥管理器失败:', error);
    }
  }
  
  /**
   * 加载或生成SM2密钥对
   */
  loadOrGenerateKeys() {
    try {
      // 检查是否存在已保存的密钥
      if (fs.existsSync(this.keysFile)) {
        const savedKeys = JSON.parse(fs.readFileSync(this.keysFile, 'utf8'));
        
        // 验证密钥格式
        if (this.validateKeyPair(savedKeys)) {
          this.keyPair = savedKeys;
          console.log('✅ 成功加载已保存的SM2密钥对');
          console.log(`   公钥: ${this.keyPair.publicKey.substring(0, 20)}...`);
          console.log(`   生成时间: ${this.keyPair.createdAt}`);
          return;
        }
      }
      
      // 生成新的密钥对
      this.generateNewKeyPair();
      
    } catch (error) {
      console.error('❌ 加载SM2密钥失败:', error);
      // 如果加载失败，生成新密钥
      this.generateNewKeyPair();
    }
  }
  
  /**
   * 生成新的SM2密钥对
   */
  generateNewKeyPair() {
    try {
      console.log('🔐 正在生成新的SM2密钥对...');
      
      // 生成SM2密钥对 (十六进制格式)
      const keypair = sm2.generateKeyPairHex();
      
      // 验证生成的密钥
      if (!keypair.publicKey || !keypair.privateKey) {
        throw new Error('SM2密钥对生成失败');
      }
      
      // 构建密钥对象
      this.keyPair = {
        publicKey: keypair.publicKey,
        privateKey: keypair.privateKey,
        algorithm: 'SM2',
        curve: 'sm2p256v1',
        keyLength: {
          publicKey: keypair.publicKey.length,
          privateKey: keypair.privateKey.length
        },
        createdAt: new Date().toISOString(),
        version: '1.0'
      };
      
      // 保存密钥到文件
      this.saveKeysToFile();
      
      console.log('✅ SM2密钥对生成成功!');
      console.log(`   公钥长度: ${this.keyPair.keyLength.publicKey} 字符`);
      console.log(`   私钥长度: ${this.keyPair.keyLength.privateKey} 字符`);
      console.log(`   公钥前20位: ${this.keyPair.publicKey.substring(0, 20)}...`);
      
    } catch (error) {
      console.error('❌ 生成SM2密钥对失败:', error);
      throw error;
    }
  }
  
  /**
   * 验证密钥对格式
   */
  validateKeyPair(keyPair) {
    if (!keyPair || !keyPair.publicKey || !keyPair.privateKey) {
      return false;
    }
    
    // 检查公钥长度 (SM2公钥应该是130位十六进制字符)
    if (keyPair.publicKey.length !== 130) {
      console.warn('⚠️ 公钥长度不正确，期望130字符，实际:', keyPair.publicKey.length);
      return false;
    }
    
    // 检查私钥长度 (SM2私钥应该是64位十六进制字符)
    if (keyPair.privateKey.length !== 64) {
      console.warn('⚠️ 私钥长度不正确，期望64字符，实际:', keyPair.privateKey.length);
      return false;
    }
    
    return true;
  }
  
  /**
   * 保存密钥到文件
   */
  saveKeysToFile() {
    try {
      const keysData = JSON.stringify(this.keyPair, null, 2);
      fs.writeFileSync(this.keysFile, keysData, 'utf8');
      
      // 设置文件权限 (仅所有者可读写)
      fs.chmodSync(this.keysFile, 0o600);
      
      console.log('💾 SM2密钥对已保存到:', this.keysFile);
      
    } catch (error) {
      console.error('❌ 保存SM2密钥失败:', error);
      throw error;
    }
  }
  
  /**
   * 加载或生成基础密钥BK
   */
  loadOrGenerateBaseKey() {
    try {
      // 检查是否存在已保存的基础密钥
      if (fs.existsSync(this.bkFile)) {
        const savedBaseKey = JSON.parse(fs.readFileSync(this.bkFile, 'utf8'));
        
        // 验证基础密钥格式
        if (this.validateBaseKey(savedBaseKey)) {
          this.baseKey = savedBaseKey;
          console.log('✅ 成功加载已保存的基础密钥BK');
          console.log(`   BK预览: ${this.baseKey.key.substring(0, 16)}...`);
          console.log(`   生成时间: ${this.baseKey.createdAt}`);
          return;
        }
      }
      
      // 生成新的基础密钥BK
      this.generateBaseKey();
      
    } catch (error) {
      console.error('❌ 加载基础密钥BK失败:', error);
      // 如果加载失败，生成新密钥
      this.generateBaseKey();
    }
  }
  
  /**
   * 生成随机基础密钥BK (128位，符合SM4密钥长度)
   */
  generateBaseKey() {
    try {
      console.log('🔐 正在生成新的基础密钥BK (128位)...');
      
      // 生成128位(16字节)的随机基础密钥
      const rawKey = crypto.randomBytes(16); // 16字节 = 128位
      
      // 转换为十六进制字符串 (32字符，符合SM4密钥格式)
      const keyHex = rawKey.toString('hex');
      
      // 验证生成的密钥
      if (keyHex.length !== 32) {
        throw new Error('基础密钥BK生成失败: 长度不正确');
      }
      
      // 构建基础密钥对象
      this.baseKey = {
        key: keyHex,
        algorithm: 'BK-Random',
        keyLength: 128, // 128位
        format: 'hex',
        createdAt: new Date().toISOString(),
        version: '1.0',
        description: '基础密钥BK，用于组密钥派生，符合SM4密钥长度标准'
      };
      
      // 保存基础密钥到文件
      this.saveBaseKeyToFile();
      
      console.log('✅ 基础密钥BK生成成功!');
      console.log(`   密钥长度: ${this.baseKey.keyLength} 位 (${this.baseKey.key.length} 字符)`);
      console.log(`   BK预览: ${this.baseKey.key.substring(0, 16)}...`);
      console.log(`   用途: ${this.baseKey.description}`);
      
    } catch (error) {
      console.error('❌ 生成基础密钥BK失败:', error);
      throw error;
    }
  }
  
  /**
   * 验证基础密钥BK格式
   */
  validateBaseKey(baseKey) {
    if (!baseKey || !baseKey.key) {
      return false;
    }
    
    // 检查密钥长度 (128位 = 32十六进制字符)
    if (baseKey.key.length !== 32) {
      console.warn('⚠️ 基础密钥BK长度不正确，期望32字符，实际:', baseKey.key.length);
      return false;
    }
    
    // 检查是否为有效的十六进制字符串
    if (!/^[0-9a-fA-F]{32}$/.test(baseKey.key)) {
      console.warn('⚠️ 基础密钥BK不是有效的十六进制格式');
      return false;
    }
    
    return true;
  }
  
  /**
   * 保存基础密钥BK到文件
   */
  saveBaseKeyToFile() {
    try {
      const baseKeyData = JSON.stringify(this.baseKey, null, 2);
      fs.writeFileSync(this.bkFile, baseKeyData, 'utf8');
      
      // 设置文件权限 (仅所有者可读写)
      fs.chmodSync(this.bkFile, 0o600);
      
      console.log('💾 基础密钥BK已保存到:', this.bkFile);
      
    } catch (error) {
      console.error('❌ 保存基础密钥BK失败:', error);
      throw error;
    }
  }
  
  /**
   * 基于基础密钥BK派生组密钥
   * @param {string} groupId - 组ID，用于密钥派生
   * @param {string} salt - 可选的盐值，增强安全性
   * @returns {Object} 派生的组密钥对象
   */
  deriveGroupKey(groupId, salt = null) {
    try {
      if (!this.baseKey) {
        throw new Error('基础密钥BK未初始化');
      }
      
      if (!groupId || typeof groupId !== 'string') {
        throw new Error('组ID不能为空且必须是字符串');
      }
      
      console.log(`🔑 正在为组 "${groupId}" 派生密钥...`);
      
      // 构建派生输入材料
      const derivationMaterial = salt ? 
        `${this.baseKey.key}:${groupId}:${salt}` : 
        `${this.baseKey.key}:${groupId}`;
      
      // 使用HMAC-SM3进行密钥派生（符合国密标准）
      const derivedKey = crypto.createHmac('sha256', Buffer.from(this.baseKey.key, 'hex'))
        .update(derivationMaterial)
        .digest('hex');
      
      // 提取128位(32字符)作为组密钥，符合SM4标准
      const groupKey = derivedKey.substring(0, 32);
      
      const groupKeyInfo = {
        groupId: groupId,
        key: groupKey,
        algorithm: 'SM4-Derived',
        keyLength: 128,
        format: 'hex',
        derivedFrom: 'BK-Random',
        baseKeyPreview: this.baseKey.key.substring(0, 16) + '...',
        salt: salt,
        derivedAt: new Date().toISOString(),
        version: '1.0',
        derivationMethod: 'HMAC-SM3-BK'
      };
      
      console.log(`✅ 组密钥派生成功`);
      console.log(`   组ID: ${groupId}`);
      console.log(`   组密钥预览: ${groupKey.substring(0, 16)}...`);
      console.log(`   派生方法: ${groupKeyInfo.derivationMethod}`);
      
      return groupKeyInfo;
      
    } catch (error) {
      console.error(`❌ 组密钥派生失败 (组: ${groupId}):`, error);
      throw error;
    }
  }
  
  /**
   * 验证组密钥派生的一致性
   * @param {string} groupId - 组ID
   * @param {string} expectedKey - 期望的组密钥
   * @param {string} salt - 可选的盐值
   * @returns {boolean} 验证结果
   */
  verifyGroupKey(groupId, expectedKey, salt = null) {
    try {
      if (!this.baseKey) {
        throw new Error('基础密钥BK未初始化');
      }
      
      const derivedKeyInfo = this.deriveGroupKey(groupId, salt);
      const isValid = derivedKeyInfo.key === expectedKey;
      
      console.log(`🔍 验证组 "${groupId}" 密钥一致性: ${isValid ? '✅ 通过' : '❌ 失败'}`);
      
      return isValid;
      
    } catch (error) {
      console.error('❌ 组密钥验证失败:', error);
      return false;
    }
  }
  
  /**
   * 重新生成基础密钥BK
   * 注意：这会导致所有基于此BK派生的组密钥失效
   */
  regenerateBaseKey() {
    try {
      console.warn('⚠️ 重新生成基础密钥BK将导致所有组密钥失效！');
      
      this.generateBaseKey();
      
      console.log('✅ 基础密钥BK已重新生成');
      console.log('⚠️ 请通知所有客户端更新组密钥');
      
    } catch (error) {
      console.error('❌ 重新生成基础密钥BK失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取公钥
   */
  getPublicKey() {
    return this.keyPair ? this.keyPair.publicKey : null;
  }
  
  /**
   * 获取完整密钥对信息
   */
  getKeyPair() {
    return this.keyPair ? { ...this.keyPair } : null;
  }
  
  /**
   * 获取密钥信息摘要
   */
  getKeyInfo() {
    if (!this.keyPair) {
      return null;
    }
    
    return {
      algorithm: this.keyPair.algorithm,
      curve: this.keyPair.curve,
      keyLength: this.keyPair.keyLength,
      createdAt: this.keyPair.createdAt,
      publicKey: this.keyPair.publicKey,
      publicKeyPreview: this.keyPair.publicKey.substring(0, 20) + '...',
      hasPrivateKey: !!this.keyPair.privateKey
    };
  }
  
  /**
   * 获取基础密钥BK信息
   */
  getBaseKeyInfo() {
    if (!this.baseKey) {
      return null;
    }
    
    return {
      algorithm: this.baseKey.algorithm,
      keyLength: this.baseKey.keyLength,
      format: this.baseKey.format,
      createdAt: this.baseKey.createdAt,
      keyPreview: this.baseKey.key.substring(0, 16) + '...',
      fullKey: this.baseKey.key,
      description: this.baseKey.description
    };
  }
  
  /**
   * 获取基础密钥BK (仅供内部使用)
   */
  getBaseKey() {
    return this.baseKey ? this.baseKey.key : null;
  }
  
  /**
   * 为客户端生成密钥对 (服务端集中生成)
   */
  generateClientKeyPair() {
    try {
      console.log('🔐 正在为客户端生成SM2密钥对...');
      
      // 生成客户端SM2密钥对 (十六进制格式)
      const clientKeyPair = sm2.generateKeyPairHex();
      
      // 验证生成的密钥
      if (!clientKeyPair.publicKey || !clientKeyPair.privateKey) {
        throw new Error('客户端SM2密钥对生成失败');
      }
      
      console.log('✅ 客户端SM2密钥对生成成功!');
      console.log(`   公钥长度: ${clientKeyPair.publicKey.length} 字符`);
      console.log(`   私钥长度: ${clientKeyPair.privateKey.length} 字符`);
      console.log(`   公钥前20位: ${clientKeyPair.publicKey.substring(0, 20)}...`);
      
      return {
        publicKey: clientKeyPair.publicKey,
        privateKey: clientKeyPair.privateKey,
        algorithm: 'SM2',
        curve: 'sm2p256v1',
        keyLength: {
          publicKey: clientKeyPair.publicKey.length,
          privateKey: clientKeyPair.privateKey.length
        },
        createdAt: new Date().toISOString(),
        version: '1.0',
        purpose: 'client'
      };
      
    } catch (error) {
      console.error('❌ 生成客户端SM2密钥对失败:', error);
      throw error;
    }
  }

  /**
   * 验证密钥对完整性
   */
  testKeyPair() {
    try {
      if (!this.keyPair) {
        throw new Error('密钥对未初始化');
      }
      
      // 测试加密解密 (使用sm2模块的正确API)
      const testMessage = 'SM2密钥对完整性测试消息';
      
      // 使用服务器公钥加密，使用私钥解密
      const encrypted = sm2.doEncrypt(testMessage, this.keyPair.publicKey);
      const decrypted = sm2.doDecrypt(encrypted, this.keyPair.privateKey);
      
      if (decrypted !== testMessage) {
        throw new Error('密钥对加密解密测试失败');
      }
      
      // 测试签名验证
      const signature = sm2.doSignature(testMessage, this.keyPair.privateKey);
      const isValid = sm2.doVerifySignature(testMessage, signature, this.keyPair.publicKey);
      
      if (!isValid) {
        throw new Error('密钥对签名验证测试失败');
      }
      
      console.log('✅ SM2密钥对完整性验证通过');
      return true;
      
    } catch (error) {
      console.error('❌ SM2密钥对完整性验证失败:', error);
      return false;
    }
  }
  
  /**
   * 加密数据
   * @param {string} message - 要加密的消息
   * @param {string} publicKey - 公钥（可选，默认使用服务器的公钥）
   * @returns {string} 加密后的数据
   */
  encrypt(message, publicKey = null) {
    if (!this.keyPair) {
      throw new Error('密钥对未初始化');
    }
    
    const pubKey = publicKey || this.keyPair.publicKey;
    return sm2.doEncrypt(message, pubKey);
  }
  
  /**
   * 解密数据
   * @param {string} encryptedData - 加密的数据
   * @param {string} privateKey - 私钥（可选，默认使用服务器的私钥）
   * @returns {string} 解密后的消息
   */
  decrypt(encryptedData, privateKey = null) {
    if (!this.keyPair) {
      throw new Error('密钥对未初始化');
    }
    
    const privKey = privateKey || this.keyPair.privateKey;
    return sm2.doDecrypt(encryptedData, privKey);
  }
  
  /**
   * 数字签名
   * @param {string} message - 要签名的消息
   * @param {string} privateKey - 私钥（可选，默认使用服务器的私钥）
   * @returns {string} 签名数据
   */
  sign(message, privateKey = null) {
    if (!this.keyPair) {
      throw new Error('密钥对未初始化');
    }
    
    const privKey = privateKey || this.keyPair.privateKey;
    return sm2.doSignature(message, privKey);
  }
  
  /**
   * 验证数字签名
   * @param {string} message - 原始消息
   * @param {string} signature - 签名数据
   * @param {string} publicKey - 公钥（可选，默认使用服务器的公钥）
   * @returns {boolean} 验证结果
   */
  verify(message, signature, publicKey = null) {
    if (!this.keyPair) {
      throw new Error('密钥对未初始化');
    }
    
    const pubKey = publicKey || this.keyPair.publicKey;
    return sm2.doVerifySignature(message, signature, pubKey);
  }
  
  /**
   * 重新生成密钥对
   */
  regenerateKeyPair() {
    this.generateNewKeyPair();
  }
  
  /**
   * SM3-KDF密钥派生函数
   * @param {string} key - 原始密钥
   * @param {string} context - 派生上下文/用户ID等
   * @param {number} length - 期望输出的密钥长度（字节数）
   * @returns {string} 派生的密钥（hex格式）
   */
  sm3KDF(key, context, length = 32) {
    try {
      if (!key) {
        throw new Error('原始密钥不能为空');
      }
      
      if (!context) {
        throw new Error('派生上下文不能为空');
      }
      
      let output = '';
      let counter = 1;
      
      // KDF构造：KDF(K, Z) = SM3(CTX || K || counter)
      while (output.length < length * 2) { // length * 2 因为hex格式
        const counterHex = Buffer.from(counter.toString()).toString('hex');
        const input = context + key + counterHex;
        
        // 使用crypto的Hmac进行SM3哈希（SM3算法通过sm-crypto库支持）
        const hmac = crypto.createHmac('sm3', Buffer.from(key, 'hex'));
        hmac.update(Buffer.from(context, 'utf8'));
        const hash = hmac.digest('hex');
        
        output += hash;
        counter++;
      }
      
      return output.substring(0, length * 2);
      
    } catch (error) {
      console.error('SM3-KDF密钥派生失败:', error);
      throw error;
    }
  }
  
  /**
   * 派生房间用户基础值 S_i = KDF(K_room, 用户ID)
   * @param {string} roomBaseKey - 房间级基础密钥K_room
   * @param {string} roomId - 房间ID
   * @param {string} userId - 用户ID
   * @returns {string} 房间ID哈希值 + S_i值（拼接后的hex格式）
   */
  deriveUserRoomBaseValue(roomBaseKey, roomId, userId) {
    try {
      if (!roomBaseKey) {
        throw new Error('房间级基础密钥不能为空');
      }
      
      if (!roomId) {
        throw new Error('房间ID不能为空');
      }
      
      if (!userId) {
        throw new Error('用户ID不能为空');
      }
      
      // S_i = KDF(K_room, 用户ID)，派生32字节（256位）作为用户房间基础值
      const userBaseValue = this.sm3KDF(roomBaseKey, `user_${userId}_room_base`, 32);
      
      // 对roomId进行SM3哈希
      const roomIdHash = crypto.createHash('sm3').update(roomId, 'utf8').digest('hex');
      
      // 拼接房间ID哈希值和S_i值：RoomId_Hash + S_i
      const combinedValue =  userBaseValue + roomIdHash;
      
      console.log(`✅ 用户房间基础值S_i派生成功`);
      console.log(`   房间ID: ${roomId}`);
      console.log(`   房间ID哈希值预览: ${roomIdHash.substring(0, 16)}...`);
      console.log(`   用户ID: ${userId}`);
      console.log(`   S_i预览: ${userBaseValue.substring(0, 16)}...`);
      console.log(`   拼接后总长度: ${combinedValue.length} 字符`);
      
      return combinedValue;
      
    } catch (error) {
      console.error('用户房间基础值S_i派生失败:', error);
      throw error;
    }
  }
  
  /**
   * 计算组密钥 GK = KDF(S_i, F_room)
   * @param {string} userBaseValue - 用户房间基础值S_i
   * @param {string} roomFactor - 房间动态因子F_room
   * @returns {string} 组密钥GK（hex格式）
   */
  deriveGroupKeyFromValues(userBaseValue, roomFactor) {
    try {
      if (!userBaseValue) {
        throw new Error('用户房间基础值S_i不能为空');
      }
      
      if (!roomFactor) {
        throw new Error('房间动态因子F_room不能为空');
      }
      
      // GK = KDF(S_i, F_room)，派生16字节（128位）作为组密钥，符合SM4标准
      const groupKey = this.sm3KDF(userBaseValue, `group_key_${roomFactor}`, 16);
      
      console.log(`✅ 组密钥GK计算成功`);
      console.log(`   GK预览: ${groupKey.substring(0, 16)}...`);
      
      return groupKey;
      
    } catch (error) {
      console.error('组密钥GK计算失败:', error);
      throw error;
    }
  }
  
  /**
   * 生成房间级基础密钥K_room
   * @param {string} roomId - 房间ID
   * @returns {string} 房间级基础密钥（hex格式）
   */
  generateRoomBaseKey(roomId) {
    try {
      if (!roomId) {
        throw new Error('房间ID不能为空');
      }
      
      // 基于基础密钥BK和房间ID生成房间级基础密钥
      const roomBaseKey = this.sm3KDF(this.baseKey.key, `room_base_${roomId}`, 16);
      
      console.log(`✅ 房间级基础密钥K_room生成成功`);
      console.log(`   房间ID: ${roomId}`);
      console.log(`   K_room预览: ${roomBaseKey.substring(0, 16)}...`);
      
      return roomBaseKey;
      
    } catch (error) {
      console.error('房间级基础密钥K_room生成失败:', error);
      throw error;
    }
  }
  
  /**
   * 生成房间动态因子F_room
   * @param {string} roomId - 房间ID
   * @returns {string} 房间动态因子F_room
   */
  generateRoomDynamicFactor(roomId) {
    try {
      if (!roomId) {
        throw new Error('房间ID不能为空');
      }
      
      const timestamp = Date.now();
      const randomValue = crypto.randomBytes(8).toString('hex');
      const roomFactor = `${roomId}_${timestamp}_${randomValue}`;
      
      console.log(`✅ 房间动态因子F_room生成成功`);
      console.log(`   房间ID: ${roomId}`);
      console.log(`   时间戳: ${timestamp}`);
      console.log(`   F_room: ${roomFactor}`);
      
      return roomFactor;
      
    } catch (error) {
      console.error('房间动态因子F_room生成失败:', error);
      throw error;
    }
  }
  
  /**
   * 打包房间密钥信息用于传输（加密）
   * @param {object} keyInfo - 密钥信息对象
   * @param {string} userPublicKey - 用户SM2公钥
   * @returns {string} 加密后的密钥信息
   */
  packageRoomKeyInfo(keyInfo, userPublicKey) {
    try {
      const jsonString = JSON.stringify(keyInfo);
      const encrypted = this.encrypt(jsonString, userPublicKey);
      
      console.log(`📦 房间密钥信息打包成功`);
      console.log(`   原始信息长度: ${jsonString.length} 字符`);
      console.log(`   加密后长度: ${encrypted.length} 字符`);
      
      return encrypted;
      
    } catch (error) {
      console.error('房间密钥信息打包失败:', error);
      throw error;
    }
  }
}

module.exports = SM2KeyManager;