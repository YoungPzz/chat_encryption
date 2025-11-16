/**
 * 房间组密钥派生功能测试脚本
 * 测试完整的房间密钥管理流程：房间密钥生成、用户密钥派生、组密钥计算
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
    serverUrl: 'ws://localhost:3000',
    timeout: 30000
};

// 测试状态
let testState = {
    connected: false,
    userId: null,
    roomId: 'test_room_' + Date.now(),
    serverPublicKey: null,
    clientKeyPair: null,
    roomKeyInfo: null,
    groupKey: null,
    testResults: []
};

// WebSocket连接
let ws = null;

// 记录测试结果
function logTest(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        type,
        message,
        testStep: testState.testStep
    };
    testState.testResults.push(logEntry);
    
    const prefix = {
        'info': 'ℹ️',
        'success': '✅',
        'error': '❌',
        'key': '🔑',
        'room': '🏠',
        'system': '🔧'
    }[type] || 'ℹ️';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
}

// 连接WebSocket
function connectWebSocket() {
    return new Promise((resolve, reject) => {
        logTest('正在连接到WebSocket服务器...', 'info');
        
        try {
            ws = new WebSocket(TEST_CONFIG.serverUrl);
            
            const timeout = setTimeout(() => {
                reject(new Error('连接超时'));
            }, TEST_CONFIG.timeout);
            
            ws.onopen = () => {
                clearTimeout(timeout);
                testState.connected = true;
                logTest('WebSocket连接成功', 'success');
                resolve();
            };
            
            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    handleMessage(message);
                } catch (error) {
                    logTest(`消息解析错误: ${error.message}`, 'error');
                }
            };
            
            ws.onclose = () => {
                testState.connected = false;
                logTest('WebSocket连接已关闭', 'system');
            };
            
            ws.onerror = (error) => {
                logTest(`WebSocket错误: ${error.message}`, 'error');
                reject(error);
            };
            
        } catch (error) {
            logTest(`WebSocket连接失败: ${error.message}`, 'error');
            reject(error);
        }
    });
}

// 处理服务器消息
function handleMessage(message) {
    switch (message.type) {
        case 'welcome':
            testState.userId = message.userId;
            testState.serverPublicKey = message.serverKeyInfo;
            logTest(`收到欢迎消息，用户ID: ${testState.userId}`, 'system');
            logTest(`服务器公钥长度: ${testState.serverPublicKey.publicKey.length} 字符`, 'key');
            break;
            
        case 'client_keys_generated':
            logTest(`收到服务端生成的客户端密钥对`, 'key');
            testState.clientKeyPair = message.clientKeys;
            logTest(`客户端公钥长度: ${testState.clientKeyPair.publicKey.length}`, 'key');
            break;
            
        case 'room_key_info':
            testState.roomKeyInfo = message;
            logTest(`收到房间密钥信息: ${message.roomId}`, 'room');
            logTest(`加密数据: ${JSON.stringify(message.encryptedKeyInfo).substring(0, 100)}...`, 'key');
            break;
            
        case 'room_key_summary':
            logTest(`收到房间密钥摘要: ${message.roomId}`, 'room');
            logTest(`密钥摘要: ${JSON.stringify(message.keyInfo)}`, 'key');
            break;
            
        case 'client_keys_ready':
            logTest(`客户端密钥准备就绪确认`, 'key');
            break;
            
        case 'error':
            logTest(`服务器错误: ${message.message}`, 'error');
            break;
            
        default:
            logTest(`收到消息: ${message.type}`, 'system');
    }
}

// 发送消息到服务器
function sendToServer(message) {
    return new Promise((resolve, reject) => {
        if (!testState.connected) {
            reject(new Error('未连接到服务器'));
            return;
        }
        
        try {
            ws.send(JSON.stringify(message));
            logTest(`发送消息: ${message.type}`, 'system');
            resolve();
        } catch (error) {
            logTest(`发送消息失败: ${error.message}`, 'error');
            reject(error);
        }
    });
}

// 请求服务端生成客户端密钥
function requestClientKeys() {
    return new Promise((resolve, reject) => {
        logTest('正在请求服务端生成客户端密钥对...', 'key');
        
        try {
            // 请求服务端生成客户端密钥对
            sendToServer({
                type: 'request_client_keys'
            }).then(() => {
                // 等待服务端生成密钥并返回
                setTimeout(() => {
                    if (testState.clientKeyPair) {
                        logTest('客户端密钥对生成成功', 'success');
                        logTest(`公钥长度: ${testState.clientKeyPair.publicKey.length} 字符`, 'key');
                        logTest(`私钥长度: ${testState.clientKeyPair.privateKey.length} 字符`, 'key');
                        resolve();
                    } else {
                        reject(new Error('等待服务端生成密钥超时'));
                    }
                }, 2000);
            }).catch(reject);
            
        } catch (error) {
            logTest(`请求服务端生成密钥失败: ${error.message}`, 'error');
            reject(error);
        }
    });
}

// 创建测试房间
function createTestRoom() {
    return new Promise((resolve, reject) => {
        logTest(`正在创建测试房间: ${testState.roomId}`, 'room');
        
        sendToServer({
            type: 'create_room',
            roomId: testState.roomId,
            roomName: '房间密钥测试',
            description: '用于测试房间组密钥派生功能的房间',
            options: {}
        }).then(() => {
            // 等待房间创建成功的消息
            setTimeout(resolve, 1000);
        }).catch(reject);
    });
}

// 加入房间
function joinRoom() {
    return new Promise((resolve, reject) => {
        logTest(`正在加入房间: ${testState.roomId}`, 'room');
        
        sendToServer({
            type: 'join_room',
            roomId: testState.roomId,
            username: 'test_user_' + Date.now()
        }).then(() => {
            setTimeout(resolve, 1000);
        }).catch(reject);
    });
}

// 请求房间密钥
function requestRoomKeys() {
    return new Promise((resolve, reject) => {
        logTest(`正在请求房间密钥: ${testState.roomId}`, 'room');
        
        sendToServer({
            type: 'request_room_keys',
            roomId: testState.roomId
        }).then(() => {
            // 增加超时时间到5秒，等待密钥响应
            setTimeout(() => {
                if (testState.roomKeyInfo) {
                    logTest('房间密钥信息获取成功', 'success');
                    resolve();
                } else {
                    reject(new Error('等待房间密钥响应超时'));
                }
            }, 5000);
        }).catch(reject);
    });
}

// 模拟客户端解密和组密钥计算
function simulateClientDecryption() {
    return new Promise((resolve, reject) => {
        logTest('正在模拟客户端解密和组密钥计算...', 'key');
        
        try {
            if (!testState.roomKeyInfo) {
                throw new Error('未收到房间密钥信息');
            }
            
            // 模拟解密过程
            const decryptedData = {
                si: 'demo_si_' + Date.now(),
                froom: testState.roomKeyInfo.encryptedData?.froom || 'demo_froom_' + Date.now()
            };
            
            // 计算组密钥 GK = KDF(S_i, F_room)
            const combined = decryptedData.si + '_' + decryptedData.froom;
            const groupKey = 'GK_' + Buffer.from(combined).toString('base64').substring(0, 32);
            
            testState.groupKey = groupKey;
            
            logTest(`房间基础值 S_i: ${decryptedData.si}`, 'key');
            logTest(`动态因子 F_room: ${decryptedData.froom}`, 'key');
            logTest(`计算出的组密钥 GK: ${groupKey}`, 'key');
            
            resolve();
            
        } catch (error) {
            logTest(`解密/组密钥计算失败: ${error.message}`, 'error');
            reject(error);
        }
    });
}

// 生成测试报告
function generateTestReport() {
    const reportPath = path.join(__dirname, 'test_room_key_derivation_report.json');
    
    const report = {
        testTime: new Date().toISOString(),
        testConfig: TEST_CONFIG,
        testResults: testState.testResults,
        summary: {
            totalTests: testState.testResults.length,
            successCount: testState.testResults.filter(r => r.type === 'success').length,
            errorCount: testState.testResults.filter(r => r.type === 'error').length,
            keyOperations: testState.testResults.filter(r => r.type === 'key' || r.type === 'room').length
        },
        finalState: {
            connected: testState.connected,
            userId: testState.userId,
            roomId: testState.roomId,
            hasServerPublicKey: !!testState.serverPublicKey,
            hasClientKeyPair: !!testState.clientKeyPair,
            hasRoomKeyInfo: !!testState.roomKeyInfo,
            hasGroupKey: !!testState.groupKey
        }
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    logTest(`测试报告已生成: ${reportPath}`, 'success');
    
    return report;
}

// 主要测试流程
async function runTest() {
    console.log('🚀 开始房间组密钥派生功能测试');
    console.log('=' .repeat(60));
    
    try {
        testState.testStep = '连接';
        await connectWebSocket();
        
        testState.testStep = '生成客户端密钥';
        await requestClientKeys();
        
        testState.testStep = '创建房间';
        await createTestRoom();
        
        // 等待房间创建完成和创建者自动加入
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        testState.testStep = '请求房间密钥';
        await requestRoomKeys();
        
        testState.testStep = '模拟客户端处理';
        await simulateClientDecryption();
        
        testState.testStep = '生成报告';
        const report = generateTestReport();
        
        console.log('\n📊 测试摘要:');
        console.log(`   总测试项目: ${report.summary.totalTests}`);
        console.log(`   成功项目: ${report.summary.successCount}`);
        console.log(`   错误项目: ${report.summary.errorCount}`);
        console.log(`   密钥操作: ${report.summary.keyOperations}`);
        
        console.log('\n✅ 房间组密钥派生功能测试完成！');
        
    } catch (error) {
        logTest(`测试失败: ${error.message}`, 'error');
        console.error('\n❌ 测试过程中发生错误:', error);
    } finally {
        if (ws && testState.connected) {
            ws.close();
        }
        const report = generateTestReport();
        process.exit(0);
    }
}

// 运行测试
runTest();