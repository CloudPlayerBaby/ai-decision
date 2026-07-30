import type { AnalysisStep, ToolCallRecord, Option, AnalysisResult } from '../types/analysis';

// ========== 步骤 mock ==========

export const mockSteps: AnalysisStep[] = [
  {
    id: 's_1',
    name: 'UNDERSTAND',
    displayName: '理解问题',
    status: 'SUCCEEDED',
    summary: '已识别学习路径与时间约束',
    content:
      '你只有一周时间准备 Java 后端面试，每天 2 小时，共 14 小时可用。核心矛盾在于有限时间内是追求覆盖面还是单点深度。',
    startedAt: '2026-07-30T10:00:00+08:00',
    endedAt: '2026-07-30T10:00:03+08:00',
  },
  {
    id: 's_2',
    name: 'EXTRACT_FACTORS',
    displayName: '提取关键因素',
    status: 'RUNNING',
    summary: '正在分析时间、收益与风险',
    content:
      '关键因素包括：时间成本（每天仅 2 小时）、求职收益（面试高频度）、项目实践（能否形成可验证成果）。',
  },
  {
    id: 's_3',
    name: 'GENERATE_OPTIONS',
    displayName: '生成候选方案',
    status: 'WAITING',
    summary: '等待前序步骤完成',
    content: '',
  },
];

// ========== 工具调用 mock ==========

export const mockToolCalls: ToolCallRecord[] = [
  {
    stepId: 's_2',
    toolName: 'calculator',
    status: 'SUCCEEDED',
    inputSummary: '比较每日学习时长',
    outputSummary: 'Redis 基础入门约需 10 小时，Docker 基础入门约需 14 小时',
  },
];

// ========== 方案 mock ==========

export const mockOptions: Option[] = [
  {
    id: 'opt_docker',
    name: '优先学习 Docker',
    pros: ['工程化能力完整', '部署技能通用'],
    cons: ['学习曲线陡峭'],
    risks: ['短期收益分散'],
    scores: { cost: 3, time: 3, benefit: 4, risk: 3, feasibility: 3 },
  },
  {
    id: 'opt_redis',
    name: '优先学习 Redis',
    pros: ['面试高频', '学习路径集中'],
    cons: ['需理解缓存场景'],
    risks: ['需项目实践验证'],
    scores: { cost: 4, time: 4, benefit: 5, risk: 4, feasibility: 4 },
  },
  {
    id: 'opt_both',
    name: '双线并行',
    pros: ['知识覆盖更广'],
    cons: ['注意力分散'],
    risks: ['两个都学不扎实'],
    scores: { cost: 2, time: 2, benefit: 3, risk: 2, feasibility: 2 },
  },
];

// ========== 分析结果草案 mock ==========

export const mockResult: AnalysisResult = {
  id: 'ar_40001',
  status: 'PENDING_CONFIRM',
  understanding:
    '用户希望在一周内选择优先学习方向，提升 Java 后端面试竞争力。核心矛盾是有限时间内的学习路径选择。',
  factors: [
    { id: 'f_time', name: '时间成本', weight: 0.30, description: '一周内可获得的掌握程度' },
    { id: 'f_benefit', name: '求职收益', weight: 0.35, description: '面试高频度与项目表达价值' },
    { id: 'f_practice', name: '项目实践', weight: 0.20, description: '是否能形成可验证的成果' },
    { id: 'f_risk', name: '风险', weight: 0.10, description: '学习失败或效果不佳的可能性' },
    { id: 'f_feasibility', name: '可执行性', weight: 0.05, description: '计划是否能在约束条件下完成' },
  ],
  options: mockOptions,
  recommendation: { optionId: 'opt_redis', reason: 'Redis 面试高频、学习路径集中、一周内可看到明显成果' },
  nextActions: ['完成 Redis 基础入门教程', '做一个缓存穿透演示项目', '整理 Redis 常见面试题'],
  validation: { schemaValid: true, repaired: false, warnings: [] },
  createdAt: '2026-07-30T10:01:00+08:00',
};
