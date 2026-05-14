# Learn Agent With Proxy

![Learn Agent With Proxy hero](docs/assets/readme-hero.png)

一个本地 AI API 代理和观测台，用来捕获、回放、比较 OpenAI、Anthropic 及兼容接口的请求响应。把客户端 SDK 的 Base URL 指向本地代理，就能看到 prompt、messages、tools、params、token、耗时、流式 chunk 和最终响应。

## 适合做什么

- 观察成熟 Agent 的请求结构和上下文组织方式
- 对比不同 prompt、模型、provider 的响应差异
- 调试 tool schema、tool call、tool result 的真实数据形态
- 捕获 SSE 流式响应，并核对 chunk 与最终汇总
- 回放已有日志，快速验证参数或 prompt 调整

## 功能

- **多接口代理**: 支持 OpenAI Chat Completions、OpenAI Responses、Anthropic Messages 风格请求。
- **请求日志**: 记录 endpoint、method、headers、body、model、provider 和 upstream URL。
- **响应捕获**: 保存普通响应、流式 chunk、最终响应、token 统计、耗时和错误。
- **统一解析**: 前端通过 adapter 输出归一化视图，展示组件不直接读取 provider 私有字段。
- **日志详情**: 查看 system prompt、messages、tools、params、response 和 raw JSON。
- **对比视图**: 并排比较两条日志的请求、响应和关键指标。
- **回放与 relay**: 基于已有日志重新请求，也可以编辑 endpoint、method 或 body 后再发出。

## 快速开始

安装依赖：

```bash
pnpm install
```

启动后端代理：

```bash
pnpm dev:backend
```

启动前端：

```bash
pnpm dev:webui
```

客户端 SDK 的 Base URL 指向：

```txt
http://localhost:3000/v1
```

生产模式：

```bash
pnpm build
pnpm start
```

## 环境变量

后端读取 `backend/.env`：

```env
PORT=3000
DATABASE_URL=./proxy.db

OPENAI_BASE_URL=https://api.openai.com
ANTHROPIC_BASE_URL=https://api.anthropic.com

# 可选，也可以由客户端请求头透传
# OPENAI_API_KEY=sk-xxx
# ANTHROPIC_API_KEY=sk-ant-xxx
```

`OPENAI_BASE_URL` 和 `ANTHROPIC_BASE_URL` 可以指向官方接口、第三方兼容代理或自建服务。每条日志都会记录 `upstream_url`，方便核对实际转发地址。

## 客户端示例

OpenAI SDK：

```ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: process.env.OPENAI_API_KEY,
});

const completion = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
});
```

Anthropic SDK：

```ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  baseURL: "http://localhost:3000/v1",
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const message = await client.messages.create({
  model: "claude-3-5-sonnet-latest",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello" }],
});
```

## 项目结构

```txt
backend/   Hono 代理服务，负责转发、捕获、入库、回放和静态资源托管
webui/     React + Vite 前端，负责日志列表、详情、对比和回放入口
docs/      架构、开发、策略扩展和学习指南
scripts/   根目录构建和启动脚本
```

## 扩展接口风格

provider 差异收敛在策略层：

- 后端转发、header/body 准备、token 提取、流式汇总放在 `backend/src/lib/strategies/`
- 前端日志解析放在 `webui/src/lib/log-parsing/`
- 展示组件消费 `parseLog(log)` 的归一化结果

新增 API 风格时，优先新增后端 strategy 和前端 adapter。字段要展示时，先扩展归一化类型，再让对应策略填充。

## 文档

- [架构说明](docs/architecture.md)
- [本地运行](docs/development.md)
- [策略扩展](docs/strategy-design.md)
- [学习指南](docs/learning-guide.md)
