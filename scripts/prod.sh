#!/usr/bin/env bash
# 生产脚本: 构建前后端后，由后端托管 webui/dist。
set -e

cd "$(dirname "$0")/.."

./scripts/build.sh

echo "🚀 启动生产后端服务..."
pnpm --filter backend start
