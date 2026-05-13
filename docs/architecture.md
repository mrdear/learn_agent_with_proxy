# Architecture

本项目用本地代理捕获 OpenAI、Anthropic 及兼容接口的请求和响应，写入 SQLite，并在 Web UI 中展示 Prompt、参数、Token、耗时、流式 chunk 和工具调用信息。

## 数据流

1. 客户端 SDK 将 Base URL 指向本地代理。
2. 后端识别 provider 和 endpoint，记录请求信息。
3. 后端把请求转发到对应上游。
4. 后端捕获普通响应或流式 chunk，写入 SQLite。
5. 前端通过 `/api/logs` 查询日志并展示。
6. 生产模式下，后端托管 `webui/dist`。

## 后端职责

- 接收 OpenAI / Anthropic 风格请求。
- 判断 provider，转发到对应上游。
- 捕获 request headers、request body、response body、流式 chunk、Token、耗时和错误。
- 向前端提供日志查询、详情、回放等 API。
- 托管前端静态资源。

## 前端职责

- 展示日志列表、详情、对比页。
- 展示 system prompt、messages、tools、params、response、raw JSON。
- 支持回放和 relay 编辑。
- 将 provider 私有响应解析交给 `webui/src/lib/log-parsing/`。

## 日志字段

日志主表是 `logs`。维护时重点关注：

- `provider`: `openai`、`anthropic`、`openai-responses` 等。
- `endpoint` / `method`: 原始请求路径和方法。
- `request_headers` / `request_body`: 原始请求信息，JSON 字符串。
- `response_body`: 流式响应 chunk 数组，JSON 字符串。
- `response_body_finish`: 最终响应内容。
- `input_tokens` / `output_tokens`: Token 统计。
- `is_streaming`: 是否为流式响应。
- `error`: 捕获到的错误文本。
