# Strategy Design

不同 API 风格的差异要收敛在策略层。公共流程和展示组件只依赖统一接口。

## 后端 Strategy

后端策略位于 `backend/src/lib/strategies/`：

- `openai.ts`
- `openai-responses.ts`
- `anthropic.ts`
- `index.ts`
- `types.ts`

新增后端 provider 时，优先新增 strategy，实现：

- provider 标识
- 请求头和请求体准备
- SDK 或 fetch 转发
- Token 提取
- 流式响应汇总

公共代理流程只通过 `getRelayStrategy(provider)` 获取策略。

## 前端 Adapter

前端解析策略位于 `webui/src/lib/log-parsing/`：

- `adapters/openai-chat.ts`
- `adapters/openai-responses.ts`
- `adapters/anthropic.ts`
- `adapters/fallback.ts`
- `index.ts`
- `types.ts`

前端组件只消费 `parseLog(log)` 返回的归一化结构。新增 API 风格时，优先新增 adapter，输出统一的：

- messages
- system prompt
- tools
- params
- response items
- summary

`LogDetail`、`LogTable`、`ComparePage` 这类展示组件不要直接解析 provider 私有字段。需要新展示字段时，先加到 `ParsedLog`，再由 adapter 填充。

## 扩展示例

新增一种 provider 时，通常修改：

```txt
backend/src/lib/strategies/<provider>.ts
backend/src/lib/strategies/index.ts
webui/src/lib/log-parsing/adapters/<provider>.ts
webui/src/lib/log-parsing/index.ts
webui/src/lib/log-parsing/types.ts
```

如果只是已有 provider 的新响应形态，优先改前端 adapter 或后端 strategy 中对应的解析函数。
