#!/bin/bash

# Solana 名片合约测试运行脚本
# 此脚本会自动设置测试环境并运行所有测试

set -e

echo "🚀 开始 Solana 名片合约测试..."

# 检查必要的工具是否安装
echo "📋 检查环境依赖..."

if ! command -v solana &> /dev/null; then
    echo "❌ 错误: Solana CLI 未安装. 请先安装 Solana CLI"
    exit 1
fi

if ! command -v anchor &> /dev/null; then
    echo "❌ 错误: Anchor 未安装. 请先安装 Anchor"
    exit 1
fi

# 检查 solana-test-validator 是否正在运行
echo "🔍 检查测试验证器状态..."
if ! pgrep -f "solana-test-validator" > /dev/null; then
    echo "⚠️  测试验证器未运行，正在启动..."
    echo "📍 启动本地测试验证器（在后台运行）..."
    
    # 在后台启动测试验证器
    solana-test-validator --quiet --reset &
    VALIDATOR_PID=$!
    
    echo "⏳ 等待验证器启动..."
    sleep 10
    
    # 设置 solana 配置使用本地集群
    solana config set --url localhost
else
    echo "✅ 测试验证器已在运行"
fi

# 检查网络连接
echo "🌐 检查网络连接..."
if ! solana cluster-version &> /dev/null; then
    echo "❌ 错误: 无法连接到 Solana 集群"
    exit 1
fi

echo "✅ 环境检查完成"

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "📦 安装项目依赖..."
    if command -v yarn &> /dev/null; then
        yarn install
    else
        npm install
    fi
fi

# 构建程序
echo "🔨 构建 Anchor 程序..."
anchor build

# 运行测试
echo "🧪 运行测试套件..."
echo "----------------------------------------"

# 根据传入的参数运行不同的测试
case "${1:-all}" in
    "basic")
        echo "运行基本功能测试..."
        anchor test --grep "基本功能测试"
        ;;
    "security")
        echo "运行安全性测试..."
        anchor test --grep "安全性测试"
        ;;
    "boundary")
        echo "运行边界条件测试..."
        anchor test --grep "边界条件测试"
        ;;
    "error")
        echo "运行错误处理测试..."
        anchor test --grep "错误处理测试"
        ;;
    "consistency")
        echo "运行状态一致性测试..."
        anchor test --grep "状态一致性测试"
        ;;
    "all"|*)
        echo "运行所有测试..."
        anchor test
        ;;
esac

echo "----------------------------------------"

# 如果我们启动了验证器，询问是否要关闭它
if [ ! -z "$VALIDATOR_PID" ]; then
    echo ""
    echo "🤔 是否要关闭测试验证器？ (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "🛑 关闭测试验证器..."
        kill $VALIDATOR_PID
        echo "✅ 测试验证器已关闭"
    else
        echo "ℹ️  测试验证器继续在后台运行 (PID: $VALIDATOR_PID)"
        echo "ℹ️  要手动关闭，请运行: kill $VALIDATOR_PID"
    fi
fi

echo ""
echo "🎉 测试完成！"
echo ""
echo "📚 查看详细测试指南: cat TEST_GUIDE.md"
echo "🔍 查看测试日志: solana logs" 