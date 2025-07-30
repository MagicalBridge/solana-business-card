import { exec, spawn, ChildProcess } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// 颜色输出工具
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg: string) => console.log(`${colors.cyan}➤${colors.reset} ${msg}`),
};

interface ClusterInfo {
  name: string;
  url: string;
  isLocal: boolean;
}

interface DeploymentConfig {
  cluster: ClusterInfo;
  programId?: string;
  validatorProcess?: ChildProcess;
}

class SolanaDeployer {
  private config: DeploymentConfig | null = null;

  /**
   * 获取目标环境（从环境变量或当前配置）
   */
  getTargetEnvironment(): string | null {
    const envTarget = process.env.SOLANA_ENV;
    if (envTarget) {
      log.info(`检测到环境变量 SOLANA_ENV=${envTarget}`);
      return envTarget;
    }
    return null;
  }

  /**
   * 获取环境对应的 RPC URL
   */
  getEnvironmentUrl(envName: string): string {
    const envMap: Record<string, string> = {
      'localnet': 'http://localhost:8899',
      'devnet': 'https://api.devnet.solana.com',
      'testnet': 'https://api.testnet.solana.com',
      'mainnet-beta': 'https://api.mainnet-beta.solana.com'
    };
    
    return envMap[envName] || envName; // 如果是自定义 URL，直接返回
  }

  /**
   * 切换到指定环境
   */
  async switchToEnvironment(targetEnv: string): Promise<void> {
    try {
      const targetUrl = this.getEnvironmentUrl(targetEnv);
      log.step(`切换到 ${targetEnv} 环境...`);
      
      await execAsync(`solana config set --url ${targetUrl}`);
      log.success(`已切换到 ${targetEnv} (${targetUrl})`);
      
      // 给一点时间让配置生效
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error: any) {
      log.error(`环境切换失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取当前 Solana CLI 配置的集群信息
   */
  async getCurrentCluster(): Promise<ClusterInfo> {
    try {
      log.step("检测 Solana CLI 当前配置...");
      
      const { stdout } = await execAsync("solana config get");
      const lines = stdout.split('\n');
      
      let rpcUrl = '';
      for (const line of lines) {
        if (line.includes('RPC URL:')) {
          rpcUrl = line.split('RPC URL:')[1].trim();
          break;
        }
      }

      if (!rpcUrl) {
        throw new Error("无法获取 RPC URL 配置");
      }

      // 判断集群类型
      let clusterInfo: ClusterInfo;
      
      if (rpcUrl.includes('localhost') || rpcUrl.includes('127.0.0.1')) {
        clusterInfo = { name: 'localnet', url: rpcUrl, isLocal: true };
      } else if (rpcUrl.includes('devnet')) {
        clusterInfo = { name: 'devnet', url: rpcUrl, isLocal: false };
      } else if (rpcUrl.includes('testnet')) {
        clusterInfo = { name: 'testnet', url: rpcUrl, isLocal: false };
      } else if (rpcUrl.includes('mainnet')) {
        clusterInfo = { name: 'mainnet-beta', url: rpcUrl, isLocal: false };
      } else {
        clusterInfo = { name: 'custom', url: rpcUrl, isLocal: false };
      }

      log.info(`当前集群: ${colors.bright}${clusterInfo.name}${colors.reset} (${clusterInfo.url})`);
      return clusterInfo;
      
    } catch (error: any) {
      log.error(`获取集群信息失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 检查 solana-test-validator 是否正在运行
   */
  async isValidatorRunning(): Promise<boolean> {
    try {
      const { stdout } = await execAsync("pgrep -f 'solana-test-validator'");
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * 启动 solana-test-validator
   */
  async startValidator(): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
      log.step("启动本地 Solana 测试验证器...");
      
      const validator = spawn("solana-test-validator", [
        "--quiet",
        "--reset",
        "--ledger", ".anchor/test-ledger"
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      });

      let isResolved = false;
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          log.success("验证器启动完成");
          resolve(validator);
        }
      }, 8000); // 8秒超时

      validator.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Listening') && !isResolved) {
          clearTimeout(timeout);
          isResolved = true;
          log.success("验证器启动完成");
          resolve(validator);
        }
      });

      validator.stderr?.on('data', (data) => {
        const error = data.toString();
        if (error.includes('Error') || error.includes('failed')) {
          clearTimeout(timeout);
          if (!isResolved) {
            isResolved = true;
            reject(new Error(`验证器启动失败: ${error}`));
          }
        }
      });

      validator.on('error', (error) => {
        clearTimeout(timeout);
        if (!isResolved) {
          isResolved = true;
          reject(new Error(`无法启动验证器: ${error.message}`));
        }
      });

      validator.on('exit', (code, signal) => {
        if (code !== 0 && !isResolved) {
          clearTimeout(timeout);
          isResolved = true;
          reject(new Error(`验证器异常退出: code=${code}, signal=${signal}`));
        }
      });
    });
  }

  /**
   * 等待网络连接就绪
   */
  async waitForNetwork(maxRetries: number = 10): Promise<void> {
    log.step("等待网络连接就绪...");
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        await execAsync("solana cluster-version", { timeout: 5000 });
        log.success("网络连接正常");
        return;
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error(`网络连接失败，已重试 ${maxRetries} 次`);
        }
        log.info(`网络连接失败，正在重试 (${i + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  /**
   * 构建程序
   */
  async buildProgram(): Promise<void> {
    try {
      log.step("构建 Anchor 程序...");
      await execAsync("anchor build");
      log.success("程序构建完成");
    } catch (error: any) {
      log.error(`程序构建失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 部署程序
   */
  async deployProgram(): Promise<void> {
    try {
      log.step("部署程序到区块链...");
      
      const { stdout, stderr } = await execAsync("anchor deploy");
      
      if (stderr && stderr.includes('Error')) {
        throw new Error(stderr);
      }
      
      // 解析程序 ID
      const programIdMatch = stdout.match(/Program Id: ([A-Za-z0-9]{32,})/);
      if (programIdMatch) {
        this.config!.programId = programIdMatch[1];
        log.success(`程序部署成功! Program ID: ${colors.bright}${this.config!.programId}${colors.reset}`);
      } else {
        log.success("程序部署完成");
      }
      
    } catch (error: any) {
      log.error(`程序部署失败: ${error.message}`);
      
      // 提供更详细的错误信息
      if (error.message.includes('insufficient funds')) {
        log.error("部署失败：账户余额不足，请先获取一些 SOL");
        if (this.config?.cluster.isLocal) {
          log.info("对于本地环境，可以使用: solana airdrop 10");
        }
      } else if (error.message.includes('Connection refused')) {
        log.error("部署失败：无法连接到 Solana 网络");
        if (this.config?.cluster.isLocal) {
          log.info("请确保 solana-test-validator 正在运行");
        }
      }
      
      throw error;
    }
  }

  /**
   * 验证部署结果
   */
  async verifyDeployment(): Promise<void> {
    if (!this.config?.programId) {
      log.warning("跳过部署验证：未找到程序 ID");
      return;
    }

    try {
      log.step("验证程序部署状态...");
      
      const { stdout } = await execAsync(`solana account ${this.config.programId}`);
      
      if (stdout.includes('executable: true')) {
        log.success("程序验证通过：可执行程序已正确部署");
      } else {
        log.warning("程序验证警告：程序可能未正确部署");
      }
      
    } catch (error: any) {
      log.warning(`程序验证失败: ${error.message}`);
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    if (this.config?.validatorProcess) {
      log.step("清理本地验证器进程...");
      try {
        this.config.validatorProcess.kill('SIGTERM');
        
        // 等待进程正常退出
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            this.config!.validatorProcess!.kill('SIGKILL');
            resolve(void 0);
          }, 5000);
          
          this.config!.validatorProcess!.on('exit', () => {
            clearTimeout(timeout);
            resolve(void 0);
          });
        });
        
        log.success("本地验证器已停止");
      } catch (error: any) {
        log.warning(`停止验证器时出错: ${error.message}`);
      }
    }
  }

  /**
   * 确保环境配置正确
   */
  async ensureCorrectEnvironment(): Promise<ClusterInfo> {
    // 检查是否指定了目标环境
    const targetEnv = this.getTargetEnvironment();
    
    if (targetEnv) {
      // 获取当前环境
      const currentCluster = await this.getCurrentCluster();
      
      // 如果目标环境与当前环境不匹配，自动切换
      if (currentCluster.name !== targetEnv) {
        log.warning(`当前环境 (${currentCluster.name}) 与目标环境 (${targetEnv}) 不匹配`);
        
        // 主网切换需要确认
        if (targetEnv === 'mainnet-beta') {
          log.warning("⚠️ 注意：即将切换到主网环境，这将使用真实的 SOL！");
        }
        
        await this.switchToEnvironment(targetEnv);
        
        // 重新获取集群信息
        return await this.getCurrentCluster();
      } else {
        log.success(`环境配置正确：${targetEnv}`);
        return currentCluster;
      }
    } else {
      // 没有指定目标环境，使用当前配置
      return await this.getCurrentCluster();
    }
  }

  /**
   * 主部署流程
   */
  async deploy(): Promise<void> {
    const startTime = Date.now();
    
    try {
      log.info(`${colors.bright}🚀 开始 Solana 程序部署流程${colors.reset}`);
      console.log("=".repeat(50));

      // 1. 确保环境配置正确
      const cluster = await this.ensureCorrectEnvironment();
      this.config = { cluster };

      // 2. 环境特殊处理
      if (cluster.isLocal) {
        log.info("检测到本地环境，准备启动测试验证器...");
        
        const isRunning = await this.isValidatorRunning();
        if (!isRunning) {
          this.config.validatorProcess = await this.startValidator();
        } else {
          log.info("本地验证器已在运行");
        }
        
        // 等待网络就绪
        await this.waitForNetwork();
      } else {
        log.info(`使用远程环境: ${cluster.name}`);
        await this.waitForNetwork(5);
      }

      // 3. 构建程序
      await this.buildProgram();

      // 4. 部署程序
      await this.deployProgram();

      // 5. 验证部署
      await this.verifyDeployment();

      // 部署成功
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log("=".repeat(50));
      log.success(`🎉 部署成功完成! 耗时: ${duration}s`);
      
      if (this.config.programId) {
        console.log(`\n${colors.bright}程序信息:${colors.reset}`);
        console.log(`  集群: ${colors.cyan}${cluster.name}${colors.reset}`);
        console.log(`  Program ID: ${colors.green}${this.config.programId}${colors.reset}`);
        console.log(`  RPC URL: ${cluster.url}`);
      }

    } catch (error: any) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log("=".repeat(50));
      log.error(`💥 部署失败! 耗时: ${duration}s`);
      log.error(`错误信息: ${error.message}`);
      
      // 提供故障排除建议
      console.log(`\n${colors.bright}故障排除建议:${colors.reset}`);
      console.log("1. 检查网络连接和 RPC 配置");
      console.log("2. 确保钱包有足够的 SOL 余额");
      console.log("3. 验证 Anchor 和 Solana CLI 版本兼容性");
      console.log("4. 查看详细日志获取更多信息");
      
      throw error;
    } finally {
      // 如果是在 CI 环境或明确要求清理，则清理验证器
      if (process.env.CI || process.env.AUTO_CLEANUP) {
        await this.cleanup();
      } else if (this.config?.validatorProcess) {
        log.info("本地验证器继续运行中，如需停止请手动执行清理");
      }
    }
  }
}

// 主执行函数  
async function main() {
  const deployer = new SolanaDeployer();
  
  // 处理进程退出信号
  process.on('SIGINT', async () => {
    log.warning("\n收到中断信号，正在清理...");
    await deployer.cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    log.warning("\n收到终止信号，正在清理...");
    await deployer.cleanup();
    process.exit(0);
  });

  try {
    await deployer.deploy();
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch((error) => {
    console.error("部署脚本执行失败:", error);
    process.exit(1);  
  });
}

export { SolanaDeployer };
