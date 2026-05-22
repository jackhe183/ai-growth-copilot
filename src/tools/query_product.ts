import { readFileSync } from 'fs';
import { resolve } from 'path';

interface QueryInput {
  type: 'product' | 'sop' | 'forbidden' | 'lead';
  query?: string;
  id?: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  features: string[];
  pricing: {
    min: number;
    unit: string;
    note: string;
  };
  implementation: {
    min_days: number;
    max_days: number;
    process: string;
    pilot_available: boolean;
    pilot_desc: string;
  };
  requirements: string[];
}

interface ProductCatalog {
  products: Product[];
  common_use_cases: Array<{
    industry: string;
    pain_points: string[];
    recommended: string[];
  }>;
}

export async function queryProduct(inputStr: string): Promise<string> {
  let input: QueryInput;

  try {
    input = JSON.parse(inputStr);
  } catch {
    return '查询失败：输入必须是 JSON 格式，如 {"type":"product","query":"AI客服"}';
  }

  const dataDir = resolve(process.cwd(), 'data');

  try {
    switch (input.type) {
      case 'product':
        return await queryProductCatalog(input, dataDir);
      case 'sop':
        return await queryFile('sales_sop.md', dataDir, input.query);
      case 'forbidden':
        return await queryFile('forbidden_claims.md', dataDir, input.query);
      case 'lead':
        return await queryFile('leads.json', dataDir, input.query, true);
      default:
        return `未知查询类型: ${input.type}，可选值: product, sop, forbidden, lead`;
    }
  } catch (error) {
    return `查询失败: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function queryProductCatalog(input: QueryInput, dataDir: string): Promise<string> {
  const catalogStr = readFileSync(resolve(dataDir, 'product_catalog.json'), 'utf-8');
  const catalog: ProductCatalog = JSON.parse(catalogStr);

  // 按 ID 精确查询
  if (input.id) {
    const product = catalog.products.find(p => p.id === input.id);
    if (product) {
      return formatProduct(product);
    }
    return `未找到 ID 为 ${input.id} 的产品`;
  }

  // 按关键词模糊查询
  if (input.query) {
    const query = input.query.toLowerCase();
    const matched = catalog.products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.features.some(f => f.toLowerCase().includes(query))
    );

    if (matched.length === 0) {
      return `未找到包含 "${input.query}" 的产品`;
    }

    // 检查行业场景匹配
    const useCase = catalog.common_use_cases.find(u =>
      u.industry.toLowerCase().includes(query) ||
      u.pain_points.some(p => p.toLowerCase().includes(query))
    );

    let result = matched.map(formatProduct).join('\n\n---\n\n');

    if (useCase) {
      result += `\n\n💡 行业参考（${useCase.industry}）：`;
      result += `\n痛点: ${useCase.pain_points.join('、')}`;
      result += `\n推荐方案: ${useCase.recommended.map(id => {
        const p = catalog.products.find(prod => prod.id === id);
        return p ? p.name : id;
      }).join('、')}`;
    }

    return result;
  }

  // 返回全部产品
  return catalog.products.map(formatProduct).join('\n\n---\n\n');
}

async function queryFile(
  filename: string,
  dataDir: string,
  query?: string,
  isJson = false
): Promise<string> {
  const content = readFileSync(resolve(dataDir, filename), 'utf-8');

  if (!query) {
    return isJson ? content : `文件内容:\n\n${content}`;
  }

  // 简单关键词匹配
  const lines = content.split('\n');
  const matched = lines.filter(line =>
    line.toLowerCase().includes(query.toLowerCase())
  );

  if (matched.length === 0) {
    return `未找到包含 "${query}" 的内容`;
  }

  return `匹配内容:\n\n${matched.join('\n')}`;
}

function formatProduct(product: Product): string {
  let result = `【${product.name}】\n`;
  result += `${product.description}\n\n`;
  result += `✨ 核心功能:\n${product.features.map(f => `  • ${f}`).join('\n')}\n\n`;
  result += `💰 价格参考: ${product.pricing.min} 万元起（${product.pricing.unit}）\n`;
  result += `   ${product.pricing.note}\n\n`;
  result += `⏱️ 交付周期: ${product.implementation.min_days}-${product.implementation.max_days} 天\n`;
  result += `   流程: ${product.implementation.process}\n`;
  if (product.implementation.pilot_available) {
    result += `   支持试点: ${product.implementation.pilot_desc}\n`;
  }
  result += `\n📋 需求前提:\n${product.requirements.map(r => `  • ${r}`).join('\n')}`;

  return result;
}
