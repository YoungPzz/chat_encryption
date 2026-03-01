/**
 * 国密算法库使用示例 - sm-crypto
 * 
 * sm-crypto 提供了完整的SM2、SM3、SM4国密算法实现
 * 符合国家密码管理局标准
 * 
 * 安装: npm install --save sm-crypto
 * 版本: v0.3.13
 * 
 * 算法概述:
 * - SM2: 椭圆曲线公钥密码算法 (非对称加密)
 * - SM3: 密码杂凑算法 (哈希算法)
 * - SM4: 分组密码算法 (对称加密)
 */

const sm2 = require('sm-crypto').sm2;
const sm3 = require('sm-crypto').sm3;
const sm4 = require('sm-crypto').sm4;

console.log('=== SM-Crypto 国密算法库使用示例 ===\n');

// SM2 椭圆曲线公钥密码算法示例
console.log('1. SM2 椭圆曲线公钥密码算法');
console.log('-----------------------------------');

// 生成SM2密钥对 (十六进制格式)
const sm2Keypair = sm2.generateKeyPairHex();
console.log('生成的密钥对:');
console.log('- 公钥 (Hex):', sm2Keypair.publicKey);
console.log('- 私钥 (Hex):', sm2Keypair.privateKey);
console.log('- 公钥长度:', sm2Keypair.publicKey.length, '字符');
console.log('- 私钥长度:', sm2Keypair.privateKey.length, '字符');

// SM2加密示例 (使用十六进制格式)
const originalMessage = 'Hello, 这是一条需要加密的敏感信息！';
console.log('\n原始消息:', originalMessage);

// 使用公钥加密 (mode: 1-加密, 0-签名)
const encryptedWithSM2 = sm2.encrypt(originalMessage, sm2Keypair.publicKey, 1);
console.log('SM2加密结果 (Hex):', encryptedWithSM2);

// 使用私钥解密
const decryptedWithSM2 = sm2.decrypt(encryptedWithSM2, sm2Keypair.privateKey, 1);
console.log('SM2解密结果:', decryptedWithSM2);

// SM2签名示例
const signature = sm2.sign(originalMessage, sm2Keypair.privateKey);
console.log('SM2签名结果 (Hex):', signature);

// 验证SM2签名
const isValidSignature = sm2.verify(originalMessage, signature, sm2Keypair.publicKey);
console.log('SM2签名验证结果:', isValidSignature);

// 生成SM2密钥对 (默认格式)
console.log('\n--- 密钥对生成方式对比 ---');
const defaultKeypair = sm2.generateKeyPair();
console.log('默认格式密钥对:');
console.log('- 公钥类型:', typeof defaultKeypair.publicKey);
console.log('- 私钥类型:', typeof defaultKeypair.privateKey);

console.log('\n');

// SM3 密码杂凑算法示例
console.log('2. SM3 密码杂凑算法');
console.log('-----------------------------------');

const message1 = 'Hello, SM3!';
const message2 = '这是一条需要生成哈希值的消息';

console.log('消息1:', message1);
const hash1 = sm3(message1);
console.log('SM3哈希值 (默认):', hash1);
console.log('哈希长度:', hash1.length, '字符');

console.log('\n消息2:', message2);
const hash2 = sm3(message2); // 直接返回字符串
console.log('SM3哈希值:', hash2);
console.log('哈希长度:', hash2.length, '字符');

// 验证哈希值一致性
const isHashConsistent = hash2 === sm3(message2);
console.log('哈希值一致性验证:', isHashConsistent);

// 验证数据完整性示例
const originalData = '重要的业务数据';
const tamperedData = '重要的业务数据(已篡改)';
const originalHash = sm3(originalData);
const tamperedHash = sm3(tamperedData);

console.log('\n数据完整性验证演示:');
console.log('原始数据:', originalData);
console.log('原始哈希:', originalHash);
console.log('篡改数据:', tamperedData);
console.log('篡改哈希:', tamperedHash);
console.log('数据完整性:', originalHash !== tamperedHash ? '✅ 数据完整' : '❌ 数据被篡改');

console.log('\n');

// SM4 分组密码算法示例
console.log('3. SM4 分组密码算法');
console.log('-----------------------------------');

// 生成SM4密钥 (128位)
const sm4Key = '0123456789abcdeffedcba9876543210'; // 32位十六进制字符串
console.log('SM4密钥 (Hex):', sm4Key);
console.log('密钥长度:', sm4Key.length, '字符 (128位)');

const plaintext = '这是需要加密的敏感数据内容';
console.log('\n待加密明文:', plaintext);

// SM4加密
const encryptedWithSM4 = sm4.encrypt(plaintext, sm4Key);
console.log('SM4加密结果 (Hex):', encryptedWithSM4);

// SM4解密
const decryptedWithSM4 = sm4.decrypt(encryptedWithSM4, sm4Key);
console.log('SM4解密结果:', decryptedWithSM4);

// 验证解密结果
const isDecryptionCorrect = plaintext === decryptedWithSM4;
console.log('解密结果验证:', isDecryptionCorrect);

// ECB模式加密示例
console.log('\n--- 不同加密模式示例 ---');
const ecbEncrypted = sm4.encrypt(plaintext, sm4Key); // 使用默认填充方式
const ecbDecrypted = sm4.decrypt(ecbEncrypted, sm4Key);
console.log('ECB模式加密结果:', ecbEncrypted.substring(0, 20) + '...');
console.log('ECB模式解密验证:', plaintext === ecbDecrypted);

console.log('\n');

// 实际应用场景示例
console.log('4. 实际应用场景示例');
console.log('-----------------------------------');

// 场景1: 用户身份认证
console.log('场景1: 用户身份认证');
const userInfo = 'user123|admin|2024-01-01';
const userHash = sm3(userInfo);
console.log('用户信息:', userInfo);
console.log('信息哈希:', userHash);
console.log('应用: 用于验证用户信息完整性');

// 场景2: 数据传输加密
console.log('\n场景2: 数据传输加密');
const sensitiveData = JSON.stringify({
    userId: '12345',
    username: '张三',
    email: 'zhangsan@example.com',
    timestamp: Date.now()
});
console.log('敏感数据:', sensitiveData);

// 生成临时密钥对用于此次通信
const tempKeypair = sm2.generateKeyPairHex();
const encryptedData = sm2.encrypt(sensitiveData, tempKeypair.publicKey, 1);
console.log('加密后数据长度:', encryptedData.length, '字符');
console.log('应用: 确保敏感数据传输安全');

// 场景3: 配置文件加密存储
console.log('\n场景3: 配置文件加密存储');
const configData = JSON.stringify({
    database: {
        host: 'localhost',
        port: 3306,
        username: 'admin',
        password: 'secret123'
    },
    api: {
        key: 'api-secret-key-2024'
    }
});
console.log('原始配置数据长度:', configData.length, '字符');

// 使用SM4加密配置
const configKey = 'fedcba98765432100123456789abcdef';
const encryptedConfig = sm4.encrypt(configData, configKey);
console.log('加密配置数据长度:', encryptedConfig.length, '字符');
console.log('应用: 保护敏感配置信息');

console.log('\n');

// 性能对比示例
console.log('5. 性能对比示例');
console.log('-----------------------------------');

// 测试不同数据长度的处理速度
const testDataSizes = [100, 1000, 10000];
testDataSizes.forEach(size => {
    const testData = 'A'.repeat(size);
    const start = Date.now();
    const hash = sm3(testData);
    const end = Date.now();
    console.log(`数据长度 ${size} 字符: 哈希耗时 ${end - start}ms`);
});

console.log('\n=== SM-Crypto 国密算法库使用示例完成 ===');
console.log('说明: sm-crypto库提供了简洁的API接口，适合轻量级应用');
console.log('推荐用于前端和小程序等场景');
console.log('注意: SM2加密结果格式为C1|C2|C3 (C1-随机数,C2-密文,C3-哈希值)');