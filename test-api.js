const sm3 = require('sm-crypto').sm3;
const sm4 = require('sm-crypto').sm4;

console.log('sm3 type:', typeof sm3);
console.log('sm4 type:', typeof sm4);

// 测试 SM3 API
console.log('\n=== SM3 API Test ===');
try {
  const hash1 = sm3('test message');
  console.log('sm3(message):', hash1.substring(0, 20) + '...');
  
  const hmac1 = sm3('test message', { mode: 'hmac', key: '0123456789abcdef0123456789abcdef' });
  console.log('sm3(message, {mode: hmac}):', hmac1.substring(0, 20) + '...');
} catch (e) {
  console.log('SM3 Error:', e.message);
}

// 测试 SM4 API
console.log('\n=== SM4 API Test ===');
try {
  const key = '0123456789abcdef0123456789abcdef';
  const iv = '00000000000000000000000000000000';
  
  const encrypted = sm4.encrypt('Hello World', key);
  console.log('sm4.encrypt result:', encrypted.substring(0, 20) + '...');
  
  const decrypted = sm4.decrypt(encrypted, key);
  console.log('sm4.decrypt result:', decrypted);
} catch (e) {
  console.log('SM4 Error:', e.message);
}