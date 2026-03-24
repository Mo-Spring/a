/**
 * 五维估值系统 - 类型定义
 */

// ─── 输入数据 ───

export interface HistoricalData {
  years: string[];
  revenues: number[];       // 亿
  netIncomes: number[];     // 亿
  operatingCFs: number[];   // 亿
  freeCFs: number[];        // 亿
  roes: number[];
  epses: number[];
  dividends: number[];
  payoutRatios: number[];
  revenueGrowths: number[];
  netIncomeGrowths: number[];
}

export interface StockInput {
  code: string;
  name: string;
  market: 'A' | 'HK' | 'GLOBAL';

  price: number;            // 当前股价
  pe: number;               // 当前 PE
  pb: number;               // 当前 PB
  ps: number;               // 当前 PS
  dy: number;               // 股息率 %  (e.g. 3.5 = 3.5%)
  roe: number;              // ROE %     (e.g. 15.2 = 15.2%)
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

  history: HistoricalData | null;
  shares?: number;          // 总股本（亿股）
}

export interface IndustryData {
  pe: number;
  pb: number;
  roe: number;
  name: string;
}

export interface ValuationParams {
  dcf: {
    rf: number;
    erp: number;
    terminalGrowth: number;
    projectionYears: number;
    discountRates: { bull: number; base: number; bear: number };
  };
  pe: {
    roeBase: number;
    industryWeight: number;
    historicalWeight: number;
    growthWeight: number;
  };
  gordon: {
    maxGrowthRate: number;
    defaultPayoutRatio: number;
  };
}

// ─── 输出 ───

export interface ValuationRange {
  low: number;
  mid: number;
  high: number;
}

export interface DCFResult {
  fairValue: ValuationRange;          // 估值区间（每股）
  impliedPE: ValuationRange;          // 隐含 PE 区间
  terminalValueRatio: number;         // 终值占比 (0~1)
  wacc: number;
  phases: Array<{ years: number; growth: number }>;
  projection: Array<{ year: number; fcf: number; pv: number }>;
  usedBasis: 'fcf' | 'netIncome' | 'eps';
  confidence: number;
}

export interface RelativeResult {
  fairPE: ValuationRange;
  fairPrice: ValuationRange;
  industryFairPE: number;
  historicalFairPE: number;
  pegFairPE: number;
  peg: number;
  confidence: number;
}

export interface ROICResult {
  roic: number;
  wacc: number;
  spread: number;              // ROIC - WACC
  createsValue: boolean;
  valuationMultiplier: number; // 0.5~1.5
  quality: 'excellent' | 'good' | 'average' | 'poor';
  confidence: number;
}

export interface AssetResult {
  fairPB: number;
  fairPrice: number;
  liquidationPrice: number;
  currentPB: number;
  discount: number;            // 当前价 vs 资产估值的折溢价 %
  confidence: number;
}

export interface ReverseDCFResult {
  impliedGrowthRates: { fcf: number | null; eps: number | null };
  consensusGrowth: number | null;
  userGrowth: number | null;
  gap: number | null;          // 用户假设 vs 市场隐含
  isOverpriced: boolean | null;
  confidence: number;
}

export interface ModelWeights {
  dcf: number;
  relative: number;
  roic: number;
  asset: number;
}

export interface RiskSignal {
  level: 'danger' | 'warning' | 'info';
  message: string;
}

export interface ValuationResult {
  dcf: DCFResult;
  relative: RelativeResult;
  roic: ROICResult;
  asset: AssetResult;
  reverse: ReverseDCFResult;

  compositeFairValue: ValuationRange;
  currentPrice: number;
  marginOfSafety: ValuationRange;   // %
  verdict: 'deeply_undervalued' | 'undervalued' | 'fair' | 'overvalued' | 'deeply_overvalued';
  verdictText: string;

  modelWeights: ModelWeights;
  riskSignals: RiskSignal[];
  confidence: number;
}
