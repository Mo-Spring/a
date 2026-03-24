/**
 * 个股实时价格 Hook
 *
 * 职责：获取单只股票的实时价格 + 估值指标
 * 刷新间隔：10s（实时行情必须及时）
 * 数据源：东方财富 push2 单品种 JSONP
 */

import { useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';
import { Industry, Index } from '../types';
import { LivePriceData } from '../types/market';
import { jsonp } from '../utils/jsonp';

export function useLivePrice(
  code: string | undefined,
  allIndustries: Industry[],
  setLivePrice: Dispatch<SetStateAction<LivePriceData | null>>,
) {
  const fetchPrice = useCallback(async () => {
    if (!code) { setLivePrice(null); return; }

    // 判断市场
    let cMarket = 'A';
    for (const ind of allIndustries) {
      for (const sub of ind.l2) {
        if ((sub.cs || []).find(c => c.c === code)) {
          cMarket = ind.market || 'A';
          break;
        }
      }
    }

    let mk = '0';
    if (cMarket === 'HK') mk = '116';
    else if (cMarket === 'GLOBAL') mk = '105';
    else mk = code.startsWith('6') ? '1' : '0';

    try {
      const d = await jsonp(
        `https://push2.eastmoney.com/api/qt/stock/get?secid=${mk}.${code}&fields=f43,f170,f171,f2,f3,f4,f162,f167,f173,f188,f116,f117,f9,f23,f60,f169&cb=jsonp_lp`,
        { key: `lp_${code}`, timeout: 8000 },
      );

      if (d?.data) {
        const pScale = mk === '116' ? 1000 : 100;
        const pVal = d.data.f43 !== undefined && d.data.f43 !== '-' ? d.data.f43 : (d.data.f2 !== undefined && d.data.f2 !== '-' ? d.data.f2 : d.data.f60);
        const chVal = d.data.f4 !== undefined && d.data.f4 !== '-' ? d.data.f4 : d.data.f170;
        const rawCp = d.data.f3 !== undefined && d.data.f3 !== '-' ? d.data.f3 : d.data.f171;

        const p = pVal !== undefined && pVal !== '-' ? (pVal / pScale).toFixed(mk === '116' ? 3 : 2) : '—';
        const ch = chVal !== undefined && chVal !== '-' ? (chVal / pScale).toFixed(mk === '116' ? 3 : 2) : '—';
        let cp = rawCp !== undefined && rawCp !== '-' ? (rawCp / 100).toFixed(2) : '—';
        if (cp === '0.00' && pVal > 0 && d.data.f60 > 0) {
          cp = (((pVal - d.data.f60) / d.data.f60) * 100).toFixed(2);
        }

        const pe = d.data.f162 !== '-' && d.data.f162 !== undefined && d.data.f162 > 0 ? (d.data.f162 / 100).toFixed(2)
          : (d.data.f9 !== '-' && d.data.f9 !== undefined && d.data.f9 > 0 ? (d.data.f9 / 100).toFixed(2) : undefined);
        const pb = d.data.f167 !== '-' && d.data.f167 !== undefined && d.data.f167 > 0 ? (d.data.f167 / 100).toFixed(2)
          : (d.data.f23 !== '-' && d.data.f23 !== undefined && d.data.f23 > 0 ? (d.data.f23 / 100).toFixed(2) : undefined);
        const dy = d.data.f173 !== '-' && d.data.f173 !== undefined ? (d.data.f173 / 100).toFixed(2) : undefined;
        const ps = d.data.f188 !== '-' && d.data.f188 !== undefined && d.data.f188 > 0 ? (d.data.f188 / 100).toFixed(2) : undefined;
        const mcap = d.data.f116 !== '-' && d.data.f116 !== undefined ? (d.data.f116 / 100000000).toFixed(2) : undefined;
        const fcap = d.data.f117 !== '-' && d.data.f117 !== undefined ? (d.data.f117 / 100000000).toFixed(2) : undefined;

        setLivePrice({ p, ch, cp, up: parseFloat(ch) >= 0, pe, pb, dy, ps, mcap, fcap });
      }
    } catch {}
  }, [code, setLivePrice]);

  useEffect(() => {
    if (!code) { setLivePrice(null); return; }

    fetchPrice();
    const timer = setInterval(fetchPrice, 10000);
    return () => clearInterval(timer);
  }, [code, fetchPrice]);
}
