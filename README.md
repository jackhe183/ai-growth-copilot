# AI Growth Copilot

**营销线索运营数字员工** — 基于 ReAct 模式的 AI 助手，帮助 B2B 企业智能分析潜在客户线索，输出评分、风险点和跟进建议。

## 功能特性

- **线索评分**：自动分析线索质量，输出 A/B/C/D 等级评分
- **痛点分析**：识别客户核心需求和次要痛点
- **风险识别**：提示缺失信息和潜在风险点
- **方案推荐**：基于产品目录匹配合适方案，引用真实数据
- **话术生成**：基于销售 SOP 生成标准跟进话术
- **执行 Trace**：展示完整 ReAct 执行过程，可审计可追溯

## 快速开始

### 1. 安装 Bun

```bash
# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"
```

### 2. 配置环境变量

编辑 `.env` 文件：

```env
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_BASE=https://api.deepseek.com/v1
```

### 3. 运行

```bash
# CLI 模式 - 分析线索
bun run src/index.ts lead_001

# Web 模式 - 可视化界面
bun run src/web
# 访问 http://localhost:3000
```

## 使用示例

### CLI 模式

```bash
# 列出所有可用线索
bun run src/index.ts --list

# 分析指定线索（显示 Trace）
bun run src/index.ts --trace lead_001

# 直接输入线索内容
bun run src/index.ts "客户留言：我们想了解AI客服方案..."
```

### Web 模式

```bash
bun run src/web
```

访问 http://localhost:3000，可视化选择线索、查看 Trace、分析结果。

## 项目结构

```
AI Growth Copilot/
├── data/                          # 业务数据
│   ├── leads.json                 # 线索数据
│   ├── product_catalog.json       # 产品目录
│   ├── sales_sop.md               # 销售 SOP
│   └── forbidden_claims.md        # 禁止承诺事项
├── skills/
│   └── lead-scoring-followup/
│       └── SKILL.md               # Skill 定义
├── public/                        # Web 前端
│   ├── index.html
│   └── style.css
├── src/
│   ├── index.ts                   # CLI 入口
│   ├── web.ts                     # Web 服务器
│   ├── loop.ts                    # ReAct 循环核心
│   ├── prompt.ts                  # 系统提示词
│   ├── types.ts                   # 类型定义
│   ├── llm/
│   │   └── deepseek.ts           # DeepSeek API 调用
│   ├── parser/
│   │   └── assistant.ts          # XML 回复解析
│   └── tools/
│       ├── mod.ts                 # 工具注册表
│       └── query_product.ts       # 产品查询工具
├── docs/
│   └── lead-generation-research.md # 调研报告
├── package.json
└── tsconfig.json
```

## 核心设计

### ReAct 执行流程

```
线索上下文输入
  ↓
Reasoning Summary（推理摘要）
  ↓
Act（调用 query_product 工具）
  ↓
Observe（获取工具返回结果）
  ↓
Answer（生成结构化分析结果）
```

### Agent 与人工的责任边界

| Agent 适合做的事 | 必须人工做的事 |
|-----------------|---------------|
| 信息提取和整理 | 承诺价格/周期 |
| 基于规则的评分 | 商业决策跟进 |
| 方案匹配建议 | 谈判和议价 |
| 话术生成 | 处理异议投诉 |
| 风险提示 | 高风险客户复核 |

**核心原则**：Agent 不编造数据，所有产品参数必须来自产品目录。

### Trace 展示

每个分析任务都会展示：
- 推理摘要：为什么这样做
- 工具调用：使用了哪些数据
- 观察结果：工具返回的内容
- 最终结论：结构化分析结果

## 工具说明

### query_product

查询本地 mock 产品/服务资料。

**输入格式**：
```json
{"type": "product", "query": "关键词"}   // 按关键词搜索产品
{"type": "product", "id": "产品ID"}      // 按 ID 精确查询
{"type": "sop", "query": "评分标准"}     // 查询销售 SOP
{"type": "forbidden", "query": "关键词"} // 查询禁止承诺事项
```

## 约束规则

1. **禁止编造**：不得自行编造价格、交付周期、能力参数
2. **引用来源**：涉及产品参数时必须标注数据来源
3. **合规提示**：涉及价格、周期时必须标注"以正式报价单为准"
4. **人工复核**：Agent 输出需人工确认，不可直接作为最终决策

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| DEEPSEEK_API_KEY | DeepSeek API 密钥 | - |
| DEEPSEEK_BASE | API Base URL | https://api.deepseek.com/v1 |

## 相关文档

- [SKILL.md](skills/lead-scoring-followup/SKILL.md) - Skill 完整定义
- [docs/lead-generation-research.md](docs/lead-generation-research.md) - 营销线索问题调研报告
- [solution.md](solution.md) - 设计思路说明

## 许可证

MIT