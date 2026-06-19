#!/usr/bin/env bash
# 开发脚本: 同时启动后端 watch 和前端 Vite HMR。
set -e

cd "$(dirname "$0")/.."

backend_port="${PORT:-}"
if [[ -z "$backend_port" && -f backend/.env ]]; then
  backend_port="$(sed -n 's/^PORT=//p' backend/.env | tail -n 1 | tr -d "\"'")"
fi
backend_port="${backend_port:-3000}"

echo "🚀 启动后端代理热加载: http://localhost:${backend_port}"
echo "🚀 启动前端 Vite HMR: http://localhost:5173"
pnpm --filter backend --filter webui --parallel --stream dev
