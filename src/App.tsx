/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TrendingUp, Search, Bot, Star, Settings, ArrowLeft, Moon, Sun, LayoutGrid, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Industry, AIConfig, ViewType, NavigationState, Index, ValuationConfig, VALUATION_PRESETS, PresetName } from './types';
import { INDUSTRIES, HK_INDUSTRIES, DEFAULT_CONFIG } from './constants';
import { DEFAULT_INDICES } from './indices';
import { getAIResponse } from './services/aiService';
import { fetchFinancialStatementsCached } from './services/stockDataService';
import { calculateValuation } from './valuation/engine';
import { ValuationResult, StockInput, IndustryData, FinancialStatement } from './valuation/types';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AppContext, ConfirmDialog, LivePrice } from './AppContext';
import { ChatConversation } from './types/chat';

// ─── View Components ───
import HomeView from './views/HomeView';
import IndustryView from './views/IndustryView';
import SubIndustryView from './views/SubIndustryView';
import CompanyDetailView from './views/CompanyDetailView';
import SearchView from './views/SearchView';
import AIChatView from './views/AIChatView';
import IndexListView from './views/IndexListView';
import FavoritesView from './views/FavoritesView';
import IndexDetailView from './views/IndexDetailView';
import SettingsView from './views/SettingsView';

export default function App() {
  // ─── State ───
  const [view, setView] = useState<ViewType>('home');
  const [market, setMarket] = useState<'A' | 'HK'>('A');
  const [indexMarket, setIndexMarket] = useState<'A' | 'HK' | 'GLOBAL'>('A');
  const [indexValFilter, setIndexValFilter] = useState<'all' | 'low' | 'mid' | 'high'>('all');
  const [indices, setIndices] = useState<Index[]>(() => {
    const saved = localStorage.getItem('iv_indices');
    return saved ? JSON.parse(saved) : DEFAULT_INDICES;
  });
  const [navStack, setNavStack] = useState<NavigationState[]>([]);
  const [navArgs, setNavArgs] = useState<any[]>([]);
  const [favStocks, setFavStocks] = useState<string[]>(() => JSON.parse(localStorage.getItem('iv_fav_stocks') || '[]'));
  const [favIndices, setFavIndices] = useState<string[]>(() => JSON.parse(localStorage.getItem('iv_fav_indices') || '[]'));
  const [config, setConfig] = useState<AIConfig>(() => JSON.parse(localStorage.getItem('iv_cfg') || JSON.stringify(DEFAULT_CONFIG)));
  const [filter, setFilter] = useState<'all' | 'low' | 'mid' | 'high'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // AI conversations
  const [aiConversations, setAiConversations] = useState<ChatConversation[]>(() => {
    const saved = localStorage.getItem('iv_ai_convs');
    if (saved) return JSON.parse(saved);
    const old = sessionStorage.getItem('ai_msgs');
    if (old) {
      const msgs = JSON.parse(old);
      if (msgs.length > 0) {
        const conv = { id: 'legacy', title: '历史对话', messages: msgs, createdAt: Date.now() };
        localStorage.setItem('iv_ai_convs', JSON.stringify([conv]));
        sessionStorage.removeItem('ai_msgs');
        return [conv];
      }
    }
    return [];
  });
  const [activeAiConvId, setActiveAiConvId] = useState<string | null>(() => aiConversations.length > 0 ? aiConversations[0].id : null);
  const [showAiConvList, setShowAiConvList] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Valuation config
  const [valuationConfig, setValuationConfig] = useState<ValuationConfig>(() => {
    const saved = localStorage.getItem('iv_val_cfg');
    if (saved) { try { return JSON.parse(saved); } catch {} }
    return VALUATION_PRESETS.neutral.config;
  });
  const [activePreset, setActivePreset] = useState<PresetName | null>(() => {
    return localStorage.getItem('iv_val_preset') as PresetName || 'neutral';
  });
  const [settingsTab, setSettingsTab] = useState<'ai' | 'data' | 'valuation'>('ai');

  // Live price & company data
  const [livePrice, setLivePrice] = useState<LivePrice | null>(null);
  const [customCompanies, setCustomCompanies] = useState<any[]>(() => JSON.parse(localStorage.getItem('iv_custom_comps') || '[]'));
  const [deletedCompanies, setDeletedCompanies] = useState<string[]>(() => JSON.parse(localStorage.getItem('iv_deleted_comps') || '[]'));
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [aiAddError, setAiAddError] = useState<string | null>(null);
  const [isAddingIndex, setIsAddingIndex] = useState(false);
  const [aiIndexError, setAiIndexError] = useState<string | null>(null);

  // Batch market data
  const [batchData, setBatchData] = useState<Record<string, any>>({});
  const [indexVal, setIndexVal] = useState<Record<string, any>>({});

  // Financial statements & valuation
  const [stockStatements, setStockStatements] = useState<Record<string, FinancialStatement[]>>({});
  const [stockDetailLoading, setStockDetailLoading] = useState<Record<string, boolean>>({});
  const [valuationResults, setValuationResults] = useState<Record<string, ValuationResult>>({});

  // Dark mode
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('iv_dark');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);

  // ─── Refs ───
  const navStackRef = useRef<NavigationState[]>([]);
  const navArgsRef = useRef<any[]>([]);
  const viewRef = useRef<ViewType>(view);

  useEffect(() => { navStackRef.current = navStack; }, [navStack]);
  useEffect(() => { navArgsRef.current = navArgs; }, [navArgs]);
  useEffect(() => { viewRef.current = view; }, [view]);

  // ─── Dark Mode ───
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('iv_dark', String(darkMode));
  }, [darkMode]);

  // ─── Status Bar ───
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const timer = setTimeout(() => {
        StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
        StatusBar.setBackgroundColor({ color: darkMode ? '#0f172a' : '#ffffff' }).catch(() => {});
        StatusBar.setStyle({ style: darkMode ? Style.Dark : Style.Light }).catch(() => {});
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [darkMode]);

  // ─── Back Button ───
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapApp.addListener('backButton', () => {
      const stack = navStackRef.current;
      if (stack.length > 0) {
        const prev = stack[stack.length - 1];
        setNavStack(s => s.slice(0, -1));
        setView(prev.view);
        setNavArgs(prev.args);
        window.scrollTo(0, 0);
        return;
      }
      if (viewRef.current === 'home') { CapApp.minimizeApp(); return; }
      setView('home');
      setNavStack([]);
      setNavArgs([]);
    });
    return () => { listener.then(l => l.remove()); };
  }, []);

  // ─── API Base URLs ───
  const djApiBase = Capacitor.isNativePlatform() ? 'https://danjuanfunds.com' : '';
  const sinaApiBase = Capacitor.isNativePlatform() ? 'https://vip.stock.finance.sina.com.cn' : '/sina-api';

  // ─── Industry Merging ───
  const getMergedIndustries = (base: Industry[], mkt: 'A' | 'HK' | 'GLOBAL') => {
    const merged = JSON.parse(JSON.stringify(base)) as Industry[];
    merged.forEach(ind => {
      ind.l2.forEach(sub => { sub.cs = sub.cs.filter(c => !deletedCompanies.includes(c.c)); });
      ind.l2 = ind.l2.filter(sub => sub.cs.length > 0);
    });
    const filteredMerged = merged.filter(ind => ind.l2.length > 0);
    const marketCustom = customCompanies.filter(c => c.market === mkt && !deletedCompanies.includes(c.c));
    marketCustom.forEach(cc => {
      let ind = filteredMerged.find(i => i.nm === (cc.indName || '其他行业'));
      if (!ind) {
        ind = { id: `custom_${Date.now()}_${Math.random()}`, nm: cc.indName || '其他行业', ic: cc.ic || '🏢', ev: 'mid', l2: [] };
        filteredMerged.push(ind);
      }
      let sub = ind.l2.find(s => s.nm === (cc.subIndName || '其他细分'));
      if (!sub) {
        sub = { nm: cc.subIndName || '其他细分', cs: [] };
        ind.l2.push(sub);
      }
      if (!sub.cs.find(x => x.c === cc.c)) {
        sub.cs.push({ c: cc.c, n: cc.n, market: cc.market });
      }
    });
    return filteredMerged;
  };

  const mergedA = getMergedIndustries(INDUSTRIES, 'A');
  const mergedHK = getMergedIndustries(HK_INDUSTRIES, 'HK');
  const mergedGlobal = getMergedIndustries([], 'GLOBAL');
  const currentIndustries = market === 'A' ? mergedA : (market === 'HK' ? mergedHK : mergedGlobal);
  const allIndustries = [...mergedA, ...mergedHK, ...mergedGlobal];

  // ─── Batch Data Fetch ───
  const allCodesStr = JSON.stringify([
    ...allIndustries.flatMap(ind => ind.l2.flatMap(sub => sub.cs.map(c => c.c))),
    ...allIndustries.filter(ind => ind.bk).map(ind => ind.bk),
    ...allIndustries.flatMap(ind => (ind.indices || []).map(idx => idx.c)),
    ...indices.map(idx => idx.c)
  ]);

  useEffect(() => {
    const fetchBatch = () => {
      const allCodes = allIndustries.flatMap(ind => ind.l2.flatMap(sub => sub.cs));
      const bkCodes = allIndustries.filter(ind => ind.bk).map(ind => ({ c: ind.bk, market: 'BK' }));
      const userIdxCodes = indices.map(idx => ({ c: idx.c, market: 'IDX', mk: idx.mk, m: idx.m }));
      const combined = [...allCodes, ...bkCodes, ...userIdxCodes];
      if (combined.length === 0) return;

      const secidsList = combined.map(c => {
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
        if (c.market === 'GLOBAL') {
          const idx = indices.find(i => i.c === c.c);
          if (idx?.mk) return `${idx.mk}.${c.c}`;
          const fallbackMap: Record<string, string> = { DJI: '100.UDI', IXIC: '100.IXIC', INX: '100.SPX', N225: '100.N225', KS11: '100.KOSPI', FTSE: '100.FTSE', GDAXI: '100.GDAXI', FCHI: '100.FCHI', NSEI: '100.NIFTY', BVSP: '100.BVSP' };
          return fallbackMap[c.c] || `105.${c.c}`;
        }
        const mk = c.c.startsWith('6') ? '1' : '0';
        return `${mk}.${c.c}`;
      });

      const parseMarketData = (item: any) => {
        let code = item.f12;
        if (code === 'UDI') code = 'DJI';
        if (code === 'SPX') code = 'INX';
        if (code === 'KOSPI') code = 'KS11';
        if (code === 'NIFTY') code = 'NSEI';
        const mkId = item.f13;
        const pScale = mkId === 116 ? 1000 : 100;
        const val = (f: any, div = 1) => (f !== '-' && f !== undefined && f !== null) ? f / div : undefined;
        const valPos = (f: any, div = 1) => { const v = val(f, div); return v !== undefined && v > 0 ? v : undefined; };
        return {
          code, pScale,
          p: item.f2 !== '-' && item.f2 !== undefined ? (item.f2 / pScale).toFixed(mkId === 116 ? 3 : 2) : undefined,
          cp: item.f3 !== '-' && item.f3 !== undefined ? (item.f3 / 100).toFixed(2) : undefined,
          pe: valPos(item.f9, 100), pb: valPos(item.f23, 100), dy: valPos(item.f133),
          roe: val(item.f37), eps: valPos(item.f112),
          mcap: valPos(item.f20, 100000000), fcap: valPos(item.f117),
          debt: val(item.f57),
          pePct: val(item.f137), pbPct: val(item.f138),
          dividendPerShare: (item.f133 !== '-' && item.f133 !== undefined && item.f133 > 0 && item.f2 > 0)
            ? (item.f2 / pScale) * (item.f133 / 100) : undefined,
        };
      };

      const applyBatchData = (diff: any[]) => {
        setBatchData(prev => {
          const newData = { ...prev };
          diff.forEach((item: any) => {
            const d = parseMarketData(item);
            newData[d.code] = {
              p: d.p, cp: d.cp, pe: d.pe, pb: d.pb, dy: d.dy, ps: undefined,
              roe: d.roe, roa: undefined, eps: d.eps, mcap: d.mcap, fcap: d.fcap,
              grossMargin: undefined, netMargin: undefined, debt: d.debt,
              revenueGrowth: undefined, netIncomeGrowth: undefined,
              dividendPerShare: d.dividendPerShare, payoutYears: undefined,
              pePct: d.pePct, pbPct: d.pbPct,
            };
          });
          return newData;
        });
      };

      const chunkSize = 100;
      for (let i = 0; i < secidsList.length; i += chunkSize) {
        const chunk = secidsList.slice(i, i + chunkSize).join(',');
        const cbName = `jsonp_batch_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const timeoutId = setTimeout(() => {
          delete (window as any)[cbName];
          document.getElementById(cbName)?.remove();
        }, 15000);

        (window as any)[cbName] = (d: any) => {
          clearTimeout(timeoutId);
          if (d?.data?.diff) applyBatchData(d.data.diff);
          delete (window as any)[cbName];
          document.getElementById(cbName)?.remove();
        };

        const script = document.createElement('script');
        script.id = cbName;
        script.src = `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${chunk}&fields=f2,f3,f9,f12,f13,f14,f20,f23,f37,f57,f112,f113,f116,f117,f133,f137,f138&cb=${cbName}`;
        script.onerror = () => {
          clearTimeout(timeoutId);
          delete (window as any)[cbName];
          document.getElementById(cbName)?.remove();
          fetch(`https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${chunk}&fields=f2,f3,f9,f12,f13,f14,f20,f23,f37,f57,f112,f113,f116,f117,f133,f137,f138`)
            .then(r => r.json())
            .then((d: any) => { if (d?.data?.diff) applyBatchData(d.data.diff); })
            .catch(() => {});
        };
        document.head.appendChild(script);
      }
    };

    fetchBatch();
    const timer = setInterval(fetchBatch, 10000);

    // Industry index data (separate fetch with idx_ prefix)
    const fetchIndustryIndices = () => {
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

      const cbName = `jsonp_indidx_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const timeoutId = setTimeout(() => { delete (window as any)[cbName]; document.getElementById(cbName)?.remove(); }, 10000);

      (window as any)[cbName] = (d: any) => {
        clearTimeout(timeoutId);
        if (d?.data?.diff) {
          setBatchData(prev => {
            const newData = { ...prev };
            d.data.diff.forEach((item: any) => {
              const code = item.f12;
              const mkId = item.f13;
              const pScale = mkId === 116 ? 1000 : 100;
              const val = (f: any, div = 1) => (f !== '-' && f !== undefined && f !== null) ? f / div : undefined;
              const valPos = (f: any, div = 1) => { const v = val(f, div); return v !== undefined && v > 0 ? v : undefined; };
              newData[`idx_${code}`] = {
                p: item.f2 !== '-' && item.f2 !== undefined ? (item.f2 / pScale).toFixed(2) : undefined,
                cp: item.f3 !== '-' && item.f3 !== undefined ? (item.f3 / 100).toFixed(2) : undefined,
                pe: valPos(item.f9, 100), pb: valPos(item.f23, 100), dy: valPos(item.f133),
                ps: undefined, mcap: valPos(item.f20, 100000000),
              };
            });
            return newData;
          });
        }
        delete (window as any)[cbName];
        document.getElementById(cbName)?.remove();
      };

      const script = document.createElement('script');
      script.id = cbName;
      script.src = `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${secids}&fields=f2,f3,f9,f12,f13,f20,f23,f133&cb=${cbName}`;
      document.head.appendChild(script);
    };

    fetchIndustryIndices();
    const idxTimer = setInterval(fetchIndustryIndices, 10000);
    return () => { clearInterval(timer); clearInterval(idxTimer); };
  }, [allCodesStr]);

  // ─── Financial Statements Fetch ───
  useEffect(() => {
    if (view !== 'comp' || !navArgs[0]) return;
    const code = String(navArgs[0]).trim();
    if (!code || stockDetailLoading[code]) return;
    const doFetch = async () => {
      setStockDetailLoading(prev => ({ ...prev, [code]: true }));
      try {
        const stmts = await fetchFinancialStatementsCached(code);
        if (stmts.length > 0) setStockStatements(prev => ({ ...prev, [code]: stmts }));
      } catch (e) { console.error('[FinancialFetch] Error:', e); }
      finally { setStockDetailLoading(prev => ({ ...prev, [code]: false })); }
    };
    doFetch();
  }, [view, navArgs[0]]);

  // ─── Valuation Computation ───
  useEffect(() => {
    if (view !== 'comp' || !navArgs[0]) return;
    const code = String(navArgs[0]).trim();
    if (!code) return;

    const stmts = stockStatements[code] || [];
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
            code: c.c, name: c.n, pe: batchData[c.c]?.pe || 0, pb: batchData[c.c]?.pb || 0,
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
  }, [view, navArgs[0], stockStatements, batchData]);

  // ─── Index Valuation (Danjuan + Eastmoney fallback) ───
  const allIndexCodes = indices.map(i => i.c).join(',');
  useEffect(() => {
    if (indices.length === 0) return;
    const fetchIndexValuation = async () => {
      const matchedCodes = new Set<string>();
      const applyData = (djItems: any[]) => {
        const newVal: Record<string, any> = {};
        for (const idx of indices) {
          const match = djItems.find((item: any) => {
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
      };

      try {
        let djData: any;
        if (Capacitor.isNativePlatform()) {
          const resp = await CapacitorHttp.get({ url: `${djApiBase}/djapi/index_eva/dj` });
          djData = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
        } else {
          const resp = await fetch(`${djApiBase}/djapi/index_eva/dj`);
          djData = await resp.json();
        }
        if (djData?.data?.items?.length > 0) applyData(djData.data.items);
      } catch (e) { console.warn('[IndexVal] Danjuan API failed:', e); }

      // Supplementary: eastmoney for unmatched indices
      const missingIndices = indices.filter(idx => !matchedCodes.has(idx.c));
      for (const idx of missingIndices) {
        const secid = idx.mk ? `${idx.mk}.${idx.c}` :
                      idx.m === 'GLOBAL' ? `100.${idx.c}` :
                      idx.m === 'HK' ? `116.${idx.c}` :
                      (idx.c.startsWith('6') || idx.c.startsWith('000') || idx.c.startsWith('930') || idx.c.startsWith('H')) ? `1.${idx.c}` :
                      (idx.c.startsWith('399') || idx.c.startsWith('159')) ? `0.${idx.c}` : `1.${idx.c}`;
        const cbName = `jsonp_idxval_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const timeoutId = setTimeout(() => { delete (window as any)[cbName]; document.getElementById(cbName)?.remove(); }, 8000);

        (window as any)[cbName] = (d: any) => {
          clearTimeout(timeoutId);
          if (d?.data) {
            const pe = d.data.f162 !== '-' && d.data.f162 > 0 ? d.data.f162 / 100 : (d.data.f9 !== '-' && d.data.f9 > 0 ? d.data.f9 / 100 : undefined);
            const pb = d.data.f167 !== '-' && d.data.f167 > 0 ? d.data.f167 / 100 : (d.data.f23 !== '-' && d.data.f23 > 0 ? d.data.f23 / 100 : undefined);
            const dy = d.data.f173 !== '-' && d.data.f173 > 0 ? d.data.f173 / 100 : undefined;
            const priceScale = idx.m === 'HK' ? 1000 : 100;
            const p = d.data.f2 !== undefined && d.data.f2 !== '-' ? (d.data.f2 / priceScale).toFixed(2) : undefined;
            const cp = d.data.f3 !== undefined && d.data.f3 !== '-' ? (d.data.f3 / 100).toFixed(2) : undefined;
            if (pe || pb || p) {
              setIndexVal(prev => ({
                ...prev, [idx.c]: { ...(prev[idx.c] || {}), ...(pe ? { pe } : {}), ...(pb ? { pb } : {}), ...(dy !== undefined ? { dy } : {}), ...(p ? { p } : {}), ...(cp ? { cp } : {}) }
              }));
            }
          }
          delete (window as any)[cbName];
          document.getElementById(cbName)?.remove();
        };

        const script = document.createElement('script');
        script.id = cbName;
        script.src = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f2,f3,f9,f23,f162,f167,f173&cb=${cbName}`;
        script.onerror = () => { clearTimeout(timeoutId); delete (window as any)[cbName]; document.getElementById(cbName)?.remove(); };
        document.head.appendChild(script);
      }
    };

    fetchIndexValuation();
    const timer = setInterval(fetchIndexValuation, 60000);
    return () => clearInterval(timer);
  }, [allIndexCodes]);

  // Fallback: compute index PE/PB from constituent stocks
  useEffect(() => {
    const fetchAndCompute = async () => {
      for (const idx of indices) {
        const iv = indexVal[idx.c];
        if (iv?.pe && iv.pe > 0) continue;
        if (idx.m !== 'A') continue;
        try {
          const resp = await fetch(`${sinaApiBase}/corp/go.php/vII_NewestComponent/indexid/${idx.c}.phtml`);
          const buf = await resp.arrayBuffer();
          const html = new TextDecoder('gbk').decode(buf);
          const codeMatches = [...html.matchAll(/<div align="center">(\d{6})<\/div>/g)];
          const codes = [...new Set(codeMatches.map(m => m[1]))];
          if (codes.length === 0) continue;

          const secids = codes.map(c => `${c.startsWith('6') ? '1' : '0'}.${c}`).join(',');
          const batchResp = await fetch(`https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${secids}&fields=f12,f2,f9,f23,f116,f162,f167,f173`);
          const batchData = await batchResp.json();
          if (!batchData?.data?.diff) continue;

          let totalPE = 0, totalPB = 0, totalDY = 0, peW = 0, pbW = 0, dyW = 0;
          for (const s of batchData.data.diff) {
            const pe = (s.f162 > 0 ? s.f162 / 100 : (s.f9 > 0 ? s.f9 / 100 : 0));
            const pb = (s.f167 > 0 ? s.f167 / 100 : (s.f23 > 0 ? s.f23 / 100 : 0));
            const dy = s.f173 > 0 ? s.f173 / 100 : 0;
            const mcap = s.f116 > 0 ? s.f116 : 1;
            if (pe > 0) { totalPE += pe * mcap; peW += mcap; }
            if (pb > 0) { totalPB += pb * mcap; pbW += mcap; }
            if (dy > 0) { totalDY += dy * mcap; dyW += mcap; }
          }
          const avgPE = peW > 0 ? totalPE / peW : undefined;
          const avgPB = pbW > 0 ? totalPB / pbW : undefined;
          const avgDY = dyW > 0 ? totalDY / dyW : undefined;
          if (avgPE || avgPB) {
            setIndexVal(prev => ({ ...prev, [idx.c]: { pe: avgPE, pb: avgPB, dy: avgDY, source: 'computed' } }));
          }
        } catch {}
      }
    };
    const timer = setTimeout(fetchAndCompute, 5000);
    return () => clearTimeout(timer);
  }, [allIndexCodes]);

  // Dedicated index val: per-index JSONP
  useEffect(() => {
    if (indices.length === 0) return;
    const getSecid = (idx: Index): string | null => {
      if (idx.mk) return `${idx.mk}.${idx.c}`;
      if (idx.m === 'GLOBAL') return `100.${idx.c}`;
      if (idx.m === 'HK') return `116.${idx.c}`;
      if (idx.c.startsWith('6') || idx.c.startsWith('000') || idx.c.startsWith('930') || idx.c.startsWith('H')) return `1.${idx.c}`;
      if (idx.c.startsWith('399') || idx.c.startsWith('159')) return `0.${idx.c}`;
      return `1.${idx.c}`;
    };

    const fetchAllIndexVal = () => {
      indices.forEach((idx, i) => {
        const secid = getSecid(idx);
        if (!secid) return;
        const cbName = `jsonp_ixval_${Date.now()}_${i}_${Math.floor(Math.random() * 10000)}`;
        const timeoutId = setTimeout(() => { delete (window as any)[cbName]; document.getElementById(cbName)?.remove(); }, 8000);

        (window as any)[cbName] = (d: any) => {
          clearTimeout(timeoutId);
          if (d?.data) {
            const pe = d.data.f162 !== undefined && d.data.f162 !== '-' && d.data.f162 > 0 ? d.data.f162 / 100 : d.data.f9 !== undefined && d.data.f9 !== '-' && d.data.f9 > 0 ? d.data.f9 / 100 : undefined;
            const pb = d.data.f167 !== undefined && d.data.f167 !== '-' && d.data.f167 > 0 ? d.data.f167 / 100 : d.data.f23 !== undefined && d.data.f23 !== '-' && d.data.f23 > 0 ? d.data.f23 / 100 : undefined;
            const dy = d.data.f173 !== undefined && d.data.f173 !== '-' && d.data.f173 > 0 ? d.data.f173 / 100 : undefined;
            const priceScale = idx.m === 'HK' ? 1000 : 100;
            const p = d.data.f2 !== undefined && d.data.f2 !== '-' ? (d.data.f2 / priceScale).toFixed(2) : undefined;
            const cp = d.data.f3 !== undefined && d.data.f3 !== '-' ? (d.data.f3 / 100).toFixed(2) : undefined;
            if (pe || pb || p) {
              setIndexVal(prev => {
                const existing = prev[idx.c] || {};
                const update: Record<string, any> = {};
                if (p) update.p = p;
                if (cp) update.cp = cp;
                if (idx.m === 'GLOBAL') {
                  if (pe) update.pe = pe; if (pb) update.pb = pb; if (dy !== undefined) update.dy = dy;
                } else {
                  if (pe && !existing.pe) update.pe = pe;
                  if (pb && !existing.pb) update.pb = pb;
                  if (dy !== undefined && !existing.dy) update.dy = dy;
                }
                return { ...prev, [idx.c]: { ...existing, ...update } };
              });
            }
          }
          delete (window as any)[cbName];
          document.getElementById(cbName)?.remove();
        };

        const script = document.createElement('script');
        script.id = cbName;
        script.src = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f2,f3,f9,f23,f162,f167,f173&cb=${cbName}`;
        script.onerror = () => { clearTimeout(timeoutId); delete (window as any)[cbName]; document.getElementById(cbName)?.remove(); };
        document.head.appendChild(script);
      });
    };

    fetchAllIndexVal();
    const timer = setInterval(fetchAllIndexVal, 60000);
    return () => clearInterval(timer);
  }, [allIndexCodes]);

  // ─── Persistence Effects ───
  useEffect(() => { localStorage.setItem('iv_fav_stocks', JSON.stringify(favStocks)); localStorage.setItem('iv_fav_indices', JSON.stringify(favIndices)); }, [favStocks, favIndices]);
  useEffect(() => { localStorage.setItem('iv_cfg', JSON.stringify(config)); }, [config]);
  useEffect(() => { localStorage.setItem('iv_ai_convs', JSON.stringify(aiConversations)); }, [aiConversations]);

  // ─── Live Price ───
  useEffect(() => {
    if (view === 'comp' && navArgs[0]) {
      const code = navArgs[0];
      let cMarket = 'A';
      for (const ind of allIndustries) {
        for (const sub of ind.l2) {
          if ((sub.cs || []).find(c => c.c === code)) { cMarket = ind.market || 'A'; break; }
        }
      }
      let mk = '0';
      if (cMarket === 'HK') mk = '116';
      else if (cMarket === 'GLOBAL') mk = '105';
      else mk = code.startsWith('6') ? '1' : '0';

      const fetchPrice = () => {
        const cbName = `jsonp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const timeoutId = setTimeout(() => { delete (window as any)[cbName]; document.getElementById(cbName)?.remove(); }, 8000);

        (window as any)[cbName] = (d: any) => {
          clearTimeout(timeoutId);
          if (d.data) {
            const pScale = mk === '116' ? 1000 : 100;
            const pVal = d.data.f43 !== undefined && d.data.f43 !== '-' ? d.data.f43 : (d.data.f2 !== undefined && d.data.f2 !== '-' ? d.data.f2 : d.data.f60);
            const chVal = d.data.f4 !== undefined && d.data.f4 !== '-' ? d.data.f4 : d.data.f170;
            const rawCp = d.data.f3 !== undefined && d.data.f3 !== '-' ? d.data.f3 : d.data.f171;
            const p = pVal !== undefined && pVal !== '-' ? (pVal / pScale).toFixed(mk === '116' ? 3 : 2) : '—';
            const ch = chVal !== undefined && chVal !== '-' ? (chVal / pScale).toFixed(mk === '116' ? 3 : 2) : '—';
            let cp = rawCp !== undefined && rawCp !== '-' ? (rawCp / 100).toFixed(2) : '—';
            if (cp === '0.00' && pVal > 0 && d.data.f60 > 0) cp = (((pVal - d.data.f60) / d.data.f60) * 100).toFixed(2);
            const pe = d.data.f162 !== '-' && d.data.f162 !== undefined && d.data.f162 > 0 ? (d.data.f162 / 100).toFixed(2) : (d.data.f9 !== '-' && d.data.f9 !== undefined && d.data.f9 > 0 ? (d.data.f9 / 100).toFixed(2) : undefined);
            const pb = d.data.f167 !== '-' && d.data.f167 !== undefined && d.data.f167 > 0 ? (d.data.f167 / 100).toFixed(2) : (d.data.f23 !== '-' && d.data.f23 !== undefined && d.data.f23 > 0 ? (d.data.f23 / 100).toFixed(2) : undefined);
            const dy = d.data.f173 !== '-' && d.data.f173 !== undefined ? (d.data.f173 / 100).toFixed(2) : undefined;
            const ps = d.data.f188 !== '-' && d.data.f188 !== undefined && d.data.f188 > 0 ? (d.data.f188 / 100).toFixed(2) : undefined;
            const mcap = d.data.f116 !== '-' && d.data.f116 !== undefined ? (d.data.f116 / 100000000).toFixed(2) : undefined;
            const fcap = d.data.f117 !== '-' && d.data.f117 !== undefined ? (d.data.f117 / 100000000).toFixed(2) : undefined;
            setLivePrice({ p, ch, cp, up: parseFloat(ch) >= 0, pe, pb, dy, ps, mcap, fcap });
          }
          delete (window as any)[cbName];
          document.getElementById(cbName)?.remove();
        };

        const script = document.createElement('script');
        script.id = cbName;
        script.src = `https://push2.eastmoney.com/api/qt/stock/get?secid=${mk}.${code}&fields=f43,f170,f171,f2,f3,f4,f162,f167,f173,f188,f116,f117,f9,f23,f60,f169&cb=${cbName}`;
        script.onerror = () => { clearTimeout(timeoutId); delete (window as any)[cbName]; document.getElementById(cbName)?.remove(); };
        document.head.appendChild(script);
      };
      fetchPrice();
      const timer = setInterval(fetchPrice, 10000);
      return () => clearInterval(timer);
    } else {
      setLivePrice(null);
    }
  }, [view, navArgs]);

  // ─── Actions ───
  const navigate = (newView: ViewType, ...args: any[]) => {
    setNavStack(prev => [...prev, { view, args: navArgs }]);
    setView(newView);
    setNavArgs(args);
    window.scrollTo(0, 0);
  };

  const goBack = () => {
    if (navStack.length > 0) {
      const last = navStack[navStack.length - 1];
      setNavStack(prev => prev.slice(0, -1));
      setView(last.view);
      setNavArgs(last.args);
    } else { setView('home'); }
  };

  const toggleFav = (code: string, type: 'stock' | 'index', e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (type === 'stock') setFavStocks(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
    else setFavIndices(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  const handleDeleteCompany = (code: string) => {
    setConfirmDialog({
      title: '删除公司', message: '确定删除该公司吗？删除后可通过设置恢复。',
      onConfirm: () => {
        const newDeleted = [...deletedCompanies, code];
        setDeletedCompanies(newDeleted);
        localStorage.setItem('iv_deleted_comps', JSON.stringify(newDeleted));
        const newCustom = customCompanies.filter(c => c.c !== code);
        setCustomCompanies(newCustom);
        localStorage.setItem('iv_custom_comps', JSON.stringify(newCustom));
        setView('home');
        setConfirmDialog(null);
      }
    });
  };

  const handleRestoreDefaults = () => {
    setCustomCompanies([]); localStorage.removeItem('iv_custom_comps');
    setDeletedCompanies([]); localStorage.removeItem('iv_deleted_comps');
    setView('home');
  };

  const handleRestoreDefaultIndices = () => {
    setConfirmDialog({
      title: '恢复默认指数', message: '将重置为系统默认指数列表，你手动添加的指数会被移除。',
      onConfirm: () => {
        setIndices([...DEFAULT_INDICES]); localStorage.setItem('iv_indices', JSON.stringify(DEFAULT_INDICES));
        setFavIndices([]); localStorage.setItem('iv_fav_indices', JSON.stringify([]));
        setConfirmDialog(null);
      }
    });
  };

  const handleAiAddCompany = async () => {
    if (!searchQuery) return;
    if (!config.apiKey && !(config.provider === 'gemini')) { setAiAddError('请先在设置中配置 AI API Key 才能使用自动添加功能'); return; }
    setIsAddingCompany(true); setAiAddError(null);
    try {
      const prompt = `用户想添加一个股票，输入是："${searchQuery}"。请识别这只股票，并返回它的基本信息。必须返回一个合法的 JSON 对象，不要包含任何 markdown 标记。JSON 格式：{"c":"股票代码","n":"公司简称","market":"A/HK/GLOBAL","indName":"一级行业","subIndName":"二级行业","pe":数字,"pb":数字,"roe":数字,"dy":数字,"ps":数字,"ic":"行业Emoji"}`;
      let text = await getAIResponse(prompt, config, []);
      const match = text.match(/\{[\s\S]*\}/);
      if (match) text = match[0];
      const newComp = JSON.parse(text);
      newComp.c = (newComp.c || '').trim(); newComp.n = (newComp.n || '').trim();
      const updatedCustom = [...customCompanies, newComp];
      setCustomCompanies(updatedCustom); localStorage.setItem('iv_custom_comps', JSON.stringify(updatedCustom));
      setSearchQuery(''); setMarket(newComp.market); navigate('comp', newComp.c, newComp.n);
    } catch (err) { console.error(err); setAiAddError('添加失败，请重试或检查输入是否正确。'); }
    finally { setIsAddingCompany(false); }
  };

  const handleAiAddIndex = async () => {
    if (!searchQuery) return;
    if (!config.apiKey && !(config.provider === 'gemini')) { setAiIndexError('请先在设置中配置 AI API Key 才能使用自动添加功能'); return; }
    setIsAddingIndex(true); setAiIndexError(null);
    try {
      const prompt = `用户想添加一个指数，输入是："${searchQuery}"。请识别这个指数，并返回它的基本信息。必须返回一个合法的 JSON 对象。JSON 格式：{"c":"指数代码","n":"指数全称","m":"A/HK/GLOBAL","mk":"东方财富市场代码"}`;
      let text = await getAIResponse(prompt, config, []);
      const match = text.match(/\{[\s\S]*\}/);
      if (match) text = match[0];
      const newIdx = JSON.parse(text);
      newIdx.c = (newIdx.c || '').trim(); newIdx.n = (newIdx.n || '').trim();
      newIdx.m = newIdx.m || 'A'; newIdx.mk = newIdx.mk || '1';
      if (!indices.find(i => i.c === newIdx.c)) {
        const newIndices = [...indices, newIdx];
        setIndices(newIndices); localStorage.setItem('iv_indices', JSON.stringify(newIndices));
      }
      setSearchQuery(''); setIndexMarket(newIdx.m); navigate('index_detail', newIdx);
    } catch (err) { console.error(err); setAiIndexError('添加失败，请重试或检查输入是否正确。'); }
    finally { setIsAddingIndex(false); }
  };

  // ─── Context Value ───
  const contextValue = {
    view, market, indexMarket, indexValFilter, indices, navStack, navArgs,
    favStocks, favIndices, config, filter, aiConversations, activeAiConvId,
    showAiConvList, aiLoading, valuationConfig, activePreset, settingsTab,
    livePrice, customCompanies, deletedCompanies, isAddingCompany, aiAddError,
    isAddingIndex, aiIndexError, batchData, indexVal, stockStatements,
    stockDetailLoading, valuationResults, darkMode, confirmDialog,
    searchQuery, setSearchQuery,
    setView, setMarket, setIndexMarket, setIndexValFilter, setIndices,
    setFavStocks, setFavIndices, setConfig, setFilter, setAiConversations,
    setActiveAiConvId, setShowAiConvList, setAiLoading, setValuationConfig,
    setActivePreset, setSettingsTab, setCustomCompanies, setDeletedCompanies,
    setIsAddingCompany, setAiAddError, setIsAddingIndex, setAiIndexError,
    setDarkMode, setConfirmDialog,
    allIndustries, currentIndustries,
    navigate, goBack, toggleFav, handleDeleteCompany,
    handleRestoreDefaults, handleRestoreDefaultIndices,
    handleAiAddCompany, handleAiAddIndex,
  };

  // ─── Title Map ───
  const viewTitles: Record<string, string> = {
    home: '📊 行业估值', search: '搜索', ai: 'AI 助手', index_list: '指数行情',
    settings: '设置', fav: '自选股',
  };

  const getTitle = () => {
    if (viewTitles[view]) return viewTitles[view];
    if (view === 'ind') return currentIndustries[navArgs[0]]?.nm || '';
    if (view === 'sub') return currentIndustries[navArgs[0]]?.l2[navArgs[1]]?.nm || '';
    if (view === 'comp') return navArgs[1] || '';
    if (view === 'index' || view === 'index_detail') return '指数详情';
    return '';
  };

  // ─── Render View ───
  const renderView = () => {
    switch (view) {
      case 'home': return <HomeView />;
      case 'ind': return <IndustryView idx={navArgs[0]} />;
      case 'sub': return <SubIndustryView idx={navArgs[0]} sidx={navArgs[1]} />;
      case 'comp': return <CompanyDetailView code={navArgs[0]} name={navArgs[1]} />;
      case 'search': return <SearchView searchQuery={searchQuery} setSearchQuery={setSearchQuery} />;
      case 'ai': return <AIChatView />;
      case 'fav': return <FavoritesView />;
      case 'settings': return <SettingsView />;
      case 'index_list': return <IndexListView />;
      case 'index': {
        const ind = currentIndustries[navArgs[0]];
        if (!ind) return null;
        const indexInfo = (ind.indices || []).find(idx => idx.c === navArgs[1]);
        if (!indexInfo) return null;
        const indexObj: Index = { c: indexInfo.c, n: indexInfo.n, m: (ind.market === 'HK' ? 'HK' : 'A') as 'A' | 'HK' | 'GLOBAL' };
        return <IndexDetailView idx={indexObj} batchData={batchData} indexVal={indexVal}
          breadcrumbNodes={<>
            <button onClick={() => setView('home')} className="breadcrumb-link">全部</button>
            <span className="mx-1 text-slate-300">›</span>
            <button onClick={() => navigate('ind', navArgs[0])} className="breadcrumb-link">{ind.nm}</button>
            <span className="mx-1 text-slate-300">›</span>
            <span>{indexInfo.n}</span>
          </>} />;
      }
      case 'index_detail': return <IndexDetailView idx={navArgs[0]} batchData={batchData} indexVal={indexVal} />;
      default: return null;
    }
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className={`min-h-screen bg-surface pb-24 ${darkMode ? 'text-slate-100' : ''}`}>
        {/* Top Bar */}
        <div className="sticky top-0 z-50 nav-glass px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {navStack.length > 0 && view !== 'home' && (
              <button onClick={goBack} className="p-1.5 -ml-1 rounded-xl text-slate-500 hover:bg-slate-100/60 active:scale-90 transition-all">
                <ArrowLeft size={20} strokeWidth={2.5} />
              </button>
            )}
            <h1 className="text-[15px] font-extrabold text-slate-900 tracking-tight">{getTitle()}</h1>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100/60 hover:text-brand-600 transition-all dark:hover:bg-slate-700/60">
              {darkMode ? <Sun size={19} strokeWidth={2} /> : <Moon size={19} strokeWidth={2} />}
            </button>
            <button onClick={() => navigate('settings')} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100/60 hover:text-brand-600 transition-all dark:hover:bg-slate-700/60">
              <Settings size={19} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-lg mx-auto p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={view + (navArgs[0] || '')}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 nav-bottom-glass flex justify-around items-center py-1.5 px-4 pb-[calc(6px+env(safe-area-inset-bottom))] z-50">
          {[
            { id: 'home', l: '行业', i: LayoutGrid },
            { id: 'index_list', l: '指数', i: TrendingUp },
            { id: 'search', l: '搜索', i: Search },
            { id: 'ai', l: 'AI助手', i: Bot },
            { id: 'fav', l: '自选', i: Star },
          ].map(t => (
            <button key={t.id}
              onClick={() => { setView(t.id as ViewType); setNavStack([]); setNavArgs([]); }}
              className={`flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all duration-200 ${view === t.id ? 'text-brand-600' : 'text-slate-400'}`}>
              <div className={`p-1 rounded-lg transition-all duration-200 ${view === t.id ? 'bg-brand-50' : ''}`}>
                <t.i size={19} strokeWidth={view === t.id ? 2.5 : 1.8} />
              </div>
              <span className={`text-[10px] transition-all duration-200 ${view === t.id ? 'font-extrabold' : 'font-semibold'}`}>{t.l}</span>
            </button>
          ))}
        </nav>

        {/* Confirm Dialog */}
        <AnimatePresence>
          {confirmDialog && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center px-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setConfirmDialog(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="relative bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <AlertCircle size={24} className="text-amber-500" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 text-center mb-2">{confirmDialog.title}</h3>
                <p className="text-sm text-slate-500 text-center leading-relaxed mb-6">{confirmDialog.message}</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setConfirmDialog(null)} className="py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl active:scale-[0.98] transition-transform">取消</button>
                  <button onClick={confirmDialog.onConfirm} className="py-3 bg-red-500 text-white font-bold rounded-2xl active:scale-[0.98] transition-transform shadow-lg shadow-red-500/25">确定</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AppContext.Provider>
  );
}
