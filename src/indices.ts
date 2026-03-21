import { Index } from './types';

export const DEFAULT_INDICES: Index[] = [
  // A-Share (SH: market id '1', SZ: market id '0')
  { c: '000300', n: '沪深300', m: 'A', mk: '1' },
  { c: '000001', n: '上证指数', m: 'A', mk: '1' },
  { c: '399001', n: '深证成指', m: 'A', mk: '0' },
  { c: '399006', n: '创业板指', m: 'A', mk: '0' },
  { c: '000688', n: '科创50', m: 'A', mk: '1' },
  { c: '000852', n: '中证1000', m: 'A', mk: '1' },
  
  // HK-Share (market id '100' for HSI family, '116' for others)
  { c: 'HSI', n: '恒生指数', m: 'HK', mk: '100' },
  { c: 'HSCEI', n: '恒生中国企业指数', m: 'HK', mk: '100' },
  { c: 'HSTECH', n: '恒生科技指数', m: 'HK', mk: '100' },
  
  // Global Indices (market id '100' for most)
  { c: 'DJI', n: '道琼斯', m: 'GLOBAL', mk: '100' },
  { c: 'IXIC', n: '纳斯达克', m: 'GLOBAL', mk: '100' },
  { c: 'INX', n: '标普500', m: 'GLOBAL', mk: '100' },
  { c: 'N225', n: '日经225', m: 'GLOBAL', mk: '100' },
  { c: 'KS11', n: '韩国综合', m: 'GLOBAL', mk: '100' },
  { c: 'FTSE', n: '英国富时100', m: 'GLOBAL', mk: '100' },
  { c: 'GDAXI', n: '德国DAX', m: 'GLOBAL', mk: '100' },
  { c: 'FCHI', n: '法国CAC40', m: 'GLOBAL', mk: '100' },
  { c: 'NSEI', n: '印度Nifty50', m: 'GLOBAL', mk: '100' },
  { c: 'BVSP', n: '巴西Bovespa', m: 'GLOBAL', mk: '100' },
];
