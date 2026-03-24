/**
 * 股票财务数据服务
 *
 * 数据分两层：
 * 1. 实时行情（PE/PB/价格/涨跌幅）— 通过 App.tsx 中的 JSONP 10s 轮询
 * 2. 财务报表（三表数据）— 通过本模块获取，存 localStorage，7 天刷新一次
 *
 * 数据源：东方财富 datacenter JSONP API
 */

import type { FinancialStatement, CachedValuationData } from '../valuation/types';

// ─── JSONP 工具 ───

function jsonp(url: string, callbackName: string, timeoutMs = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`JSONP timeout`));
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
    script.onerror = () => { cleanup(); reject(new Error('JSONP load error')); };
    document.head.appendChild(script);
  });
}

// ─── 东方财富：利润表 + 关键指标 ───

async function fetchMainFinanceData(code: string): Promise<any[]> {
  const cbName = `fin_main_${code}_${Date.now()}`;
  const filter = `(SECURITY_CODE="${code}")`;
  const columns = [
    'SECURITY_CODE', 'REPORT_DATE',
    'BASIC_EPS', 'WEIGHTAVG_ROE',
    'OPERATE_INCOME', 'TOTAL_OPERATE_INCOME',
    'OPERATE_COST', 'OPERATE_EXPENSE',
    'PARENT_NETPROFIT', 'YSTZ', 'SJLTZ',
    'TOI_SAME', 'PARENT_SAME',
    'ASSIGNDSCRPT', 'NETPROFIT',
  ].join(',');
  const url = `https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName=RPT_F10_FINANCE_MAINFINADATA&columns=${columns}&filter=${encodeURIComponent(filter)}&pageNumber=1&pageSize=8&sortTypes=-1&sortColumns=REPORT_DATE&cb=${cbName}`;
  const data = await jsonp(url, cbName);
  return data?.result?.data || [];
}

// ─── 东方财富：现金流量表 ───

async function fetchCashFlowData(code: string): Promise<Map<string, { operatingCF: number; investingCF: number; financingCF: number; capex: number; dividendPaid: number }>> {
  const result = new Map<string, { operatingCF: number; investingCF: number; financingCF: number; capex: number; dividendPaid: number }>();

  try {
    const cbName = `fin_cf_${code}_${Date.now()}`;
    const filter = `(SECURITY_CODE="${code}")`;
    // 现金流量表关键字段
    const columns = 'SECURITY_CODE,REPORT_DATE,NETCASH_OPERATE,NETCASH_INVEST,NETCASH_FINANCE,CASH_RELATED,PURCHASE_FIXED_ASSETS,CONSTRUCT_FIXED_ASSETS,DIV_PROF_INTEREST_PAID';
    const url = `https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName=RPT_F10_FINANCE_GCASHFLOW&columns=${columns}&filter=${encodeURIComponent(filter)}&pageNumber=1&pageSize=8&sortTypes=-1&sortColumns=REPORT_DATE&cb=${cbName}`;
    const data = await jsonp(url, cbName);
    const items = data?.result?.data || [];

    for (const item of items) {
      const year = (item.REPORT_DATE || '').substring(0, 4);
      if (!year) continue;

      const operatingCF = (item.NETCASH_OPERATE || 0) / 1e8;
      const investingCF = (item.NETCASH_INVEST || 0) / 1e8;
      const financingCF = (item.NETCASH_FINANCE || 0) / 1e8;
      // 资本支出：购建固定资产等
      const capex = Math.abs(((item.PURCHASE_FIXED_ASSETS || 0) + (item.CONSTRUCT_FIXED_ASSETS || 0)) / 1e8);
      // 分红支出
      const dividendPaid = Math.abs((item.DIV_PROF_INTEREST_PAID || 0) / 1e8);

      result.set(year, { operatingCF, investingCF, financingCF, capex, dividendPaid });
    }
  } catch (e) {
    console.warn(`[fetchCashFlowData] Failed for ${code}:`, e);
  }

  return result;
}

// ─── 东方财富：资产负债表 ───

async function fetchBalanceSheetData(code: string): Promise<Map<string, { totalAssets: number; totalEquity: number; totalDebt: number; bvps: number }>> {
  const result = new Map<string, { totalAssets: number; totalEquity: number; totalDebt: number; bvps: number }>();

  try {
    const cbName = `fin_bs_${code}_${Date.now()}`;
    const filter = `(SECURITY_CODE="${code}")`;
    const columns = 'SECURITY_CODE,REPORT_DATE,TOTAL_ASSETS,TOTAL_LIABILITIES,TOTAL_EQUITY,PARENT_EQUITY,BPS';
    const url = `https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName=RPT_F10_FINANCE_GBALANCE&columns=${columns}&filter=${encodeURIComponent(filter)}&pageNumber=1&pageSize=8&sortTypes=-1&sortColumns=REPORT_DATE&cb=${cbName}`;
    const data = await jsonp(url, cbName);
    const items = data?.result?.data || [];

    for (const item of items) {
      const year = (item.REPORT_DATE || '').substring(0, 4);
      if (!year) continue;

      result.set(year, {
        totalAssets: (item.TOTAL_ASSETS || 0) / 1e8,
        totalEquity: (item.PARENT_EQUITY || item.TOTAL_EQUITY || 0) / 1e8,
        totalDebt: (item.TOTAL_LIABILITIES || 0) / 1e8,
        bvps: item.BPS || 0,
      });
    }
  } catch (e) {
    console.warn(`[fetchBalanceSheetData] Failed for ${code}:`, e);
  }

  return result;
}

// ─── 东方财富：每股指标 ───

async function fetchPerShareData(code: string): Promise<Map<string, { eps: number; bvps: number; roe: number }>> {
  const result = new Map<string, { eps: number; bvps: number; roe: number }>();

  try {
    const cbName = `fin_ps_${code}_${Date.now()}`;
    const filter = `(SECURITY_CODE="${code}")`;
    const columns = 'SECURITY_CODE,REPORT_DATE,BASIC_EPS,BPS,WEIGHTAVG_ROE';
    const url = `https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName=RPT_F10_FINANCE_MAINFINADATA&columns=${columns}&filter=${encodeURIComponent(filter)}&pageNumber=1&pageSize=8&sortTypes=-1&sortColumns=REPORT_DATE&cb=${cbName}`;
    const data = await jsonp(url, cbName);
    const items = data?.result?.data || [];

    for (const item of items) {
      const year = (item.REPORT_DATE || '').substring(0, 4);
      if (!year) continue;

      result.set(year, {
        eps: item.BASIC_EPS || 0,
        bvps: item.BPS || 0,
        roe: item.WEIGHTAVG_ROE || 0,
      });
    }
  } catch (e) {
    console.warn(`[fetchPerShareData] Failed for ${code}:`, e);
  }

  return result;
}

// ─── 整合三表数据 → FinancialStatement[] ───

export async function fetchFinancialStatements(code: string): Promise<FinancialStatement[]> {
  // 并行获取三表 + 每股指标
  const [mainData, cfData, bsData, psData] = await Promise.all([
    fetchMainFinanceData(code),
    fetchCashFlowData(code),
    fetchBalanceSheetData(code),
    fetchPerShareData(code),
  ]);

  if (mainData.length === 0) return [];

  // 按年份合并
  const statements: FinancialStatement[] = [];

  for (const item of mainData) {
    const year = (item.REPORT_DATE || '').substring(0, 4);
    if (!year) continue;

    const cf = cfData.get(year) || { operatingCF: 0, investingCF: 0, financingCF: 0, capex: 0, dividendPaid: 0 };
    const bs = bsData.get(year) || { totalAssets: 0, totalEquity: 0, totalDebt: 0, bvps: 0 };
    const ps = psData.get(year) || { eps: 0, bvps: 0, roe: 0 };

    const revenue = (item.OPERATE_INCOME || item.TOTAL_OPERATE_INCOME || 0) / 1e8;
    const netIncome = (item.PARENT_NETPROFIT || item.NETPROFIT || 0) / 1e8;
    const costOfRevenue = (item.OPERATE_COST || 0) / 1e8;
    const grossProfit = revenue - costOfRevenue;
    const operatingProfit = (item.NETPROFIT || 0) / 1e8; // 简化

    // 优先用年报数据（12-31），如果没有则用最新报告期
    const reportDate = item.REPORT_DATE || '';

    statements.push({
      year,
      reportDate,
      revenue,
      costOfRevenue,
      grossProfit,
      operatingProfit,
      netIncome,
      eps: ps.eps || item.BASIC_EPS || 0,
      totalAssets: bs.totalAssets,
      totalEquity: bs.totalEquity,
      totalDebt: bs.totalDebt,
      bvps: bs.bvps || ps.bvps || 0,
      operatingCF: cf.operatingCF,
      investingCF: cf.investingCF,
      financingCF: cf.financingCF,
      capex: cf.capex,
      freeCF: cf.operatingCF - cf.capex,
      dividendPaid: cf.dividendPaid,
      roe: ps.roe || item.WEIGHTAVG_ROE || 0,
      roa: bs.totalAssets > 0 ? (netIncome / bs.totalAssets) * 100 : 0,
      grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      netMargin: revenue > 0 ? (netIncome / revenue) * 100 : 0,
      debtRatio: bs.totalAssets > 0 ? (bs.totalDebt / bs.totalAssets) * 100 : 0,
      revenueGrowth: item.YSTZ || 0,
      netIncomeGrowth: item.SJLTZ || 0,
      payoutRatio: netIncome > 0 ? (cf.dividendPaid / netIncome) * 100 : 0,
    });
  }

  return statements;
}

// ─── localStorage 缓存 ───

const CACHE_PREFIX = 'iv_fin_';
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 天

function getCacheKey(code: string): string {
  return `${CACHE_PREFIX}${code}`;
}

function loadFromCache(code: string): FinancialStatement[] | null {
  try {
    const raw = localStorage.getItem(getCacheKey(code));
    if (!raw) return null;
    const cached: CachedValuationData = JSON.parse(raw);
    if (Date.now() - cached.fetchedAt > cached.ttl) return null; // 过期
    return cached.statements;
  } catch {
    return null;
  }
}

function saveToCache(code: string, statements: FinancialStatement[]): void {
  try {
    const data: CachedValuationData = {
      code,
      statements,
      fetchedAt: Date.now(),
      ttl: DEFAULT_TTL,
    };
    localStorage.setItem(getCacheKey(code), JSON.stringify(data));
  } catch (e) {
    console.warn('[saveToCache] Failed:', e);
  }
}

/** 带缓存的获取财务报表 */
export async function fetchFinancialStatementsCached(code: string): Promise<FinancialStatement[]> {
  // 1. 先查缓存
  const cached = loadFromCache(code);
  if (cached && cached.length > 0) {
    // 后台静默刷新（超过 1 天）
    const raw = localStorage.getItem(getCacheKey(code));
    if (raw) {
      try {
        const c: CachedValuationData = JSON.parse(raw);
        if (Date.now() - c.fetchedAt > 24 * 60 * 60 * 1000) {
          // 后台刷新
          fetchFinancialStatements(code).then(stmts => {
            if (stmts.length > 0) saveToCache(code, stmts);
          }).catch(() => {});
        }
      } catch {}
    }
    return cached;
  }

  // 2. 缓存没有，实时获取
  const statements = await fetchFinancialStatements(code);
  if (statements.length > 0) {
    saveToCache(code, statements);
  }
  return statements;
}

/** 清除某只股票的缓存 */
export function clearFinancialCache(code?: string): void {
  if (code) {
    localStorage.removeItem(getCacheKey(code));
  } else {
    // 清除所有财务缓存
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }
}
