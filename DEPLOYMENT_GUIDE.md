# Solana 程序部署指南

这个智能部署脚本可以自动检测环境并处理不同网络的部署需求。

## 🚀 快速开始

### 1. 安装依赖

```bash
yarn install
# 或者
npm install
```

### 2. 基本部署

```bash
# 使用当前 solana-cli 配置的环境部署
yarn deploy

# 或者直接运行脚本
npx ts-node migrations/deploy.ts
```

## 🌐 环境特定部署

### 本地环境 (Localnet)
```bash
# 设置本地环境并部署
solana config set --url localhost
yarn deploy

# 或者使用环境变量
yarn deploy:local
```

**本地环境特性:**
- ✅ 自动启动 `solana-test-validator`
- ✅ 自动等待网络就绪  
- ✅ 支持验证器进程管理
- ✅ 自动空投测试 SOL

### 开发网络 (Devnet)
```bash
# 设置开发网络并部署
solana config set --url https://api.devnet.solana.com
yarn deploy

# 或者使用环境变量
yarn deploy:devnet
```

### 测试网络 (Testnet)
```bash
# 设置测试网络并部署
solana config set --url https://api.testnet.solana.com
yarn deploy

# 或者使用环境变量  
yarn deploy:testnet
```

### 主网 (Mainnet)
```bash
# ⚠️ 主网部署需要真实的 SOL
solana config set --url https://api.mainnet-beta.solana.com
yarn deploy

# 或者使用环境变量
yarn deploy:mainnet
```

## 🛠 高级选项

### 自动清理模式
```bash
# 部署完成后自动停止本地验证器
yarn deploy:auto-cleanup
```

### 环境变量配置
```bash
# 自动清理（适用于 CI/CD）
AUTO_CLEANUP=true yarn deploy

# 强制使用特定环境
SOLANA_ENV=devnet yarn deploy
```

## 📋 部署流程

脚本会自动执行以下步骤：

1. **🔍 环境检测**
   - 读取 `solana config get` 获取当前 RPC 配置
   - 识别集群类型 (localnet/devnet/testnet/mainnet)

2. **🚀 验证器管理** (仅本地环境)
   - 检查 `solana-test-validator` 是否运行
   - 如未运行则自动启动
   - 等待网络连接就绪

3. **🔨 程序构建**
   - 执行 `anchor build`
   - 编译 Rust 程序为 `.so` 文件

4. **📤 程序部署**
   - 执行 `anchor deploy`
   - 上传程序到区块链
   - 解析并显示程序 ID

5. **✅ 部署验证**
   - 验证程序账户状态
   - 确认程序正确部署

## 🎯 输出示例

### 成功部署
```
🚀 开始 Solana 程序部署流程
==================================================
➤ 检测 Solana CLI 当前配置...
ℹ 当前集群: localnet (http://localhost:8899)
ℹ 检测到本地环境，准备启动测试验证器...
➤ 启动本地 Solana 测试验证器...
✓ 验证器启动完成
➤ 等待网络连接就绪...
✓ 网络连接正常
➤ 构建 Anchor 程序...
✓ 程序构建完成
➤ 部署程序到区块链...
✓ 程序部署成功! Program ID: CRMKu2kLLiGM18cCtWVgyTzYXyLgdrKxAto1B2CVWNqZ
➤ 验证程序部署状态...
✓ 程序验证通过：可执行程序已正确部署
==================================================
✓ 🎉 部署成功完成! 耗时: 15.23s

程序信息:
  集群: localnet
  Program ID: CRMKu2kLLiGM18cCtWVgyTzYXyLgdrKxAto1B2CVWNqZ
  RPC URL: http://localhost:8899
```

### 部署失败示例
```
==================================================
✗ 💥 部署失败! 耗时: 5.67s
✗ 错误信息: insufficient funds for transaction

故障排除建议:
1. 检查网络连接和 RPC 配置
2. 确保钱包有足够的 SOL 余额
3. 验证 Anchor 和 Solana CLI 版本兼容性
4. 查看详细日志获取更多信息
```

## 🔧 故障排除

### 常见问题

#### 1. 余额不足
```
✗ 部署失败：账户余额不足，请先获取一些 SOL
ℹ 对于本地环境，可以使用: solana airdrop 10
```

**解决方案:**
```bash
# 本地环境
solana airdrop 10

# 开发网络
solana airdrop 2 --url devnet

# 测试网络  
solana airdrop 1 --url testnet
```

#### 2. 连接被拒绝
```
✗ 部署失败：无法连接到 Solana 网络
ℹ 请确保 solana-test-validator 正在运行
```

**解决方案:**
```bash
# 手动启动验证器
solana-test-validator --reset

# 检查验证器状态
solana cluster-version
```

#### 3. 程序构建失败
```bash
# 清理并重新构建
anchor clean
anchor build
```

#### 4. 版本兼容性问题
```bash
# 检查版本
anchor --version
solana --version

# 更新工具
anchor upgrade
solana-install update
```

### 调试模式

如需更详细的调试信息，可以设置环境变量：

```bash
# 启用详细日志
RUST_LOG=debug yarn deploy

# 保留验证器日志
SOLANA_LOG_PATH=./validator.log yarn deploy
```

## 🔒 安全提醒

### 主网部署注意事项

⚠️ **主网部署前必读:**

1. **钱包安全**: 确保使用安全的钱包文件
2. **代码审计**: thoroughly review your program code
3. **小额测试**: 先用少量 SOL 测试部署
4. **备份重要数据**: 保存程序 ID 和关键信息
5. **网络费用**: 主网部署需要真实的 SOL 作为交易费

### 推荐部署流程

1. **本地测试** → `yarn deploy:local`
2. **开发网验证** → `yarn deploy:devnet`  
3. **测试网验证** → `yarn deploy:testnet`
4. **主网部署** → `yarn deploy:mainnet`

## 📚 相关命令

```bash
# 查看当前配置
solana config get

# 切换网络
solana config set --url <RPC_URL>

# 查看钱包余额
solana balance

# 查看程序账户
solana account <PROGRAM_ID>

# 停止本地验证器
pkill solana-test-validator
```

## 🤖 CI/CD 集成

对于持续集成环境，推荐使用自动清理模式：

```yaml
# .github/workflows/deploy.yml
- name: Deploy to Devnet
  run: |
    solana config set --url https://api.devnet.solana.com
    AUTO_CLEANUP=true yarn deploy
  env:
    CI: true
```

---

## 💡 提示

- 脚本会自动检测并处理不同环境的特殊需求
- 本地环境会自动管理验证器生命周期
- 支持优雅的进程中断和清理 (Ctrl+C)
- 所有部署信息都会清晰显示，便于调试和记录