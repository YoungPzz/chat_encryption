const { split, combine } = require('shamir-secret-sharing');
const sm3 = require('sm-crypto').sm3;

/**
 * Shamir密钥分片管理器
 * 用于将SM4密钥通过Shamir算法进行分片和恢复
 */
class ShamirKeySharingManager {
  /**
   * 将SM4密钥分片
   * @param {Buffer} sm4Key - 16字节的SM4密钥
   * @param {number} shares - 分片数量
   * @param {number} threshold - 恢复阈值
   * @returns {Array<{index: number, share: Buffer}>} 分片数组
   */
  static async splitKey(sm4Key, shares = 5, threshold = 3) {
    try {
      // 验证输入参数
      if (!Buffer.isBuffer(sm4Key) || sm4Key.length !== 16) {
        throw new Error('SM4密钥必须是16字节的Buffer');
      }
      
      if (shares < threshold) {
        throw new Error('分片数量必须大于等于阈值');
      }
      
      // 确保密钥是Uint8Array类型
      const keyUint8Array = new Uint8Array(sm4Key);
      
      // 使用Uint8Array进行分片 - split返回Promise，需要await
      const sharesArray = await split(keyUint8Array, shares, threshold);
      
      // 检查返回结果是否为数组
      if (!Array.isArray(sharesArray)) {
        console.error('分片结果不是数组:', sharesArray);
        throw new Error('分片结果格式错误');
      }
      
      // 将分片转换为更易管理的格式
      const formattedShares = sharesArray.map((share, index) => ({
        index: index + 1, // 索引从1开始
        share: Buffer.isBuffer(share) ? share : Buffer.from(share)
      }));
      
      console.log(`✅ 成功将SM4密钥分为${shares}个分片，阈值为${threshold}`);
      return formattedShares;
      
    } catch (error) {
      console.error('Shamir密钥分片失败:', error);
      throw error;
    }
  }
  
  /**
   * 从分片中恢复SM4密钥
   * @param {Array<{index: number, share: Buffer}>} shares - 分片数组
   * @returns {Buffer} 恢复的SM4密钥
   */
  static recoverKey(shares) {
    try {
      if (!Array.isArray(shares) || shares.length === 0) {
        throw new Error('分片数组不能为空');
      }
      
      // 验证每个分片的格式
      shares.forEach(share => {
        if (!share || typeof share.index !== 'number' || !Buffer.isBuffer(share.share)) {
          throw new Error('无效的分片格式');
        }
      });
      
      // 提取原始的分片数组格式
      const originalSharesFormat = shares.map(share => share.share);
      
      // 恢复密钥
      const recoveredKey = combine(originalSharesFormat);
      
      // 验证恢复的密钥是否为16字节
      if (recoveredKey.length !== 16) {
        throw new Error('恢复的密钥不是有效的SM4密钥（16字节）');
      }
      
      console.log(`✅ 成功从${shares.length}个分片恢复SM4密钥`);
      return recoveredKey;
      
    } catch (error) {
      console.error('Shamir密钥恢复失败:', error);
      throw error;
    }
  }
  
  /**
   * 将分片对象序列化为字符串
   * @param {Array<{index: number, share: Buffer}>} shares - 分片数组
   * @returns {Array<{index: number, share: string}>} 序列化后的分片数组
   */
  static serializeShares(shares) {
    // 输出详细的分片信息
    console.log(`\n🔍 分片详细数值信息:`);
    console.log(`   总分片数: ${shares.length}`);
    console.log(`   分片详情:`);
    
    // 序列化分片
    const serialized = shares.map(share => {
      const hexValue = share.share.toString('hex');
      const base64Value = share.share.toString('base64');
      
      console.log(`     分片 ${share.index}:`);
      console.log(`       索引: ${share.index}`);
      console.log(`       十六进制: ${hexValue}`);
      console.log(`       Base64: ${base64Value}`);
      // console.log(`       长度: ${share.share.length} 字节`);
      
      // 对Base64数据进行SM3哈希
      const sm3Hash = sm3(base64Value);
      console.log(`       SM3哈希: ${sm3Hash.substring(0, 20)}...`);
      
      return {
        index: share.index,
        share: base64Value,
        sm3Hash: sm3Hash
      };
    });
    
    // console.log(`📋 序列化后的分片数据:`, serialized);
    return serialized;
  }
  
  /**
   * 从字符串反序列化分片对象
   * @param {Array<{index: number, share: string, sm3Hash: string}>} serializedShares - 序列化的分片数组
   * @returns {Array<{index: number, share: Buffer, sm3Hash: string}>} 反序列化后的分片数组
   */
  static deserializeShares(serializedShares) {
    console.log(`\n🔍 反序列化分片信息:`);
    console.log(`   总分片数: ${serializedShares.length}`);
    
    return serializedShares.map(share => {
      const shareBuffer = Buffer.from(share.share, 'base64');
      
      // 验证SM3哈希
      if (share.sm3Hash) {
        const computedHash = sm3(share.share);
        const hashValid = computedHash === share.sm3Hash;
        
        console.log(`     分片 ${share.index}:`);
        console.log(`       索引: ${share.index}`);
        console.log(`       Base64长度: ${share.share.length}`);
        console.log(`       Buffer长度: ${shareBuffer.length} 字节`);
        console.log(`       SM3哈希验证: ${hashValid ? '✅ 通过' : '❌ 失败'}`);
        console.log(`       存储的哈希: ${share.sm3Hash.substring(0, 20)}...`);
        console.log(`       计算的哈希: ${computedHash.substring(0, 20)}...`);
        
        if (!hashValid) {
          console.error(`❌ 分片 ${share.index} 的SM3哈希验证失败，数据可能被篡改！`);
        }
      } else {
        console.log(`     分片 ${share.index}: 无SM3哈希验证`);
      }
      
      return {
        index: share.index,
        share: shareBuffer,
        sm3Hash: share.sm3Hash
      };
    });
  }
  
  /**
   * 验证分片数量是否满足恢复条件
   * @param {number} shareCount - 可用分片数量
   * @param {number} threshold - 恢复阈值
   * @returns {boolean} 是否满足恢复条件
   */
  static validateShareCount(shareCount, threshold) {
    return shareCount >= threshold;
  }
}

module.exports = ShamirKeySharingManager;