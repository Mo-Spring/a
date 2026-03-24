/**
 * 市场行情相关类型
 */

/** 批量行情数据（来自 push2.eastmoney.com） */
export interface MarketData {
  p?: string;     // 最新价
  cp?: string;    // 涨跌幅 %
  pe?: number;    // 市盈率
  pb?: number;    // 市净率
  dy?: number;    // 股息率 %
  ps?: number;    // 市销率
  roe?: number;   // ROE %
  roa?: number;   // ROA %
  eps?: number;   // 每股收益
  mcap?: number;  // 总市值（亿）
  fcap?: number;  // 流通市值（亿）
  grossMargin?: number;
  netMargin?: number;
  debt?: number;  // 资产负债率 %
  revenueGrowth?: number;
  netIncomeGrowth?: number;
  dividendPerShare?: number;
  payoutYears?: number;
  pePct?: number; // PE 百分位
  pbPct?: number; // PB 百分位
  revenue?: number;
  netIncome?: number;
}

/** 指数估值数据（来自蛋卷基金 + eastmoney 补充） */
export interface IndexValuationData {
  pe?: number;
  pb?: number;
  dy?: number;
  pePct?: number;
  pbPct?: number;
  roe?: number;
  peg?: number;
  evaType?: 'low' | 'mid' | 'high';
  bondYield?: number;
  source?: string;
  peOverHistory?: number;
  pbOverHistory?: number;
  evaTypeInt?: number;
  date?: string;
  p?: string;
  cp?: string;
}

/** 实时价格数据（个股详情页） */
export interface LivePriceData {
  p: string;
  ch: string;
  cp: string;
  up: boolean;
  pe?: string;
  pb?: string;
  dy?: string;
  ps?: string;
  mcap?: string;
  fcap?: string;
}
