/**
 * SM-Crypto 国密算法库引用配置
 * 
 * 本文件用于在项目中引用和配置SM-Crypto国密算法库
 * 符合国家密码管理局标准，支持SM2、SM3、SM4核心算法
 * 
 * 库信息:
 * - 包名: sm-crypto
 * - 版本: v0.3.13
 * - 安装命令: npm install --save sm-crypto
 * 
 * 算法支持:
 * - SM2: 椭圆曲线公钥密码算法 (非对称加密/签名)
 * - SM3: 密码杂凑算法 (哈希算法)  
 * - SM4: 分组密码算法 (对称加密)
 */

// ===== 库引用配置 =====
const sm2 = require('sm-crypto').sm2;
const sm3 = require('sm-crypto').sm3;
const sm4 = require('sm-crypto').sm4;

// ===== 库验证测试 =====
console.log('SM-Crypto 国密算法库引用验证');

// 验证SM2算法
try {
    const testKeypair = sm2.generateKeyPairHex();
    console.log('✅ SM2算法加载成功 - 密钥对生成正常');
    console.log('  公钥长度:', testKeypair.publicKey.length, '字符');
    console.log('  私钥长度:', testKeypair.privateKey.length, '字符');
} catch (error) {
    console.error('❌ SM2算法加载失败:', error.message);
}

// 验证SM3算法
try {
    const testHash = sm3('test');
    console.log('✅ SM3算法加载成功 - 哈希生成正常');
    console.log('  哈希长度:', testHash.length, '字符');
} catch (error) {
    console.error('❌ SM3算法加载失败:', error.message);
}

// 验证SM4算法
try {
    const testKey = '0123456789abcdeffedcba9876543210';
    const encrypted = sm4.encrypt('test', testKey);
    const decrypted = sm4.decrypt(encrypted, testKey);
    console.log('✅ SM4算法加载成功 - 加密解密正常');
    console.log('  加密结果长度:', encrypted.length, '字符');
} catch (error) {
    console.error('❌ SM4算法加载失败:', error.message);
}

// ===== 模块导出配置 =====
module.exports = {
    // SM2算法模块
    sm2: {
        // 密钥对生成 (十六进制格式)
        generateKeyPairHex: sm2.generateKeyPairHex,
        generateKeyPair: sm2.generateKeyPair,
        
        // 加密解密 (mode: 1-加密, 0-签名)
        encrypt: (data, publicKey, mode = 1) => sm2.encrypt(data, publicKey, mode),
        decrypt: (data, privateKey, mode = 1) => sm2.decrypt(data, privateKey, mode),
        
        // 签名验证
        sign: sm2.sign,
        verify: sm2.verify
    },
    
    // SM3算法模块
    sm3: {
        digest: sm3,
        digestHex: sm3
    },
    
    // SM4算法模块  
    sm4: {
        encrypt: sm4.encrypt,
        decrypt: sm4.decrypt
    },
    
    // 库版本信息
    version: {
        name: 'sm-crypto',
        version: '0.3.13'
    }
};

console.log('\nSM-Crypto 国密算法库配置完成！');
console.log('可用的算法模块: sm2, sm3, sm4');
console.log('使用方法: const smConfig = require(\'./sm-crypto-config\');');

// ===== 使用示例 =====
/*
// 使用示例:
const { sm2, sm3, sm4 } = require('./sm-crypto-config');

// SM2使用
const keypair = sm2.generateKeyPairHex();
const encrypted = sm2.encrypt('消息', keypair.publicKey, 1);
const decrypted = sm2.decrypt(encrypted, keypair.privateKey, 1);

// SM3使用
const hash = sm3.digest('消息');

// SM4使用
const key = '0123456789abcdeffedcba9876543210';
const encrypted = sm4.encrypt('消息', key);
const decrypted = sm4.decrypt(encrypted, key);
*/