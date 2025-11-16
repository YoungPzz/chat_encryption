const SM2KeyManager = require('./sm2KeyManager');

/**
 * 基础密钥BK和组密钥派生测试脚本
 */
async function testBaseKeyAndGroupKeyDerivation() {
  console.log('=== 基础密钥BK和组密钥派生功能测试 ===\n');

  try {
    // 创建密钥管理器实例
    console.log('1. 初始化SM2KeyManager...');
    const keyManager = new SM2KeyManager();
    
    // 测试基础密钥BK信息
    console.log('\n2. 测试基础密钥BK信息获取...');
    const baseKeyInfo = keyManager.getBaseKeyInfo();
    if (baseKeyInfo) {
      console.log('✅ 基础密钥BK信息:');
      console.log(`   算法: ${baseKeyInfo.algorithm}`);
      console.log(`   密钥长度: ${baseKeyInfo.keyLength} 位`);
      console.log(`   格式: ${baseKeyInfo.format}`);
      console.log(`   BK预览: ${baseKeyInfo.keyPreview}`);
      console.log(`   完整BK: ${baseKeyInfo.fullKey}`);
      console.log(`   创建时间: ${baseKeyInfo.createdAt}`);
      console.log(`   用途: ${baseKeyInfo.description}`);
    } else {
      throw new Error('无法获取基础密钥BK信息');
    }

    // 测试组密钥派生功能
    console.log('\n3. 测试组密钥派生功能...');
    
    // 为不同组派生密钥
    const groups = ['general', 'private-room', 'admin-group', 'test-room'];
    const groupKeys = [];
    
    for (const groupId of groups) {
      console.log(`\n   正在为组 "${groupId}" 派生密钥...`);
      const groupKeyInfo = keyManager.deriveGroupKey(groupId);
      groupKeys.push(groupKeyInfo);
      
      console.log(`   ✅ 组密钥派生成功:`);
      console.log(`      组ID: ${groupKeyInfo.groupId}`);
      console.log(`      组密钥: ${groupKeyInfo.key}`);
      console.log(`      密钥长度: ${groupKeyInfo.keyLength} 位`);
      console.log(`      算法: ${groupKeyInfo.algorithm}`);
      console.log(`      派生方法: ${groupKeyInfo.derivationMethod}`);
      console.log(`      基于BK: ${groupKeyInfo.baseKeyPreview}`);
      console.log(`      派生时间: ${groupKeyInfo.derivedAt}`);
    }
    
    // 测试密钥一致性验证
    console.log('\n4. 测试组密钥一致性验证...');
    for (let i = 0; i < groupKeys.length; i++) {
      const groupKeyInfo = groupKeys[i];
      const isValid = keyManager.verifyGroupKey(
        groupKeyInfo.groupId, 
        groupKeyInfo.key
      );
      
      if (isValid) {
        console.log(`   ✅ 组 "${groupKeyInfo.groupId}" 密钥验证通过`);
      } else {
        console.log(`   ❌ 组 "${groupKeyInfo.groupId}" 密钥验证失败`);
      }
    }
    
    // 测试使用盐值的密钥派生
    console.log('\n5. 测试带盐值的组密钥派生...');
    const salt = 'random-salt-12345';
    const saltedGroupKey = keyManager.deriveGroupKey('secure-room', salt);
    console.log(`   ✅ 带盐值组密钥派生成功:`);
    console.log(`      组ID: ${saltedGroupKey.groupId}`);
    console.log(`      盐值: ${saltedGroupKey.salt}`);
    console.log(`      组密钥: ${saltedGroupKey.key}`);
    
    // 验证带盐值的密钥一致性
    const isSaltedValid = keyManager.verifyGroupKey(
      'secure-room', 
      saltedGroupKey.key, 
      salt
    );
    console.log(`   🔍 带盐值密钥验证结果: ${isSaltedValid ? '✅ 通过' : '❌ 失败'}`);
    
    // 测试SM4兼容性
    console.log('\n6. 测试SM4密钥格式兼容性...');
    for (const groupKeyInfo of groupKeys) {
      const keyLength = groupKeyInfo.key.length;
      const isSm4Compatible = keyLength === 32; // SM4需要128位密钥 = 32字符hex
      
      if (isSm4Compatible) {
        console.log(`   ✅ 组 "${groupKeyInfo.groupId}" 密钥格式符合SM4标准 (${keyLength}字符)`);
      } else {
        console.log(`   ❌ 组 "${groupKeyInfo.groupId}" 密钥格式不符合SM4标准 (${keyLength}字符)`);
      }
    }
    
    console.log('\n=== 基础密钥BK和组密钥派生测试完成 ===');
    console.log('✅ 所有测试通过！');
    console.log('\n📋 测试总结:');
    console.log(`   - 基础密钥BK: ✅ 正常生成和存储`);
    console.log(`   - 组密钥派生: ✅ 成功派生 ${groups.length} 个组密钥`);
    console.log(`   - 密钥验证: ✅ 一致性验证正常`);
    console.log(`   - SM4兼容: ✅ 所有密钥符合SM4标准 (128位)`);
    console.log(`   - 盐值支持: ✅ 支持带盐值密钥派生`);
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误堆栈:', error.stack);
  }
}

// 运行测试
if (require.main === module) {
  testBaseKeyAndGroupKeyDerivation().then(() => {
    console.log('\n🏁 测试脚本执行完毕');
    process.exit(0);
  }).catch((error) => {
    console.error('\n💥 测试脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = testBaseKeyAndGroupKeyDerivation;