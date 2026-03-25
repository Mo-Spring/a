/**
 * 个股 PE/PB 百分位 Hook
 *
 * 数据源：东方财富 RPT_VALUEANALYSIS_DET（历史 PE_TTM / PB_MRQ）
 * 策略：
 *   - 仅在进入个股详情页时触发
 *   - localStorage 缓存 7 天
 *   - 取近 ~2000 个交易日（约 8 年）计算百分位
 */

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { MarketData } from '../types/market';

const CACHE_PREFIX = 'iv_pct_';
const TTL = 7 * 24 * 60 * 60 * 1000; // 7 天

interface PercentileCache {
  pePct: number;
  pbPct: number;
  fetchedAt: number;
  sampleSize: number;
}

function loadCache(code: string): PercentileCache | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + code);
    if (!raw) return null;
    const c: PercentileCache = JSON.parse(raw);
    if (Date.now() - c.fetchedAt > TTL) return null;
    return c;
  } catch { return null; }
}

function saveCache(code: string, data: PercentileCache): void {
  try { localStorage.setItem(CACHE_PREFIX + code, JSON.stringify(data)); } catch {}
}

/** 计算 value 在 sorted 数组中的百分位（0~1） */
function percentile(sorted: number[], value: number): number {
  if (sorted.length === 0) return 0;
  let count = 0;
  for (const v of sorted) { if (v <= value) count++; else break; }
  return count / sorted.length;
}

async function fetchAndCompute(code: string): Promise<PercentileCache | null> {
  const url = `https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName=RPT_VALUEANALYSIS_DET&columns=SECURITY_CODE,TRADE_DATE,PE_TTM,PB_MRQ&filter=(SECURITY_CODE%3D%22${code}%22)&pageNumber=1&pageSize=2000&sortTypes=-1&sortColumns=TRADE_DATE`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const items: any[] = json?.result?.data || [];
    if (items.length < 30) return null; // 数据太少，无意义

    // 当前值 = 最新一条
    const latest = items[0];
    const currentPE = latest.PE_TTM;
    const currentPB = latest.PB_MRQ;

    // 收集有效历史值（排除负数和极端异常值）
    const histPE: number[] = [];
    const histPB: number[] = [];
    for (const item of items) {
      const pe = item.PE_TTM;
      const pb = item.PB_MRQ;
      if (typeof pe === 'number' && pe > 0 && pe < 500) histPE.push(pe);
      if (typeof pb === 'number' && pb > 0 && pb < 100) histPB.push(pb);
    }

    histPE.sort((a, b) => a - b);
    histPB.sort((a, b) => a - b);

    const pePct = (typeof currentPE === 'number' && currentPE > 0)
      ? Math.round(percentile(histPE, currentPE) * 100) : 0;
    const pbPct = (typeof currentPB === 'number' && currentPB > 0)
      ? Math.round(percentile(histPB, currentPB) * 100) : 0;

    return { pePct, pbPct, fetchedAt: Date.now(), sampleSize: items.length };
  } catch (e) {
    console.warn(`[useStockPercentiles] Failed for ${code}:`, e);
    return null;
  }
}

export function useStockPercentiles(
  code: string | undefined,
  setBatchData: Dispatch<SetStateAction<Record<string, MarketData>>>,
) {
  useEffect(() => {
    if (!code) return;

    // 先查缓存
    const cached = loadCache(code);
    if (cached) {
      setBatchData(prev => ({
        ...prev,
        [code]: { ...prev[code], pePct: cached.pePct, pbPct: cached.pbPct },
      }));
      return;
    }

    // 拉取并计算
    let cancelled = false;
    fetchAndCompute(code).then(result => {
      if (cancelled || !result) return;
      saveCache(code, result);
      setBatchData(prev => ({
        ...prev,
        [code]: { ...prev[code], pePct: result.pePct, pbPct: result.pbPct },
      }));
    });

    return () => { cancelled = true; };
  }, [code, setBatchData]);
}
