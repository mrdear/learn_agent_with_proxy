# Development

项目使用 `pnpm` 和 monorepo workspace。

## 常用命令

```bash
pnpm dev:backend
pnpm dev:webui
pnpm build:webui
pnpm build
pnpm start
```

开发模式下，后端和前端分开启动。生产模式下，`pnpm start` 会构建前端、编译后端，并由后端托管前端静态资源。

## 客户端配置

客户端 SDK 的 Base URL 指向：

```txt
http://localhost:3000/v1
```

## 环境变量

后端启动时会读取 `backend/.env`，同名变量以这个文件为准：

```env
PORT=3000
DATABASE_URL=./proxy.db
PROXY_CONFIG_SECRET=use-a-long-random-local-secret
```

Provider 的 endpoint、API key、默认模型和模型映射在 Web UI 的 Settings 页面维护，写入 SQLite。API key 会以 AES-256-GCM 密文保存；加密主密钥来自 `PROXY_CONFIG_SECRET`，如果没有设置，后端会生成 `backend/.proxy-secret`。

首次启动时，如果旧的 `OPENAI_BASE_URL`、`ANTHROPIC_BASE_URL`、`OPENAI_API_KEY`、`ANTHROPIC_API_KEY` 还存在，会只用来初始化空库里的默认 provider 配置。已有 DB 配置优先级更高。

每条代理日志会记录 `upstream_url`，用于核对实际转发地址和当前 provider 配置是否一致。

## 前端 UI

- 使用 shadcn/ui。
- 按需安装组件：`pnpm dlx shadcn@latest add <component-name>`。
- JSON 展示使用项目已有 `JsonViewer`。
- Markdown 文本展示使用项目已有 `MarkdownViewer`。
