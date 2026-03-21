/**
 * 实时财务数据服务
 * 从东方财富获取股票实时行情和财务指标
 * 使用 JSONP 避免 CORS 问题
 */

// ─── JSONP 工具函数 ───

function jsonp(url: string, callbackName: string, timeoutMs = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`JSONP timeout: ${url}`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      delete (window as any)[callbackName];
      const el = document.getElementById(callbackName);
      if (el) el.remove();
    };

    (window as any)[callbackName] = (data: any) => {
      cleanup();
      resolve(data);
    };

    const script = document.createElement('script');
    script.id = callbackName;
    script.src = url;
    script.onerror = () => {
      cleanup();
      reject(new Error(`JSONP load error: ${url}`));
    };
    document.head.appendChild(script);
  });
}

// ─── 数据类型 ───

export interface CompleteStockData {
  code: string;
  name: string;
  price: number;
  changePct: number;
  pe: number;
  pb: number;
  ps: number;
  dy: number;
  roe: number;
  roa: number;
  eps: number;
  bvps: number;
  mcap: number;         // 总市值（亿）
  fcap: number;         // 流通市值（亿）
  // 财务数据
  revenue: number;      // 营收（亿）
  netIncome: number;    // 净利润（亿）
  operatingCF: number;  // 经营现金流（亿）
  freeCF: number;       // 自由现金流（亿）
  revenueGrowth: number;
  netIncomeGrowth: number;
  grossMargin: number;
  netMargin: number;
  totalDebt: number;
  dividendPerShare: number;
  payoutRatio: number;
  // 历史数据
  history: FinancialSummary | null;
  // 元数据
  source: 'live' | 'cached' | 'static';
  fetchedAt: number;
}

export interface FinancialSummary {
  years: string[];
  revenues: number[];
  netIncomes: number[];
  operatingCFs: number[];
  freeCFs: number[];
  roes: number[];
  epses: number[];
  dividends: number[];
  payoutRatios: number[];
  revenueGrowths: number[];
  netIncomeGrowths: number[];
}

// ─── 东方财富实时行情（JSONP）───

/**
 * 获取单只股票实时估值数据
 * 使用 push2.eastmoney.com JSONP 接口
 */
async function fetchEastmoneyQuote(code: string, market: 'A' | 'HK'): Promise<Partial<CompleteStockData> | null> {
  try {
    const mk = market === 'A'
      ? (code.startsWith('6') ? '1' : '0')
      : '116';
    const secid = `${mk}.${code}`;

    const cbName = `em_quote_${code}_${Date.now()}`;
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f44,f45,f46,f47,f48,f50,f57,f58,f116,f117,f162,f167,f168,f169,f170,f171,f173,f177,f183,f184,f185,f186,f187,f188,f292&cb=${cbName}`;

    const data = await jsonp(url, cbName);
    const d = data?.data;
    if (!d) return null;

    // 东方财富价格字段：大部分 *100，需除以对应精度
    const priceDiv = 100;
    const price = d.f43 != null ? d.f43 / priceDiv : 0;

    return {
      code,
      name: d.f58 || '',
      price,
      changePct: d.f170 != null ? d.f170 / 100 : 0,
      pe: d.f162 != null && d.f162 > 0 ? d.f162 / 100 : 0,
      pb: d.f167 != null && d.f167 > 0 ? d.f167 / 100 : 0,
      ps: d.f173 != null && d.f173 > 0 ? d.f173 / 100 : 0,
      dy: d.f177 != null ? d.f177 / 100 : 0,
      roe: d.f183 != null ? d.f183 / 100 : 0,
      roa: d.f184 != null ? d.f184 / 100 : 0,
      eps: d.f116 != null ? d.f116 / 100 : 0,
      bvps: d.f23 != null ? d.f23 / 100 : 0,
      mcap: d.f116 != null && d.f57 != null ? d.f57 / 100000000 : 0,
      fcap: d.f117 != null ? d.f117 / 100000000 : 0,
      grossMargin: d.f185 != null ? d.f185 / 100 : 0,
      netMargin: d.f186 != null ? d.f186 / 100 : 0,
      totalDebt: d.f52 != null ? d.f52 / 100 : 0,
    };
  } catch (e) {
    console.error(`[fetchEastmoneyQuote] Error for ${code}:`, e);
    return null;
  }
}

/**
 * 获取财务摘要数据（多年度）
 * 使用 datacenter.eastmoney.com 接口
 */
async function fetchFinancialHistory(code: string, market: 'A' | 'HK'): Promise<FinancialSummary | null> {
  try {
    // 东方财富数据中心 - 主要财务指标
    const cbName = `em_fin_${code}_${Date.now()}`;
    const filter = `(SECURITY_CODE="${code}")`;
    const url = `https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName=RPT_F10_FINANCE_MAINFINADATA&columns=SECURITY_CODE,REPORT_DATE,BASIC_EPS,WEIGHTAVG_ROE,OPERATE_INCOME,PARENT_NETPROFIT,YSTZ,SJLTZ,MGJYXJJE,ASSIGNDSCRPT&filter=${encodeURIComponent(filter)}&pageNumber=1&pageSize=5&sortTypes=-1&sortColumns=REPORT_DATE&cb=${cbName}`;

    const data = await jsonp(url, cbName, 10000);
    const items = data?.result?.data;
    if (!items || items.length === 0) return null;

    const summary: FinancialSummary = {
      years: [],
      revenues: [],
      netIncomes: [],
      operatingCFs: [],
      freeCFs: [],
      roes: [],
      epses: [],
      dividends: [],
      payoutRatios: [],
      revenueGrowths: [],
      netIncomeGrowths: [],
    };

    for (const item of items) {
      summary.years.push(item.REPORT_DATE?.substring(0, 4) || '');
      summary.revenues.push((item.OPERATE_INCOME || 0) / 100000000);
      summary.netIncomes.push((item.PARENT_NETPROFIT || 0) / 100000000);
      summary.roes.push(item.WEIGHTAVG_ROE || 0);
      summary.epses.push(item.BASIC_EPS || 0);
      summary.revenueGrowths.push(item.YSTZ || 0);
      summary.netIncomeGrowths.push(item.SJLTZ || 0);
      summary.operatingCFs.push(0);
      summary.freeCFs.push(0);
      summary.dividends.push(0);
      summary.payoutRatios.push(0);
    }

    return summary;
  } catch (e) {
    console.error(`[fetchFinancialHistory] Error for ${code}:`, e);
    return null;
  }
}

// ─── 合并数据源 ───

/**
 * 获取一只股票的完整数据
 * 并行获取：实时行情 + 财务历史
 */
export async function fetchCompleteStockData(
  code: string,
  market: 'A' | 'HK' | 'GLOBAL',
  staticFallback?: { pe?: number; pb?: number; roe?: number; dy?: number; ps?: number; n?: string }
): Promise<CompleteStockData> {
  const result: CompleteStockData = {
    code,
    name: staticFallback?.n || '',
    price: 0,
    changePct: 0,
    pe: staticFallback?.pe || 0,
    pb: staticFallback?.pb || 0,
    ps: staticFallback?.ps || 0,
    dy: staticFallback?.dy || 0,
    roe: staticFallback?.roe || 0,
    roa: 0,
    eps: 0,
    bvps: 0,
    mcap: 0,
    fcap: 0,
    revenue: 0,
    netIncome: 0,
    operatingCF: 0,
    freeCF: 0,
    revenueGrowth: 0,
    netIncomeGrowth: 0,
    grossMargin: 0,
    netMargin: 0,
    totalDebt: 0,
    dividendPerShare: 0,
    payoutRatio: 0,
    history: null,
    source: 'static',
    fetchedAt: Date.now(),
  };

  if (market === 'GLOBAL') return result;

  try {
    // 并行获取
    const [quoteResult, historyResult] = await Promise.allSettled([
      fetchEastmoneyQuote(code, market as 'A' | 'HK'),
      fetchFinancialHistory(code, market as 'A' | 'HK'),
    ]);

    // 合并实时行情
    if (quoteResult.status === 'fulfilled' && quoteResult.value) {
      const q = quoteResult.value;
      if (q.price && q.price > 0) {
        result.price = q.price;
        result.source = 'live';
      }
      result.name = result.name || q.name || '';
      if (q.changePct) result.changePct = q.changePct;
      if (q.pe && q.pe > 0) result.pe = q.pe;
      if (q.pb && q.pb > 0) result.pb = q.pb;
      if (q.ps && q.ps > 0) result.ps = q.ps;
      if (q.dy) result.dy = q.dy;
      if (q.roe) result.roe = q.roe;
      if (q.roa) result.roa = q.roa;
      if (q.eps && q.eps > 0) result.eps = q.eps;
      if (q.bvps && q.bvps > 0) result.bvps = q.bvps;
      if (q.mcap && q.mcap > 0) result.mcap = q.mcap;
      if (q.fcap && q.fcap > 0) result.fcap = q.fcap;
      if (q.grossMargin) result.grossMargin = q.grossMargin;
      if (q.netMargin) result.netMargin = q.netMargin;
      if (q.totalDebt) result.totalDebt = q.totalDebt;
    }

    // 合并历史数据
    if (historyResult.status === 'fulfilled' && historyResult.value) {
      result.history = historyResult.value;
      const h = historyResult.value;

      // 用最新历史数据补全
      if (h.roes.length > 0 && h.roes[0] > 0 && result.roe === 0) result.roe = h.roes[0];
      if (h.epses.length > 0 && h.epses[0] > 0 && result.eps === 0) result.eps = h.epses[0];
      if (h.revenues.length > 0) result.revenue = h.revenues[0];
      if (h.netIncomes.length > 0) result.netIncome = h.netIncomes[0];

      // 计算增长率
      if (h.netIncomes.length >= 2 && h.netIncomes[1] !== 0) {
        result.netIncomeGrowth = ((h.netIncomes[0] - h.netIncomes[1]) / Math.abs(h.netIncomes[1])) * 100;
      }
      if (h.revenues.length >= 2 && h.revenues[1] !== 0) {
        result.revenueGrowth = ((h.revenues[0] - h.revenues[1]) / Math.abs(h.revenues[1])) * 100;
      }

      result.source = result.source === 'live' ? 'live' : 'cached';
    }
  } catch (e) {
    console.error(`[fetchCompleteStockData] Error for ${code}:`, e);
  }

  return result;
}

// ─── 缓存管理 ───

const stockCache = new Map<string, { data: CompleteStockData; expiresAt: number }>();
const CACHE_TTL = 60_000; // 1 分钟

export async function fetchStockDataCached(
  code: string,
  market: 'A' | 'HK' | 'GLOBAL',
  staticFallback?: { pe?: number; pb?: number; roe?: number; dy?: number; ps?: number; n?: string }
): Promise<CompleteStockData> {
  const key = `${market}:${code}`;
  const cached = stockCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const data = await fetchCompleteStockData(code, market, staticFallback);
  stockCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
  return data;
}

export function clearStockCache() {
  stockCache.clear();
}
