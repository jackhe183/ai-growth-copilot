import { runAgent, runAgentStream, type StreamEvent } from './loop.ts';
import type { TraceStep } from './types.ts';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[97m',
  magenta: '\x1b[35m',
};

interface Lead {
  id: string;
  source: string;
  company: string;
  industry: string;
  interested_product: string;
  customer_message: string;
  sales_notes: string;
  contact?: {
    name: string;
    title: string;
    phone: string;
    email: string;
  };
}

function printStep(step: TraceStep): void {
  console.log(`\n${colors.gray}[Step ${step.step}]${colors.reset}`);

  if (step.thought) {
    console.log(`${colors.cyan}🤔 ${step.thought}${colors.reset}`);
  }

  if (step.action) {
    const input = step.action.input || '{}';
    console.log(`${colors.blue}🔧 ${step.action.tool}(${truncate(input, 100)})${colors.reset}`);
  }

  if (step.observation) {
    console.log(`${colors.green}📋 ${truncate(step.observation, 300)}${colors.reset}`);
  }

  if (step.error && !step.final) {
    console.log(`${colors.red}❌ ${step.error}${colors.reset}`);
  }

  if (step.final) {
    console.log(`\n${colors.green}${colors.bold}========== 分析结果 ==========${colors.reset}`);
    console.log(`${colors.green}${step.final}${colors.reset}`);
  }
}

function printStreamEvent(event: StreamEvent): void {
  switch (event.type) {
    case 'step':
      const step = event.step;
      console.log(`\n${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      console.log(`${colors.bold}${colors.magenta}[Step ${step.step}]${colors.reset}`);

      if (step.thought) {
        console.log(`${colors.yellow}🤔 思考: ${step.thought}${colors.reset}`);
      }
      if (step.action) {
        const input = step.action.input || '{}';
        console.log(`${colors.blue}🔧 执行: ${step.action.tool}${colors.reset}`);
        console.log(`${colors.gray}   参数: ${truncate(input, 150)}${colors.reset}`);
      }
      if (step.observation) {
        console.log(`${colors.green}📋 观察: ${truncate(step.observation, 300)}${colors.reset}`);
      }
      if (step.error) {
        console.log(`${colors.red}❌ 错误: ${step.error}${colors.reset}`);
      }
      if (step.final) {
        console.log(`\n${colors.green}${colors.bold}✅ 完成${colors.reset}`);
      }
      break;

    case 'token':
      process.stdout.write(event.token);
      break;

    case 'error':
      console.log(`\n${colors.red}❌ 错误: ${event.message}${colors.reset}`);
      break;
  }
}

function truncate(str: string, maxLen: number): string {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

function listLeads(): void {
  const leads: Lead[] = JSON.parse(
    readFileSync(resolve(process.cwd(), 'data', 'leads.json'), 'utf-8')
  );

  console.log(`\n${colors.bold}📋 可用线索列表:${colors.reset}\n`);
  leads.forEach((lead, idx) => {
    console.log(`${colors.blue}${idx + 1}.${colors.reset} [${lead.id}] ${lead.company} (${lead.industry})`);
    console.log(`   来源: ${lead.source} | 产品: ${lead.interested_product}`);
    console.log();
  });
  console.log(`使用方式: bun run src/index.ts lead_001`);
  console.log(`或直接输入线索内容进行分析`);
}

function buildTaskFromLead(lead: Lead): string {
  return `请分析以下线索：

来源：${lead.source}
公司：${lead.company}
行业：${lead.industry}
感兴趣产品：${lead.interested_product}

客户留言：
${lead.customer_message}

销售备注：
${lead.sales_notes}
${lead.contact ? `
联系信息：${lead.contact.name}（${lead.contact.title}）` : ''}`;
}

async function main() {
  const args = Bun.argv.slice(2);
  const showTrace = args.includes('--trace') || args.includes('-t');
  const listArg = args.includes('--list') || args.includes('-l');
  const streamMode = args.includes('--stream') || args.includes('-s');

  const filteredArgs = args.filter(
    arg => !arg.startsWith('--') && !arg.startsWith('-')
  );

  // 解析剩余参数
  const remainingArgs = args.filter(
    arg => !['--trace', '-t', '--list', '-l', '--stream', '-s'].includes(arg)
  );

  if (listArg) {
    listLeads();
    process.exit(0);
  }

  if (remainingArgs.length === 0) {
    console.log(`
${colors.bold}AI Growth Copilot - 线索评分助手${colors.reset}

用法:
  bun run src/index.ts --list              # 列出所有可用线索
  bun run src/index.ts <lead_id>           # 使用线索 ID 分析
  bun run src/index.ts --stream <lead_id>  # 流式输出模式
  bun run src/index.ts --trace <lead_id>   # 显示完整 trace

示例:
  bun run src/index.ts lead_001
  bun run src/index.ts --stream lead_002
  bun run src/index.ts --trace lead_003

直接输入线索内容:
  bun run src/index.ts "客户留言：我们想了解AI客服..."
`);
    process.exit(0);
  }

  const input = remainingArgs.join(' ');
  let task = input;

  // 检查是否是 lead ID
  if (input.match(/^lead_\d{3}$/i)) {
    const leads: Lead[] = JSON.parse(
      readFileSync(resolve(process.cwd(), 'data', 'leads.json'), 'utf-8')
    );
    const lead = leads.find(l => l.id.toLowerCase() === input.toLowerCase());

    if (lead) {
      task = buildTaskFromLead(lead);
    } else {
      console.log(`${colors.red}未找到线索: ${input}${colors.reset}`);
      console.log(`使用 --list 查看可用线索`);
      process.exit(1);
    }
  }

  console.log(`${colors.bold}🎯 线索评分任务${colors.reset}\n`);

  try {
    if (streamMode) {
      // 流式输出模式
      console.log(`${colors.cyan}🚀 启动流式输出...\n${colors.reset}`);
      let isFirstToken = true;

      for await (const event of runAgentStream(task)) {
        if (event.type === 'token' && isFirstToken) {
          console.log(`\n${colors.green}${colors.bold}========== 分析结果 ==========${colors.reset}\n`);
          isFirstToken = false;
        }
        printStreamEvent(event);
      }
      console.log(`\n`);
    } else {
      // 非流式模式（原有行为）
      if (showTrace) {
        console.log(`${colors.gray}正在启动 ReAct 循环...\n${colors.reset}`);
      }

      const result = await runAgent(task, showTrace ? printStep : undefined);

      if (!showTrace) {
        console.log(`\n${colors.green}${colors.bold}========== 分析结果 ==========${colors.reset}`);
        console.log(`${colors.green}${result.final}${colors.reset}`);
      }
    }
  } catch (error) {
    console.error('\n错误:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();