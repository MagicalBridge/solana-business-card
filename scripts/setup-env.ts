#!/usr/bin/env ts-node

import { exec } from "child_process";
import { promisify } from "util";
import * as readline from "readline";

const execAsync = promisify(exec);

// 颜色输出工具
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg: string) => console.log(`${colors.cyan}➤${colors.reset} ${msg}`),
};

interface SolanaEnvironment {
  name: string;
  displayName: string;
  url: string;
  description: string;
  requiresFunds: boolean;
}

const environments: SolanaEnvironment[] = [
  {
    name: "localnet",
    displayName: "本地网络 (Localnet)",
    url: "http://localhost:8899",
    description: "本地测试环境，无需真实资金",
    requiresFunds: false,
  },
  {
    name: "devnet", 
    displayName: "开发网络 (Devnet)",
    url: "https://api.devnet.solana.com",
    description: "Solana 开发测试网络，可免费获取测试代币",
    requiresFunds: false,
  },
  {
    name: "testnet",
    displayName: "测试网络 (Testnet)", 
    url: "https://api.testnet.solana.com",
    description: "Solana 测试网络，性能接近主网",
    requiresFunds: false,
  },
  {
    name: "mainnet-beta",
    displayName: "主网 (Mainnet)",
    url: "https://api.mainnet-beta.solana.com", 
    description: "⚠️ 生产环境，需要真实的 SOL",
    requiresFunds: true,
  }
];

class SolanaEnvironmentManager {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * 获取当前环境配置
   */
  async getCurrentEnvironment(): Promise<string | null> {
    try {
      const { stdout } = await execAsync("solana config get");
      const lines = stdout.split('\n');
      
      let rpcUrl = '';
      for (const line of lines) {
        if (line.includes('RPC URL:')) {
          rpcUrl = line.split('RPC URL:')[1].trim();
          break;
        }
      }

      // 查找匹配的环境
      const env = environments.find(e => rpcUrl.includes(e.url.replace('https://', '').replace('http://', '')));
      return env ? env.name : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 显示当前配置
   */
  async showCurrentConfig() {
    try {
      log.step("获取当前 Solana 配置...");
      const { stdout } = await execAsync("solana config get");
      console.log(`\n${colors.bright}当前配置:${colors.reset}`);
      console.log(stdout);
    } catch (error: any) {
      log.error(`无法获取配置: ${error.message}`);
    }
  }

  /**
   * 显示钱包余额
   */
  async showBalance() {
    try {
      log.step("获取钱包余额...");
      const { stdout } = await execAsync("solana balance");
      log.success(`当前余额: ${colors.bright}${stdout.trim()}${colors.reset}`);
    } catch (error: any) {
      log.warning(`无法获取余额: ${error.message}`);
    }
  }

  /**
   * 切换到指定环境
   */
  async switchEnvironment(env: SolanaEnvironment): Promise<boolean> {
    try {
      log.step(`切换到 ${env.displayName}...`);
      
      await execAsync(`solana config set --url ${env.url}`);
      log.success(`已切换到 ${env.displayName}`);
      
      // 显示警告信息
      if (env.requiresFunds) {
        log.warning("⚠️ 注意：这是生产环境，需要真实的 SOL！");
      }
      
      return true;
    } catch (error: any) {
      log.error(`切换失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 空投测试代币
   */
  async requestAirdrop(amount: number = 2): Promise<boolean> {
    try {
      log.step(`请求空投 ${amount} SOL...`);
      
      const { stdout } = await execAsync(`solana airdrop ${amount}`);
      log.success("空投成功！");
      console.log(stdout);
      
      return true;
    } catch (error: any) {
      log.error(`空投失败: ${error.message}`);
      
      if (error.message.includes('airdrop request limit')) {
        log.info("提示：可能已达到空投限制，请稍后再试");
      } else if (error.message.includes('mainnet')) {
        log.error("主网不支持空投，需要真实购买 SOL");
      }
      
      return false;
    }
  }

  /**
   * 问用户问题
   */
  private question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  /**
   * 显示环境选择菜单
   */
  async showEnvironmentMenu(): Promise<SolanaEnvironment | null> {
    console.log(`\n${colors.bright}可用的 Solana 环境:${colors.reset}\n`);
    
    // 先获取当前环境，避免在循环中重复调用
    const currentEnv = await this.getCurrentEnvironment();
    
    environments.forEach((env, index) => {
      const current = env.name === currentEnv ? " 👈 当前" : "";
      console.log(`${colors.cyan}${index + 1}${colors.reset}. ${env.displayName}${current}`);
      console.log(`   ${env.description}`);
      console.log(`   RPC: ${colors.yellow}${env.url}${colors.reset}\n`);
    });

    const answer = await this.question("请选择环境 (输入数字，或按 Enter 取消): ");
    
    if (!answer.trim()) {
      return null;
    }

    const choice = parseInt(answer) - 1;
    if (choice >= 0 && choice < environments.length) {
      return environments[choice];
    } else {
      log.error("无效选择");
      return null;
    }
  }

  /**
   * 显示主菜单
   */
  async showMainMenu(): Promise<string> {
    console.log(`\n${colors.bright}Solana 环境管理器${colors.reset}\n`);
    console.log(`${colors.cyan}1${colors.reset}. 查看当前配置`);
    console.log(`${colors.cyan}2${colors.reset}. 切换环境`);
    console.log(`${colors.cyan}3${colors.reset}. 查看钱包余额`);
    console.log(`${colors.cyan}4${colors.reset}. 请求测试代币空投`);
    console.log(`${colors.cyan}5${colors.reset}. 部署程序`);
    console.log(`${colors.cyan}0${colors.reset}. 退出\n`);

    return await this.question("请选择操作: ");
  }

  /**
   * 执行部署
   */
  async deployProgram() {
    log.step("准备部署程序...");
    
    const currentEnv = await this.getCurrentEnvironment();
    if (!currentEnv) {
      log.warning("无法确定当前环境，请先选择环境");
      return;
    }

    const env = environments.find(e => e.name === currentEnv);
    if (env?.requiresFunds) {
      const confirm = await this.question(`⚠️ 将要部署到主网，这需要真实的 SOL。确认继续？(y/N): `);
      if (confirm.toLowerCase() !== 'y') {
        log.info("部署已取消");
        return;
      }
    }

    try {
      const { spawn } = require('child_process');
      const deployProcess = spawn('yarn', ['deploy'], {
        stdio: 'inherit',
        shell: true
      });

      deployProcess.on('close', (code: number) => {
        if (code === 0) {
          log.success("部署完成！");
        } else {
          log.error("部署失败");
        }
      });
    } catch (error: any) {
      log.error(`启动部署失败: ${error.message}`);
    }
  }

  /**
   * 主运行循环
   */
  async run() {
    log.info(`${colors.bright}欢迎使用 Solana 环境管理器！${colors.reset}`);
    
    try {
      while (true) {
        const choice = await this.showMainMenu();
        
        switch (choice) {
          case '1':
            await this.showCurrentConfig();
            break;
            
          case '2':
            const env = await this.showEnvironmentMenu();
            if (env) {
              const success = await this.switchEnvironment(env);
              if (success) {
                await this.showBalance();
              }
            }
            break;
            
          case '3':
            await this.showBalance();
            break;
            
          case '4':
            const currentEnv = await this.getCurrentEnvironment();
            const currentEnvObj = environments.find(e => e.name === currentEnv);
            
            if (currentEnvObj?.requiresFunds) {
              log.error("主网不支持空投，请通过交易所购买 SOL");
            } else {
              const amountStr = await this.question("请输入空投数量 (默认 2 SOL): ");
              const amount = parseFloat(amountStr) || 2;
              await this.requestAirdrop(amount);
              await this.showBalance();
            }
            break;
            
          case '5':
            await this.deployProgram();
            break;
            
          case '0':
            log.info("再见！");
            this.rl.close();
            return;
            
          default:
            log.warning("无效选择，请重新输入");
        }

        // 暂停一下让用户看到结果
        await this.question("\n按 Enter 继续...");
        console.clear();
      }
    } catch (error: any) {
      log.error(`程序出错: ${error.message}`);
    } finally {
      this.rl.close();
    }
  }
}

// 主函数
async function main() {
  const manager = new SolanaEnvironmentManager();
  
  // 处理中断信号
  process.on('SIGINT', () => {
    console.log('\n👋 再见！');
    process.exit(0);
  });

  await manager.run();
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch((error) => {
    console.error("环境管理器出错:", error);
    process.exit(1);
  });
}

export { SolanaEnvironmentManager };