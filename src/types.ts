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

export type ViewType = 'home' | 'ind' | 'sub' | 'comp' | 'search' | 'ai' | 'fav' | 'index' | 'index_list' | 'index_detail';

export interface NavigationState {
  view: ViewType;
  args: any[];
}
