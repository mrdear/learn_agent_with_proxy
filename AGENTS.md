# Learn Agent With Proxy

这是项目协作入口，详细说明放在 `docs/`。改代码前先按任务类型跳到对应文档。

## 快速定位

- 项目架构: [docs/architecture.md](docs/architecture.md)
- 本地运行: [docs/development.md](docs/development.md)
- API 风格扩展: [docs/strategy-design.md](docs/strategy-design.md)
- Prompt 学习方向: [docs/learning-guide.md](docs/learning-guide.md)

## 目录职责

- `backend/`: Hono 代理服务，负责转发、捕获、入库、回放和静态资源托管。
- `webui/`: React + Vite 前端，负责日志列表、详情、对比和回放入口。
- `docs/`: 项目说明、维护约定和扩展指南。
- `scripts/`: 根目录构建和启动脚本。

## 常用命令

```bash
pnpm dev:backend
pnpm dev:webui
pnpm build:webui
pnpm build
pnpm start
```

## 核心规约

项目按前后端分离维护，生产模式由后端托管前端构建产物。客户端 SDK 的 Base URL 指向 `http://localhost:3000`。

不同 API 风格的差异要收敛在策略层：

- 后端 provider 差异放在 `backend/src/lib/strategies/`，公共代理流程通过 `getRelayStrategy(provider)` 使用策略。
- 前端日志解析差异放在 `webui/src/lib/log-parsing/`，展示组件通过 `parseLog(log)` 使用归一化结果。
- `LogDetail`、`LogTable`、`ComparePage` 不直接解析 OpenAI、Anthropic 等私有字段。

新增 API 风格时，优先新增后端 strategy 和前端 adapter。字段需要展示时，先扩展归一化类型，再让对应策略填充。

详细设计看 [docs/strategy-design.md](docs/strategy-design.md)。

## 改动入口

- 改代理转发、Token 提取、流式汇总：看 [docs/strategy-design.md](docs/strategy-design.md) 的后端策略。
- 改日志展示、字段解析、工具调用展示：看 [docs/strategy-design.md](docs/strategy-design.md) 的前端 adapter。
- 改启动、环境变量、部署方式：看 [docs/development.md](docs/development.md)。
- 改数据流或模块边界：看 [docs/architecture.md](docs/architecture.md)。

## 维护守则

- 涉及 provider 差异时，优先改 strategy / adapter。
- 展示组件不要直接解析 provider 私有字段。
- 数据库字段变化要同步检查后端写入、API 返回、前端类型。
- 提交前至少跑相关构建或 lint。
