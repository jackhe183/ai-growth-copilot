import { runAgent } from './loop.ts';
import type { TraceStep } from './types.ts';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PORT = 3000;

// 获取线索列表
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

function getLeads(): Lead[] {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), 'data', 'leads.json'), 'utf-8')
  );
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

// 记录步骤用于 SSE
let currentSteps: TraceStep[] = [];
let currentResult = '';

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // 静态文件
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const file = Bun.file(resolve(process.cwd(), 'public', 'index.html'));
    return new Response(file, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (url.pathname === '/style.css') {
    const file = Bun.file(resolve(process.cwd(), 'public', 'style.css'));
    return new Response(file, {
      headers: { 'Content-Type': 'text/css; charset=utf-8' },
    });
  }

  // API: 获取线索列表
  if (url.pathname === '/api/leads' && req.method === 'GET') {
    return Response.json(getLeads());
  }

  // API: 分析线索 (轮询模式)
  if (url.pathname === '/api/analyze' && req.method === 'POST') {
    const { leadId, customInput } = await req.json();

    let task = customInput;
    const steps: TraceStep[] = [];

    // 如果是 lead ID，构建任务
    if (leadId && !customInput) {
      const leads = getLeads();
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        task = buildTaskFromLead(lead);
      } else {
        return Response.json({ error: '未找到线索' }, { status: 404 });
      }
    }

    // 运行 Agent
    const result = await runAgent(task, (step) => {
      steps.push(step);
    });

    return Response.json({
      steps,
      result: result.final,
    });
  }

  // API: 获取分析进度（轮询）
  if (url.pathname === '/api/status' && req.method === 'GET') {
    return Response.json({ status: 'idle' });
  }

  return new Response('Not Found', { status: 404 });
}

Bun.serve({
  port: PORT,
  idleTimeout: 255,
  fetch: handleRequest,
});

console.log(`🚀 AI Growth Copilot Web - http://localhost:${PORT}`);
console.log(`📋 线索分析 API: POST /api/analyze`);
console.log(`📄 线索列表 API: GET /api/leads`);