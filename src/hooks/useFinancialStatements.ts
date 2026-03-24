/**
 * 财务报表 Hook
 *
 * 职责：进入个股详情页时获取三表数据
 * 缓存策略：localStorage 7 天
 * 数据源：东方财富 datacenter JSONP（stockDataService）
 */

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { FinancialStatement } from '../valuation/types';
import { fetchFinancialStatementsCached } from '../services/stockDataService';

export function useFinancialStatements(
  code: string | undefined,
  setStockStatements: Dispatch<SetStateAction<Record<string, FinancialStatement[]>>>,
  setStockDetailLoading: Dispatch<SetStateAction<Record<string, boolean>>>,
) {
  useEffect(() => {
    if (!code) return;

    const doFetch = async () => {
      setStockDetailLoading(prev => ({ ...prev, [code]: true }));
      try {
        const stmts = await fetchFinancialStatementsCached(code);
        if (stmts.length > 0) {
          setStockStatements(prev => ({ ...prev, [code]: stmts }));
        }
      } catch (e) {
        console.error('[FinancialFetch] Error:', e);
      } finally {
        setStockDetailLoading(prev => ({ ...prev, [code]: false }));
      }
    };
    doFetch();
  }, [code, setStockStatements, setStockDetailLoading]);
}
