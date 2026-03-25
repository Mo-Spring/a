/**
 * 股票财务数据服务
 *
 * 数据分两层：
 * 1. 实时行情（PE/PB/价格/涨跌幅）— 通过 App.tsx 中的 JSONP 10s 轮询
 * 2. 财务报表（三表数据）— 通过本模块获取，存 localStorage，7 天刷新一次
 *
 * 数据源：东方财富 datacenter API（支持 CORS，返回纯 JSON，用 fetch 替代 JSONP）
 */

import type { FinancialStatement, CachedValuationData } from '../valuation/types';

// ─── Fetch 工具（替代 JSONP）──

async function fetchJson(url: string, timeoutMs = 10000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ─── 东方财富：利润表 + 关键指标 ───

async function fetchMainFinanceData(code: string): Promise<any[]> {
  const filter = `(SECURITY_CODE="${code}")`;
  const columns = [
    'SECURITY_CODE', 'REPORT_DATE',
    'EPSJB', 'ROEJQ',
    'TOTALOPERATEREVE', 'MLR',
    'PARENTNETPROFIT', 'KCFJCXSYJLR',
    'TOTALOPERATEREVETZ', 'PARENTNETPROFITTZ',
    'BPS',
  ].join(',');
  const url = `https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName=RPT_F10_FINANCE_MAINFINADATA&columns=${columns}&filter=${encodeURIComponent(filter)}&pageNumber=1&pageSize=8&sortTypes=-1&sortColumns=REPORT_DATE`;
  const data = await fetchJson(url);
  return data?.result?.data || [];
}

// ─── 东方财富：现金流量表 ───

async function fetchCashFlowData(code: string): Promise<Map<string, { operatingCF: number; investingCF: number; financingCF: number; capex: number; dividendPaid: number }>> {
  const result = new Map<string, { operatingCF: number; investingCF: number; financingCF: number; capex: number; dividendPaid: number }>();

  try {
    const filter = `(SECURITY_CODE="${code}")`;
    const columns = 'SECURITY_CODE,REPORT_DATE,NETCASH_OPERATE,NETCASH_INVEST,NETCASH_FINANCE,CONSTRUCT_LONG_ASSET,ASSIGN_DIVIDEND_PORFIT,SUBSIDIARY_PAY_DIVIDEND';
    const url = `https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName=RPT_F10_FINANCE_GCASHFLOW&columns=${columns}&filter=${encodeURIComponent(filter)}&pageNumber=1&pageSize=8&sortTypes=-1&sortColumns=REPORT_DATE`;
    const data = await fetchJson(url);
    const items = data?.result?.data || [];

    for (const item of items) {
      const year = (item.REPORT_DATE || '').substring(0, 4);
      if (!year) continue;

      const operatingCF = (item.NETCASH_OPERATE || 0) / 1e8;
      const investingCF = (item.NETCASH_INVEST || 0) / 1e8;
      const financingCF = (item.NETCASH_FINANCE || 0) / 1e8;
      const capex = Math.abs((item.CONSTRUCT_LONG_ASSET || 0) / 1e8);
      const dividendPaid = Math.abs(((item.ASSIGN_DIVIDEND_PORFIT || 0) + (item.SUBSIDIARY_PAY_DIVIDEND || 0)) / 1e8);

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
    const filter = `(SECURITY_CODE="${code}")`;
    const columns = 'SECURITY_CODE,REPORT_DATE,TOTAL_ASSETS,TOTAL_LIABILITIES,TOTAL_EQUITY,TOTAL_PARENT_EQUITY';
    const url = `https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName=RPT_F10_FINANCE_GBALANCE&columns=${columns}&filter=${encodeURIComponent(filter)}&pageNumber=1&pageSize=8&sortTypes=-1&sortColumns=REPORT_DATE`;
    const data = await fetchJson(url);
    const items = data?.result?.data || [];

    for (const item of items) {
      const year = (item.REPORT_DATE || '').substring(0, 4);
      if (!year) continue;

      result.set(year, {
        totalAssets: (item.TOTAL_ASSETS || 0) / 1e8,
        totalEquity: (item.TOTAL_PARENT_EQUITY || item.TOTAL_EQUITY || 0) / 1e8,
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
    const filter = `(SECURITY_CODE="${code}")`;
    const columns = 'SECURITY_CODE,REPORT_DATE,EPSJB,BPS,ROEJQ';
    const url = `https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName=RPT_F10_FINANCE_MAINFINADATA&columns=${columns}&filter=${encodeURIComponent(filter)}&pageNumber=1&pageSize=8&sortTypes=-1&sortColumns=REPORT_DATE`;
    const data = await fetchJson(url);
    const items = data?.result?.data || [];

    for (const item of items) {
      const year = (item.REPORT_DATE || '').substring(0, 4);
      if (!year) continue;

      result.set(year, {
        eps: item.EPSJB || 0,
        bvps: item.BPS || 0,
        roe: item.ROEJQ || 0,
      });
    }
  } catch (e) {
    console.warn(`[fetchPerShareData] Failed for ${code}:`, e);
  }

  return result;
}

// ─── 整合三表数据 → FinancialStatement[] ───

/** 判断是否为年报 */
function isAnnualReport(reportDate: string): boolean {
  return reportDate.endsWith('12-31') || reportDate.endsWith('12-30');
}

/** 数据 sanity check：防止异常值污染估值 */
function sanitize(val: number, min: number, max: number, fallback = 0): number {
  if (!isFinite(val) || isNaN(val)) return fallback;
  if (val < min || val > max) return fallback;
  return val;
}

export async function fetchFinancialStatements(code: string): Promise<FinancialStatement[]> {
  // 并行获取三表 + 每股指标
  const [mainData, cfData, bsData, psData] = await Promise.all([
    fetchMainFinanceData(code),
    fetchCashFlowData(code),
    fetchBalanceSheetData(code),
    fetchPerShareData(code),
  ]);

  if (mainData.length === 0) return [];

  // 优先保留年报，只取年报数据（避免季报数据与年报口径不同导致合并错误）
  const annualMainData = mainData.filter(item => isAnnualReport(item.REPORT_DATE || ''));
  // 如果年报不足 2 条，回退到全部数据（但仍需去重同一年只取最新）
  const effectiveMainData = annualMainData.length >= 2 ? annualMainData : mainData;

  // 按年份去重：同一年只保留最新的报告期
  const seenYears = new Set<string>();
  const dedupedMainData: any[] = [];
  for (const item of effectiveMainData) {
    const year = (item.REPORT_DATE || '').substring(0, 4);
    if (!year || seenYears.has(year)) continue;
    seenYears.add(year);
    dedupedMainData.push(item);
  }

  // 按年份合并
  const statements: FinancialStatement[] = [];

  for (const item of dedupedMainData) {
    const year = (item.REPORT_DATE || '').substring(0, 4);
    if (!year) continue;

    const isAnnual = isAnnualReport(item.REPORT_DATE || '');

    // 只用年报数据做三表匹配（季报的三表口径不同）
    let cf = { operatingCF: 0, investingCF: 0, financingCF: 0, capex: 0, dividendPaid: 0 };
    let bs = { totalAssets: 0, totalEquity: 0, totalDebt: 0, bvps: 0 };
    let ps = { eps: 0, bvps: 0, roe: 0 };

    // 优先匹配同年年报的三表数据
    for (const [key, val] of cfData) {
      if (key === year) { cf = val; break; }
    }
    for (const [key, val] of bsData) {
      if (key === year) { bs = val; break; }
    }
    for (const [key, val] of psData) {
      if (key === year) { ps = val; break; }
    }

    const revenue = (item.TOTALOPERATEREVE || 0) / 1e8;
    const netIncome = (item.PARENTNETPROFIT || 0) / 1e8;
    const grossProfit = (item.MLR || 0) / 1e8;
    const costOfRevenue = grossProfit > 0 ? revenue - grossProfit : 0;
    const operatingProfit = netIncome;

    const reportDate = item.REPORT_DATE || '';

    // Sanity checks
    const safeTotalAssets = sanitize(bs.totalAssets, 0, 1e8, 0);
    const safeTotalDebt = sanitize(bs.totalDebt, 0, 1e8, 0);
    const safeRevenue = sanitize(revenue, 0, 1e6, 0);
    const safeNetIncome = sanitize(netIncome, -1e5, 1e5, 0);
    const safeDebtRatio = safeTotalAssets > 0 ? sanitize((safeTotalDebt / safeTotalAssets) * 100, 0, 100, 0) : 0;

    statements.push({
      year,
      reportDate,
      revenue: safeRevenue,
      costOfRevenue: sanitize(costOfRevenue, 0, 1e6, 0),
      grossProfit: sanitize(grossProfit, -1e6, 1e6, 0),
      operatingProfit: sanitize(operatingProfit, -1e6, 1e6, 0),
      netIncome: safeNetIncome,
      eps: sanitize(ps.eps || item.EPSJB || 0, -1000, 1000, 0),
      totalAssets: safeTotalAssets,
      totalEquity: sanitize(bs.totalEquity, 0, 1e8, 0),
      totalDebt: safeTotalDebt,
      bvps: sanitize(bs.bvps || ps.bvps || 0, 0, 10000, 0),
      operatingCF: sanitize(cf.operatingCF, -1e6, 1e6, 0),
      investingCF: sanitize(cf.investingCF, -1e6, 1e6, 0),
      financingCF: sanitize(cf.financingCF, -1e6, 1e6, 0),
      capex: sanitize(cf.capex, 0, 1e6, 0),
      freeCF: sanitize(cf.operatingCF - cf.capex, -1e6, 1e6, 0),
      dividendPaid: sanitize(cf.dividendPaid, 0, 1e6, 0),
      roe: sanitize(ps.roe || item.ROEJQ || 0, -50, 100, 0),
      roa: safeTotalAssets > 0 ? sanitize((safeNetIncome / safeTotalAssets) * 100, -50, 50, 0) : 0,
      grossMargin: safeRevenue > 0 ? sanitize((grossProfit / safeRevenue) * 100, -100, 100, 0) : 0,
      netMargin: safeRevenue > 0 ? sanitize((safeNetIncome / safeRevenue) * 100, -100, 100, 0) : 0,
      debtRatio: safeDebtRatio,
      revenueGrowth: sanitize(item.TOTALOPERATEREVETZ || 0, -100, 1000, 0),
      netIncomeGrowth: sanitize(item.PARENTNETPROFITTZ || 0, -100, 1000, 0),
      payoutRatio: safeNetIncome > 0 ? sanitize((cf.dividendPaid / safeNetIncome) * 100, 0, 100, 0) : 0,
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
    if (Date.now() - cached.fetchedAt > cached.ttl) return null;
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
  const cached = loadFromCache(code);
  if (cached && cached.length > 0) {
    const raw = localStorage.getItem(getCacheKey(code));
    if (raw) {
      try {
        const c: CachedValuationData = JSON.parse(raw);
        if (Date.now() - c.fetchedAt > 24 * 60 * 60 * 1000) {
          fetchFinancialStatements(code).then(stmts => {
            if (stmts.length > 0) saveToCache(code, stmts);
          }).catch(() => {});
        }
      } catch {}
    }
    return cached;
  }

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
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }
}
