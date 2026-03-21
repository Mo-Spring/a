export interface Company {
  c: string; // code
  n: string; // name
  sn?: string; // sub-industry name (runtime populated)
  market?: 'A' | 'HK' | 'GLOBAL';
}

export interface SubIndustry {
  nm: string;
  cs: Company[];
}

export interface IndexInfo {
  c: string; // code
  n: string; // name
  t: 'broad' | 'theme'; // type: broad or theme
}

export interface Industry {
  id: string;
  nm: string;
  ic: string;
  ev: 'low' | 'mid' | 'high';
  market?: 'A' | 'HK' | 'GLOBAL';
  l2: SubIndustry[];
  bk?: string; // BK code for real-time index
  indices?: IndexInfo[];
}

export interface AIConfig {
  provider: string;
  apiUrl: string;
  apiKey: string;
  model: string;
}

export interface Index {
  c: string; // code
  n: string; // name
  m: 'A' | 'HK' | 'GLOBAL'; // market category
  mk?: string; // raw eastmoney market id
}

export type ViewType = 'home' | 'ind' | 'sub' | 'comp' | 'search' | 'ai' | 'fav' | 'index' | 'index_list' | 'index_detail' | 'settings';

export interface NavigationState {
  view: ViewType;
  args: any[];
}

// ─── 估值模型参数 ───

export interface DCFParams {
  rf: number;                // 无风险利率 (e.g. 0.025 = 2.5%)
  erp: number;               // 股权风险溢价
  terminalGrowth: number;    // 永续增长率
  projectionYears: number;   // 预测年数
}

export interface PERelativeParams {
  roeBase: number;           // ROE 基准值 (e.g. 0.15 = 15%)
  industryWeight: number;    // 行业 PE 权重
  historicalWeight: number;  // 历史 PE 权重
  growthWeight: number;      // PEG 权重
}

export interface GordonParams {
  maxGrowthRate: number;     // 增长率上限
  defaultPayoutRatio: number; // 默认分红比例
}

export interface ValuationConfig {
  dcf: DCFParams;
  pe: PERelativeParams;
  gordon: GordonParams;
}

export type PresetName = 'conservative' | 'neutral' | 'aggressive';

export const VALUATION_PRESETS: Record<PresetName, { name: string; desc: string; config: ValuationConfig }> = {
  conservative: {
    name: '保守',
    desc: '高安全边际，适合稳健型投资者',
    config: {
      dcf: { rf: 0.03, erp: 0.07, terminalGrowth: 0.02, projectionYears: 10 },
      pe: { roeBase: 0.12, industryWeight: 0.35, historicalWeight: 0.35, growthWeight: 0.30 },
      gordon: { maxGrowthRate: 0.06, defaultPayoutRatio: 0.4 },
    },
  },
  neutral: {
    name: '中性',
    desc: '均衡估值，参考市场中位数',
    config: {
      dcf: { rf: 0.025, erp: 0.06, terminalGrowth: 0.03, projectionYears: 10 },
      pe: { roeBase: 0.15, industryWeight: 0.40, historicalWeight: 0.35, growthWeight: 0.25 },
      gordon: { maxGrowthRate: 0.10, defaultPayoutRatio: 0.3 },
    },
  },
  aggressive: {
    name: '激进',
    desc: '看好增长，适合进取型投资者',
    config: {
      dcf: { rf: 0.02, erp: 0.05, terminalGrowth: 0.04, projectionYears: 10 },
      pe: { roeBase: 0.18, industryWeight: 0.45, historicalWeight: 0.30, growthWeight: 0.25 },
      gordon: { maxGrowthRate: 0.15, defaultPayoutRatio: 0.2 },
    },
  },
};
