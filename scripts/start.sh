#!/usr/bin/env bash
# 启动脚本: scripts/start.sh
set -e

# 确保在根目录执行
cd "$(dirname "$0")/.."

# 执行构建
./scripts/build.sh

echo "🚀 正在启动后端服务..."
pnpm --filter backend start
