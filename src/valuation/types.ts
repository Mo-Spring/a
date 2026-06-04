/**
 * 估值系统 - 类型定义
 * 两个核心模型：DCF + PE 相对估值
 * 辅助信号：护城河、清算底线、市场预期
 */

// ─── 财务报表原始数据 ───

export interface FinancialStatement {
  year: string;           // "2024"
  reportDate: string;     // "2024-12-31"
  // 利润表
  revenue: number;        // 营业收入（亿）
  costOfRevenue: number;  // 营业成本（亿）
  grossProfit: number;    // 毛利（亿）
  operatingProfit: number;// 营业利润（亿）
  netIncome: number;      // 归母净利润（亿）
  eps: number;            // 基本每股收益
  // 资产负债表
  totalAssets: number;    // 总资产（亿）
  totalEquity: number;    // 归母净资产（亿）
  totalDebt: number;      // 总负债（亿）
  bvps: number;           // 每股净资产
  // 现金流量表
  operatingCF: number;    // 经营活动现金流净额（亿）
  investingCF: number;    // 投资活动现金流净额（亿）
  financingCF: number;    // 筹资活动现金流净额（亿）
  capex: number;          // 资本支出（亿，取绝对值）
  freeCF: number;         // 自由现金流 = 经营CF - CapEx（亿）
  dividendPaid: number;   // 分红支出（亿）
  // 衍生指标
  roe: number;            // ROE %
  roa: number;            // ROA %
  grossMargin: number;    // 毛利率 %
  netMargin: number;      // 净利率 %
  debtRatio: number;      // 资产负债率 %
  revenueGrowth: number;  // 同比营收增长 %
  netIncomeGrowth: number;// 同比净利润增长 %
  payoutRatio: number;    // 分红比例 %
}

// ─── 估值输入 ───

export interface StockInput {
  code: string;
  name: string;
  market: 'A' | 'HK' | 'GLOBAL';

  price: number;            // 当前股价
  pe: number;               // 当前 PE(TTM)
  pb: number;               // 当前 PB
  ps: number;               // 当前 PS
  dy: number;               // 股息率 %
  roe: number;              // ROE %
  roa: number;              // ROA %
  eps: number;              // 每股收益
  bvps: number;             // 每股净资产
  mcap: number;             // 总市值（亿）
  fcap: number;             // 流通市值（亿）

  revenue: number;          // 营收（亿）
  netIncome: number;        // 净利润（亿）
  operatingCF: number;      // 经营现金流（亿）
  freeCF: number;           // 自由现金流（亿）
  grossMargin: number;      // 毛利率 %
  netMargin: number;        // 净利率 %
  totalDebt: number;        // 资产负债率 %
  dividendPerShare: number; // 每股股利
  revenueGrowth: number;    // 营收增长率 %
  netIncomeGrowth: number;  // 净利润增长率 %
  shares?: number;          // 总股本（亿股）

  // 真实财务报表历史
  statements: FinancialStatement[]; // 按时间倒序，[0] = 最新
}

export interface IndustryData {
  pe: number;
  pb: number;
  roe: number;
  name: string;
  // 同行业公司估值参考
  peers?: Array<{ code: string; name: string; pe: number; pb: number; roe: number; mcap: number }>;
}

export interface ValuationParams {
  dcf: {
    rf: number;               // 无风险利率
    erp: number;              // 股权风险溢价
    terminalGrowth: number;   // 永续增长率
    projectionYears: number;  // 预测年数
    discountRates: { bull: number; base: number; bear: number };
  };
  pe: {
    roeBase: number;          // ROE 基准值
    roeSlope?: number;        // ROE→PE 斜率系数，默认 5.0
    roeIntercept?: number;    // ROE→PE 截距，默认 0.5
    industryWeight: number;   // 行业 PE 权重
    historicalWeight: number; // 历史 PE 权重
    growthWeight: number;     // PEG 权重
  };
}

// ─── 估值输出 ───

export interface ValuationRange {
  low: number;
  mid: number;
  high: number;
}

/** DCF 模型结果 */
export interface DCFResult {
  fairValue: ValuationRange;      // 每股估值
  impliedPE: ValuationRange;      // 隐含 PE
  wacc: number;                   // 加权平均资本成本
  terminalValueRatio: number;     // 终值占比
  phases: Array<{ years: number; growth: number }>;
  projection: Array<{ year: number; fcf: number; pv: number }>;
  usedBasis: 'fcf' | 'netIncome' | 'eps';
  confidence: number;
  netDebtPerShare?: number;     // 每股净负债
  // 敏感性分析
  sensitivity?: Array<{ growth: number; wacc: number; value: number }>;
}

/** PE 相对估值结果 */
export interface RelativeResult {
  fairPE: ValuationRange;
  fairPrice: ValuationRange;
  industryFairPE: number;
  roeAdjustedFairPE: number;
  pegFairPE: number;
  peg: number;
  confidence: number;
  // 同业 PE 区间
  peerPEStats?: {
    min: number;
    max: number;
    median: number;
    current: number;
    peerPercentile: number;  // 当前 PE 在同业中的百分位排名
  };
}

/** 辅助信号 */
export interface MoatSignal {
  label: string;       // "盈利护城河" / "现金流质量" / ...
  score: number;       // 0~100
  level: 'strong' | 'good' | 'average' | 'weak';
  detail: string;      // 解释文字
}

export interface RiskSignal {
  level: 'danger' | 'warning' | 'info';
  message: string;
}

/** 综合估值结果 */
export interface ValuationResult {
  dcf: DCFResult;
  relative: RelativeResult;

  // 综合估值
  compositeFairValue: ValuationRange;
  currentPrice: number;
  marginOfSafety: ValuationRange;   // %
  verdict: 'deeply_undervalued' | 'undervalued' | 'fair' | 'overvalued' | 'deeply_overvalued';
  verdictText: string;

  // 辅助信号
  moatSignals: MoatSignal[];
  riskSignals: RiskSignal[];
  liquidationPrice: number;         // 清算底线
  impliedGrowth: number | null;     // 当前股价隐含的年化增长率

  // 元信息
  modelWeights: { dcf: number; relative: number };
  confidence: number;
}

// ─── 本地缓存 ───

export interface CachedValuationData {
  code: string;
  statements: FinancialStatement[];
  fetchedAt: number;
  ttl: number; // 缓存有效时长（ms），默认 7 天
}
