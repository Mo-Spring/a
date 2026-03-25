/**
 * 批量行情数据 Hook
 *
 * 职责：
 * - 定期拉取所有行业成分股 + 板块指数 + 用户指数的实时行情
 * - 定期拉取行业关联指数的行情（plain key 存储，和 fetchBatch 统一）
 *
 * 刷新间隔：10s（实时行情需要及时更新）
 *
 * 数据源：东方财富 push2 JSONP API
 */

import { useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';import { Industry, Index } from '../types';
import { MarketData } from '../types/market';
import { jsonp, cleanupAllJsonp } from '../utils/jsonp';

/** 东方财富 push2 字段解析 */
function parsePush2Item(item: any): { code: string; data: MarketData } {
  let code: string = item.f12;
  if (code === 'UDI') code = 'DJI';
  if (code === 'SPX') code = 'INX';
  if (code === 'KOSPI') code = 'KS11';
  if (code === 'NIFTY') code = 'NSEI';

  const mkId = item.f13;
  const pScale = mkId === 116 ? 1000 : 100;
  const val = (f: any, div = 1) => (f !== '-' && f !== undefined && f !== null) ? f / div : undefined;
  const valPos = (f: any, div = 1) => { const v = val(f, div); return v !== undefined && v > 0 ? v : undefined; };

  return {
    code,
    data: {
      p: item.f2 !== '-' && item.f2 !== undefined ? (item.f2 / pScale).toFixed(mkId === 116 ? 3 : 2) : undefined,
      cp: item.f3 !== '-' && item.f3 !== undefined ? (item.f3 / 100).toFixed(2) : undefined,
      pe: valPos(item.f9, 100),
      pb: valPos(item.f23, 100),
      dy: valPos(item.f133),
      ps: valPos(item.f188, 100),
      roe: val(item.f37),
      eps: valPos(item.f112),
      mcap: valPos(item.f20, 100000000),
      fcap: valPos(item.f117),
      debt: val(item.f57),
      pePct: valPos(item.f137),
      pbPct: valPos(item.f138),
      dividendPerShare: (item.f133 !== '-' && item.f133 !== undefined && item.f133 > 0 && item.f2 > 0)
        ? (item.f2 / pScale) * (item.f133 / 100) : undefined,
    },
  };
}

/** 构建 secid 列表 */
function buildSecids(
  allIndustries: Industry[],
  indices: Index[],
): string[] {
  const allCodes = allIndustries.flatMap(ind => ind.l2.flatMap(sub => sub.cs));
  const bkCodes = allIndustries.filter(ind => ind.bk).map(ind => ({ c: ind.bk, market: 'BK' as const }));
  const userIdxCodes = indices.map(idx => ({ c: idx.c, market: 'IDX' as const, mk: idx.mk, m: idx.m }));
  const combined = [...allCodes, ...bkCodes, ...userIdxCodes];
  if (combined.length === 0) return [];

  const fallbackMap: Record<string, string> = {
    DJI: '100.UDI', IXIC: '100.IXIC', INX: '100.SPX', N225: '100.N225',
    KS11: '100.KOSPI', FTSE: '100.FTSE', GDAXI: '100.GDAXI', FCHI: '100.FCHI',
    NSEI: '100.NIFTY', BVSP: '100.BVSP',
  };

  return combined.map(c => {
    if (c.market === 'BK') return `90.${c.c}`;
    if (c.market === 'IDX') {
      if (c.m === 'GLOBAL') return `100.${c.c}`;
      if (c.m === 'HK') {
        if (['HSI', 'HSCEI', 'HSTECH'].includes(c.c)) return `100.${c.c}`;
        return c.mk ? `${c.mk}.${c.c}` : `116.${c.c}`;
      }
      if (c.mk) return `${c.mk}.${c.c}`;
      const mk = (c.c.startsWith('399') || c.c.startsWith('159')) ? '0' : '1';
      return `${mk}.${c.c}`;
    }
    if (c.market === 'HK') {
      if (['HSI', 'HSCEI', 'HSTECH'].includes(c.c)) return `100.${c.c}`;
      return `116.${c.c}`;
    }
    if (c.market === 'GLOBAL') return fallbackMap[c.c] || `105.${c.c}`;
    const mk = c.c.startsWith('6') ? '1' : '0';
    return `${mk}.${c.c}`;
  });
}

const BATCH_FIELDS = 'f2,f3,f9,f12,f13,f14,f20,f23,f37,f57,f112,f113,f116,f117,f133,f137,f138,f188';
const CHUNK_SIZE = 100;

export function useBatchData(
  allIndustries: Industry[],
  indices: Index[],
  allCodesStr: string,
  setBatchData: Dispatch<SetStateAction<Record<string, MarketData>>>,
) {
  // 主批量行情
  const fetchBatch = useCallback(async () => {
    const secidsList = buildSecids(allIndustries, indices);
    if (secidsList.length === 0) return;

    const applyResults = (diff: any[]) => {
      setBatchData(prev => {
        const next = { ...prev };
        diff.forEach((item: any) => {
          const { code, data } = parsePush2Item(item);
          next[code] = { ...next[code], ...data };
        });
        return next;
      });
    };

    for (let i = 0; i < secidsList.length; i += CHUNK_SIZE) {
      const chunk = secidsList.slice(i, i + CHUNK_SIZE).join(',');
      try {
        const d = await jsonp(
          `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${chunk}&fields=${BATCH_FIELDS}&cb=jsonp_batch`,
          {
            timeout: 15000,
            fetchFallback: `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${chunk}&fields=${BATCH_FIELDS}`,
          },
        );
        if (d?.data?.diff) applyResults(d.data.diff);
      } catch (e) {
        if ((e as Error).message !== 'duplicate') {
          console.warn(`[BatchData] chunk ${i} failed:`, e);
        }
      }
    }
  }, [allCodesStr, setBatchData]);

  // 行业关联指数行情（用完整字段，存 plain key，和 fetchBatch 统一）
  const fetchIndustryIndices = useCallback(async () => {
    const allIndustryIndices = [...new Map(
      allIndustries.flatMap(ind => ind.indices || []).map(idx => [idx.c, idx])
    ).values()];
    if (allIndustryIndices.length === 0) return;

    const secids = allIndustryIndices.map(idx => {
      let mk: string;
      if (['HSTECH', 'HSI', 'HSCEI'].includes(idx.c)) mk = '100';
      else if (idx.c.startsWith('399') || idx.c.startsWith('159')) mk = '0';
      else mk = '1';
      return `${mk}.${idx.c}`;
    }).join(',');

    try {
      const d = await jsonp(
        `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${secids}&fields=${BATCH_FIELDS}&cb=jsonp_indidx`,
        { timeout: 10000 },
      );
      if (d?.data?.diff) {
        setBatchData(prev => {
          const next = { ...prev };
          d.data.diff.forEach((item: any) => {
            const code = item.f12;
            const mkId = item.f13;
            const pScale = mkId === 116 ? 1000 : 100;
            const val = (f: any, div = 1) => (f !== '-' && f !== undefined && f !== null) ? f / div : undefined;
            const valPos = (f: any, div = 1) => { const v = val(f, div); return v !== undefined && v > 0 ? v : undefined; };
            // 存 plain key（不用 idx_ 前缀），和 fetchBatch 保持一致
            next[code] = {
              p: item.f2 !== '-' && item.f2 !== undefined ? (item.f2 / pScale).toFixed(2) : undefined,
              cp: item.f3 !== '-' && item.f3 !== undefined ? (item.f3 / 100).toFixed(2) : undefined,
              pe: valPos(item.f9, 100),
              pb: valPos(item.f23, 100),
              dy: valPos(item.f133),
              ps: valPos(item.f188, 100),
              mcap: valPos(item.f20, 100000000),
              // 保留已有字段（fetchBatch 可能已写入更完整的数据）
              ...next[code],
            };
          });
          return next;
        });
      }
    } catch (e) {
      if ((e as Error).message !== 'duplicate') console.warn('[IndIdx] failed:', e);
    }
  }, [allCodesStr, setBatchData]);

  useEffect(() => {
    fetchBatch();
    fetchIndustryIndices();

    const batchTimer = setInterval(fetchBatch, 10000);
    const idxTimer = setInterval(fetchIndustryIndices, 10000);

    return () => {
      clearInterval(batchTimer);
      clearInterval(idxTimer);
      cleanupAllJsonp();
    };
  }, [fetchBatch, fetchIndustryIndices]);
}
