# Node.js WebSocket 服务器

一个基于 Node.js 的 WebSocket 服务器，集成了 Express 框架，支持实时双向通信功能。

## 功能特性

- 🚀 **Express HTTP 服务器** - 提供静态文件服务和 REST API
- 🔌 **WebSocket 实时通信** - 支持客户端与服务器的双向实时通信
- 📡 **消息广播** - 支持向所有连接的客户端广播消息
- ❤️ **心跳检测** - 内置 ping/pong 心跳机制
- 📊 **连接统计** - 提供连接数量和状态的实时监控
- 🛠️ **优雅关闭** - 支持平滑关闭服务器
- 📱 **Web 测试客户端** - 内置 HTML 测试界面

## 项目结构

```
smSevrer/
├── index.js          # 主服务器文件
├── index.html        # WebSocket 测试客户端
├── package.json      # 项目配置和依赖
└── README.md         # 项目说明文档
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务器

**开发模式（推荐）：**
```bash
npm run dev
```

**生产模式：**
```bash
npm start
```

服务器将在 `http://localhost:3000` 启动

### 3. 测试连接

在浏览器中打开 `http://localhost:3000` 来访问测试客户端界面

## API 文档

### HTTP 端点

#### `GET /`
- **描述**: 返回测试客户端页面
- **返回**: HTML 页面

#### `GET /health`
- **描述**: 服务器健康检查
- **返回**: 
  ```json
  {
    "status": "Server is running",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
  ```

#### `GET /connections`
- **描述**: 获取当前连接统计
- **返回**: 
  ```json
  {
    "connections": 1,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
  ```

### WebSocket 消息格式

#### 客户端发送消息格式

**1. 心跳检测 (ping)**
```json
{
  "type": "ping"
}
```

**2. 回显消息 (echo)**
```json
{
  "type": "echo",
  "message": "你的消息内容",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**3. 广播消息 (broadcast)**
```json
{
  "type": "broadcast",
  "message": "广播内容",
  "from": "发送者名称",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### 服务器返回消息格式

**1. 欢迎消息**
```json
{
  "type": "welcome",
  "message": "欢迎连接到WebSocket服务器!",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**2. 心跳回复 (pong)**
```json
{
  "type": "pong",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**3. 回显回复**
```json
{
  "type": "echo",
  "data": {...},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**4. 广播消息**
```json
{
  "type": "broadcast",
  "message": "广播内容",
  "from": "发送者名称",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**5. 错误消息**
```json
{
  "type": "error",
  "message": "错误描述",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 使用示例

### JavaScript 客户端连接示例

```javascript
// 创建 WebSocket 连接
const ws = new WebSocket('ws://localhost:3000');

// 连接成功事件
ws.onopen = function(event) {
    console.log('WebSocket 连接已建立');
    
    // 发送心跳检测
    ws.send(JSON.stringify({ type: 'ping' }));
    
    // 发送回显消息
    ws.send(JSON.stringify({
        type: 'echo',
        message: 'Hello WebSocket!',
        timestamp: new Date().toISOString()
    }));
    
    // 发送广播消息
    ws.send(JSON.stringify({
        type: 'broadcast',
        message: '大家好!',
        from: '我的应用',
        timestamp: new Date().toISOString()
    }));
};

// 接收消息事件
ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('收到消息:', data);
};

// 连接关闭事件
ws.onclose = function(event) {
    console.log('WebSocket 连接已关闭');
};

// 错误处理
ws.onerror = function(error) {
    console.error('WebSocket 错误:', error);
};
```

## 配置选项

### 环境变量

- `PORT`: 服务器端口号 (默认: 3000)

```bash
# 设置自定义端口
PORT=8080 npm start
```

### 服务器配置

在 `index.js` 中可以修改以下配置：

```javascript
// WebSocket 服务器配置
const wss = new WebSocket.Server({ 
    server: server,           // HTTP 服务器实例
    path: '/websocket',       // WebSocket 路径 (可选)
    perMessageDeflate: false  // 消息压缩 (可选)
});
```

## 开发命令

- `npm start` - 启动生产服务器
- `npm run dev` - 启动开发服务器（需要 nodemon）
- `npm install` - 安装项目依赖

## 技术栈

- **Node.js** - JavaScript 运行时环境
- **Express** - Web 应用框架
- **ws** - WebSocket 库
- **nodemon** - 开发模式自动重启工具

## 注意事项

1. **连接限制**: 默认情况下，服务器可以处理大量并发连接
2. **消息格式**: 所有 WebSocket 消息都应使用 JSON 格式
3. **错误处理**: 服务器包含完整的错误处理机制
4. **资源清理**: 服务器支持优雅关闭，自动清理资源

## 故障排除

### 连接失败
- 检查服务器是否正常运行
- 确认端口 3000 未被占用
- 验证防火墙设置

### 消息发送失败
- 确认 WebSocket 连接状态
- 检查消息格式是否为有效的 JSON
- 查看服务器控制台错误信息

### 开发模式问题
- 确保已安装 nodemon: `npm install -g nodemon`
- 或者使用本地安装的开发依赖

## 许可证

ISC

## 更新日志

### v1.0.0
- 初始版本发布
- 集成 Express 和 WebSocket 功能
- 添加测试客户端界面
- 实现消息广播和心跳检测
- 提供完整的 API 文档