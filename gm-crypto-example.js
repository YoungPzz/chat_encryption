/**
 * 国密算法库使用示例 - gm-crypto
 * 
 * gm-crypto 提供了完整的SM2、SM3、SM4国密算法实现
 * 符合国家密码管理局标准
 * 
 * 安装: npm install --save gm-crypto
 * 版本: v0.1.12
 * 
 * 算法概述:
 * - SM2: 椭圆曲线公钥密码算法 (非对称加密)
 * - SM3: 密码杂凑算法 (哈希算法)
 * - SM4: 分组密码算法 (对称加密)
 */

const { SM2, SM3, SM4 } = require('gm-crypto');

console.log('=== GM-Crypto 国密算法库使用示例 ===\n');

// SM2 椭圆曲线公钥密码算法示例
console.log('1. SM2 椭圆曲线公钥密码算法');
console.log('-----------------------------------');

// 生成SM2密钥对
const sm2Keypair = SM2.generateKeyPair();
console.log('生成的密钥对:');
console.log('- 公钥 (Hex):', sm2Keypair.publicKey);
console.log('- 私钥 (Hex):', sm2Keypair.privateKey);
console.log('- 公钥长度:', sm2Keypair.publicKey.length, '字符');
console.log('- 私钥长度:', sm2Keypair.privateKey.length, '字符');

// SM2加密示例
const originalMessage = 'Hello, 这是一条需要加密的敏感信息！';
console.log('\n原始消息:', originalMessage);

// 使用公钥加密
const encryptedWithSM2 = SM2.encrypt(originalMessage, sm2Keypair.publicKey, 1); // 1为加密模式
console.log('SM2加密结果 (Hex):', encryptedWithSM2);

// 使用私钥解密
const decryptedWithSM2 = SM2.decrypt(encryptedWithSM2, sm2Keypair.privateKey, 1);
console.log('SM2解密结果:', decryptedWithSM2);

// SM2签名示例
const signature = SM2.sign(originalMessage, sm2Keypair.privateKey, { der: true });
console.log('SM2签名结果 (Hex):', signature);

// 验证SM2签名
const isValidSignature = SM2.verify(originalMessage, signature, sm2Keypair.publicKey, { der: true });
console.log('SM2签名验证结果:', isValidSignature);

console.log('\n');

// SM3 密码杂凑算法示例
console.log('2. SM3 密码杂凑算法');
console.log('-----------------------------------');

const message1 = 'Hello, SM3!';
const message2 = '这是一条需要生成哈希值的消息';

console.log('消息1:', message1);
const hash1 = SM3.digest(message1);
console.log('SM3哈希值:', hash1);
console.log('哈希长度:', hash1.length, '字符');

console.log('\n消息2:', message2);
const hash2 = SM3.digestHex(message2); // 十六进制格式
console.log('SM3哈希值 (Hex):', hash2);
console.log('哈希长度:', hash2.length, '字符');

// 验证哈希值一致性
const isHashConsistent = hash2 === SM3.digestHex(message2);
console.log('哈希值一致性验证:', isHashConsistent);

console.log('\n');

// SM4 分组密码算法示例
console.log('3. SM4 分组密码算法');
console.log('-----------------------------------');

// 生成SM4密钥 (128位，16字节)
const sm4Key = SM4.generateKey('hex'); // 可选格式: 'hex', 'array', 'bytes'
console.log('生成的SM4密钥 (Hex):', sm4Key);
console.log('密钥长度:', sm4Key.length, '字符 (128位)');

const plaintext = '这是需要加密的敏感数据内容';
console.log('\n待加密明文:', plaintext);

// SM4加密
const encryptedWithSM4 = SM4.encrypt(plaintext, sm4Key);
console.log('SM4加密结果 (Hex):', encryptedWithSM4);

// SM4解密
const decryptedWithSM4 = SM4.decrypt(encryptedWithSM4, sm4Key);
console.log('SM4解密结果:', decryptedWithSM4);

// 验证解密结果
const isDecryptionCorrect = plaintext === decryptedWithSM4;
console.log('解密结果验证:', isDecryptionCorrect);

console.log('\n');

// 高级使用示例
console.log('4. 高级使用示例');
console.log('-----------------------------------');

// 批量加密示例
const messages = ['消息1', '消息2', '消息3'];
const publicKey = sm2Keypair.publicKey;

console.log('批量加密演示:');
messages.forEach((msg, index) => {
    const encrypted = SM2.encrypt(msg, publicKey, 1);
    console.log(`消息${index + 1}加密结果: ${encrypted.substring(0, 20)}...`);
});

// 哈希验证示例
console.log('\n数据完整性验证演示:');
const dataToVerify = '重要的业务数据';
const originalHash = SM3.digestHex(dataToVerify);
const tamperedData = '重要的业务数据(已篡改)';
const tamperedHash = SM3.digestHex(tamperedData);

console.log('原始数据哈希:', originalHash);
console.log('篡改后哈希:', tamperedHash);
console.log('数据完整性:', originalHash !== tamperedHash ? '✅ 数据完整' : '❌ 数据被篡改');

console.log('\n=== GM-Crypto 国密算法库使用示例完成 ===');
console.log('说明: 以上示例展示了SM2、SM3、SM4三大核心国密算法的基本用法');
console.log('实际使用时可根据业务需求调整参数配置');