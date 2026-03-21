/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  TrendingUp, 
  Search, 
  Bot, 
  Star, 
  Settings, 
  ChevronRight, 
  ArrowLeft, 
  Loader2, 
  Send,
  AlertCircle,
  Trash2,
  LayoutGrid,
  MessageSquarePlus,
  MessageSquare,
  Plus,
  X,
  MoreVertical,
  Moon,
  Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Industry, Company, AIConfig, ViewType, NavigationState, Index } from './types';
import { INDUSTRIES, HK_INDUSTRIES, DEFAULT_CONFIG, PROVIDERS } from './constants';
import { DEFAULT_INDICES } from './indices';
import { getAIResponse } from './services/aiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

interface SearchViewProps {
  allIndustries: Industry[];
  customCompanies: any[];
  indices: Index[];
  setIndices: (indices: Index[]) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  navigate: (view: ViewType, ...args: any[]) => void;
  setMarket: (market: 'A' | 'HK' | 'GLOBAL') => void;
  setIndexMarket: (market: 'A' | 'HK' | 'GLOBAL') => void;
  handleAiAddCompany: () => void;
  isAddingCompany: boolean;
  aiAddError: string | null;
}

const SearchView = ({
  allIndustries,
  customCompanies,
  indices,
  setIndices,
  searchQuery,
  setSearchQuery,
  navigate,
  setMarket,
  setIndexMarket,
  handleAiAddCompany,
  isAddingCompany,
  aiAddError
}: SearchViewProps) => {
  const [searchType, setSearchType] = useState<'stock' | 'index'>('stock');
  const [remoteResults, setRemoteResults] = useState<any[]>([]);
  
  // Clear search query when switching search type
  const handleTypeSwitch = (type: 'stock' | 'index') => {
    setSearchType(type);
    setSearchQuery('');
    setRemoteResults([]);
  };

  const results: any[] = [];
  
  if (searchType === 'stock' && searchQuery.length > 0) {
    allIndustries.forEach((ind, ii) => ind.l2.forEach(s => (s.cs || []).forEach(c => {
      if (c.n.includes(searchQuery) || c.c.includes(searchQuery)) {
        results.push({ ...c, sn: s.nm, ii, ic: ind.ic, market: ind.market || 'A', source: 'industry' });
      }
    })));
    customCompanies.forEach(c => {
      if (c.n.includes(searchQuery) || c.c.includes(searchQuery)) {
        results.push({ ...c, sn: c.subIndName, ii: -1, ic: c.ic || '🏢', market: c.market || 'A', source: 'custom' });
      }
    });
  }

  useEffect(() => {
    if (searchQuery.length < 1) {
      setRemoteResults([]);
      return;
    }
    const timer = setTimeout(() => {
      const cbName = `jsonp_search_${Date.now()}`;
      (window as any)[cbName] = (d: any) => {
        if (d?.QuotationCodeTable?.Data) {
          const mapped = d.QuotationCodeTable.Data.map((item: any) => {
            let m: 'A' | 'HK' | 'GLOBAL' = 'A';
            let mk = item.MarketType;

            // Use QuoteID if available (e.g., "0.399997") — already in correct secid format
            if (item.QuoteID && item.QuoteID.includes('.')) {
              const parts = item.QuoteID.split('.');
              mk = parts[0];
              if (mk === '116') m = 'HK';
              else if (['105', '106', '107', '100'].includes(mk)) m = 'GLOBAL';
              else m = 'A';
            } else {
              // Fallback: map MarketType
              if (mk === '116') m = 'HK';
              else if (['105', '106', '107', '100'].includes(mk)) m = 'GLOBAL';
              else m = 'A'; // '0', '1', '2' etc. → A-share
            }

            return {
              c: item.Code,
              n: item.Name,
              m: m,
              mk: mk,
              type: item.ClassCode
            };
          });
          setRemoteResults(mapped);
        }
        delete (window as any)[cbName];
        const scriptEl = document.getElementById(cbName);
        if (scriptEl) document.head.removeChild(scriptEl);
      };
      const script = document.createElement('script');
      script.id = cbName;
      // type=1 for stocks, type=14 for indices
      const apiType = searchType === 'stock' ? '1' : '14';
      script.src = `https://searchapi.eastmoney.com/api/suggest/get?input=${searchQuery}&type=${apiType}&cb=${cbName}`;
      document.head.appendChild(script);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, searchType]);

  const addIndex = (idx: any) => {
    if (indices.find(i => i.c === idx.c)) return;
    const newIndex = { c: idx.c, n: idx.n, m: idx.m, mk: idx.mk };
    const newIndices = [...indices, newIndex];
    setIndices(newIndices);
    localStorage.setItem('iv_indices', JSON.stringify(newIndices));
    setSearchQuery('');
    setRemoteResults([]);
    setIndexMarket(idx.m);
    navigate('index_detail', newIndex);
  };

  return (
    <div className="space-y-4">
      <div className="flex bg-white/80 border border-slate-200/60 rounded-2xl p-1 shadow-card">
        <button
          onClick={() => handleTypeSwitch('stock')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${
            searchType === 'stock' ? 'tab-pill-active' : 'tab-pill-inactive'
          }`}
        >
          搜索股票
        </button>
        <button
          onClick={() => handleTypeSwitch('index')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${
            searchType === 'index' ? 'tab-pill-active' : 'tab-pill-inactive'
          }`}
        >
          搜索指数
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
        <input
          autoFocus
          className="input-field pl-10 pr-4 py-3 rounded-2xl shadow-card"
          placeholder={searchType === 'stock' ? "搜索公司名称或代码..." : "搜索指数名称或代码..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {searchType === 'stock' ? (
          <>
            {results.length > 0 ? results.map(c => (
              <div
                key={`${c.source}-${c.market}-${c.c}`}
                onClick={() => { setMarket(c.market || 'A'); navigate('comp', c.c, c.n); }}
                className="card-interactive p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-sm font-bold text-slate-800">{c.ic} {c.n}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{c.c} · {c.sn}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { l: 'PE', v: c.pe || '—' },
                    { l: 'ROE', v: `${c.roe}%` },
                    { l: '股息', v: `${c.dy}%` },
                  ].map(m => (
                    <div key={m.l} className="bg-slate-50 rounded-lg py-1.5 text-center">
                      <div className="text-[9px] text-slate-400 font-bold uppercase">{m.l}</div>
                      <div className="text-xs font-bold text-slate-700">{m.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )) : searchQuery.length > 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">未找到相关公司</div>
            ) : (
              <div className="text-center py-20 text-slate-400 text-sm">输入关键词搜索</div>
            )}
            
            {searchQuery.length > 0 && (
              <div className="mt-4 space-y-2">
                <button
                  onClick={handleAiAddCompany}
                  disabled={isAddingCompany}
                  className="w-full bg-brand-50 border border-brand-100 text-brand-600 font-bold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  {isAddingCompany ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />}
                  {isAddingCompany ? '正在让 AI 识别并添加...' : `找不到？让 AI 自动添加 "${searchQuery}"`}
                </button>
                {aiAddError && (
                  <div className="text-center text-xs text-red-500 font-medium">
                    {aiAddError}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {remoteResults.length > 0 && remoteResults.map(idx => (
              <div
                key={`${idx.m}-${idx.c}`}
                onClick={() => addIndex(idx)}
                className="card-interactive p-4 flex justify-between items-center"
              >
                <div>
                  <div className="text-sm font-bold text-slate-800">{idx.n}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{idx.c} · {idx.m === 'A' ? 'A股' : idx.m === 'HK' ? '港股' : '美股'}</div>
                </div>
                <div className="text-indigo-600 text-xs font-bold">点击添加</div>
              </div>
            ))}
            {searchQuery.length > 0 && (
              <div className="card p-6 text-center">
                {remoteResults.length === 0 && (
                  <div className="text-slate-400 text-sm mb-4">未找到相关指数，您可以手动添加</div>
                )}
                <button
                  onClick={() => {
                    const q = searchQuery.trim();
                    let m: 'A' | 'HK' | 'GLOBAL' = 'GLOBAL';
                    let mk = '100';
                    if (/^\d{6}$/.test(q)) {
                      m = 'A';
                      mk = q.startsWith('399') || q.startsWith('159') ? '0' : '1';
                    } else if (['HSI', 'HSCEI', 'HSTECH'].includes(q) || q.startsWith('HK')) {
                      m = 'HK';
                      mk = '100';
                    }
                    const newIdx = { c: q, n: `自定义指数 ${q}`, m, mk };
                    if (indices.find(i => i.c === q)) return;
                    const newIndices = [...indices, newIdx];
                    setIndices(newIndices);
                    localStorage.setItem('iv_indices', JSON.stringify(newIndices));
                    setSearchQuery('');
                    setRemoteResults([]);
                    setIndexMarket(m);
                    navigate('index_detail', newIdx);
                  }}
                  className="btn-primary px-6 py-2.5 rounded-xl"
                >
                  手动添加指数: {searchQuery}
                </button>
              </div>
            )}
            {searchQuery.length === 0 && remoteResults.length === 0 && (
              <div className="text-center py-20 text-slate-400 text-sm">输入关键词搜索指数</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface IndexDetailViewProps {
  idx: Index;
  batchData: Record<string, any>;
  indexVal: Record<string, { pe?: number; pb?: number; dy?: number; pePct?: number; pbPct?: number; source?: string }>;
  setView: (view: ViewType) => void;
  toggleFav: (code: string, type: 'stock' | 'index', e?: React.MouseEvent) => void;
  favIndices: string[];
}

const IndexDetailView = ({ idx, batchData, indexVal, setView, toggleFav, favIndices }: IndexDetailViewProps) => {
  const bd = batchData[idx.c];
  const iv = indexVal[idx.c];

  return (
    <div className="space-y-4">
      <div className="breadcrumb">
        <button onClick={() => setView('index_list')} className="breadcrumb-link">指数列表</button>
        <ChevronRight size={12} />
        <span>{idx.n}</span>
        <button onClick={(e) => toggleFav(idx.c, 'index', e)} className="ml-auto p-1 text-amber-400">
          {favIndices.includes(idx.c) ? <Star fill="currentColor" size={20} /> : <Star size={20} />}
        </button>
      </div>

      <div className="card-elevated p-5 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{idx.n}</h2>
            <div className="text-xs text-slate-400 font-mono mt-1">{idx.c} · {idx.m === 'A' ? 'A股' : idx.m === 'HK' ? '港股' : '国外'}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-900">{bd?.p || '—'}</div>
            {bd?.cp && (
              <div className={`text-sm font-bold ${parseFloat(bd.cp) >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {parseFloat(bd.cp) >= 0 ? '+' : ''}{bd.cp}%
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">PE (TTM)</div>
            <div className="text-base font-bold text-slate-800">{iv?.pe ? iv.pe.toFixed(2) : (bd?.pe !== undefined && bd.pe > 0 ? bd.pe : '—')}</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">PB</div>
            <div className="text-base font-bold text-slate-800">{iv?.pb ? iv.pb.toFixed(2) : (bd?.pb !== undefined && bd.pb > 0 ? bd.pb : '—')}</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">股息率</div>
            <div className="text-base font-bold text-slate-800">{iv?.dy ? `${(iv.dy * 100).toFixed(2)}%` : (bd?.dy !== undefined && bd.dy > 0 ? `${bd.dy}%` : '—')}</div>
          </div>
        </div>

        {iv?.source === 'computed' && (
          <div className="text-center text-[10px] text-amber-500 font-medium flex items-center justify-center gap-1">
            <span>⚠️</span> PE/PB 为从行业成分股推算，非指数直接数据
          </div>
        )}

        {bd?.pe && bd?.pe > 0 && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex justify-between items-center">
            <div>
              <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">价值估计 (基于历史均值)</div>
              <div className="text-lg font-bold text-indigo-600 tabular-nums">
                {bd?.p && bd?.pe ? `¥${(parseFloat(bd.p) * (15 / bd.pe)).toFixed(2)}` : '—'}
                <span className="text-xs font-medium ml-1 opacity-70">合理 PE 15.0x</span>
              </div>
            </div>
            <div className={`text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm ${bd.pe < 12 ? 'bg-emerald-50 text-emerald-600' : bd.pe < 18 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
              {bd.pe < 12 ? '低估' : bd.pe < 18 ? '合理' : '高估'}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">PE 百分位 (近10年)</div>
            <div className="text-2xl font-bold text-slate-800">{iv?.pePct !== undefined ? `${(iv.pePct * 100).toFixed(1)}` : (idx.pePct || '—')}%</div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">PB 百分位 (近10年)</div>
            <div className="text-2xl font-bold text-slate-800">{iv?.pbPct !== undefined ? `${(iv.pbPct * 100).toFixed(1)}` : (idx.pbPct || '—')}%</div>
          </div>
        </div>

        <div className={`rounded-2xl p-6 text-center ${
          ((iv?.pePct !== undefined ? iv.pePct * 100 : idx.pePct) || 50) < 30 ? 'bg-emerald-50 border border-emerald-100' : 
          ((iv?.pePct !== undefined ? iv.pePct * 100 : idx.pePct) || 50) > 70 ? 'bg-red-50 border border-red-100' : 
          'bg-amber-50 border border-amber-100'
        }`}>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">整体估值水平</div>
          <div className={`text-3xl font-black ${
            ((iv?.pePct !== undefined ? iv.pePct * 100 : idx.pePct) || 50) < 30 ? 'text-emerald-600' : 
            ((iv?.pePct !== undefined ? iv.pePct * 100 : idx.pePct) || 50) > 70 ? 'text-red-600' : 
            'text-amber-600'
          }`}>
            {((iv?.pePct !== undefined ? iv.pePct * 100 : idx.pePct) || 50) < 30 ? '低估' : ((iv?.pePct !== undefined ? iv.pePct * 100 : idx.pePct) || 50) > 70 ? '高估' : '适中'}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            基于 PE 百分位：{iv?.pePct !== undefined ? `${(iv.pePct * 100).toFixed(1)}%` : (idx.pePct ? `${idx.pePct}%` : '暂无数据')}
          </div>
        </div>

        <div className="p-4 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-2xl text-xs text-slate-600 leading-relaxed">
          <div className="font-bold text-indigo-600 mb-1">估值分析</div>
          <p>
            当前指数 PE 为 {iv?.pe ? iv.pe.toFixed(2) : (bd?.pe && bd.pe > 0 ? bd.pe : '—')}，PB 为 {iv?.pb ? iv.pb.toFixed(2) : (bd?.pb && bd.pb > 0 ? bd.pb : '—')}。
            {(iv?.pe || bd?.pe) && (iv?.pe || parseFloat(bd.pe)) < 15 ? '当前估值处于较低水平，具备较好的投资性价比。' : 
             (iv?.pe || bd?.pe) && (iv?.pe || parseFloat(bd.pe)) > 30 ? '当前估值处于较高水平，需警惕回调风险。' : 
             '当前估值处于合理区间。'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default function App() {
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
  // AI 对话管理
  interface ChatMessage { role: string; content: string; }
  interface ChatConversation { id: string; title: string; messages: ChatMessage[]; createdAt: number; }
  const [aiConversations, setAiConversations] = useState<ChatConversation[]>(() => {
    const saved = localStorage.getItem('iv_ai_convs');
    if (saved) return JSON.parse(saved);
    // 迁移旧数据
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
  const [showSettings, setShowSettings] = useState(false);
  const [livePrice, setLivePrice] = useState<{ 
    p: string; ch: string; cp: string; up: boolean;
    pe?: string; pb?: string; dy?: string; mcap?: string;
  } | null>(null);
  const [customCompanies, setCustomCompanies] = useState<any[]>(() => JSON.parse(localStorage.getItem('iv_custom_comps') || '[]'));
  const [deletedCompanies, setDeletedCompanies] = useState<string[]>(() => JSON.parse(localStorage.getItem('iv_deleted_comps') || '[]'));
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [aiAddError, setAiAddError] = useState<string | null>(null);
  const [batchData, setBatchData] = useState<Record<string, { pe?: number; pb?: number; dy?: number; mcap?: number; p?: string; cp?: string }>>({});
  const [indexVal, setIndexVal] = useState<Record<string, { pe?: number; pb?: number; dy?: number; pePct?: number; pbPct?: number; source?: string }>>({});
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('iv_dark');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // 初始化 & 切换暗色模式
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('iv_dark', String(darkMode));
  }, [darkMode]);

  // 导航状态 ref（供返回键监听使用，避免闭包陈旧）
  const navStackRef = useRef<NavigationState[]>([]);
  const navArgsRef = useRef<any[]>([]);
  const viewRef = useRef<ViewType>(view);
  const showSettingsRef = useRef(showSettings);

  // 同步 state → ref
  useEffect(() => { navStackRef.current = navStack; }, [navStack]);
  useEffect(() => { navArgsRef.current = navArgs; }, [navArgs]);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { showSettingsRef.current = showSettings; }, [showSettings]);

  // 状态栏：不覆盖 WebView，根据主题适配
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const timer = setTimeout(() => {
        StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
        StatusBar.setBackgroundColor({ color: darkMode ? '#0f172a' : '#ffffff' }).catch(() => {});
        StatusBar.setStyle({ style: darkMode ? Style.Light : Style.Dark }).catch(() => {});
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [darkMode]);

  // Android 返回键监听 —— 完全基于 ref，无闭包陈旧问题
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapApp.addListener('backButton', () => {
      // 1. 设置面板打开时 → 关闭设置
      if (showSettingsRef.current) {
        setShowSettings(false);
        return;
      }
      // 2. 有导航栈 → 返回上一页
      const stack = navStackRef.current;
      if (stack.length > 0) {
        const prev = stack[stack.length - 1];
        setNavStack(s => s.slice(0, -1));
        setView(prev.view);
        setNavArgs(prev.args);
        window.scrollTo(0, 0);
        return;
      }
      // 3. 在首页 → 最小化
      if (viewRef.current === 'home') {
        CapApp.minimizeApp();
        return;
      }
      // 4. 其他页面 → 回到首页
      setView('home');
      setNavStack([]);
      setNavArgs([]);
    });
    return () => { listener.then(l => l.remove()); };
  }, []);

  // Capacitor 环境下直接访问真实 API（无 CORS 限制），Web 环境走代理
  const djApiBase = Capacitor.isNativePlatform() ? 'https://danjuanfunds.com' : '';
  const sinaApiBase = Capacitor.isNativePlatform() ? 'https://vip.stock.finance.sina.com.cn' : '';

  const getMergedIndustries = (base: Industry[], mkt: 'A' | 'HK' | 'GLOBAL') => {
    const merged = JSON.parse(JSON.stringify(base)) as Industry[];
    
    merged.forEach(ind => {
      ind.l2.forEach(sub => {
        sub.cs = sub.cs.filter(c => !deletedCompanies.includes(c.c));
      });
      ind.l2 = ind.l2.filter(sub => sub.cs.length > 0);
    });
    const filteredMerged = merged.filter(ind => ind.l2.length > 0);

    const marketCustom = customCompanies.filter(c => c.market === mkt && !deletedCompanies.includes(c.c));
    
    marketCustom.forEach(cc => {
      let ind = filteredMerged.find(i => i.nm === (cc.indName || '其他行业'));
      if (!ind) {
        ind = { id: `custom_${Date.now()}_${Math.random()}`, nm: cc.indName || '其他行业', ic: cc.ic || '🏢', ev: 'mid', l2: [], pe: 20, pb: 2, pp: 0, bp: 0, roe: 15, dy: 2, an: '自定义添加的行业' };
        filteredMerged.push(ind);
      }
      let sub = ind.l2.find(s => s.nm === (cc.subIndName || '其他细分'));
      if (!sub) {
        sub = { nm: cc.subIndName || '其他细分', cs: [] };
        ind.l2.push(sub);
      }
      if (!sub.cs.find(x => x.c === cc.c)) {
        sub.cs.push({
          c: cc.c, n: cc.n, pe: Number(cc.pe) || 0, pb: Number(cc.pb) || 0, roe: Number(cc.roe) || 0, dy: Number(cc.dy) || 0, ps: Number(cc.ps) || 0, market: cc.market
        });
      }
    });
    return filteredMerged;
  };

  const mergedA = getMergedIndustries(INDUSTRIES, 'A');
  const mergedHK = getMergedIndustries(HK_INDUSTRIES, 'HK');
  const mergedGlobal = getMergedIndustries([], 'GLOBAL');
  const currentIndustries = market === 'A' ? mergedA : (market === 'HK' ? mergedHK : mergedGlobal);
  const allIndustries = [...mergedA, ...mergedHK, ...mergedGlobal];

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
      const indCodes = allIndustries.flatMap(ind => (ind.indices || []).map(idx => ({ c: idx.c, market: 'IDX' })));
      const userIndices = indices.map(idx => ({ c: idx.c, market: idx.m === 'A' ? 'IDX' : idx.m }));
      const combined = [...allCodes, ...bkCodes, ...indCodes, ...userIndices];
      if (combined.length === 0) return;
      
      const secidsList = combined.map(c => {
        if (c.market === 'BK') return `90.${c.c}`;
        if (c.market === 'IDX') {
          // Use stored mk if available for precise market identification
          // Fallback: 000xxx/001xxx/930xxx/931xxx → SH (1), 399xxx → SZ (0)
          const idx = indices.find(i => i.c === c.c);
          if (idx?.mk) return `${idx.mk}.${c.c}`;
          const realMk = (c.c.startsWith('399') || c.c.startsWith('159')) ? '0' : '1';
          return `${realMk}.${c.c}`;
        }
        if (c.market === 'HK') {
          if (['HSI', 'HSCEI', 'HSTECH'].includes(c.c)) return `100.${c.c}`;
          return `116.${c.c}`;
        }
        if (c.market === 'GLOBAL') {
          // Use stored mk if available
          const idx = indices.find(i => i.c === c.c);
          if (idx?.mk) return `${idx.mk}.${c.c}`;
          // Fallback hardcoded mappings
          if (c.c === 'DJI') return '100.UDI';
          if (c.c === 'IXIC') return '100.IXIC';
          if (c.c === 'INX') return '100.SPX';
          if (c.c === 'N225') return '100.N225';
          if (c.c === 'KS11') return '100.KOSPI';
          if (c.c === 'FTSE') return '100.FTSE';
          if (c.c === 'GDAXI') return '100.GDAXI';
          if (c.c === 'FCHI') return '100.FCHI';
          if (c.c === 'NSEI') return '100.NIFTY';
          if (c.c === 'BVSP') return '100.BVSP';
          return `105.${c.c}`;
        }
        const mk = c.market === 'HK' ? '116' : (c.c.startsWith('6') ? '1' : '0');
        return `${mk}.${c.c}`;
      });

      const chunkSize = 100;
      for (let i = 0; i < secidsList.length; i += chunkSize) {
        const chunk = secidsList.slice(i, i + chunkSize).join(',');
        const cbName = `jsonp_batch_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        
        const timeoutId = setTimeout(() => {
          delete (window as any)[cbName];
          const scriptEl = document.getElementById(cbName);
          if (scriptEl) scriptEl.remove();
        }, 10000);
        
        (window as any)[cbName] = (d: any) => {
          clearTimeout(timeoutId);
          if (d?.data?.diff) {
            setBatchData(prev => {
              const newData = { ...prev };
              d.data.diff.forEach((item: any) => {
                let code = item.f12;
                // Map back special codes for global indices
                if (code === 'UDI') code = 'DJI';
                if (code === 'SPX') code = 'INX';
                if (code === 'KOSPI') code = 'KS11';
                if (code === 'NIFTY') code = 'NSEI';

                const mkId = item.f13; // Market ID: 1=SH, 0=SZ, 116=HK, 90=BK
                const pScale = mkId === 116 ? 1000 : 100;
                
                const pe = item.f162 !== '-' && item.f162 !== undefined && item.f162 > 0 ? item.f162 / 100 : (item.f9 !== '-' && item.f9 !== undefined && item.f9 > 0 ? item.f9 / 100 : undefined);
                const pb = item.f167 !== '-' && item.f167 !== undefined && item.f167 > 0 ? item.f167 / 100 : (item.f23 !== '-' && item.f23 !== undefined && item.f23 > 0 ? item.f23 / 100 : undefined);
                const dy = item.f173 !== '-' && item.f173 !== undefined && item.f173 > 0 ? item.f173 / 100 : undefined;
                const mcap = item.f116 !== '-' && item.f116 !== undefined ? item.f116 / 100000000 : undefined;
                
                const p = item.f2 !== '-' && item.f2 !== undefined ? (item.f2 / pScale).toFixed(mkId === 116 ? 3 : 2) : undefined;
                const cp = item.f3 !== '-' && item.f3 !== undefined ? (item.f3 / 100).toFixed(2) : undefined;
                
                newData[code] = { pe, pb, dy, mcap, p, cp };
              });
              return newData;
            });
          }
          delete (window as any)[cbName];
          const scriptEl = document.getElementById(cbName);
          if (scriptEl) scriptEl.remove();
        };
        
        const script = document.createElement('script');
        script.id = cbName;
        script.src = `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${chunk}&fields=f12,f13,f14,f2,f3,f9,f23,f116,f162,f167,f173&cb=${cbName}`;
        script.onerror = () => {
          clearTimeout(timeoutId);
          delete (window as any)[cbName];
          const scriptEl = document.getElementById(cbName);
          if (scriptEl) scriptEl.remove();
        };
        document.head.appendChild(script);
      }
    };

    fetchBatch();
    const timer = setInterval(fetchBatch, 10000);
    return () => clearInterval(timer);
  }, [allCodesStr]);

  // Fetch index valuation from danjuanfunds.com + eastmoney as fallback
  const allIndexCodes = indices.map(i => i.c).join(',');
  useEffect(() => {
    if (indices.length === 0) return;
    
    const fetchIndexValuation = async () => {
      const matchedCodes = new Set<string>();
      const applyData = (djItems: any[]) => {
        const newVal: Record<string, { pe?: number; pb?: number; dy?: number; pePct?: number; pbPct?: number }> = {};
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
            };
          }
        }
        setIndexVal(prev => ({ ...prev, ...newVal }));
      };

      try {
        // Capacitor: 直接访问 danjuanfunds.com；Web: 走 /djapi 代理
        const resp = await fetch(`${djApiBase}/djapi/index_eva/dj`);
        const data = await resp.json();
        if (data.data && data.data.items && data.data.items.length > 0) {
          applyData(data.data.items);
        }
      } catch (e) {
        // CORS blocked in production - percentile data unavailable
      }

      // Supplementary: fetch PE/PB for indices not matched by danjuan via eastmoney stock API
      const missingIndices = indices.filter(idx => !matchedCodes.has(idx.c));
      for (const idx of missingIndices) {
        if (!idx.mk || idx.m === 'GLOBAL') continue;
        const cbName = `jsonp_idxval_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const timeoutId = setTimeout(() => {
          delete (window as any)[cbName];
          const el = document.getElementById(cbName);
          if (el) el.remove();
        }, 8000);
        
        (window as any)[cbName] = (d: any) => {
          clearTimeout(timeoutId);
          if (d?.data) {
            const pe = d.data.f162 !== '-' && d.data.f162 > 0 ? d.data.f162 / 100 : 
                       (d.data.f9 !== '-' && d.data.f9 > 0 ? d.data.f9 / 100 : undefined);
            const pb = d.data.f167 !== '-' && d.data.f167 > 0 ? d.data.f167 / 100 :
                       (d.data.f23 !== '-' && d.data.f23 > 0 ? d.data.f23 / 100 : undefined);
            const dy = d.data.f173 !== '-' && d.data.f173 > 0 ? d.data.f173 / 100 : undefined;
            if (pe || pb) {
              setIndexVal(prev => ({
                ...prev,
                [idx.c]: { pe, pb, dy }
              }));
            }
          }
          delete (window as any)[cbName];
          const el = document.getElementById(cbName);
          if (el) el.remove();
        };
        
        const script = document.createElement('script');
        script.id = cbName;
        script.src = `https://push2.eastmoney.com/api/qt/stock/get?secid=${idx.mk}.${idx.c}&fields=f9,f23,f162,f167,f173&cb=${cbName}`;
        script.onerror = () => {
          clearTimeout(timeoutId);
          delete (window as any)[cbName];
          const el = document.getElementById(cbName);
          if (el) el.remove();
        };
        document.head.appendChild(script);
      }
    };
    
    fetchIndexValuation();
    const timer = setInterval(fetchIndexValuation, 60000);
    return () => clearInterval(timer);
  }, [allIndexCodes]);

  // Fallback: compute index PE/PB from constituent stocks via Sina API
  useEffect(() => {
    const fetchAndCompute = async () => {
      for (const idx of indices) {
        // Skip if already have data from DJ or eastmoney
        const iv = indexVal[idx.c];
        if (iv?.pe && iv.pe > 0) continue;
        // Skip non-A-share indices (Sina only covers A-share)
        if (idx.m !== 'A') continue;

        try {
          // 1. Fetch constituent stocks from Sina
          const resp = await fetch(`${sinaApiBase}/corp/go.php/vII_NewestComponent/indexid/${idx.c}.phtml`);
          const buf = await resp.arrayBuffer();
          const html = new TextDecoder('gbk').decode(buf);
          const codeMatches = [...html.matchAll(/<div align="center">(\d{6})<\/div>/g)];
          const codes = [...new Set(codeMatches.map(m => m[1]))];

          if (codes.length === 0) continue;

          // 2. Batch fetch PE/PB for constituents from eastmoney
          const secids = codes.map(c => `${c.startsWith('6') ? '1' : '0'}.${c}`).join(',');
          const batchResp = await fetch(`https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${secids}&fields=f12,f2,f9,f23,f116,f162,f167,f173`);
          const batchData = await batchResp.json();

          if (!batchData?.data?.diff) continue;

          // 3. Compute weighted PE/PB
          let totalPE = 0, totalPB = 0, totalDY = 0;
          let peW = 0, pbW = 0, dyW = 0;
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
            setIndexVal(prev => ({
              ...prev,
              [idx.c]: { pe: avgPE, pb: avgPB, dy: avgDY, source: 'computed' }
            }));
          }
        } catch (e) {
          // Sina API may fail (CORS, network, etc.) — silently skip
        }
      }
    };

    // Run after a delay to let DJ/eastmoney results arrive first
    const timer = setTimeout(fetchAndCompute, 5000);
    return () => clearTimeout(timer);
  }, [allIndexCodes]);

  // 专用指数 PE/PB/DY 获取：逐个 JSONP 请求 eastmoney 单品种接口
  // 批量 API (ulist.np) 对指数可能不返回估值字段，此效果确保指数估值数据可靠获取
  useEffect(() => {
    if (indices.length === 0) return;

    const fetchAllIndexVal = () => {
      indices.forEach((idx, i) => {
        if (!idx.mk || idx.m === 'GLOBAL') return;

        const cbName = `jsonp_ixval_${Date.now()}_${i}_${Math.floor(Math.random() * 10000)}`;
        const timeoutId = setTimeout(() => {
          delete (window as any)[cbName];
          const el = document.getElementById(cbName);
          if (el) el.remove();
        }, 8000);

        (window as any)[cbName] = (d: any) => {
          clearTimeout(timeoutId);
          if (d?.data) {
            const pe = d.data.f162 !== undefined && d.data.f162 !== '-' && d.data.f162 > 0 ? d.data.f162 / 100 :
                       d.data.f9 !== undefined && d.data.f9 !== '-' && d.data.f9 > 0 ? d.data.f9 / 100 : undefined;
            const pb = d.data.f167 !== undefined && d.data.f167 !== '-' && d.data.f167 > 0 ? d.data.f167 / 100 :
                       d.data.f23 !== undefined && d.data.f23 !== '-' && d.data.f23 > 0 ? d.data.f23 / 100 : undefined;
            const dy = d.data.f173 !== undefined && d.data.f173 !== '-' && d.data.f173 > 0 ? d.data.f173 / 100 : undefined;
            if (pe || pb) {
              setIndexVal(prev => {
                const existing = prev[idx.c];
                // 仅在无数据或数据更优时更新
                if (!existing?.pe && !existing?.pb) {
                  return { ...prev, [idx.c]: { pe, pb, dy } };
                }
                return prev;
              });
            }
          }
          delete (window as any)[cbName];
          const el = document.getElementById(cbName);
          if (el) el.remove();
        };

        const script = document.createElement('script');
        script.id = cbName;
        script.src = `https://push2.eastmoney.com/api/qt/stock/get?secid=${idx.mk}.${idx.c}&fields=f9,f23,f162,f167,f173&cb=${cbName}`;
        script.onerror = () => {
          clearTimeout(timeoutId);
          delete (window as any)[cbName];
          const el = document.getElementById(cbName);
          if (el) el.remove();
        };
        document.head.appendChild(script);
      });
    };

    // 首次立即执行 + 每 60 秒刷新
    fetchAllIndexVal();
    const timer = setInterval(fetchAllIndexVal, 60000);
    return () => clearInterval(timer);
  }, [allIndexCodes]);

  useEffect(() => {
    localStorage.setItem('iv_fav_stocks', JSON.stringify(favStocks));
    localStorage.setItem('iv_fav_indices', JSON.stringify(favIndices));
  }, [favStocks, favIndices]);

  useEffect(() => {
    localStorage.setItem('iv_cfg', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('iv_ai_convs', JSON.stringify(aiConversations));
  }, [aiConversations]);

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
    } else {
      setView('home');
    }
  };

  const toggleFav = (code: string, type: 'stock' | 'index', e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (type === 'stock') {
      setFavStocks(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
    } else {
      setFavIndices(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
    }
  };

  const pColor = (v: number) => v < 30 ? 'text-emerald-600' : v < 70 ? 'text-amber-600' : 'text-red-600';
  const pBg = (v: number) => v < 30 ? 'bg-emerald-600' : v < 70 ? 'bg-amber-600' : 'bg-red-600';
  const evColor = (e: string) => e === 'low' ? 'bg-emerald-50 text-emerald-600' : e === 'mid' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600';
  const evText = (e: string) => e === 'low' ? '低估' : e === 'mid' ? '适中' : '高估';

  const getGrade = (v: number, ts: number[]) => v >= ts[0] ? 'A+' : v >= ts[1] ? 'A' : v >= ts[2] ? 'B+' : v >= ts[3] ? 'B' : 'C';
  const gColor = (g: string) => g.includes('A') ? 'text-emerald-600' : g === 'B+' ? 'text-amber-600' : 'text-red-600';

  // Live Price Fetching
  useEffect(() => {
    if (view === 'comp' && navArgs[0]) {
      const code = navArgs[0];
      
      // Find company to determine market
      let cMarket = 'A';
      let foundComp: any = null;
      for (const ind of allIndustries) {
        for (const sub of ind.l2) {
          const comp = (sub.cs || []).find(c => c.c === code);
          if (comp) {
            cMarket = comp.market || 'A';
            foundComp = comp;
            break;
          }
        }
        if (foundComp) break;
      }

      let mk = '0';
      if (cMarket === 'HK') {
        mk = '116';
      } else if (cMarket === 'GLOBAL') {
        // Simple heuristic for US stocks if no specific market type is stored
        // Most US tech stocks are on NASDAQ (105)
        mk = '105'; 
      } else {
        mk = code.startsWith('6') ? '1' : '0';
      }
      
      const fetchPrice = () => {
        const cbName = `jsonp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        
        // Add timeout to detect silent JSONP failures
        const timeoutId = setTimeout(() => {
          delete (window as any)[cbName];
          const scriptEl = document.getElementById(cbName);
          if (scriptEl) scriptEl.remove();
        }, 8000);
        
        (window as any)[cbName] = (d: any) => {
          clearTimeout(timeoutId);
          if (d.data) {
            const pScale = mk === '116' ? 1000 : 100;
            const pVal = d.data.f43 !== undefined && d.data.f43 !== '-' ? d.data.f43 : (d.data.f2 !== undefined && d.data.f2 !== '-' ? d.data.f2 : d.data.f60);
            const chVal = d.data.f170 !== undefined && d.data.f170 !== '-' ? d.data.f170 : d.data.f4;
            const cpVal = d.data.f171 !== undefined && d.data.f171 !== '-' ? d.data.f171 : d.data.f3;

            const p = pVal !== undefined && pVal !== '-' ? (pVal / pScale).toFixed(mk === '116' ? 3 : 2) : '—';
            const ch = chVal !== undefined && chVal !== '-' ? (chVal / pScale).toFixed(mk === '116' ? 3 : 2) : '—';
            const cp = cpVal !== undefined && cpVal !== '-' ? (cpVal / 100).toFixed(2) : '—';
            
            const pe = d.data.f162 !== '-' && d.data.f162 !== undefined && d.data.f162 > 0 ? (d.data.f162 / 100).toFixed(2) : (d.data.f9 !== '-' && d.data.f9 !== undefined && d.data.f9 > 0 ? (d.data.f9 / 100).toFixed(2) : undefined);
            const pb = d.data.f167 !== '-' && d.data.f167 !== undefined && d.data.f167 > 0 ? (d.data.f167 / 100).toFixed(2) : (d.data.f23 !== '-' && d.data.f23 !== undefined && d.data.f23 > 0 ? (d.data.f23 / 100).toFixed(2) : undefined);
            const dy = d.data.f173 !== '-' && d.data.f173 !== undefined ? (d.data.f173 / 100).toFixed(2) : undefined;
            const mcap = d.data.f116 !== '-' && d.data.f116 !== undefined ? (d.data.f116 / 100000000).toFixed(2) : undefined;

            setLivePrice({ p, ch, cp, up: parseFloat(ch) >= 0, pe, pb, dy, mcap });
          }
          delete (window as any)[cbName];
          const scriptEl = document.getElementById(cbName);
          if (scriptEl) scriptEl.remove();
        };
        
        const script = document.createElement('script');
        script.id = cbName;
        script.src = `https://push2.eastmoney.com/api/qt/stock/get?secid=${mk}.${code}&fields=f43,f170,f171,f2,f3,f4,f162,f167,f173,f116,f9,f23,f60&cb=${cbName}`;
        script.onerror = () => {
          clearTimeout(timeoutId);
          console.error('Failed to fetch price');
          delete (window as any)[cbName];
          const scriptEl = document.getElementById(cbName);
          if (scriptEl) scriptEl.remove();
        };
        document.head.appendChild(script);
      };
      fetchPrice();
      const timer = setInterval(fetchPrice, 10000);
      return () => clearInterval(timer);
    } else {
      setLivePrice(null);
    }
  }, [view, navArgs]);

  const handleDeleteCompany = (code: string) => {
    const newDeleted = [...deletedCompanies, code];
    setDeletedCompanies(newDeleted);
    localStorage.setItem('iv_deleted_comps', JSON.stringify(newDeleted));
    
    const newCustom = customCompanies.filter(c => c.c !== code);
    setCustomCompanies(newCustom);
    localStorage.setItem('iv_custom_comps', JSON.stringify(newCustom));
    
    setView('home');
  };

  const handleRestoreDefaults = () => {
    setCustomCompanies([]);
    localStorage.removeItem('iv_custom_comps');
    setDeletedCompanies([]);
    localStorage.removeItem('iv_deleted_comps');
    setView('home');
    setShowSettings(false);
  };

  const getIndustryValuation = (ind: Industry) => {
    // Priority: Use BK index data if available
    if (ind.bk && batchData[ind.bk]) {
      const bkd = batchData[ind.bk];
      return {
        pe: bkd.pe || ind.pe,
        pb: bkd.pb || ind.pb,
        dy: bkd.dy || ind.dy,
        cp: bkd.cp,
        roe: (bkd.pe && bkd.pb && Number(bkd.pe) > 0) ? ((Number(bkd.pb) / Number(bkd.pe)) * 100).toFixed(1) : ind.roe,
        source: 'index'
      };
    }

    let totalPE = 0, totalPB = 0, totalDY = 0, totalCP = 0, totalMCap = 0;
    let peCount = 0, pbCount = 0, dyCount = 0, cpCount = 0;

    ind.l2.forEach(sub => {
      sub.cs.forEach(c => {
        const bd = batchData[c.c];
        const pe = bd?.pe ? parseFloat(bd.pe) : c.pe;
        const pb = bd?.pb ? parseFloat(bd.pb) : c.pb;
        const dy = bd?.dy ? parseFloat(bd.dy) : c.dy;
        const mcap = bd?.mcap ? parseFloat(bd.mcap) : 1;
        const cp = bd?.cp ? parseFloat(bd.cp) : undefined;

        if (pe && pe > 0) { totalPE += pe * mcap; peCount += mcap; }
        if (pb && pb > 0) { totalPB += pb * mcap; pbCount += mcap; }
        if (dy && dy > 0) { totalDY += dy * mcap; dyCount += mcap; }
        if (cp !== undefined) { totalCP += cp * mcap; cpCount += mcap; }
      });
    });

    const avgPE = peCount > 0 ? (totalPE / peCount).toFixed(1) : ind.pe;
    const avgPB = pbCount > 0 ? (totalPB / pbCount).toFixed(2) : ind.pb;
    const avgDY = dyCount > 0 ? (totalDY / dyCount).toFixed(2) : ind.dy;
    const avgCP = cpCount > 0 ? (totalCP / cpCount).toFixed(2) : undefined;
    const avgROE = (avgPE && avgPB && Number(avgPE) > 0) ? ((Number(avgPB) / Number(avgPE)) * 100).toFixed(1) : ind.roe;

    return { pe: avgPE, pb: avgPB, roe: avgROE, dy: avgDY, cp: avgCP, source: 'calc' };
  };

  const renderHome = () => (
    <div className="space-y-4">
      {/* Market Switcher */}
      <div className="flex bg-white/80 border border-slate-200/60 rounded-2xl p-1 shadow-card">
        <button
          onClick={() => setMarket('A')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${
            market === 'A' ? 'tab-pill-active' : 'tab-pill-inactive'
          }`}
        >
          A股行业
        </button>
        <button
          onClick={() => setMarket('HK')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${
            market === 'HK' ? 'tab-pill-active' : 'tab-pill-inactive'
          }`}
        >
          港股行业
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="stat-cell">
          <div className="stat-label">一级行业</div>
          <div className="text-xl font-extrabold text-brand-600 tabular-nums">{currentIndustries.length}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">龙头公司</div>
          <div className="text-xl font-extrabold text-cyan-600 tabular-nums">
            {currentIndustries.reduce((a, i) => a + i.l2.reduce((b, s) => b + (s.cs || []).length, 0), 0)}
          </div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">低估行业</div>
          <div className="text-xl font-extrabold text-emerald-600 tabular-nums">
            {currentIndustries.filter(i => i.ev === 'low').length}
          </div>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {(['all', 'low', 'mid', 'high'] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
              filter === t 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'bg-white text-slate-500 border border-slate-200/60'
            }`}
          >
            {t === 'all' ? '全部' : t === 'low' ? '低估' : t === 'mid' ? '适中' : '高估'}
          </button>
        ))}
      </div>

      {/* Industry Cards */}
      <div className="space-y-3">
        {currentIndustries.filter(i => filter === 'all' || i.ev === filter).map((ind, idx) => {
          const indVal = getIndustryValuation(ind);
          return (
          <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            key={ind.id}
            onClick={() => navigate('ind', idx)}
            className="card-interactive p-4 relative overflow-hidden"
          >
            {indVal.source === 'index' && (
              <div className="absolute top-0 right-0 badge-brand rounded-bl-xl px-2.5 py-1 scale-90 origin-top-right">
                实时数据
              </div>
            )}
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-extrabold text-slate-900">{ind.ic} {ind.nm}</span>
                {indVal.cp !== undefined && (
                  <span className={`text-[10px] font-bold tabular-nums ${parseFloat(indVal.cp) >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {parseFloat(indVal.cp) >= 0 ? '▲' : '▼'}{Math.abs(parseFloat(indVal.cp)).toFixed(2)}%
                  </span>
                )}
              </div>
              <span className={`badge ${ind.ev === 'low' ? 'val-low' : ind.ev === 'mid' ? 'val-mid' : 'val-high'}`}>
                {evText(ind.ev)}
              </span>
            </div>
            {Number(indVal.pe) > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="stat-cell py-2">
                  <div className="stat-label">PE</div>
                  <div className="stat-value">{indVal.pe}</div>
                </div>
                <div className="stat-cell py-2">
                  <div className="stat-label">PB</div>
                  <div className="stat-value">{indVal.pb}</div>
                </div>
                <div className="stat-cell py-2">
                  <div className="stat-label">股息率</div>
                  <div className="stat-value">{indVal.dy}%</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-[10px] mb-2.5">
              <span className="text-slate-400 font-bold w-10">PE%位</span>
              <div className="progress-bar flex-1">
                <div 
                  className="progress-bar-fill" 
                  style={{ 
                    width: `${Math.min(ind.pp, 100)}%`,
                    background: ind.pp < 30 ? 'linear-gradient(90deg, #10b981, #34d399)' : ind.pp < 70 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #ef4444, #f87171)'
                  }} 
                />
              </div>
              <span className={`w-8 text-right font-bold tabular-nums ${pColor(ind.pp)}`}>{ind.pp}%</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ind.l2.map(s => (
                <span key={s.nm} className="text-[9px] px-2 py-0.5 bg-surface text-slate-500 border border-slate-100/80 rounded-md font-semibold">
                  {s.nm}
                </span>
              ))}
            </div>
          </motion.div>
        )})}
      </div>
    </div>
  );

  const renderInd = (idx: number) => {
    const ind = currentIndustries[idx];
    if (!ind) return null;
    const indVal = getIndustryValuation(ind);
    return (
      <div className="space-y-5">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <button onClick={() => setView('home')} className="breadcrumb-link">全部</button>
          <ChevronRight size={11} />
          <span className="text-slate-600 font-medium">{ind.nm}</span>
        </div>

        {/* Industry Overview Card */}
        <div className="card-elevated p-5 relative overflow-hidden">
          {indVal.source === 'index' && (
            <div className="absolute top-0 right-0 badge-brand rounded-bl-xl px-2.5 py-1">
              实时指数数据
            </div>
          )}
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-extrabold text-slate-900">{ind.ic} {ind.nm}</h2>
              {indVal.cp !== undefined && (
                <span className={`text-[11px] font-bold tabular-nums ${parseFloat(indVal.cp) >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {parseFloat(indVal.cp) >= 0 ? '▲' : '▼'}{Math.abs(parseFloat(indVal.cp)).toFixed(2)}%
                </span>
              )}
            </div>
            <span className={`badge ${ind.ev === 'low' ? 'val-low' : ind.ev === 'mid' ? 'val-mid' : 'val-high'}`}>
              {evText(ind.ev)}
            </span>
          </div>

          {ind.indices && ind.indices.length > 0 && (
            <div className="mb-4">
              <div className="stat-label mb-2">相关指数</div>
              <div className="flex flex-wrap gap-2">
                {ind.indices.map(idxInfo => {
                  const bd = batchData[idxInfo.c];
                  return (
                    <button
                      key={idxInfo.c}
                      onClick={() => navigate('index', idx, idxInfo.c)}
                      className="stat-cell px-3 py-2 text-left active:scale-95 transition-transform"
                    >
                      <div className="text-[10px] font-bold text-slate-700">{idxInfo.n}</div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 tabular-nums">{bd?.p || '—'}</span>
                        {bd?.cp && (
                          <span className={`text-[9px] font-bold tabular-nums ${parseFloat(bd.cp) >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {parseFloat(bd.cp) >= 0 ? '▲' : '▼'}{Math.abs(parseFloat(bd.cp)).toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'PE', val: indVal.pe || '—' },
              { label: 'PB', val: indVal.pb },
              { label: 'ROE', val: `${indVal.roe}%` },
              { label: '股息率', val: `${indVal.dy}%` },
              { label: 'PE%位', val: `${ind.pp}%`, color: pColor(ind.pp) },
              { label: 'PB%位', val: `${ind.bp}%`, color: pColor(ind.bp) },
            ].map(m => (
              <div key={m.label} className="stat-cell">
                <div className="stat-label">{m.label}</div>
                <div className={`stat-value ${m.color || ''}`}>{m.val}</div>
              </div>
            ))}
          </div>
          
          <div className="p-3.5 bg-brand-50/50 border-l-[3px] border-brand-400 rounded-r-xl text-[13px] text-slate-600 leading-relaxed">
            {ind.an}
          </div>
        </div>

        {/* Sub-industries */}
        <div className="space-y-2.5">
          <h3 className="text-sm font-extrabold text-slate-900 px-0.5">二级行业</h3>
          {ind.l2.map((s, si) => (
            <div
              key={s.nm}
              onClick={() => navigate('sub', idx, si)}
              className="card-interactive p-4 flex justify-between items-center"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-[13px] font-bold text-slate-800">{s.nm}</span>
                <span className="badge-brand text-[8px]">二级</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                {s.cs.length}家 <ChevronRight size={13} className="text-slate-300" />
              </div>
            </div>
          ))}
        </div>

        {/* Company Cards */}
        <div className="space-y-2.5">
          <h3 className="text-sm font-extrabold text-slate-900 px-0.5">龙头公司</h3>
          {ind.l2.flatMap(s => s.cs.map(c => ({ ...c, sn: s.nm }))).map(c => (
            <div
              key={`${c.market || 'A'}-${c.c}`}
              onClick={() => navigate('comp', c.c, c.n)}
              className="card-interactive p-4"
            >
              <div className="flex justify-between items-start mb-2.5">
                <div>
                  <div className="text-[13px] font-bold text-slate-900">{c.n}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{c.c} · {c.sn}</div>
                </div>
                {batchData[c.c] && batchData[c.c].p && (
                  <div className="text-right">
                    <div className="text-[13px] font-bold text-slate-900 tabular-nums">¥{batchData[c.c].p}</div>
                    <div className={`text-[10px] font-bold tabular-nums ${parseFloat(batchData[c.c].cp || '0') >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {parseFloat(batchData[c.c].cp || '0') >= 0 ? '▲' : '▼'}{Math.abs(parseFloat(batchData[c.c].cp || '0')).toFixed(2)}%
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { l: 'PE', v: batchData[c.c]?.pe || c.pe || '—' },
                  { l: 'PB', v: batchData[c.c]?.pb || c.pb },
                  { l: 'ROE', v: `${c.roe}%` },
                  { l: '股息', v: `${batchData[c.c]?.dy || c.dy}%` },
                  { l: 'PS', v: c.ps },
                ].map(m => (
                  <div key={m.l} className="stat-cell py-1.5">
                    <div className="stat-label text-[7px]">{m.l}</div>
                    <div className="text-[10px] font-bold text-slate-700 tabular-nums">{m.v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSub = (idx: number, sidx: number) => {
    const ind = currentIndustries[idx];
    if (!ind) return null;
    const sub = ind.l2[sidx];
    if (!sub) return null;
    return (
      <div className="space-y-4">
        <div className="breadcrumb">
          <button onClick={() => setView('home')} className="breadcrumb-link">全部</button>
          <ChevronRight size={12} />
          <button onClick={() => navigate('ind', idx)} className="breadcrumb-link">{ind.nm}</button>
          <ChevronRight size={12} />
          <span>{sub.nm}</span>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-lg font-bold text-slate-800">{ind.ic} {sub.nm}</h2>
          <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded font-bold">二级</span>
        </div>

        <div className="space-y-3">
          {sub.cs.map(c => (
            <div
              key={`${c.market || 'A'}-${c.c}`}
              onClick={() => navigate('comp', c.c, c.n)}
              className="card-interactive p-4"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-sm font-bold text-slate-800">{c.n}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{c.c}</div>
                </div>
                {batchData[c.c] && batchData[c.c].p && (
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-800">¥{batchData[c.c].p}</div>
                    <div className={`text-[10px] font-bold ${parseFloat(batchData[c.c].cp || '0') >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {parseFloat(batchData[c.c].cp || '0') >= 0 ? '+' : ''}{batchData[c.c].cp}%
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-5 gap-1">
                {[
                  { l: 'PE', v: batchData[c.c]?.pe || c.pe || '—' },
                  { l: 'PB', v: batchData[c.c]?.pb || c.pb },
                  { l: 'ROE', v: `${c.roe}%` },
                  { l: '股息', v: `${batchData[c.c]?.dy || c.dy}%` },
                  { l: 'PS', v: c.ps },
                ].map(m => (
                  <div key={m.l} className="bg-slate-50 rounded-lg py-1 text-center">
                    <div className="text-[8px] text-slate-400 font-bold uppercase">{m.l}</div>
                    <div className="text-[10px] font-bold text-slate-700">{m.v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderComp = (code: string, name: string) => {
    let ind: Industry | undefined;
    let c: any;
    
    // Trim code for robust matching
    const tCode = code.trim();

    for (const i of allIndustries) {
      const allC = i.l2.flatMap(s => s.cs.map(comp => ({ ...comp, sn: s.nm })));
      const found = allC.find(x => x.c === tCode);
      if (found) {
        ind = i;
        c = found;
        break;
      }
    }
    
    // Fallback search in customCompanies if not found in allIndustries (though it should be)
    if (!c) {
      const found = customCompanies.find(x => x.c === tCode);
      if (found) {
        c = found;
        ind = allIndustries.find(i => i.nm === (found.indName || '其他行业')) || allIndustries[0];
      }
    }

    if (!c || !ind) return <div className="p-8 text-center text-gray-500">未找到公司数据 ({tCode})</div>;

    const ii = currentIndustries.findIndex(i => i.id === ind?.id);

    const currentPE = livePrice?.pe && !isNaN(parseFloat(livePrice.pe)) && parseFloat(livePrice.pe) > 0 ? parseFloat(livePrice.pe) : (batchData[tCode]?.pe || c.pe || 0);
    const currentPB = livePrice?.pb && !isNaN(parseFloat(livePrice.pb)) && parseFloat(livePrice.pb) > 0 ? parseFloat(livePrice.pb) : (batchData[tCode]?.pb || c.pb || 0);
    const currentDY = livePrice?.dy && !isNaN(parseFloat(livePrice.dy)) ? parseFloat(livePrice.dy) : (batchData[tCode]?.dy || c.dy || 0);

    const rf = 0.05, erp = 0.06, beta = 1, wacc = rf + beta * erp;
    const growth = c.roe > 20 ? 0.08 : c.roe > 15 ? 0.06 : c.roe > 10 ? 0.04 : 0.02;
    const tg = 0.025, yrs = 10, eps = currentPE > 0 ? (100 / currentPE) : 0;
    let dcf = 0;
    for (let y = 1; y <= yrs; y++) dcf += eps * Math.pow(1 + growth, y) / Math.pow(1 + wacc, y);
    dcf += (eps * Math.pow(1 + growth, yrs) * (1 + tg)) / (wacc - tg) / Math.pow(1 + wacc, yrs);
    const dcfPE = eps > 0 ? (dcf / eps) : 0;
    const indPE = ind.pe || 20, peFairPE = indPE * (c.roe / 15);
    const gROE = c.roe / 100, gG = Math.min(gROE * 0.3, 0.04), pbFair = gROE > 0 ? ((gROE - gG) / (wacc - gG)) : 0;
    const gordonPE = gROE > 0 ? (pbFair / gROE) : 0;
    const fairPE = (dcfPE + peFairPE + gordonPE) / 3;
    const margin = currentPE > 0 ? ((fairPE - currentPE) / currentPE * 100) : 0;

    let vc = 'bg-slate-50 text-slate-400', vt = '—';
    if (currentPE <= 0) { vc = 'bg-amber-50 text-amber-600'; vt = '⚠️ 亏损'; }
    else if (margin > 25) { vc = 'bg-emerald-50 text-emerald-600'; vt = `低估 +${margin.toFixed(0)}%`; }
    else if (margin > -15) { vc = 'bg-amber-50 text-amber-600'; vt = `合理 ${margin >= 0 ? '+' : ''}${margin.toFixed(0)}%`; }
    else { vc = 'bg-red-50 text-red-600'; vt = `高估 ${margin.toFixed(0)}%`; }

    const rg = getGrade(c.roe, [25, 20, 15, 10]);
    const dg = getGrade(currentDY, [5, 3, 2, 1]);
    const pg = currentPE > 0 ? getGrade(100 / currentPE, [25, 15, 10, 5]) : 'N/A';
    const bg = getGrade(100 / currentPB, [100, 50, 25, 10]);

    return (
      <div className="space-y-4">
        <div className="breadcrumb">
          <button onClick={() => setView('home')} className="breadcrumb-link">全部</button>
          <ChevronRight size={12} />
          <button onClick={() => ii >= 0 ? navigate('ind', ii) : setView('home')} className="breadcrumb-link">{ind.nm}</button>
          <ChevronRight size={12} />
          <span>{c.n}</span>
        </div>

        <div className="card-elevated p-5 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-slate-800">{c.n}</h2>
              <div className="text-xs text-slate-400 font-mono mt-1">{c.c} · {ind.nm}/{c.sn}</div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => handleDeleteCompany(c.c)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                <Trash2 size={20} />
              </button>
              <button onClick={(e) => toggleFav(c.c, 'stock', e)} className="p-2 text-amber-400">
                {favStocks.includes(c.c) ? <Star fill="currentColor" size={24} /> : <Star size={24} />}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">实时价格</div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-800 tabular-nums">
                  {(() => {
                    const p = (livePrice && livePrice.p !== '—') ? livePrice.p : batchData[tCode]?.p;
                    return p ? `¥${p}` : '加载中...';
                  })()}
                </span>
                {(() => {
                  const cp = (livePrice && livePrice.cp !== '—') ? livePrice.cp : batchData[tCode]?.cp;
                  const up = cp ? parseFloat(cp) >= 0 : false;
                  const ch = (livePrice && livePrice.ch !== '—') ? livePrice.ch : null;
                  return cp ? (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${up ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {up ? '+' : ''}{ch ? `${ch}(${up ? '+' : ''}${cp}%)` : `${up ? '+' : ''}${cp}%`}
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {currentPE > 0 ? (
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex justify-between items-center">
                <div>
                  <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">综合估值 (DCF+PE+Gordon)</div>
                  <div className="text-lg font-bold text-indigo-600 tabular-nums">
                    {(() => {
                      const priceStr = (livePrice && livePrice.p !== '—') ? livePrice.p : (batchData[tCode]?.p || null);
                      return priceStr && currentPE > 0 ? `¥${(parseFloat(priceStr) * (fairPE / currentPE)).toFixed(2)}` : '—';
                    })()}
                    <span className="text-xs font-medium ml-1 opacity-70">PE {fairPE.toFixed(1)}x</span>
                  </div>
                </div>
                <div className={`text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm ${vc}`}>
                  {vt}
                </div>
              </div>
            ) : (
              <div className={`text-xs font-bold px-3 py-1.5 rounded-lg inline-block ${vc}`}>
                {vt}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { l: 'PE', v: livePrice?.pe || batchData[tCode]?.pe || c.pe || '—' },
              { l: 'PB', v: livePrice?.pb || batchData[tCode]?.pb || c.pb },
              { l: 'ROE', v: `${c.roe}%` },
              { l: '股息率', v: `${livePrice?.dy || batchData[tCode]?.dy || c.dy}%` },
              { l: '市值', v: livePrice?.mcap ? `${livePrice.mcap}亿` : '—' },
              { l: 'WACC', v: `${(wacc * 100).toFixed(1)}%` },
            ].map(m => (
              <div key={m.l} className="bg-slate-50 rounded-xl p-2 text-center">
                <div className="text-[9px] text-slate-400 font-bold uppercase">{m.l}</div>
                <div className="text-sm font-bold text-slate-700">{m.v}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { l: '盈利能力', v: rg },
              { l: '分红能力', v: dg },
              { l: 'PE估值', v: pg },
              { l: 'PB估值', v: bg },
            ].map(m => (
              <div key={m.l} className="bg-white border border-slate-100 rounded-xl p-2 text-center shadow-sm">
                <div className="text-[9px] text-slate-400 font-bold">{m.l}</div>
                <div className={`text-lg font-bold ${gColor(m.v)}`}>{m.v}</div>
              </div>
            ))}
          </div>

          {currentPE > 0 && (
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
              <h3 className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                <TrendingUp size={14} /> 多模型综合估值
              </h3>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">① DCF 现金流折现</span>
                  <span className="font-mono font-bold text-slate-700">PE {dcfPE.toFixed(1)}x</span>
                </div>
                <div className="text-[9px] text-slate-400 font-medium">
                  WACC {(wacc * 100).toFixed(1)}% · 增长 {(growth * 100).toFixed(0)}% · 永续 {(tg * 100).toFixed(1)}%
                </div>
                <div className="border-b border-slate-200 my-1" />
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">② PE 相对估值 (行业{indPE}×ROE修正)</span>
                  <span className="font-mono font-bold text-slate-700">PE {peFairPE.toFixed(1)}x</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">③ Gordon 股利折现</span>
                  <span className="font-mono font-bold text-slate-700">PE {gordonPE.toFixed(1)}x (PB {pbFair.toFixed(2)}x)</span>
                </div>
                <div className="border-t-2 border-slate-200 pt-2 flex justify-between text-xs font-bold">
                  <span className="text-slate-800">综合合理 PE</span>
                  <span className="text-indigo-600">PE {fairPE.toFixed(1)}x</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">当前 PE</span>
                  <span className="text-slate-700">{currentPE > 0 ? currentPE.toFixed(2) : '亏损'}</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-800">安全边际</span>
                  <span className={margin > 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {margin > 0 ? '+' : ''}{margin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="p-3 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-xl text-xs text-slate-600 leading-relaxed">
            {c.roe >= 20 ? '✅ ROE ' + c.roe + '% 优秀 ' : c.roe >= 10 ? '⚠️ ROE ' + c.roe + '% 中等 ' : '❌ ROE 仅 ' + c.roe + '% '}
            {currentDY >= 3 ? '✅ 股息率 ' + currentDY + '% ' : 'ℹ️ 股息率 ' + currentDY + '% '}
            {currentPE > 0 && currentPE <= 15 ? '✅ PE 偏低 ' : currentPE > 0 && currentPE <= 30 ? 'ℹ️ PE 适中 ' : '⚠️ PE 偏高 '}
            {currentPB < 1 ? '✅ PB 破净 ' : currentPB <= 2 ? 'ℹ️ PB 合理 ' : '⚠️ PB 偏高 '}
          </div>
        </div>
      </div>
    );
  };

  const handleAiAddCompany = async () => {
    if (!searchQuery) return;
    if (!config.apiKey && !(config.provider === 'gemini' && process.env.GEMINI_API_KEY)) {
      setAiAddError('请先在设置中配置 AI API Key 才能使用自动添加功能');
      return;
    }
    setIsAddingCompany(true);
    setAiAddError(null);
    try {
      const prompt = `用户想添加一个股票，输入是："${searchQuery}"。
      请识别这只股票，并返回它的基本信息。
      必须返回一个合法的 JSON 对象，不要包含任何 markdown 标记（如 \`\`\`json），直接返回 JSON 字符串。
      JSON 格式如下：
      {
        "c": "股票代码(如 600519 或 00700 或 AAPL)",
        "n": "公司简称",
        "market": "A" 或 "HK" 或 "GLOBAL",
        "indName": "所属一级行业名称(如 食品饮料、资讯科技、美股科技)",
        "subIndName": "所属二级行业名称(如 白酒、互联网、软件)",
        "pe": 静态市盈率(数字),
        "pb": 市净率(数字),
        "roe": 净资产收益率(数字，如 15.5 表示 15.5%),
        "dy": 股息率(数字，如 2.5 表示 2.5%),
        "ps": 市销率(数字),
        "ic": "一个代表该行业的Emoji图标"
      }`;
      
      let text = await getAIResponse(prompt, config, []);
      
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        text = match[0];
      }
      const newComp = JSON.parse(text);
      newComp.c = (newComp.c || '').trim();
      newComp.n = (newComp.n || '').trim();
      
      const updatedCustom = [...customCompanies, newComp];
      setCustomCompanies(updatedCustom);
      localStorage.setItem('iv_custom_comps', JSON.stringify(updatedCustom));
      
      setSearchQuery('');
      setMarket(newComp.market);
      navigate('comp', newComp.c, newComp.n);
    } catch (err) {
      console.error(err);
      setAiAddError('添加失败，请重试或检查输入是否正确。');
    } finally {
      setIsAddingCompany(false);
    }
  };


  const renderAI = () => {
    const activeConv = aiConversations.find(c => c.id === activeAiConvId);
    const messages = activeConv?.messages || [];

    const handleNewConversation = () => {
      const newConv: ChatConversation = {
        id: `conv_${Date.now()}`,
        title: '新对话',
        messages: [],
        createdAt: Date.now(),
      };
      setAiConversations(prev => [newConv, ...prev]);
      setActiveAiConvId(newConv.id);
      setShowAiConvList(false);
    };

    const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updated = aiConversations.filter(c => c.id !== id);
      setAiConversations(updated);
      if (activeAiConvId === id) {
        setActiveAiConvId(updated.length > 0 ? updated[0].id : null);
      }
    };

    const handleSend = async (e?: React.FormEvent) => {
      e?.preventDefault();
      const input = (document.getElementById('aiIn') as HTMLInputElement).value.trim();
      if (!input || aiLoading) return;

      // 如果没有活跃对话，先创建一个
      let convId = activeAiConvId;
      if (!convId) {
        const newConv: ChatConversation = {
          id: `conv_${Date.now()}`,
          title: input.slice(0, 20) + (input.length > 20 ? '...' : ''),
          messages: [],
          createdAt: Date.now(),
        };
        setAiConversations(prev => [newConv, ...prev]);
        setActiveAiConvId(newConv.id);
        convId = newConv.id;
      }

      const userMsg: ChatMessage = { role: 'user', content: input };
      setAiConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, messages: [...c.messages, userMsg], title: c.messages.length === 0 ? input.slice(0, 20) + (input.length > 20 ? '...' : '') : c.title } : c
      ));
      (document.getElementById('aiIn') as HTMLInputElement).value = '';
      setAiLoading(true);

      try {
        const conv = aiConversations.find(c => c.id === convId);
        const historyForApi = (conv?.messages || []).map(m => ({ role: m.role, content: m.content }));
        const response = await getAIResponse(input, config, historyForApi);
        const aiMsg: ChatMessage = { role: 'assistant', content: response || 'AI 未能生成回复' };
        setAiConversations(prev => prev.map(c =>
          c.id === convId ? { ...c, messages: [...c.messages, aiMsg] } : c
        ));
      } catch (error: any) {
        const errMsg: ChatMessage = { role: 'assistant', content: `❌ 错误: ${error.message}` };
        setAiConversations(prev => prev.map(c =>
          c.id === convId ? { ...c, messages: [...c.messages, errMsg] } : c
        ));
      } finally {
        setAiLoading(false);
      }
    };

    return (
      <div className="flex flex-col" style={{ height: 'calc(100dvh - 56px)' }}>
        {/* AI 页面头部 */}
        <div className="flex items-center justify-between px-1 pb-3">
          <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
            {config.apiKey ? `${config.provider}` : '未配置 API'}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewConversation}
              className="p-2 rounded-xl text-slate-400 hover:bg-slate-100/60 hover:text-brand-500 transition-all"
              title="新建对话"
            >
              <MessageSquarePlus size={18} />
            </button>
            <button
              onClick={() => setShowAiConvList(true)}
              className="p-2 rounded-xl text-slate-400 hover:bg-slate-100/60 hover:text-brand-500 transition-all"
              title="对话记录"
            >
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        {/* 消息区域 */}
        <div className="flex-1 overflow-y-auto space-y-3 pb-4 px-1 no-scrollbar" id="aiMsgs">
          {messages.length === 0 && (
            <div className="text-center pt-20 space-y-4">
              <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto text-brand-500 shadow-glow-sm">
                <Bot size={28} />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-700 mb-1">AI 投资助手</div>
                <div className="text-xs text-slate-400 max-w-[240px] mx-auto">问我关于行业趋势或公司估值的问题</div>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-2 px-4">
                {['分析白酒行业估值', '宁德时代值得投资吗', '什么是安全边际'].map(q => (
                  <button
                    key={q}
                    onClick={() => {
                      (document.getElementById('aiIn') as HTMLInputElement).value = q;
                      handleSend();
                    }}
                    className="text-[11px] px-3 py-1.5 rounded-full bg-white border border-slate-200/60 text-slate-500 font-medium active:scale-95 transition-all hover:border-brand-300 hover:text-brand-600"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-2.5 text-[13px] leading-relaxed ${
                m.role === 'user' ? 'chat-bubble-user text-white' : 'chat-bubble-ai text-slate-700'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {aiLoading && (
            <div className="flex justify-start">
              <div className="chat-bubble-ai px-4 py-2.5 text-slate-400 flex items-center gap-2 text-[13px]">
                <Loader2 size={15} className="animate-spin" /> 思考中...
              </div>
            </div>
          )}
        </div>

        {/* 输入栏 */}
        <form onSubmit={handleSend} className="flex gap-2 mt-2">
          <input
            id="aiIn"
            className="input-field flex-1 rounded-2xl py-3"
            placeholder="问问 AI..."
            disabled={aiLoading}
          />
          <button
            type="submit"
            disabled={aiLoading}
            className="btn-primary p-3 rounded-2xl disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </form>

        {/* 对话记录弹窗 */}
        <AnimatePresence>
          {showAiConvList && (
            <div className="fixed inset-0 z-[100] flex items-end justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAiConvList(false)}
                className="absolute inset-0 modal-overlay"
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                className="relative w-full max-w-lg modal-sheet p-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
              >
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5" />
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-extrabold text-slate-900">对话记录</h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleNewConversation}
                      className="btn-primary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
                    >
                      <Plus size={14} /> 新建
                    </button>
                    <button
                      onClick={() => setShowAiConvList(false)}
                      className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-all"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {aiConversations.length === 0 && (
                    <div className="text-center py-12 text-slate-400 text-sm">
                      暂无对话记录
                    </div>
                  )}
                  {aiConversations.map(conv => (
                    <div
                      key={conv.id}
                      onClick={() => {
                        setActiveAiConvId(conv.id);
                        setShowAiConvList(false);
                      }}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        conv.id === activeAiConvId ? 'bg-brand-50 border border-brand-200' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        conv.id === activeAiConvId ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <MessageSquare size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-slate-800 truncate">{conv.title}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {conv.messages.length} 条消息 · {new Date(conv.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderIndex = (indIdx: number, indexCode: string) => {
    const ind = currentIndustries[indIdx];
    if (!ind) return null;
    const indexInfo = (ind.indices || []).find(idx => idx.c === indexCode);
    if (!indexInfo) return null;
    const bd = batchData[indexCode];

    return (
      <div className="space-y-4">
        <div className="breadcrumb">
          <button onClick={() => setView('home')} className="breadcrumb-link">全部</button>
          <ChevronRight size={12} />
          <button onClick={() => navigate('ind', indIdx)} className="breadcrumb-link">{ind.nm}</button>
          <ChevronRight size={12} />
          <span>{indexInfo.n}</span>
        </div>

        <div className="card-elevated p-6 relative overflow-hidden">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-slate-800">{indexInfo.n}</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${indexInfo.t === 'broad' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                  {indexInfo.t === 'broad' ? '宽基指数' : '主题指数'}
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono">{indexCode}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-900">{bd?.p || '—'}</div>
              {bd?.cp && (
                <div className={`text-sm font-bold ${parseFloat(bd.cp) >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {parseFloat(bd.cp) >= 0 ? '+' : ''}{bd.cp}%
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-50 rounded-2xl p-4 text-center">
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">市盈率 PE (TTM)</div>
              <div className="text-xl font-bold text-slate-800">{bd?.pe && bd.pe > 0 ? bd.pe : '—'}</div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 text-center">
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">市净率 PB</div>
              <div className="text-xl font-bold text-slate-800">{bd?.pb && bd.pb > 0 ? bd.pb : '—'}</div>
            </div>
          </div>

          <div className="p-4 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-2xl text-xs text-slate-600 leading-relaxed">
            <div className="font-bold text-indigo-600 mb-1">指数说明</div>
            {indexInfo.t === 'broad' ? (
              <p>该指数是反映{ind.nm}行业整体表现的宽基指数，涵盖了行业内具有代表性的多数上市公司，是评估行业整体估值水平的重要参考。</p>
            ) : (
              <p>该指数是聚焦于{ind.nm}行业中特定细分领域（如{indexInfo.n.replace(/中证|指数|100|300/g, '')}）的主题指数，反映了该细分赛道的景气度和市场关注度。</p>
            )}
          </div>
        </div>

        <button 
          onClick={goBack}
          className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl text-sm font-bold active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <ArrowLeft size={16} /> 返回行业详情
        </button>
      </div>
    );
  };

  const renderIndexList = () => {
    const filtered = indices.filter(idx => {
      const iv = indexVal[idx.c];
      const pePct = (iv?.pePct !== undefined ? iv.pePct * 100 : idx.pePct) || 50;
      const status = pePct < 30 ? 'low' : pePct > 70 ? 'high' : 'mid';
      
      const marketMatch = idx.m === indexMarket;
      const filterMatch = indexValFilter === 'all' || indexValFilter === status;
      
      return marketMatch && filterMatch;
    });

    return (
      <div className="space-y-4">
        <div className="flex bg-white/80 border border-slate-200/60 rounded-2xl p-1 shadow-card">
          {(['A', 'HK', 'GLOBAL'] as const).map(m => (
            <button
              key={m}
              onClick={() => setIndexMarket(m)}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${
                indexMarket === m ? 'tab-pill-active' : 'tab-pill-inactive'
              }`}
            >
              {m === 'A' ? 'A股指数' : m === 'HK' ? '港股指数' : '国外指数'}
            </button>
          ))}
        </div>

        <div className="flex bg-white/80 border border-slate-200/60 rounded-2xl p-1 shadow-card overflow-x-auto">
          {(['all', 'low', 'mid', 'high'] as const).map(f => (
            <button
              key={f}
              onClick={() => setIndexValFilter(f)}
              className={`flex-1 py-2 px-4 text-xs font-bold rounded-xl transition-all duration-200 whitespace-nowrap ${
                indexValFilter === f ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'
              }`}
            >
              {f === 'all' ? '全部' : f === 'low' ? '低估' : f === 'mid' ? '适中' : '高估'}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map(idx => {
            const bd = batchData[idx.c];
            const iv = indexVal[idx.c];
            const pePct = (iv?.pePct !== undefined ? iv.pePct * 100 : idx.pePct) || 50;
            const status = pePct < 30 ? 'low' : pePct > 70 ? 'high' : 'mid';
            const statusText = status === 'low' ? '低估' : status === 'high' ? '高估' : '适中';
            const statusColor = status === 'low' ? 'bg-emerald-50 text-emerald-600' : status === 'high' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600';

            return (
              <div
                key={idx.c}
                onClick={() => navigate('index_detail', idx)}
                className="card-interactive p-4"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold text-slate-800">{idx.n}</div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${statusColor}`}>
                        {statusText}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">{idx.c}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-800">{bd?.p || '—'}</div>
                      {bd?.cp && (
                        <div className={`text-[10px] font-bold ${parseFloat(bd.cp) >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {parseFloat(bd.cp) >= 0 ? '+' : ''}{bd.cp}%
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const newIndices = indices.filter(i => i.c !== idx.c);
                        setIndices(newIndices);
                        localStorage.setItem('iv_indices', JSON.stringify(newIndices));
                      }}
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="bg-slate-50 rounded-lg py-1.5 text-center">
                    <div className="text-[9px] text-slate-400 font-bold uppercase">PE</div>
                    <div className="text-xs font-bold text-slate-700">{iv?.pe ? iv.pe.toFixed(2) : (bd?.pe !== undefined && bd.pe > 0 ? bd.pe : '—')}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg py-1.5 text-center">
                    <div className="text-[9px] text-slate-400 font-bold uppercase">PB</div>
                    <div className="text-xs font-bold text-slate-700">{iv?.pb ? iv.pb.toFixed(2) : (bd?.pb !== undefined && bd.pb > 0 ? bd.pb : '—')}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg py-1.5 text-center">
                    <div className="text-[9px] text-slate-400 font-bold uppercase">股息率</div>
                    <div className="text-xs font-bold text-slate-700">{iv?.dy ? `${(iv.dy * 100).toFixed(2)}%` : (bd?.dy !== undefined && bd.dy > 0 ? `${bd.dy}%` : '—')}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const [favTab, setFavTab] = useState<'stocks' | 'indices'>('stocks');

  const renderFavStocks = () => {
    const results: any[] = [];
    allIndustries.forEach((ind, ii) => ind.l2.forEach(s => (s.cs || []).forEach(c => {
      if (favStocks.includes(c.c)) {
        results.push({ ...c, sn: s.nm, ii, ic: ind.ic, nm: ind.nm, market: ind.market || 'A' });
      }
    })));

    return (
      <div className="space-y-3">
        {results.length > 0 ? results.map(c => (
          <div
            key={`${c.market}-${c.c}`}
            onClick={() => { setMarket(c.market || 'A'); navigate('comp', c.c, c.n); }}
            className="card-interactive p-4"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-sm font-bold text-slate-800">{c.ic} {c.n}</div>
                <div className="text-[10px] text-slate-400 font-mono">{c.c} · {c.nm}/{c.sn}</div>
              </div>
              <button onClick={(e) => toggleFav(c.c, 'stock', e)} className="p-1 text-amber-400">
                <Star fill="currentColor" size={20} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[
                { l: 'PE', v: c.pe || '—' },
                { l: 'ROE', v: `${c.roe}%` },
                { l: '股息', v: `${c.dy}%` },
              ].map(m => (
                <div key={m.l} className="bg-slate-50 rounded-lg py-1.5 text-center">
                  <div className="text-[9px] text-slate-400 font-bold uppercase">{m.l}</div>
                  <div className="text-xs font-bold text-slate-700">{m.v}</div>
                </div>
              ))}
            </div>
          </div>
        )) : (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
              <Star size={32} />
            </div>
            <div className="text-sm text-slate-400">暂无自选股<br />在公司详情页点击 ☆ 添加</div>
          </div>
        )}
      </div>
    );
  };

  const renderFavIndices = () => {
    const results = indices.filter(idx => favIndices.includes(idx.c));

    return (
      <div className="space-y-3">
        {results.length > 0 ? results.map(idx => (
          <div
            key={idx.c}
            onClick={() => navigate('index_detail', idx)}
            className="card-interactive p-4"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm font-bold text-slate-800">{idx.n}</div>
                <div className="text-[10px] text-slate-400 font-mono">{idx.c}</div>
              </div>
              <button onClick={(e) => toggleFav(idx.c, 'index', e)} className="p-1 text-amber-400">
                <Star fill="currentColor" size={20} />
              </button>
            </div>
          </div>
        )) : (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
              <Star size={32} />
            </div>
            <div className="text-sm text-slate-400">暂无自选指数<br />在指数详情页点击 ☆ 添加</div>
          </div>
        )}
      </div>
    );
  };

  const renderFav = () => {
    return (
      <div className="space-y-4">
        <div className="flex bg-white/80 border border-slate-200/60 rounded-2xl p-1 shadow-card">
          <button onClick={() => setFavTab('stocks')} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${favTab === 'stocks' ? 'tab-pill-active' : 'tab-pill-inactive'}`}>自选股</button>
          <button onClick={() => setFavTab('indices')} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${favTab === 'indices' ? 'tab-pill-active' : 'tab-pill-inactive'}`}>自选指数</button>
        </div>
        {favTab === 'stocks' ? renderFavStocks() : renderFavIndices()}
      </div>
    );
  };

  return (
    <div className={`min-h-screen bg-surface pb-24 ${darkMode ? 'text-slate-100' : ''}`}>
      {/* Top Bar */}
      <div className="sticky top-0 z-50 nav-glass px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {navStack.length > 0 && view !== 'home' && (
            <button onClick={goBack} className="p-1.5 -ml-1 rounded-xl text-slate-500 hover:bg-slate-100/60 active:scale-90 transition-all">
              <ArrowLeft size={20} strokeWidth={2.5} />
            </button>
          )}
          <h1 className="text-[15px] font-extrabold text-slate-900 tracking-tight">
            {view === 'home' ? '📊 行业估值' : 
             view === 'ind' ? currentIndustries[navArgs[0]].nm :
             view === 'sub' ? currentIndustries[navArgs[0]].l2[navArgs[1]].nm :
             view === 'comp' ? navArgs[1] :
             view === 'search' ? '搜索' :
             view === 'ai' ? 'AI 助手' : 
             view === 'index' ? '指数详情' : 
             view === 'index_list' ? '指数行情' :
             view === 'index_detail' ? '指数详情' : '自选股'}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100/60 hover:text-brand-600 transition-all dark:hover:bg-slate-700/60">
            {darkMode ? <Sun size={19} strokeWidth={2} /> : <Moon size={19} strokeWidth={2} />}
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100/60 hover:text-brand-600 transition-all dark:hover:bg-slate-700/60">
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
            {view === 'home' && renderHome()}
            {view === 'ind' && renderInd(navArgs[0])}
            {view === 'sub' && renderSub(navArgs[0], navArgs[1])}
            {view === 'comp' && renderComp(navArgs[0], navArgs[1])}
            {view === 'search' && (
              <SearchView
                allIndustries={allIndustries}
                customCompanies={customCompanies}
                indices={indices}
                setIndices={setIndices}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                navigate={navigate}
                setMarket={setMarket}
                setIndexMarket={setIndexMarket}
                handleAiAddCompany={handleAiAddCompany}
                isAddingCompany={isAddingCompany}
                aiAddError={aiAddError}
              />
            )}
            {view === 'ai' && renderAI()}
            {view === 'fav' && renderFav()}
            {view === 'index' && renderIndex(navArgs[0], navArgs[1])}
            {view === 'index_list' && renderIndexList()}
            {view === 'index_detail' && (
              <IndexDetailView
                idx={navArgs[0]}
                batchData={batchData}
                indexVal={indexVal}
                setView={setView}
                toggleFav={toggleFav}
                favIndices={favIndices}
              />
            )}
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
          <button
            key={t.id}
            onClick={() => { setView(t.id as ViewType); setNavStack([]); setNavArgs([]); }}
            className={`flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all duration-200 ${
              view === t.id ? 'text-brand-600' : 'text-slate-400'
            }`}
          >
            <div className={`p-1 rounded-lg transition-all duration-200 ${view === t.id ? 'bg-brand-50' : ''}`}>
              <t.i size={19} strokeWidth={view === t.id ? 2.5 : 1.8} />
            </div>
            <span className={`text-[10px] transition-all duration-200 ${view === t.id ? 'font-extrabold' : 'font-semibold'}`}>{t.l}</span>
          </button>
        ))}
      </nav>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 modal-overlay"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative w-full max-w-lg modal-sheet p-6 pb-[calc(24px+env(safe-area-inset-bottom))]"
            >
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
              <h2 className="text-lg font-extrabold text-slate-900 mb-6 flex items-center gap-2">
                <Settings className="text-brand-500" size={20} /> 设置
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">AI 服务商</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(PROVIDERS).map(([id, p]) => (
                      <button
                        key={id}
                        onClick={() => setConfig({ 
                          ...config, 
                          provider: id, 
                          apiUrl: config.apiUrl === '' || Object.values(PROVIDERS).some(prov => prov.url === config.apiUrl) ? p.url : config.apiUrl, 
                          model: p.model 
                        })}
                        className={`p-3 rounded-xl text-left transition-all duration-200 ${
                          config.provider === id 
                            ? 'border-2 border-brand-500 bg-brand-50 shadow-glow-sm' 
                            : 'border border-slate-200/80 bg-surface hover:border-slate-300'
                        }`}
                      >
                        <div className={`text-sm font-bold ${config.provider === id ? 'text-brand-700' : 'text-slate-700'}`}>{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">{p.model}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-0.5">API 地址</label>
                    <input
                      className="input-field"
                      value={config.apiUrl}
                      placeholder={PROVIDERS[config.provider]?.url || "https://api.example.com"}
                      onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-0.5">API Key</label>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="sk-xxxxxxxx"
                      value={config.apiKey}
                      onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                    />
                    <p className="text-[10px] text-slate-400 mt-2 ml-0.5 flex items-center gap-1">
                      <AlertCircle size={10} /> 你的 API 密钥仅保存在本地浏览器中
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-0.5">模型名称</label>
                    <input
                      className="input-field"
                      value={config.model}
                      onChange={(e) => setConfig({ ...config, model: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">数据管理</label>
                  <button
                    onClick={handleRestoreDefaults}
                    className="btn-danger w-full py-3 flex items-center justify-center gap-2"
                  >
                    <Trash2 size={15} />
                    恢复默认公司数据
                  </button>
                  <p className="text-[10px] text-slate-400 mt-2 text-center">
                    清除所有自定义添加和删除的公司，恢复初始状态
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => { setConfig(DEFAULT_CONFIG); localStorage.removeItem('iv_cfg'); }}
                    className="btn-secondary py-3"
                  >
                    恢复默认
                  </button>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="btn-primary py-3"
                  >
                    完成
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
