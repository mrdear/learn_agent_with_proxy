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
http://localhost:3000
```

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

## 前端 UI

- 使用 shadcn/ui。
- 按需安装组件：`pnpm dlx shadcn@latest add <component-name>`。
- JSON 展示使用项目已有 `JsonViewer`。
- Markdown 文本展示使用项目已有 `MarkdownViewer`。
