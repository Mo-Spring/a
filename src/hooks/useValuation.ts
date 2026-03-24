/**
 * 估值计算 Hook
 *
 * 职责：当股票详情页所需的 batchData 和 stockStatements 都到位后，运行估值引擎
 * 不做任何网络请求，只做纯计算
 */

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { Industry, ValuationConfig } from '../types';
import { ValuationResult, StockInput, IndustryData, FinancialStatement } from '../valuation/types';
import { calculateValuation } from '../valuation/engine';
import { MarketData } from '../types/market';

export function useValuation(
  code: string | undefined,
  allIndustries: Industry[],
  batchData: Record<string, MarketData>,
  stockStatements: Record<string, FinancialStatement[]>,
  valuationConfig: ValuationConfig,
  setValuationResults: Dispatch<SetStateAction<Record<string, ValuationResult>>>,
) {
  useEffect(() => {
    if (!code) return;

    const stmts = stockStatements[code] || [];

    // 收集行业信息
    let compMarket: 'A' | 'HK' | 'GLOBAL' = 'A';
    let industryName = '默认';
    let industryPE = 20, industryPB = 1.5, industryROE = 12;
    let peers: Array<{ code: string; name: string; pe: number; pb: number; roe: number; mcap: number }> = [];

    for (const ind of allIndustries) {
      for (const sub of ind.l2) {
        const found = sub.cs.find(c => c.c === code);
        if (found) {
          compMarket = ind.market || 'A';
          industryName = ind.nm;
          const peValues = sub.cs.map(c => batchData[c.c]?.pe).filter((v): v is number => v !== undefined && v > 0 && v < 500);
          const pbValues = sub.cs.map(c => batchData[c.c]?.pb).filter((v): v is number => v !== undefined && v > 0 && v < 50);
          const roeValues = sub.cs.map(c => batchData[c.c]?.roe).filter((v): v is number => v !== undefined && v > 0 && v < 100);
          if (peValues.length > 0) industryPE = peValues.reduce((a, b) => a + b, 0) / peValues.length;
          if (pbValues.length > 0) industryPB = pbValues.reduce((a, b) => a + b, 0) / pbValues.length;
          if (roeValues.length > 0) industryROE = roeValues.reduce((a, b) => a + b, 0) / roeValues.length;
          peers = sub.cs.filter(x => x.c !== code).map(c => ({
            code: c.c, name: c.n,
            pe: batchData[c.c]?.pe || 0, pb: batchData[c.c]?.pb || 0,
            roe: batchData[c.c]?.roe || 0, mcap: batchData[c.c]?.mcap || 0,
          })).filter(p => p.pe > 0);
          break;
        }
      }
    }

    const bd = batchData[code] || {};
    const currentPE = bd.pe || 0;
    const currentPB = bd.pb || 0;
    const currentPrice = parseFloat(bd.p || '0') || 0;
    if (currentPE <= 0 || currentPrice <= 0) return;

    const currentEPS = bd.eps || (currentPE > 0 ? currentPrice / currentPE : 0);
    const currentROA = stmts.length > 0 && stmts[0].totalAssets > 0
      ? (stmts[0].netIncome / stmts[0].totalAssets) * 100 : 0;
    let currentDebt = stmts.length > 0 ? stmts[0].debtRatio : 0;
    if (currentDebt <= 0 && bd.debt && bd.debt > 0 && bd.debt <= 100) currentDebt = bd.debt;
    if (currentDebt < 0 || currentDebt > 100) currentDebt = 0;
    const currentPS = bd.ps || (stmts.length > 0 && bd.mcap && bd.mcap > 0 ? stmts[0].revenue / bd.mcap : 0);
    const currentDividendPS = bd.dividendPerShare || (bd.dy && bd.dy > 0 && currentPrice > 0 ? currentPrice * (bd.dy / 100) : 0);

    const stockInput: StockInput = {
      code, name: code, market: compMarket === 'HK' ? 'HK' : 'A',
      price: currentPrice, pe: currentPE, pb: currentPB, ps: currentPS,
      dy: bd.dy || 0, roe: bd.roe || (stmts.length > 0 ? stmts[0].roe : 0),
      roa: currentROA, eps: currentEPS,
      bvps: bd.eps && currentPE > 0 ? currentPrice / currentPE * currentPB : (stmts.length > 0 ? stmts[0].bvps : 0),
      mcap: bd.mcap || 0, fcap: bd.fcap || 0,
      revenue: stmts.length > 0 ? stmts[0].revenue : 0,
      netIncome: stmts.length > 0 ? stmts[0].netIncome : 0,
      operatingCF: stmts.length > 0 ? stmts[0].operatingCF : 0,
      freeCF: stmts.length > 0 ? stmts[0].freeCF : 0,
      grossMargin: stmts.length > 0 ? stmts[0].grossMargin : 0,
      netMargin: stmts.length > 0 ? stmts[0].netMargin : 0,
      totalDebt: currentDebt, dividendPerShare: currentDividendPS,
      revenueGrowth: stmts.length > 0 ? stmts[0].revenueGrowth : 0,
      netIncomeGrowth: stmts.length > 0 ? stmts[0].netIncomeGrowth : 0,
      statements: stmts,
    };

    const industryData: IndustryData = { pe: industryPE, pb: industryPB, roe: industryROE, name: industryName, peers };
    const valuation = calculateValuation(stockInput, industryData, valuationConfig);
    setValuationResults(prev => ({ ...prev, [code]: valuation }));
  }, [code, stockStatements, batchData, valuationConfig, setValuationResults]);
}
