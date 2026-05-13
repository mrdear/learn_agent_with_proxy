# Learn Agent With Proxy

本项目用本地代理捕获 OpenAI、Anthropic 及兼容接口的请求和响应，写入 SQLite，并在 Web UI 中展示 Prompt、参数、Token、耗时、流式 chunk 和工具调用信息。

## 项目结构

- `backend/`: Hono 后端，负责代理转发、日志入库、回放、静态资源托管。
- `webui/`: React + Vite 前端，使用 shadcn/ui 展示日志列表、详情、对比和回放入口。
- `scripts/`: 根目录构建和启动脚本。
- `pnpm-workspace.yaml`: monorepo workspace 配置。

项目使用 `pnpm`。根目录常用命令：

```bash
pnpm dev:backend
pnpm dev:webui
pnpm build:webui
pnpm build
pnpm start
```

客户端 SDK 的 Base URL 指向 `http://localhost:3000`。

## 后端约定

后端核心职责：

- 接收 OpenAI / Anthropic 风格请求。
- 判断 provider，转发到对应上游。
- 捕获 request headers、request body、response body、流式 chunk、Token、耗时和错误。
- 向前端提供 `/api/logs` 等查询接口。
- 生产模式托管 `webui/dist`。

日志主表是 `logs`。关键字段包括：

- `provider`: `openai`、`anthropic`、`openai-responses` 等。
- `endpoint` / `method`: 原始请求路径和方法。
- `request_headers` / `request_body`: 原始请求信息，JSON 字符串。
- `response_body`: 流式响应 chunk 数组，JSON 字符串。
- `response_body_finish`: 最终响应内容，非流式时为原始响应，流式时为拼接结果或完成事件。
- `input_tokens` / `output_tokens`: Token 统计。
- `is_streaming`: 是否为流式响应。
- `error`: 捕获到的错误文本。

## 策略设计

不同 API 风格的差异要收敛在策略层，业务流程和 UI 组件不要散落 provider 分支。

后端策略位于 `backend/src/lib/strategies/`：

- `openai.ts`
- `openai-responses.ts`
- `anthropic.ts`
- `index.ts`
- `types.ts`

新增后端 provider 时，优先新增一个 strategy，实现：

- provider 标识
- 请求头和请求体准备
- SDK 或 fetch 转发
- Token 提取
- 流式响应汇总

公共代理流程只通过 `getRelayStrategy(provider)` 获取策略。

前端解析策略位于 `webui/src/lib/log-parsing/`：

- `adapters/openai-chat.ts`
- `adapters/openai-responses.ts`
- `adapters/anthropic.ts`
- `adapters/fallback.ts`
- `index.ts`
- `types.ts`

前端组件只消费 `parseLog(log)` 返回的归一化结构。新增 API 风格时，优先新增 adapter，输出统一的 messages、system prompt、tools、params、response items 和 summary。

`LogDetail`、`LogTable`、`ComparePage` 这类展示组件不要直接解析 provider 私有字段。确实需要新字段时，先加到 `ParsedLog`，再由 adapter 填充。

## 前端约定

- UI 组件使用 shadcn/ui，按需安装：`pnpm dlx shadcn@latest add <component-name>`。
- 日志展示组件保持展示职责，解析逻辑放到 `webui/src/lib/log-parsing/`。
- JSON 展示使用项目已有 `JsonViewer`。
- Markdown 文本展示使用项目已有 `MarkdownViewer`。
- 表格、详情、对比页共享同一套解析结果，避免重复写 OpenAI / Anthropic 字段判断。

## 环境变量

在 `backend/.env` 配置：

```env
PORT=3000
DATABASE_URL=./proxy.db

OPENAI_BASE_URL=https://api.openai.com
ANTHROPIC_BASE_URL=https://api.anthropic.com

# 可选，也可以由客户端请求头透传
# OPENAI_API_KEY=sk-xxx
# ANTHROPIC_API_KEY=sk-ant-xxx
```

`OPENAI_BASE_URL` 和 `ANTHROPIC_BASE_URL` 可以指向官方接口、第三方兼容代理或自建服务。

## 开发重点

查看捕获日志时，重点关注：

- System Prompt: 角色、规则、边界条件。
- Few-shot: 示例如何约束输出。
- Tool Use: tool schema、调用参数、tool result 的组织方式。
- 多轮上下文: 历史消息如何影响当前输出。
- 流式响应: chunk 与最终结果是否一致。

## 改动守则

- 涉及 provider 差异时，优先改 strategy / adapter。
- 涉及展示样式时，尽量保持解析层接口稳定。
- 涉及数据库字段时，同步检查后端写入、API 返回、前端类型。
- 提交前至少运行相关构建或 lint。
