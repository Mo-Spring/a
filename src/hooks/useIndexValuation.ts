/**
 * 指数估值 Hook
 *
 * 职责：从多数据源获取指数的 PE/PB/百分位/估值判断
 *
 * 数据优先级：
 * 1. 蛋卷基金 API（最全，含 evaType 判断）
 * 2. 东方财富单品种接口（补充价格和缺失的 PE/PB）
 * 3. 新浪成分股推算（仅 A 股，最后兜底）
 *
 * 刷新间隔：
 * - 蛋卷 + eastmoney 补充：60s（估值数据变化慢）
 * - 专用指数逐个 JSONP：60s（获取实时价格/涨跌幅）
 * - 新浪推算：延迟 5s 后执行一次
 */

import { useEffect, useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { Index } from '../types';
import { IndexValuationData } from '../types/market';
import { jsonp, cleanupAllJsonp } from '../utils/jsonp';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

const djApiBase = Capacitor.isNativePlatform() ? 'https://danjuanfunds.com' : '';
const sinaApiBase = Capacitor.isNativePlatform() ? 'https://vip.stock.finance.sina.com.cn' : '/sina-api';

/** 判断 secid 前缀 */
function getSecid(idx: Index): string | null {
  if (idx.mk) return `${idx.mk}.${idx.c}`;
  if (idx.m === 'GLOBAL') return `100.${idx.c}`;
  if (idx.m === 'HK') return `116.${idx.c}`;
  if (idx.c.startsWith('6') || idx.c.startsWith('000') || idx.c.startsWith('930') || idx.c.startsWith('H')) return `1.${idx.c}`;
  if (idx.c.startsWith('399') || idx.c.startsWith('159')) return `0.${idx.c}`;
  return `1.${idx.c}`;
}

export function useIndexValuation(
  indices: Index[],
  allIndexCodes: string,
  setIndexVal: Dispatch<SetStateAction<Record<string, IndexValuationData>>>,
) {
  // 引用最新 indices 用于闭包内访问
  const indicesRef = useRef(indices);
  useEffect(() => { indicesRef.current = indices; }, [indices]);

  // ─── 1. 蛋卷基金 API ───
  const fetchDanjuan = useCallback(async () => {
    try {
      let djData: any;
      if (Capacitor.isNativePlatform()) {
        const resp = await CapacitorHttp.get({ url: `${djApiBase}/djapi/index_eva/dj` });
        djData = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
      } else {
        const resp = await fetch(`${djApiBase}/djapi/index_eva/dj`);
        djData = await resp.json();
      }

      if (djData?.data?.items?.length > 0) {
        const matchedCodes = new Set<string>();
        const newVal: Record<string, Partial<IndexValuationData>> = {};

        for (const idx of indicesRef.current) {
          const match = djData.data.items.find((item: any) => {
            const djCode = (item.index_code || '').replace(/^(SH|SZ|HK|CSI)/, '');
            return djCode === idx.c || item.index_code === idx.c;
          });
          if (match) {
            matchedCodes.add(idx.c);
            newVal[idx.c] = {
              pe: match.pe > 0 ? match.pe : undefined,
              pb: match.pb > 0 ? match.pb : undefined,
              dy: (match.yeild || match.dy) > 0 ? (match.yeild || match.dy) : undefined,
              pePct: (match.pe_percentile || match.pePct) > 0 ? (match.pe_percentile || match.pePct) : undefined,
              pbPct: (match.pb_percentile || match.pbPct) > 0 ? (match.pb_percentile || match.pbPct) : undefined,
              roe: match.roe > 0 ? match.roe : undefined,
              peg: match.peg > 0 ? match.peg : undefined,
              evaType: match.eva_type || undefined,
              bondYield: match.bond_yeild > 0 ? match.bond_yeild : undefined,
              peOverHistory: match.pe_over_history > 0 ? match.pe_over_history : undefined,
              pbOverHistory: match.pb_over_history > 0 ? match.pb_over_history : undefined,
              evaTypeInt: match.eva_type_int !== undefined ? match.eva_type_int : undefined,
              date: match.date || undefined,
            };
          }
        }

        setIndexVal(prev => {
          const merged = { ...prev };
          for (const [code, val] of Object.entries(newVal)) {
            merged[code] = { ...(prev[code] || {}), ...val };
          }
          return merged;
        });

        // 对蛋卷未覆盖的指数，用 eastmoney 补充
        const missing = indicesRef.current.filter(idx => !matchedCodes.has(idx.c));
        for (const idx of missing) {
          await fetchEastmoneySingle(idx);
        }
      }
    } catch (e) {
      console.warn('[IndexVal] Danjuan API failed:', e);
    }
  }, [setIndexVal]);

  // ─── 2. 东方财富单品种补充 ───
  const fetchEastmoneySingle = useCallback(async (idx: Index) => {
    const secid = getSecid(idx);
    if (!secid) return;

    try {
      const priceScale = idx.m === 'HK' ? 1000 : 100;
      const d = await jsonp(
        `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f2,f3,f9,f23,f162,f167,f173&cb=jsonp_ixval`,
        { timeout: 8000 },
      );

      if (d?.data) {
        const pe = d.data.f162 !== undefined && d.data.f162 !== '-' && d.data.f162 > 0 ? d.data.f162 / 100 :
                   d.data.f9 !== undefined && d.data.f9 !== '-' && d.data.f9 > 0 ? d.data.f9 / 100 : undefined;
        const pb = d.data.f167 !== undefined && d.data.f167 !== '-' && d.data.f167 > 0 ? d.data.f167 / 100 :
                   d.data.f23 !== undefined && d.data.f23 !== '-' && d.data.f23 > 0 ? d.data.f23 / 100 : undefined;
        const dy = d.data.f173 !== undefined && d.data.f173 !== '-' && d.data.f173 > 0 ? d.data.f173 / 100 : undefined;
        const p = d.data.f2 !== undefined && d.data.f2 !== '-' ? (d.data.f2 / priceScale).toFixed(2) : undefined;
        const cp = d.data.f3 !== undefined && d.data.f3 !== '-' ? (d.data.f3 / 100).toFixed(2) : undefined;

        if (pe || pb || p) {
          setIndexVal(prev => {
            const existing = prev[idx.c] || {};
            const update: Partial<IndexValuationData> = {};
            if (p) update.p = p;
            if (cp) update.cp = cp;
            // GLOBAL 指数必须用 eastmoney 数据（蛋卷不覆盖）
            if (idx.m === 'GLOBAL') {
              if (pe) update.pe = pe;
              if (pb) update.pb = pb;
              if (dy !== undefined) update.dy = dy;
            } else {
              if (pe && !existing.pe) update.pe = pe;
              if (pb && !existing.pb) update.pb = pb;
              if (dy !== undefined && !existing.dy) update.dy = dy;
            }
            return { ...prev, [idx.c]: { ...existing, ...update } };
          });
        }
      }
    } catch {}
  }, [setIndexVal]);

  // ─── 3. 新浪成分股推算（仅 A 股兜底） ───
  const fetchSinaComputed = useCallback(async () => {
    for (const idx of indicesRef.current) {
      // 只对已有数据的跳过
      setIndexVal(prev => {
        const iv = prev[idx.c];
        if (iv?.pe && iv.pe > 0) return prev; // 已有数据
        if (idx.m !== 'A') return prev; // 只处理 A 股

        // 触发异步计算（不能在 reducer 里做异步，所以先标记再外发）
        return prev;
      });

      // 检查是否需要计算
      const needsCompute = !document.querySelector(`[data-idx-computed="${idx.c}"]`);
      if (!needsCompute) continue;

      try {
        const resp = await fetch(`${sinaApiBase}/corp/go.php/vII_NewestComponent/indexid/${idx.c}.phtml`);
        const buf = await resp.arrayBuffer();
        const html = new TextDecoder('gbk').decode(buf);
        const codeMatches = [...html.matchAll(/<div align="center">(\d{6})<\/div>/g)];
        const codes = [...new Set(codeMatches.map(m => m[1]))];
        if (codes.length === 0) continue;

        const secids = codes.map(c => `${c.startsWith('6') ? '1' : '0'}.${c}`).join(',');
        const batchResp = await fetch(`https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${secids}&fields=f12,f2,f9,f23,f116`);
        const batchData = await batchResp.json();
        if (!batchData?.data?.diff) continue;

        let totalPE = 0, totalPB = 0, peW = 0, pbW = 0;
        for (const s of batchData.data.diff) {
          const pe = (s.f9 > 0 ? s.f9 / 100 : 0);
          const pb = (s.f23 > 0 ? s.f23 / 100 : 0);
          const mcap = s.f116 > 0 ? s.f116 : 1;
          if (pe > 0) { totalPE += pe * mcap; peW += mcap; }
          if (pb > 0) { totalPB += pb * mcap; pbW += mcap; }
        }
        const avgPE = peW > 0 ? totalPE / peW : undefined;
        const avgPB = pbW > 0 ? totalPB / pbW : undefined;
        if (avgPE || avgPB) {
          setIndexVal(prev => ({
            ...prev,
            [idx.c]: { ...prev[idx.c], pe: avgPE, pb: avgPB, source: 'computed' },
          }));
        }
      } catch {}
    }
  }, [setIndexVal]);

  // ─── 4. 逐个指数获取实时价格（用 eastmoney 单品种接口） ───
  const fetchAllIndexPrices = useCallback(async () => {
    for (const idx of indicesRef.current) {
      const secid = getSecid(idx);
      if (!secid) continue;

      try {
        const priceScale = idx.m === 'HK' ? 1000 : 100;
        const d = await jsonp(
          `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f2,f3,f9,f23,f162,f167,f173&cb=jsonp_ixpr`,
          { timeout: 8000 },
        );

        if (d?.data) {
          const pe = d.data.f162 !== undefined && d.data.f162 !== '-' && d.data.f162 > 0 ? d.data.f162 / 100 :
                     d.data.f9 !== undefined && d.data.f9 !== '-' && d.data.f9 > 0 ? d.data.f9 / 100 : undefined;
          const pb = d.data.f167 !== undefined && d.data.f167 !== '-' && d.data.f167 > 0 ? d.data.f167 / 100 :
                     d.data.f23 !== undefined && d.data.f23 !== '-' && d.data.f23 > 0 ? d.data.f23 / 100 : undefined;
          const dy = d.data.f173 !== undefined && d.data.f173 !== '-' && d.data.f173 > 0 ? d.data.f173 / 100 : undefined;
          const p = d.data.f2 !== undefined && d.data.f2 !== '-' ? (d.data.f2 / priceScale).toFixed(2) : undefined;
          const cp = d.data.f3 !== undefined && d.data.f3 !== '-' ? (d.data.f3 / 100).toFixed(2) : undefined;

          if (pe || pb || p) {
            setIndexVal(prev => {
              const existing = prev[idx.c] || {};
              const update: Partial<IndexValuationData> = {};
              if (p) update.p = p;
              if (cp) update.cp = cp;
              if (idx.m === 'GLOBAL') {
                if (pe) update.pe = pe;
                if (pb) update.pb = pb;
                if (dy !== undefined) update.dy = dy;
              } else {
                if (pe && !existing.pe) update.pe = pe;
                if (pb && !existing.pb) update.pb = pb;
                if (dy !== undefined && !existing.dy) update.dy = dy;
              }
              return { ...prev, [idx.c]: { ...existing, ...update } };
            });
          }
        }
      } catch {}
    }
  }, [setIndexVal]);

  useEffect(() => {
    if (indices.length === 0) return;

    // 蛋卷 + eastmoney 补充：首次立即执行，60s 刷新
    fetchDanjuan();
    const djTimer = setInterval(fetchDanjuan, 60000);

    // 逐个指数价格：首次立即执行，60s 刷新
    fetchAllIndexPrices();
    const priceTimer = setInterval(fetchAllIndexPrices, 60000);

    // 新浪推算：延迟 5s（等其他数据源先到）
    const sinaTimer = setTimeout(fetchSinaComputed, 5000);

    return () => {
      clearInterval(djTimer);
      clearInterval(priceTimer);
      clearTimeout(sinaTimer);
      cleanupAllJsonp();
    };
  }, [allIndexCodes, fetchDanjuan, fetchAllIndexPrices, fetchSinaComputed]);
}
