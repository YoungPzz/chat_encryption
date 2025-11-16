/**
 * SM2KeyManager API 使用示例
 * 展示如何在业务代码中使用重构后的SM2密钥管理器
 */

const SM2KeyManager = require('./sm2KeyManager');

// 创建SM2密钥管理器实例
const sm2KeyManager = new SM2KeyManager();

/**
 * 示例1: 获取密钥信息
 */
function getKeyInfoExample() {
  console.log('=== 获取密钥信息示例 ===');
  
  // 获取密钥信息摘要
  const keyInfo = sm2KeyManager.getKeyInfo();
  console.log('密钥信息:', keyInfo);
  
  // 获取完整密钥对
  const keyPair = sm2KeyManager.getKeyPair();
  console.log('完整密钥对:', keyPair);
  
  // 只获取公钥
  const publicKey = sm2KeyManager.getPublicKey();
  console.log('公钥:', publicKey);
}

/**
 * 示例2: 加密解密操作
 */
function encryptDecryptExample() {
  console.log('\n=== 加密解密操作示例 ===');
  
  try {
    // 加密消息
    const originalMessage = '这是一个需要加密的敏感消息';
    console.log('原始消息:', originalMessage);
    
    const encryptedData = sm2KeyManager.encrypt(originalMessage);
    console.log('加密后数据:', encryptedData);
    
    // 解密消息
    const decryptedMessage = sm2KeyManager.decrypt(encryptedData);
    console.log('解密后消息:', decryptedMessage);
    
    // 验证解密结果
    if (decryptedMessage === originalMessage) {
      console.log('✅ 加密解密测试成功');
    }
    
  } catch (error) {
    console.error('❌ 加密解密测试失败:', error);
  }
}

/**
 * 示例3: 数字签名操作
 */
function digitalSignatureExample() {
  console.log('\n=== 数字签名操作示例 ===');
  
  try {
    // 要签名的消息
    const message = '这是一份需要签名的合同内容';
    console.log('原始消息:', message);
    
    // 生成数字签名
    const signature = sm2KeyManager.sign(message);
    console.log('数字签名:', signature);
    
    // 验证数字签名
    const isValid = sm2KeyManager.verify(message, signature);
    console.log('签名验证结果:', isValid);
    
    if (isValid) {
      console.log('✅ 数字签名验证成功');
    }
    
  } catch (error) {
    console.error('❌ 数字签名测试失败:', error);
  }
}

/**
 * 示例4: 使用自定义密钥对
 */
function customKeyPairExample() {
  console.log('\n=== 使用自定义密钥对示例 ===');
  
  try {
    // 可以传递自定义的公钥/私钥进行加密解密
    const customMessage = '使用自定义密钥加密';
    const serverPublicKey = sm2KeyManager.getPublicKey();
    
    // 使用服务器公钥加密
    const encryptedWithServerKey = sm2KeyManager.encrypt(customMessage, serverPublicKey);
    console.log('使用服务器公钥加密:', encryptedWithServerKey);
    
    // 解密（使用服务器私钥）
    const decryptedWithServerKey = sm2KeyManager.decrypt(encryptedWithServerKey);
    console.log('使用服务器私钥解密:', decryptedWithServerKey);
    
  } catch (error) {
    console.error('❌ 自定义密钥测试失败:', error);
  }
}

/**
 * 示例5: 密钥对完整性验证
 */
function keyPairValidationExample() {
  console.log('\n=== 密钥对完整性验证示例 ===');
  
  try {
    const isValid = sm2KeyManager.testKeyPair();
    console.log('密钥对完整性验证结果:', isValid);
    
    if (isValid) {
      console.log('✅ 密钥对完整且功能正常');
    }
    
  } catch (error) {
    console.error('❌ 密钥对验证失败:', error);
  }
}

/**
 * 示例6: 重新生成密钥对
 */
function regenerateKeysExample() {
  console.log('\n=== 重新生成密钥对示例 ===');
  
  try {
    console.log('重新生成SM2密钥对...');
    sm2KeyManager.regenerateKeyPair();
    
    // 验证新密钥对
    const newKeyInfo = sm2KeyManager.getKeyInfo();
    console.log('新密钥信息:', newKeyInfo);
    
    // 测试新密钥对
    const testMessage = '测试新密钥对';
    const encrypted = sm2KeyManager.encrypt(testMessage);
    const decrypted = sm2KeyManager.decrypt(encrypted);
    
    if (decrypted === testMessage) {
      console.log('✅ 新密钥对功能正常');
    }
    
  } catch (error) {
    console.error('❌ 重新生成密钥对失败:', error);
  }
}

// 执行所有示例
function runAllExamples() {
  console.log('🎯 SM2KeyManager API 使用示例');
  console.log('=====================================');
  
  // 等待密钥管理器初始化完成
  setTimeout(() => {
    getKeyInfoExample();
    encryptDecryptExample();
    digitalSignatureExample();
    customKeyPairExample();
    keyPairValidationExample();
    
    console.log('\n🎉 所有API示例执行完成！');
  }, 1000);
}

// 如果直接运行此文件，执行所有示例
if (require.main === module) {
  runAllExamples();
}

// 导出示例函数
module.exports = {
  getKeyInfoExample,
  encryptDecryptExample,
  digitalSignatureExample,
  customKeyPairExample,
  keyPairValidationExample,
  regenerateKeysExample,
  runAllExamples
};