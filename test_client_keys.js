// 测试客户端密钥生成功能的脚本
const WebSocket = require('ws');

console.log('=== 开始测试客户端密钥生成功能 ===\n');

// 创建WebSocket连接
const ws = new WebSocket('ws://localhost:3000');

let userId = null;

ws.on('open', () => {
    console.log('✅ WebSocket连接成功');
    
    // 等待欢迎消息，然后发送密钥生成请求
    setTimeout(() => {
        console.log('发送客户端密钥生成请求...');
        ws.send(JSON.stringify({
            type: 'request_client_keys',
            timestamp: new Date().toISOString()
        }));
    }, 1000);
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data);
        console.log('\n📨 收到服务器消息:', JSON.stringify(message, null, 2));
        
        if (message.type === 'welcome') {
            userId = message.userId;
            console.log(`✅ 获得用户ID: ${userId}`);
        }
        
        if (message.type === 'client_keys_generated') {
            console.log('\n🎉 客户端密钥生成成功!');
            console.log('客户端公钥长度:', message.clientKeys?.publicKey?.length);
            console.log('客户端私钥长度:', message.clientKeys?.privateKey?.length);
            console.log('服务器公钥长度:', message.serverKey?.publicKey?.length);
            console.log('生成方式:', message.summary?.exchangeMethod);
        }
        
        if (message.type === 'error') {
            console.log('\n❌ 收到错误消息:', message.message);
        }
        
    } catch (error) {
        console.error('解析消息失败:', error);
    }
});

ws.on('close', () => {
    console.log('\n🔌 WebSocket连接已关闭');
});

ws.on('error', (error) => {
    console.error('\n❌ WebSocket错误:', error);
});

// 10秒后自动关闭连接
setTimeout(() => {
    console.log('\n⏰ 测试超时，关闭连接');
    ws.close();
}, 10000);

console.log('测试脚本已启动，等待服务器响应...');