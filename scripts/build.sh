#!/usr/bin/env bash
# 构建脚本: scripts/build.sh
set -e

# 确保在根目录执行
cd "$(dirname "$0")/.."

echo "🏗️  开始全量构建..."

echo "📦 [1/2] 构建前端 (webui)..."
pnpm --filter webui build

echo "📦 [2/2] 构建后端 (backend)..."
pnpm --filter backend build

echo "✅ 构建完成！"
