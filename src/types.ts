export interface Company {
  c: string; // code
  n: string; // name
  pe: number;
  pb: number;
  roe: number;
  dy: number;
  ps: number;
  sn?: string; // sub-industry name
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
  pe: number;
  pb: number;
  pp: number; // pe percentile
  bp: number; // pb percentile
  roe: number;
  dy: number;
  an: string; // analysis
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
  mk?: string; // raw eastmoney market id ('0'=SZ, '1'=SH, '116'=HK, '100'=global, '105'=US) for precise secid construction
  pe?: number;
  pb?: number;
  dy?: number;
  cp?: number; // current price
  chg?: number; // change
  pct?: number; // percentage change
  pePct?: number; // pe percentile
  pbPct?: number; // pb percentile
  history?: { d: string; pe: number; pb: number; dy: number }[];
}

export type ViewType = 'home' | 'ind' | 'sub' | 'comp' | 'search' | 'ai' | 'fav' | 'index' | 'index_list' | 'index_detail';

export interface NavigationState {
  view: ViewType;
  args: any[];
}
