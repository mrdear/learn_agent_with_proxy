# Learn Agent With Proxy (Agent 学习代理)

本项目旨在通过本地代理服务，拦截并保存 OpenAI 和 Anthropic 的请求与响应，将其存入 SQLite 数据库。通过观察和分析这些成熟 Agent 的 Prompt 设计，帮助开发者学习如何构建高效性 AI Agent。

## 核心架构

系统采用前后端分离架构，但最终前端会被打包并由后端统一托管：

- **后端 (Hono)**:
    - 充当反向代理服务器。
    - 拦截 `/v1/chat/completions` (OpenAI) 和 `/v1/messages` (Anthropic) 等请求。
    - 将请求体（提示词、参数）和响应体存入 SQLite。
    - 转发请求到目标服务器并返回结果给原始客户端。
    - 提供 API 给前端展示数据。
    - 托管前端静态资源。
- **前端 (React/Vite + shadcn/ui)**:
    - 使用 **shadcn/ui** 作为 UI 组件库（基于 BASE UI + Tailwind CSS）。
    - 界面化展示捕获的请求列表。
    - 详细展示 Prompt 内容、模型参数、消耗 Token 等。
    - 支持按时间、模型、平台等维度进行过滤。
    - 组件按需安装：`pnpm dlx shadcn@latest add <component-name>`
- **数据库 (SQLite)**:
    - 存储请求流水，包括原始 Prompt、系统提示词、多轮对话内容等。

## 详细设计

### 1. 数据库模型 (SQLite)

主要包含一张 `logs` 表：

```sql
CREATE TABLE logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 请求信息
    provider TEXT NOT NULL,           -- 服务提供商: openai / anthropic
    endpoint TEXT NOT NULL,           -- 请求端点路径
    method TEXT NOT NULL,             -- HTTP 方法: POST / GET 等
    request_headers TEXT,             -- 请求头 (JSON 格式)
    request_body TEXT,                -- 原始请求体 (JSON 格式，包含 Prompt)
    
    -- 响应信息
    response_status INTEGER,          -- HTTP 响应状态码
    response_body TEXT,               -- 流式响应时存储每个 chunk (JSON 数组)
    response_body_finish TEXT,        -- 最终完整响应内容 (流式拼接后或非流式原始响应)
    
    -- Token 统计
    input_tokens INTEGER,             -- 输入 Token 数
    output_tokens INTEGER,            -- 输出 Token 数
    
    -- 时间信息
    request_time TEXT NOT NULL,       -- 请求发起时间 (ISO 8601)
    response_time TEXT,               -- 响应完成时间 (ISO 8601)
    duration_ms INTEGER,              -- 请求耗时 (毫秒)
    
    -- 附加信息
    model TEXT,                       -- 使用的模型名称
    is_streaming INTEGER DEFAULT 0,   -- 是否为流式请求 (0: 否, 1: 是)
    error TEXT,                       -- 错误信息 (如有)
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**字段说明：**

| 分类 | 字段 | 说明 |
| :--- | :--- | :--- |
| 请求 | `provider` | 服务提供商标识 (`openai` / `anthropic`) |
| 请求 | `endpoint` | 完整请求路径，如 `/v1/chat/completions` |
| 请求 | `method` | HTTP 方法 |
| 请求 | `request_headers` | 请求头 JSON (可用于分析 API Key 来源等) |
| 请求 | `request_body` | 原始请求体，包含完整的 messages 数组和参数 |
| 响应 | `response_status` | HTTP 状态码 |
| 响应 | `response_body` | **流式响应专用**：存储所有 SSE chunk 的 JSON 数组，便于回放分析 |
| 响应 | `response_body_finish` | 最终完整响应：流式时为拼接后的完整内容，非流式时为原始响应 |
| 统计 | `input_tokens` / `output_tokens` | Token 消耗统计 |
| 时间 | `request_time` / `response_time` | 请求/响应时间戳 |
| 时间 | `duration_ms` | 总耗时，用于性能分析 |
| 附加 | `is_streaming` | 标记是否为流式请求，便于前端区分展示 |
| 附加 | `error` | 捕获的错误信息 |

### 2. 后端代理逻辑

后端基于 Hono 实现，主要流程如下：

1. **路由匹配**: 匹配所有指向 API 的请求。
2. **中间件拦截**:
    - 解析请求体。
    - 提取 API Key（如果需要记录或透传）。
    - 将信息异步写入 SQLite。
3. **请求转发**:
    - 使用 `fetch` 或专用库将请求发送至 `api.openai.com` 或 `api.anthropic.com`。
4. **响应处理**:
    - 接收流式 (Stream) 或普通响应。
    - 如果是流式，需要特殊处理以捕获完整内容（例如：通过中间件克隆流或读取流后再转发）。
    - 返回给客户端。

### 3. 静态资源托管

前端构建后的 `dist` 目录将被后端通过 `hono/serve-static` 进行托管：

- `GET /` -> 返回 `index.html`
- `GET /assets/*` -> 返回前端静态资源
- `GET /api/logs` -> 获取本地存储的拦截记录

## 使用说明

### 包管理器

本项目使用 **pnpm** 作为包管理器，采用 monorepo 结构管理前后端。

### 环境变量

在 `backend` 目录下创建 `.env` 文件：

```env
PORT=3000
DATABASE_URL=./proxy.db

# 目标 AI 接口配置（可自定义，不限于官方接口）
OPENAI_BASE_URL=https://api.openai.com
ANTHROPIC_BASE_URL=https://api.anthropic.com

# 如果需要自动填入 Key，可以在此配置，或者由客户端请求头带入
# OPENAI_API_KEY=sk-xxx
# ANTHROPIC_API_KEY=sk-ant-xxx
```

**目标接口说明**：
- `OPENAI_BASE_URL`: OpenAI 兼容接口的基础 URL，可配置为第三方代理或自建服务
- `ANTHROPIC_BASE_URL`: Anthropic 兼容接口的基础 URL，可配置为第三方代理或自建服务

### 启动步骤 (推荐)

项目根目录已配置好集成脚本，可直接通过 `pnpm` 运行。

1. **一键构建并启动 (生产模式)**:
   ```bash
   pnpm start
   ```
   该命令会自动：构建前端 (webui) -> 编译后端 (backend) -> 启动后端服务并托管前端。

2. **仅构建前端**:
   ```bash
   pnpm build:webui
   ```

3. **开发模式 (前后端分离启动)**:
   - 启动后端 API: `pnpm dev:backend`
   - 启动前端 Vite: `pnpm dev:webui`

4. **客户端配置**:
   将你的 AI SDK Base URL 指向 `http://localhost:3000`。

## 学习重点

通过查看捕获的日志，重点分析：
- **System Prompt**: 观察不同复杂任务下，Agent 是如何定义角色和规则的。
- **Few-Shot**: 学习如何通过示例引导模型。
- **Chain of Thought**: 分析 Agent 如何引导模型进行推理。
- **Tool Use**: 观察 Function Calling 的提示词结构和参数定义。
