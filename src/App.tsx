/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TrendingUp, Search, Bot, Star, Settings, ArrowLeft, Moon, Sun, LayoutGrid, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Industry, AIConfig, ViewType, NavigationState, Index, ValuationConfig, VALUATION_PRESETS, PresetName } from './types';
import { INDUSTRIES, HK_INDUSTRIES, DEFAULT_CONFIG } from './constants';
import { DEFAULT_INDICES } from './indices';
import { getAIResponse } from './services/aiService';
import { ValuationResult, FinancialStatement } from './valuation/types';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AppContext, ConfirmDialog } from './AppContext';
import { ChatConversation } from './types/chat';
import { MarketData, IndexValuationData, LivePriceData } from './types/market';

// ─── Hooks ───
import { useBatchData } from './hooks/useBatchData';
import { useIndexValuation } from './hooks/useIndexValuation';
import { useLivePrice } from './hooks/useLivePrice';
import { useFinancialStatements } from './hooks/useFinancialStatements';
import { useValuation } from './hooks/useValuation';
import { useStockPercentiles } from './hooks/useStockPercentiles';

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
  // ─── Core State ───
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

  // Company data
  const [customCompanies, setCustomCompanies] = useState<any[]>(() => JSON.parse(localStorage.getItem('iv_custom_comps') || '[]'));
  const [deletedCompanies, setDeletedCompanies] = useState<string[]>(() => JSON.parse(localStorage.getItem('iv_deleted_comps') || '[]'));
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [aiAddError, setAiAddError] = useState<string | null>(null);
  const [isAddingIndex, setIsAddingIndex] = useState(false);
  const [aiIndexError, setAiIndexError] = useState<string | null>(null);

  // Market data state (populated by hooks)
  const [batchData, setBatchData] = useState<Record<string, MarketData>>({});
  const [indexVal, setIndexVal] = useState<Record<string, IndexValuationData>>({});
  const [livePrice, setLivePrice] = useState<LivePriceData | null>(null);
  const [stockStatements, setStockStatements] = useState<Record<string, FinancialStatement[]>>({});
  const [stockDetailLoading, setStockDetailLoading] = useState<Record<string, boolean>>({});
  const [valuationResults, setValuationResults] = useState<Record<string, ValuationResult>>({});

  // UI state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('iv_dark');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
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

  // ─── Status Bar (Capacitor native) ───
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const timer = setTimeout(() => {
        StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
        StatusBar.setBackgroundColor({ color: '#00000000' }).catch(() => {});
        StatusBar.setStyle({ style: darkMode ? Style.Dark : Style.Light }).catch(() => {});
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [darkMode]);

  // ─── Back Button (Capacitor native) ───
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

  // ─── Industry Merging (memoized) ───
  const getMergedIndustries = (base: Industry[], mkt: 'A' | 'HK' | 'GLOBAL'): Industry[] => {
    const merged = base.map(ind => ({
      ...ind,
      l2: ind.l2
        .map(sub => ({ ...sub, cs: sub.cs.filter(c => !deletedCompanies.includes(c.c)) }))
        .filter(sub => sub.cs.length > 0),
    })).filter(ind => ind.l2.length > 0);

    customCompanies
      .filter(c => c.market === mkt && !deletedCompanies.includes(c.c))
      .forEach(cc => {
        let ind = merged.find(i => i.nm === (cc.indName || '其他行业'));
        if (!ind) {
          ind = { id: `custom_${Date.now()}_${Math.random()}`, nm: cc.indName || '其他行业', ic: cc.ic || '🏢', ev: 'mid', l2: [] };
          merged.push(ind);
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

    return merged;
  };

  const mergedA = useMemo(() => getMergedIndustries(INDUSTRIES, 'A'), [customCompanies, deletedCompanies]);
  const mergedHK = useMemo(() => getMergedIndustries(HK_INDUSTRIES, 'HK'), [customCompanies, deletedCompanies]);
  const mergedGlobal = useMemo(() => getMergedIndustries([], 'GLOBAL'), [customCompanies, deletedCompanies]);
  const currentIndustries = market === 'A' ? mergedA : (market === 'HK' ? mergedHK : mergedGlobal);
  const allIndustries = useMemo(() => [...mergedA, ...mergedHK, ...mergedGlobal], [mergedA, mergedHK, mergedGlobal]);

  const allCodesStr = JSON.stringify([
    ...allIndustries.flatMap(ind => ind.l2.flatMap(sub => sub.cs.map(c => c.c))),
    ...allIndustries.filter(ind => ind.bk).map(ind => ind.bk),
    ...allIndustries.flatMap(ind => (ind.indices || []).map(idx => idx.c)),
    ...indices.map(idx => idx.c)
  ]);

  // ─── Data Hooks ───
  useBatchData(allIndustries, indices, allCodesStr, setBatchData);

  const allIndexCodes = indices.map(i => i.c).join(',');
  useIndexValuation(indices, allIndexCodes, setIndexVal);

  const currentCompCode = view === 'comp' ? navArgs[0] : undefined;
  useLivePrice(currentCompCode, allIndustries, setLivePrice);

  useStockPercentiles(currentCompCode, setBatchData);

  useFinancialStatements(currentCompCode, setStockStatements, setStockDetailLoading);

  useValuation(currentCompCode, allIndustries, batchData, stockStatements, valuationConfig, setValuationResults);

  // ─── Persistence ───
  useEffect(() => { localStorage.setItem('iv_fav_stocks', JSON.stringify(favStocks)); localStorage.setItem('iv_fav_indices', JSON.stringify(favIndices)); }, [favStocks, favIndices]);
  useEffect(() => { localStorage.setItem('iv_cfg', JSON.stringify(config)); }, [config]);
  useEffect(() => { localStorage.setItem('iv_ai_convs', JSON.stringify(aiConversations)); }, [aiConversations]);

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
    if (!config.apiKey && !(config.provider === 'gemini')) { setAiAddError('请先在设置中配置 AI API Key'); return; }
    setIsAddingCompany(true); setAiAddError(null);
    try {
      const prompt = `用户想添加一个股票，输入是："${searchQuery}"。请识别并返回 JSON：{"c":"代码","n":"简称","market":"A/HK/GLOBAL","indName":"一级行业","subIndName":"二级行业","pe":数字,"pb":数字,"roe":数字,"dy":数字,"ps":数字,"ic":"行业Emoji"}`;
      let text = await getAIResponse(prompt, config, []);
      const match = text.match(/\{[\s\S]*\}/);
      if (match) text = match[0];
      const newComp = JSON.parse(text);
      newComp.c = (newComp.c || '').trim(); newComp.n = (newComp.n || '').trim();
      const updatedCustom = [...customCompanies, newComp];
      setCustomCompanies(updatedCustom); localStorage.setItem('iv_custom_comps', JSON.stringify(updatedCustom));
      setSearchQuery(''); setMarket(newComp.market); navigate('comp', newComp.c, newComp.n);
    } catch (err) { console.error(err); setAiAddError('添加失败，请重试'); }
    finally { setIsAddingCompany(false); }
  };

  const handleAiAddIndex = async () => {
    if (!searchQuery) return;
    if (!config.apiKey && !(config.provider === 'gemini')) { setAiIndexError('请先在设置中配置 AI API Key'); return; }
    setIsAddingIndex(true); setAiIndexError(null);
    try {
      const prompt = `用户想添加一个指数，输入是："${searchQuery}"。请返回 JSON：{"c":"代码","n":"全称","m":"A/HK/GLOBAL","mk":"eastmoney市场代码"}`;
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
    } catch (err) { console.error(err); setAiIndexError('添加失败，请重试'); }
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

  // ─── Title ───
  const getTitle = (): string => {
    const map: Record<string, string> = {
      home: '📊 行业估值', search: '搜索', ai: 'AI 助手', index_list: '指数行情',
      settings: '设置', fav: '自选股', index: '指数详情', index_detail: '指数详情',
    };
    if (map[view]) return map[view];
    if (view === 'ind') return currentIndustries[navArgs[0]]?.nm || '';
    if (view === 'sub') return currentIndustries[navArgs[0]]?.l2[navArgs[1]]?.nm || '';
    if (view === 'comp') return navArgs[1] || '';
    return '';
  };

  // ─── View Router ───
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
      <div className={`min-h-screen bg-surface ${darkMode ? 'text-slate-100' : ''}`} style={{ paddingBottom: 'calc(96px + var(--sab))' }}>
        {/* Top Bar */}
        <div className="sticky top-0 z-50 nav-glass px-4 pb-3 flex items-center justify-between" style={{ paddingTop: 'calc(var(--sat) + 4px)' }}>
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
        <nav className="fixed bottom-0 left-0 right-0 nav-bottom-glass flex justify-around items-center py-1.5 px-4 z-50" style={{ paddingBottom: 'calc(12px + var(--sab))' }}>
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
