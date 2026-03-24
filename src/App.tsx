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
  Sun,
  GripVertical,
  CheckSquare,
  Square,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Industry, Company, AIConfig, ViewType, NavigationState, Index, ValuationConfig, VALUATION_PRESETS, PresetName } from './types';
import { INDUSTRIES, HK_INDUSTRIES, DEFAULT_CONFIG, PROVIDERS } from './constants';
import { DEFAULT_INDICES } from './indices';
import { getAIResponse } from './services/aiService';
import { fetchFinancialStatementsCached } from './services/stockDataService';
import { calculateValuation } from './valuation/engine';
import { ValuationResult, StockInput, IndustryData, FinancialStatement } from './valuation/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
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
  handleAiAddIndex: () => void;
  isAddingIndex: boolean;
  aiIndexError: string | null;
  batchData: Record<string, any>;
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
  aiAddError,
  handleAiAddIndex,
  isAddingIndex,
  aiIndexError,
  batchData,
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
                    { l: 'PE', v: batchData[c.c]?.pe?.toFixed(1) || '—' },
                    { l: 'ROE', v: batchData[c.c]?.roe ? `${batchData[c.c].roe.toFixed(1)}%` : '—' },
                    { l: '股息', v: batchData[c.c]?.dy ? `${batchData[c.c].dy.toFixed(1)}%` : '—' },
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
            {searchQuery.length > 0 && remoteResults.length === 0 && (
              <div className="mt-4 space-y-2">
                <button
                  onClick={handleAiAddIndex}
                  disabled={isAddingIndex}
                  className="w-full bg-brand-50 border border-brand-100 text-brand-600 font-bold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  {isAddingIndex ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />}
                  {isAddingIndex ? '正在让 AI 识别并添加...' : `找不到？让 AI 自动添加 "${searchQuery}"`}
                </button>
                {aiIndexError && (
                  <div className="text-center text-xs text-red-500 font-medium">
                    {aiIndexError}
                  </div>
                )}
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
  indexVal: Record<string, { pe?: number; pb?: number; dy?: number; pePct?: number; pbPct?: number; roe?: number; peg?: number; evaType?: string; bondYield?: number; source?: string; peOverHistory?: number; pbOverHistory?: number; evaTypeInt?: number; date?: string; p?: string; cp?: string }>;
  setView: (view: ViewType) => void;
  toggleFav: (code: string, type: 'stock' | 'index', e?: React.MouseEvent) => void;
  favIndices: string[];
  breadcrumbNodes?: React.ReactNode;  // Custom breadcrumb content (e.g. from industry page)
}

const IndexDetailView = ({ idx, batchData, indexVal, setView, toggleFav, favIndices, breadcrumbNodes }: IndexDetailViewProps) => {
  const djIv = indexVal[idx.c];
  // 指数数据完全来自专用 fetch（蛋卷 API + eastmoney 专用 JSONP），不再使用 batchData 避免代码碰撞
  const iv = djIv ? {
    p: djIv.p,
    cp: djIv.cp,
    pe: djIv.pe,
    pb: djIv.pb,
    dy: djIv.dy,
    pePct: djIv.pePct,
    pbPct: djIv.pbPct,
    source: djIv.source,
  } : undefined;

  return (
    <div className="space-y-4">
      <div className="breadcrumb">
        {breadcrumbNodes || (
          <>
            <button onClick={() => setView('index_list')} className="breadcrumb-link">指数列表</button>
            <ChevronRight size={12} />
            <span>{idx.n}</span>
          </>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`确定删除 "${idx.n}" 吗？`)) {
              const newIndices = indices.filter(i => i.c !== idx.c);
              setIndices(newIndices);
              localStorage.setItem('iv_indices', JSON.stringify(newIndices));
              setView('index_list');
            }
          }}
          className="ml-auto p-1 text-slate-300 hover:text-red-500 transition-colors"
        >
          <Trash2 size={18} />
        </button>
        <button onClick={(e) => toggleFav(idx.c, 'index', e)} className="p-1 text-amber-400">
          {favIndices.includes(idx.c) ? <Star fill="currentColor" size={20} /> : <Star size={20} />}
        </button>
      </div>

      <div className="card-elevated p-5 space-y-6">
        {/* 标题区 */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800">{idx.n}</h2>
              {djIv?.evaType && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  djIv.evaType === 'low' ? 'bg-emerald-50 text-emerald-600' :
                  djIv.evaType === 'high' ? 'bg-red-50 text-red-600' :
                  'bg-amber-50 text-amber-600'
                }`}>
                  {djIv.evaType === 'low' ? '低估' : djIv.evaType === 'high' ? '高估' : '适中'}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 font-mono mt-1">{idx.c} · {idx.m === 'A' ? 'A股' : idx.m === 'HK' ? '港股' : '国外'}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-900">{batchData[idx.c]?.p || djIv?.p || '\u2014'}</div>
            {(batchData[idx.c]?.cp || djIv?.cp) && (
              <div className={`text-sm font-bold ${parseFloat(batchData[idx.c]?.cp || djIv.cp) >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {parseFloat(batchData[idx.c]?.cp || djIv.cp) >= 0 ? '+' : ''}{batchData[idx.c]?.cp || djIv.cp}%
              </div>
            )}
          </div>
        </div>

        {/* 估值指标 */}
        <div className="grid grid-cols-3 gap-2">
          {iv?.pe && (
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">PE (TTM)</div>
              <div className="text-base font-bold text-slate-800">{iv.pe.toFixed(2)}</div>
            </div>
          )}
          {iv?.pb && (
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">PB</div>
              <div className="text-base font-bold text-slate-800">{iv.pb.toFixed(2)}</div>
            </div>
          )}
          {iv?.dy && (
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">股息率</div>
              <div className="text-base font-bold text-slate-800">{(iv.dy * 100).toFixed(2)}%</div>
            </div>
          )}
          {iv?.roe && (
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">ROE</div>
              <div className="text-base font-bold text-slate-800">{(iv.roe * 100).toFixed(2)}%</div>
            </div>
          )}
          {iv?.peg && (
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">PEG</div>
              <div className="text-base font-bold text-slate-800">{iv.peg.toFixed(2)}</div>
            </div>
          )}
          {iv?.bondYield && (
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">国债利率</div>
              <div className="text-base font-bold text-slate-800">{(iv.bondYield * 100).toFixed(2)}%</div>
            </div>
          )}
        </div>

        {iv?.source === 'computed' && (
          <div className="text-center text-[10px] text-amber-500 font-medium flex items-center justify-center gap-1">
            <span>\u26a0\ufe0f</span> PE/PB 为从行业成分股推算，非指数直接数据
          </div>
        )}

        {/* 股债利差 */}
        {iv?.pe && iv.pe > 0 && iv?.bondYield && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
            <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-2">股债利差 (FED 模型)</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-indigo-600">
                {((1 / iv.pe - iv.bondYield) * 100).toFixed(2)}%
              </span>
              <span className="text-xs text-indigo-400">
                = 1/PE({(100 / iv.pe).toFixed(2)}%) &minus; 国债({(iv.bondYield * 100).toFixed(2)}%)
              </span>
            </div>
            <div className={`mt-2 text-xs font-bold ${
              (1 / iv.pe - iv.bondYield) > 0.02 ? 'text-emerald-600' :
              (1 / iv.pe - iv.bondYield) < -0.02 ? 'text-red-600' :
              'text-amber-600'
            }`}>
              {(1 / iv.pe - iv.bondYield) > 0.02 ? '股票更有吸引力' :
               (1 / iv.pe - iv.bondYield) < -0.02 ? '债券更有吸引力' :
               '股债均衡'}
            </div>
          </div>
        )}

        {/* PE/PB 百分位 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">PE 百分位 (近10年)</div>
            <div className="text-2xl font-bold text-slate-800">{iv?.pePct !== undefined ? `${(iv.pePct * 100).toFixed(1)}` : '\u2014'}%</div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">PB 百分位 (近10年)</div>
            <div className="text-2xl font-bold text-slate-800">{iv?.pbPct !== undefined ? `${(iv.pbPct * 100).toFixed(1)}` : '\u2014'}%</div>
          </div>
        </div>

        {/* 整体估值水平 — 直接使用蛋卷基金的 evaType 判断 */}
        <div className={`rounded-2xl p-6 text-center ${
          djIv?.evaType === 'low' ? 'bg-emerald-50 border border-emerald-100' :
          djIv?.evaType === 'high' ? 'bg-red-50 border border-red-100' :
          'bg-amber-50 border border-amber-100'
        }`}>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">整体估值水平</div>
          <div className={`text-3xl font-black ${
            djIv?.evaType === 'low' ? 'text-emerald-600' :
            djIv?.evaType === 'high' ? 'text-red-600' :
            'text-amber-600'
          }`}>
            {djIv?.evaType === 'low' ? '低估' : djIv?.evaType === 'high' ? '高估' : '适中'}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {iv?.pePct !== undefined ? `PE 百分位 ${(iv.pePct * 100).toFixed(1)}%` : ''}
            {iv?.pePct !== undefined && iv?.pbPct !== undefined ? ' · ' : ''}
            {iv?.pbPct !== undefined ? `PB 百分位 ${(iv.pbPct * 100).toFixed(1)}%` : ''}
            {!iv?.pePct && !iv?.pbPct ? '暂无百分位数据' : ''}
          </div>
        </div>

        {/* 估值分析 — 客观描述指标状态，引用蛋卷判断作为结论 */}
        <div className="p-4 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-2xl text-xs text-slate-600 leading-relaxed">
          <div className="font-bold text-indigo-600 mb-1">估值分析</div>
          <p>
            当前指数 PE {iv?.pe ? iv.pe.toFixed(2) : '\u2014'}
            {iv?.pePct !== undefined ? `（近10年 ${iv.pePct < 0.3 ? '较低' : iv.pePct > 0.7 ? '较高' : '中等'}分位 ${(iv.pePct * 100).toFixed(1)}%）` : ''}
            ，PB {iv?.pb ? iv.pb.toFixed(2) : '\u2014'}
            {iv?.pbPct !== undefined ? `（近10年 ${iv.pbPct < 0.3 ? '较低' : iv.pbPct > 0.7 ? '较高' : '中等'}分位 ${(iv.pbPct * 100).toFixed(1)}%）` : ''}
            {iv?.roe ? `，ROE ${(iv.roe * 100).toFixed(2)}%` : ''}
            {iv?.peg ? `，PEG ${iv.peg.toFixed(2)}` : ''}
            {iv?.dy ? `，股息率 ${(iv.dy * 100).toFixed(2)}%` : ''}。
            {iv?.peg && iv.peg > 0 && iv.peg < 1 ? 'PEG<1，盈利增速快于估值水平。' : ''}
            {djIv?.evaType ? `蛋卷基金估值判断：${djIv.evaType === 'low' ? '低估' : djIv.evaType === 'high' ? '高估' : '适中'}。` : ''}
          </p>
        </div>

        {/* 历史均值对比 */}
        {(djIv?.peOverHistory !== undefined || djIv?.pbOverHistory !== undefined) && (
          <div className="grid grid-cols-2 gap-4">
            {djIv?.peOverHistory !== undefined && (
              <div className="bg-slate-50 rounded-2xl p-4">
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">PE / 历史均值</div>
                <div className={`text-2xl font-bold ${djIv.peOverHistory < 0.8 ? 'text-emerald-600' : djIv.peOverHistory > 1.2 ? 'text-red-600' : 'text-amber-600'}`}>
                  {(djIv.peOverHistory * 100).toFixed(1)}%
                </div>
              </div>
            )}
            {djIv?.pbOverHistory !== undefined && (
              <div className="bg-slate-50 rounded-2xl p-4">
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">PB / 历史均值</div>
                <div className={`text-2xl font-bold ${djIv.pbOverHistory < 0.8 ? 'text-emerald-600' : djIv.pbOverHistory > 1.2 ? 'text-red-600' : 'text-amber-600'}`}>
                  {(djIv.pbOverHistory * 100).toFixed(1)}%
                </div>
              </div>
            )}
          </div>
        )}

        {/* 数据来源 */}
        {djIv?.date && (
          <div className="text-center text-[10px] text-slate-400 font-medium">
            数据更新于 {djIv.date} · 来源：蛋卷基金
          </div>
        )}
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
  // 估值模型参数（从 localStorage 恢复，默认中性方案）
  const [valuationConfig, setValuationConfig] = useState<ValuationConfig>(() => {
    const saved = localStorage.getItem('iv_val_cfg');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return VALUATION_PRESETS.neutral.config;
  });
  // 当前选中的预设方案（null = 自定义）
  const [activePreset, setActivePreset] = useState<PresetName | null>(() => {
    return localStorage.getItem('iv_val_preset') as PresetName || 'neutral';
  });
  const [settingsTab, setSettingsTab] = useState<'ai' | 'data' | 'valuation'>('ai');
  const [livePrice, setLivePrice] = useState<{ 
    p: string; ch: string; cp: string; up: boolean;
    pe?: string; pb?: string; dy?: string; ps?: string; mcap?: string; fcap?: string;
  } | null>(null);
  const [customCompanies, setCustomCompanies] = useState<any[]>(() => JSON.parse(localStorage.getItem('iv_custom_comps') || '[]'));
  const [deletedCompanies, setDeletedCompanies] = useState<string[]>(() => JSON.parse(localStorage.getItem('iv_deleted_comps') || '[]'));
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [aiAddError, setAiAddError] = useState<string | null>(null);
  const [isAddingIndex, setIsAddingIndex] = useState(false);
  const [aiIndexError, setAiIndexError] = useState<string | null>(null);
  const [batchData, setBatchData] = useState<Record<string, {
    pe?: number; pb?: number; dy?: number; ps?: number; roe?: number; eps?: number;
    mcap?: number; fcap?: number;
    p?: string; cp?: string;
    roa?: number; grossMargin?: number; netMargin?: number; debt?: number;
    revenueGrowth?: number; netIncomeGrowth?: number;
    dividendPerShare?: number; payoutYears?: number;
    pePct?: number; pbPct?: number;
    revenue?: number; netIncome?: number;
  }>>({});
  const [indexVal, setIndexVal] = useState<Record<string, { pe?: number; pb?: number; dy?: number; pePct?: number; pbPct?: number; roe?: number; peg?: number; evaType?: string; bondYield?: number; source?: string; peOverHistory?: number; pbOverHistory?: number; evaTypeInt?: number; date?: string; p?: string; cp?: string }>>({});
  // 真实财务报表数据（localStorage 缓存，7 天刷新）
  const [stockStatements, setStockStatements] = useState<Record<string, FinancialStatement[]>>({});
  const [stockDetailLoading, setStockDetailLoading] = useState<Record<string, boolean>>({});
  const [valuationResults, setValuationResults] = useState<Record<string, ValuationResult>>({});
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
  const showSettingsRef = useRef(false); // kept for back button compat

  // 同步 state → ref
  useEffect(() => { navStackRef.current = navStack; }, [navStack]);
  useEffect(() => { navArgsRef.current = navArgs; }, [navArgs]);
  useEffect(() => { viewRef.current = view; }, [view]);

  // 状态栏：不覆盖 WebView，根据主题适配
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

  // Android 返回键监听 —— 完全基于 ref，无闭包陈旧问题
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapApp.addListener('backButton', () => {
      // 1. 有导航栈 → 返回上一页
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
  const sinaApiBase = Capacitor.isNativePlatform() ? 'https://vip.stock.finance.sina.com.cn' : '/sina-api';

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
        ind = { id: `custom_${Date.now()}_${Math.random()}`, nm: cc.indName || '其他行业', ic: cc.ic || '🏢', ev: 'mid', l2: [] };
        filteredMerged.push(ind);
      }
      let sub = ind.l2.find(s => s.nm === (cc.subIndName || '其他细分'));
      if (!sub) {
        sub = { nm: cc.subIndName || '其他细分', cs: [] };
        ind.l2.push(sub);
      }
      if (!sub.cs.find(x => x.c === cc.c)) {
        sub.cs.push({
          c: cc.c, n: cc.n, market: cc.market
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
      // 用户添加的指数：用市场前缀 secid 区分同代码股票/指数
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
          // A-share: use stored mk, or guess from code
          if (c.mk) return `${c.mk}.${c.c}`;
          const mk = (c.c.startsWith('399') || c.c.startsWith('159')) ? '0' : '1';
          return `${mk}.${c.c}`;
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
          console.warn(`[Batch] JSONP timeout for chunk ${i/chunkSize}`);
          delete (window as any)[cbName];
          const scriptEl = document.getElementById(cbName);
          if (scriptEl) scriptEl.remove();
        }, 15000);
        
        (window as any)[cbName] = (d: any) => {
          clearTimeout(timeoutId);
          if (d?.data?.diff) {
            setBatchData(prev => {
              const newData = { ...prev };
              d.data.diff.forEach((item: any) => {
                let code = item.f12;
                if (code === 'UDI') code = 'DJI';
                if (code === 'SPX') code = 'INX';
                if (code === 'KOSPI') code = 'KS11';
                if (code === 'NIFTY') code = 'NSEI';

                const mkId = item.f13;
                const pScale = mkId === 116 ? 1000 : 100;
                const val = (f: any, div = 1) => (f !== '-' && f !== undefined && f !== null) ? f / div : undefined;
                const valPos = (f: any, div = 1) => { const v = val(f, div); return v !== undefined && v > 0 ? v : undefined; };

                // push2 API 实际字段映射（已验证）：
                // f2=最新价, f3=涨跌幅, f9=市盈率(动态), f12=代码, f13=市场
                // f20=总市值(元), f23=市净率, f37=ROE(加权%)
                // f50=总资产, f54=总负债, f57=资产负债比率(%)
                // f112=每股收益, f113=每股净资产, f116=总市值(亿), f117=流通市值(亿)
                // f133=股息率(%)
                // ⚠️ f52=固定资产(元), f69=超大单净占比, f98/f99=DDX飘红天数 — 这些不是财务指标!
                newData[code] = {
                  // 基础行情
                  p: item.f2 !== '-' && item.f2 !== undefined ? (item.f2 / pScale).toFixed(mkId === 116 ? 3 : 2) : undefined,
                  cp: item.f3 !== '-' && item.f3 !== undefined ? (item.f3 / 100).toFixed(2) : undefined,
                  // 估值指标：f9=市盈率(动态×100), f23=市净率(×100)
                  pe: valPos(item.f9, 100),
                  pb: valPos(item.f23, 100),
                  // f133=股息率(%)
                  dy: valPos(item.f133),
                  // PS 从财务报表补充，这里不依赖不可靠的 f188
                  ps: undefined,
                  // f37=ROE(加权%)，直接使用
                  roe: val(item.f37),
                  // ROA 需从三表计算，这里无法直接获取
                  roa: undefined,
                  // f112=每股收益
                  eps: valPos(item.f112),
                  // f20=总市值(元), f116=总市值(亿)
                  mcap: valPos(item.f20, 100000000),
                  fcap: valPos(item.f117),
                  // 毛利率/净利率 需从三表计算
                  grossMargin: undefined,
                  netMargin: undefined,
                  // f57=资产负债比率(%)，正确字段
                  debt: val(item.f57),
                  // 营收/净利润增长率 需从财务报表补充
                  revenueGrowth: undefined,
                  netIncomeGrowth: undefined,
                  // 每股股利 = 股息率 × 价格
                  dividendPerShare: (item.f133 !== '-' && item.f133 !== undefined && item.f133 > 0 && item.f2 > 0)
                    ? (item.f2 / pScale) * (item.f133 / 100) : undefined,
                  payoutYears: undefined,
                  // f137/f138=PE/PB百分位
                  pePct: val(item.f137),
                  pbPct: val(item.f138),
                };
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
        script.src = `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${chunk}&fields=f2,f3,f9,f12,f13,f14,f20,f23,f37,f57,f112,f113,f116,f117,f133,f137,f138&cb=${cbName}`;
        script.onerror = () => {
          clearTimeout(timeoutId);
          console.warn(`[Batch] JSONP error, trying fetch fallback for chunk ${i/chunkSize}`);
          delete (window as any)[cbName];
          const scriptEl = document.getElementById(cbName);
          if (scriptEl) scriptEl.remove();
          // Fallback: try fetch() (works on Capacitor native, may fail on web due to CORS)
          fetch(`https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${chunk}&fields=f2,f3,f9,f12,f13,f14,f20,f23,f37,f57,f112,f113,f116,f117,f133,f137,f138`)
            .then(r => r.json())
            .then((d: any) => {
              if (d?.data?.diff) {
                setBatchData(prev => {
                  const newData = { ...prev };
                  d.data.diff.forEach((item: any) => {
                    let code = item.f12;
                    if (code === 'UDI') code = 'DJI';
                    if (code === 'SPX') code = 'INX';
                    if (code === 'KOSPI') code = 'KS11';
                    if (code === 'NIFTY') code = 'NSEI';
                    const mkId = item.f13;
                    const pScale = mkId === 116 ? 1000 : 100;
                    const val = (f: any, div = 1) => (f !== '-' && f !== undefined && f !== null) ? f / div : undefined;
                    const valPos = (f: any, div = 1) => { const v = val(f, div); return v !== undefined && v > 0 ? v : undefined; };
                    newData[code] = {
                      p: item.f2 !== '-' && item.f2 !== undefined ? (item.f2 / pScale).toFixed(mkId === 116 ? 3 : 2) : undefined,
                      cp: item.f3 !== '-' && item.f3 !== undefined ? (item.f3 / 100).toFixed(2) : undefined,
                      pe: valPos(item.f9, 100),
                      pb: valPos(item.f23, 100),
                      dy: valPos(item.f133),
                      ps: undefined,
                      roe: val(item.f37),
                      roa: undefined,
                      eps: valPos(item.f112),
                      mcap: valPos(item.f20, 100000000),
                      fcap: valPos(item.f117),
                      grossMargin: undefined,
                      netMargin: undefined,
                      debt: val(item.f57),
                      revenueGrowth: undefined,
                      netIncomeGrowth: undefined,
                      dividendPerShare: (item.f133 !== '-' && item.f133 !== undefined && item.f133 > 0 && item.f2 > 0)
                        ? (item.f2 / pScale) * (item.f133 / 100) : undefined,
                      payoutYears: undefined,
                      pePct: val(item.f137),
                      pbPct: val(item.f138),
                    };
                  });
                  return newData;
                });
              }
            })
            .catch(() => {});
        };
        document.head.appendChild(script);
      }
    };

    fetchBatch();
    const timer = setInterval(fetchBatch, 10000);

    // 行业关联指数：独立请求，用 idx_ 前缀存储避免与同代码股票冲突
    const fetchIndustryIndices = () => {
      const allIndustryIndices = [...new Map(
        allIndustries.flatMap(ind => ind.indices || []).map(idx => [idx.c, idx])
      ).values()];

      if (allIndustryIndices.length === 0) return;

      const secids = allIndustryIndices.map(idx => {
        let mk: string;
        if (idx.c === 'HSTECH' || idx.c === 'HSI' || idx.c === 'HSCEI') {
          mk = '100';
        } else if (idx.c.startsWith('399') || idx.c.startsWith('159')) {
          mk = '0';
        } else {
          mk = '1';
        }
        return `${mk}.${idx.c}`;
      }).join(',');

      const cbName = `jsonp_indidx_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
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
              const code = item.f12;
              const mkId = item.f13;
              const pScale = mkId === 116 ? 1000 : 100;
              const val = (f: any, div = 1) => (f !== '-' && f !== undefined && f !== null) ? f / div : undefined;
              const valPos = (f: any, div = 1) => { const v = val(f, div); return v !== undefined && v > 0 ? v : undefined; };
              // 用 idx_ 前缀存储，避免覆盖同代码的股票数据
              newData[`idx_${code}`] = {
                p: item.f2 !== '-' && item.f2 !== undefined ? (item.f2 / pScale).toFixed(2) : undefined,
                cp: item.f3 !== '-' && item.f3 !== undefined ? (item.f3 / 100).toFixed(2) : undefined,
                pe: valPos(item.f9, 100),
                pb: valPos(item.f23, 100),
                dy: valPos(item.f133),
                ps: undefined,
                mcap: valPos(item.f20, 100000000),
              };
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
      script.src = `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${secids}&fields=f2,f3,f9,f12,f13,f20,f23,f133&cb=${cbName}`;
      document.head.appendChild(script);
    };

    fetchIndustryIndices();
    const idxTimer = setInterval(fetchIndustryIndices, 10000);

    return () => { clearInterval(timer); clearInterval(idxTimer); };
  }, [allCodesStr]);

  // ─── 真实财务报表数据获取 ───
  // 进入公司详情页时，从 localStorage 缓存获取财务报表（无缓存则实时拉取）
  useEffect(() => {
    if (view !== 'comp' || !navArgs[0]) return;
    const code = String(navArgs[0]).trim();
    if (!code || stockDetailLoading[code]) return;

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
  }, [view, navArgs[0]]);

  // 进入公司详情页时，计算估值
  useEffect(() => {
    if (view !== 'comp' || !navArgs[0]) return;
    const code = String(navArgs[0]).trim();
    if (!code) return;

    const stmts = stockStatements[code] || [];

    // 收集行业信息
    let market: 'A' | 'HK' | 'GLOBAL' = 'A';
    let industryName = '默认';
    let industryPE = 20, industryPB = 1.5, industryROE = 12;
    let peers: Array<{ code: string; name: string; pe: number; pb: number; roe: number; mcap: number }> = [];

    for (const ind of allIndustries) {
      for (const sub of ind.l2) {
        const found = sub.cs.find(c => c.c === code);
        if (found) {
          market = ind.market || 'A';
          industryName = ind.nm;
          const peValues = sub.cs.map(c => batchData[c.c]?.pe).filter((v): v is number => v !== undefined && v > 0 && v < 500);
          const pbValues = sub.cs.map(c => batchData[c.c]?.pb).filter((v): v is number => v !== undefined && v > 0 && v < 50);
          const roeValues = sub.cs.map(c => batchData[c.c]?.roe).filter((v): v is number => v !== undefined && v > 0 && v < 100);
          if (peValues.length > 0) industryPE = peValues.reduce((a, b) => a + b, 0) / peValues.length;
          if (pbValues.length > 0) industryPB = pbValues.reduce((a, b) => a + b, 0) / pbValues.length;
          if (roeValues.length > 0) industryROE = roeValues.reduce((a, b) => a + b, 0) / roeValues.length;
          peers = sub.cs.filter(x => x.c !== code).map(c => ({
            code: c.c, name: c.n,
            pe: batchData[c.c]?.pe || 0,
            pb: batchData[c.c]?.pb || 0,
            roe: batchData[c.c]?.roe || 0,
            mcap: batchData[c.c]?.mcap || 0,
          })).filter(p => p.pe > 0);
          break;
        }
      }
    }

    // 从 batchData 获取实时指标，结合三表数据补充
    const bd = batchData[code] || {};
    const currentPE = bd.pe || 0;
    const currentPB = bd.pb || 0;
    const currentPrice = parseFloat(bd.p || '0') || 0;

    if (currentPE <= 0 || currentPrice <= 0) return;

    // EPS 优先从 batchData，否则用 price/PE 推算
    const currentEPS = bd.eps || (currentPE > 0 ? currentPrice / currentPE : 0);

    // ROA 从三表计算（净利润/总资产），batchData 的 roa 不可靠
    const currentROA = stmts.length > 0 && stmts[0].totalAssets > 0
      ? (stmts[0].netIncome / stmts[0].totalAssets) * 100 : 0;

    // 资产负债率：优先从三表，其次从 batchData（f57），带 sanity check
    let currentDebt = stmts.length > 0 ? stmts[0].debtRatio : 0;
    if (currentDebt <= 0 && bd.debt && bd.debt > 0 && bd.debt <= 100) {
      currentDebt = bd.debt;
    }
    // sanity check：负债率不应超过 100% 或低于 0%
    if (currentDebt < 0 || currentDebt > 100) currentDebt = 0;

    // PS 从三表推算：营收/市值
    const currentPS = bd.ps || (stmts.length > 0 && bd.mcap && bd.mcap > 0
      ? stmts[0].revenue / bd.mcap : 0);

    // 每股股利：从 dy × price 推算
    const currentDividendPS = bd.dividendPerShare || (bd.dy && bd.dy > 0 && currentPrice > 0
      ? currentPrice * (bd.dy / 100) : 0);

    const stockInput: StockInput = {
      code,
      name: code,
      market: market === 'HK' ? 'HK' : 'A',
      price: currentPrice,
      pe: currentPE,
      pb: currentPB,
      ps: currentPS,
      dy: bd.dy || 0,
      roe: bd.roe || (stmts.length > 0 ? stmts[0].roe : 0),
      roa: currentROA,
      eps: currentEPS,
      bvps: bd.eps && currentPE > 0 ? currentPrice / currentPE * currentPB : (stmts.length > 0 ? stmts[0].bvps : 0),
      mcap: bd.mcap || 0,
      fcap: bd.fcap || 0,
      revenue: stmts.length > 0 ? stmts[0].revenue : 0,
      netIncome: stmts.length > 0 ? stmts[0].netIncome : 0,
      operatingCF: stmts.length > 0 ? stmts[0].operatingCF : 0,
      freeCF: stmts.length > 0 ? stmts[0].freeCF : 0,
      grossMargin: stmts.length > 0 ? stmts[0].grossMargin : 0,
      netMargin: stmts.length > 0 ? stmts[0].netMargin : 0,
      totalDebt: currentDebt,
      dividendPerShare: currentDividendPS,
      revenueGrowth: stmts.length > 0 ? stmts[0].revenueGrowth : 0,
      netIncomeGrowth: stmts.length > 0 ? stmts[0].netIncomeGrowth : 0,
      statements: stmts,
    };

    const industryData: IndustryData = {
      pe: industryPE, pb: industryPB, roe: industryROE, name: industryName, peers,
    };

    const valuation = calculateValuation(stockInput, industryData, valuationConfig);
    setValuationResults(prev => ({ ...prev, [code]: valuation }));
  }, [view, navArgs[0], stockStatements, batchData]);

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
        // 合并写入：保留已有字段（如 p/cp），只更新蛋卷提供的估值字段
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
        if (djData?.data?.items?.length > 0) {
          applyData(djData.data.items);
        }
      } catch (e) {
        console.warn('[IndexVal] Danjuan API failed:', e);
      }

      // Supplementary: fetch PE/PB/price for indices not matched by danjuan via eastmoney stock API
      const missingIndices = indices.filter(idx => !matchedCodes.has(idx.c));
      for (const idx of missingIndices) {
        const secid = idx.mk ? `${idx.mk}.${idx.c}` :
                      idx.m === 'GLOBAL' ? `100.${idx.c}` :
                      idx.m === 'HK' ? `116.${idx.c}` :
                      (idx.c.startsWith('6') || idx.c.startsWith('000') || idx.c.startsWith('930') || idx.c.startsWith('H')) ? `1.${idx.c}` :
                      (idx.c.startsWith('399') || idx.c.startsWith('159')) ? `0.${idx.c}` :
                      `1.${idx.c}`;
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
            const priceScale = idx.m === 'HK' ? 1000 : 100;
            const p = d.data.f2 !== undefined && d.data.f2 !== '-' ? (d.data.f2 / priceScale).toFixed(2) : undefined;
            const cp = d.data.f3 !== undefined && d.data.f3 !== '-' ? (d.data.f3 / 100).toFixed(2) : undefined;
            if (pe || pb || p) {
              setIndexVal(prev => {
                const existing = prev[idx.c] || {};
                const update: Record<string, any> = {};
                if (pe) update.pe = pe;
                if (pb) update.pb = pb;
                if (dy !== undefined) update.dy = dy;
                if (p) update.p = p;
                if (cp) update.cp = cp;
                return { ...prev, [idx.c]: { ...existing, ...update } };
              });
            }
          }
          delete (window as any)[cbName];
          const el = document.getElementById(cbName);
          if (el) el.remove();
        };
        
        const script = document.createElement('script');
        script.id = cbName;
        script.src = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f2,f3,f9,f23,f162,f167,f173&cb=${cbName}`;
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

  // 专用指数获取：逐个 JSONP 请求 eastmoney 单品种接口
  // 获取 PE/PB/DY + 实时价格/涨跌幅，覆盖全部指数（含海外）
  useEffect(() => {
    if (indices.length === 0) return;

    // 根据市场和代码推算 secid 前缀
    const getSecid = (idx: Index): string | null => {
      if (idx.mk) return `${idx.mk}.${idx.c}`;
      // 无 mk 时自动推算
      if (idx.m === 'GLOBAL') return `100.${idx.c}`;
      if (idx.m === 'HK') return `116.${idx.c}`;
      // A 股：上交所 1，深交所 0
      if (idx.c.startsWith('6') || idx.c.startsWith('000') || idx.c.startsWith('930') || idx.c.startsWith('H')) return `1.${idx.c}`;
      if (idx.c.startsWith('399') || idx.c.startsWith('159')) return `0.${idx.c}`;
      return `1.${idx.c}`; // 默认上交所
    };

    const fetchAllIndexVal = () => {
      indices.forEach((idx, i) => {
        const secid = getSecid(idx);
        if (!secid) return;

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
            // 指数点位和涨跌幅
            const priceScale = idx.m === 'HK' ? 1000 : 100;
            const p = d.data.f2 !== undefined && d.data.f2 !== '-' ? (d.data.f2 / priceScale).toFixed(2) : undefined;
            const cp = d.data.f3 !== undefined && d.data.f3 !== '-' ? (d.data.f3 / 100).toFixed(2) : undefined;
            if (pe || pb || p) {
              setIndexVal(prev => {
                const existing = prev[idx.c] || {};
                // 只写入本次请求获取到的字段，绝不覆盖已有字段
                const update: Record<string, any> = {};
                if (p) update.p = p;
                if (cp) update.cp = cp;
                // 估值字段：GLOBAL 指数必须写（蛋卷不覆盖），其他只在现有数据缺失时补充
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
          delete (window as any)[cbName];
          const el = document.getElementById(cbName);
          if (el) el.remove();
        };

        const script = document.createElement('script');
        script.id = cbName;
        script.src = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f2,f3,f9,f23,f162,f167,f173&cb=${cbName}`;
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
            const chVal = d.data.f4 !== undefined && d.data.f4 !== '-' ? d.data.f4 : d.data.f170;
            // 优先用 f3（标准涨跌幅%），f171 有时返回错误值
            const rawCp = d.data.f3 !== undefined && d.data.f3 !== '-' ? d.data.f3 : d.data.f171;

            const p = pVal !== undefined && pVal !== '-' ? (pVal / pScale).toFixed(mk === '116' ? 3 : 2) : '—';
            const ch = chVal !== undefined && chVal !== '-' ? (chVal / pScale).toFixed(mk === '116' ? 3 : 2) : '—';
            // 涨跌幅：如果 API 返回的为 0 但有价格和昨收，手动计算
            let cp = rawCp !== undefined && rawCp !== '-' ? (rawCp / 100).toFixed(2) : '—';
            if (cp === '0.00' && pVal > 0 && d.data.f60 > 0) {
              cp = (((pVal - d.data.f60) / d.data.f60) * 100).toFixed(2);
            }
            
            const pe = d.data.f162 !== '-' && d.data.f162 !== undefined && d.data.f162 > 0 ? (d.data.f162 / 100).toFixed(2) : (d.data.f9 !== '-' && d.data.f9 !== undefined && d.data.f9 > 0 ? (d.data.f9 / 100).toFixed(2) : undefined);
            const pb = d.data.f167 !== '-' && d.data.f167 !== undefined && d.data.f167 > 0 ? (d.data.f167 / 100).toFixed(2) : (d.data.f23 !== '-' && d.data.f23 !== undefined && d.data.f23 > 0 ? (d.data.f23 / 100).toFixed(2) : undefined);
            const dy = d.data.f173 !== '-' && d.data.f173 !== undefined ? (d.data.f173 / 100).toFixed(2) : undefined;
            const ps = d.data.f188 !== '-' && d.data.f188 !== undefined && d.data.f188 > 0 ? (d.data.f188 / 100).toFixed(2) : undefined;
            const mcap = d.data.f116 !== '-' && d.data.f116 !== undefined ? (d.data.f116 / 100000000).toFixed(2) : undefined;
            const fcap = d.data.f117 !== '-' && d.data.f117 !== undefined ? (d.data.f117 / 100000000).toFixed(2) : undefined;

            setLivePrice({ p, ch, cp, up: parseFloat(ch) >= 0, pe, pb, dy, ps, mcap, fcap });
          }
          delete (window as any)[cbName];
          const scriptEl = document.getElementById(cbName);
          if (scriptEl) scriptEl.remove();
        };
        
        const script = document.createElement('script');
        script.id = cbName;
        script.src = `https://push2.eastmoney.com/api/qt/stock/get?secid=${mk}.${code}&fields=f43,f170,f171,f2,f3,f4,f162,f167,f173,f188,f116,f117,f9,f23,f60,f169&cb=${cbName}`;
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
    setConfirmDialog({
      title: '删除公司',
      message: '确定删除该公司吗？删除后可通过设置恢复。',
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
    setCustomCompanies([]);
    localStorage.removeItem('iv_custom_comps');
    setDeletedCompanies([]);
    localStorage.removeItem('iv_deleted_comps');
    setView('home');
  };

  const handleRestoreDefaultIndices = () => {
    setConfirmDialog({
      title: '恢复默认指数',
      message: '将重置为系统默认指数列表，你手动添加的指数会被移除。',
      onConfirm: () => {
        setIndices([...DEFAULT_INDICES]);
        localStorage.setItem('iv_indices', JSON.stringify(DEFAULT_INDICES));
        setFavIndices([]);
        localStorage.setItem('iv_fav_indices', JSON.stringify([]));
        setConfirmDialog(null);
      }
    });
  };

  /**
   * 根据 PE 动态计算行业估值水平
   * PE < 15 → low(低估), PE > 30 → high(高估), 其他 → mid(适中)
   */
  const computeEv = (pe: number | undefined | string): 'low' | 'mid' | 'high' => {
    const val = Number(pe);
    if (!val || val <= 0) return 'mid';
    if (val < 15) return 'low';
    if (val > 30) return 'high';
    return 'mid';
  };

  const getIndustryValuation = (ind: Industry) => {
    // Priority: Use BK index data if available
    if (ind.bk && batchData[ind.bk]) {
      const bkd = batchData[ind.bk];
      return {
        p: bkd.p,
        pe: bkd.pe,
        pb: bkd.pb,
        dy: bkd.dy,
        cp: bkd.cp,
        ps: bkd.ps,
        mcap: bkd.mcap,
        ev: computeEv(bkd.pe),
        source: 'index'
      };
    }

    let totalPE = 0, totalPB = 0, totalDY = 0, totalCP = 0, totalMCap = 0;
    let peCount = 0, pbCount = 0, dyCount = 0, cpCount = 0;

    ind.l2.forEach(sub => {
      sub.cs.forEach(c => {
        const bd = batchData[c.c];
        const pe = bd?.pe ? parseFloat(bd.pe) : undefined;
        const pb = bd?.pb ? parseFloat(bd.pb) : undefined;
        const dy = bd?.dy ? parseFloat(bd.dy) : undefined;
        const mcap = bd?.mcap ? parseFloat(bd.mcap) : 1;
        const cp = bd?.cp ? parseFloat(bd.cp) : undefined;

        if (pe && pe > 0) { totalPE += pe * mcap; peCount += mcap; }
        if (pb && pb > 0) { totalPB += pb * mcap; pbCount += mcap; }
        if (dy && dy > 0) { totalDY += dy * mcap; dyCount += mcap; }
        if (cp !== undefined) { totalCP += cp * mcap; cpCount += mcap; }
      });
    });

    const avgPE = peCount > 0 ? (totalPE / peCount).toFixed(1) : undefined;
    const avgPB = pbCount > 0 ? (totalPB / pbCount).toFixed(2) : undefined;
    const avgDY = dyCount > 0 ? (totalDY / dyCount).toFixed(2) : undefined;
    const avgCP = cpCount > 0 ? (totalCP / cpCount).toFixed(2) : undefined;

    return { pe: avgPE, pb: avgPB, dy: avgDY, cp: avgCP, ev: computeEv(avgPE), source: 'calc' };
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
          <div className="stat-label">相关公司</div>
          <div className="text-xl font-extrabold text-cyan-600 tabular-nums">
            {currentIndustries.reduce((a, i) => a + i.l2.reduce((b, s) => b + (s.cs || []).length, 0), 0)}
          </div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">低估行业</div>
          <div className="text-xl font-extrabold text-emerald-600 tabular-nums">
            {currentIndustries.filter(i => getIndustryValuation(i).ev === 'low').length}
          </div>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex bg-white/80 border border-slate-200/60 rounded-2xl p-1 shadow-card overflow-x-auto">
        {(['all', 'low', 'mid', 'high'] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`flex-1 py-2 px-4 text-xs font-bold rounded-xl transition-all duration-200 whitespace-nowrap ${
              filter === t 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'text-slate-400'
            }`}
          >
            {t === 'all' ? '全部' : t === 'low' ? '低估' : t === 'mid' ? '适中' : '高估'}
          </button>
        ))}
      </div>

      {/* Industry Cards */}
      <div className="space-y-3">
        {currentIndustries.filter(i => filter === 'all' || getIndustryValuation(i).ev === filter).map((ind) => {
          const indVal = getIndustryValuation(ind);
          const realIdx = currentIndustries.indexOf(ind);
          return (
          <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            key={ind.id}
            onClick={() => navigate('ind', realIdx)}
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
                {indVal.p && (
                  <span className="text-[11px] font-semibold text-slate-500 tabular-nums">{indVal.p}</span>
                )}
                {indVal.cp !== undefined && (
                  <span className={`text-[10px] font-bold tabular-nums ${parseFloat(indVal.cp) >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {parseFloat(indVal.cp) >= 0 ? '▲' : '▼'}{Math.abs(parseFloat(indVal.cp)).toFixed(2)}%
                  </span>
                )}
              </div>
              <span className={`badge ${indVal.ev === 'low' ? 'val-low' : indVal.ev === 'mid' ? 'val-mid' : 'val-high'}`}>
                {evText(indVal.ev)}
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
              {indVal.p && (
                <span className="text-sm font-semibold text-slate-500 tabular-nums">{indVal.p}</span>
              )}
              {indVal.cp !== undefined && (
                <span className={`text-[11px] font-bold tabular-nums ${parseFloat(indVal.cp) >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {parseFloat(indVal.cp) >= 0 ? '▲' : '▼'}{Math.abs(parseFloat(indVal.cp)).toFixed(2)}%
                </span>
              )}
            </div>
            <span className={`badge ${indVal.ev === 'low' ? 'val-low' : indVal.ev === 'mid' ? 'val-mid' : 'val-high'}`}>
              {evText(indVal.ev)}
            </span>
          </div>

          {ind.indices && ind.indices.length > 0 && (
            <div className="mb-4">
              <div className="stat-label mb-2">相关指数</div>
              <div className="flex flex-wrap gap-2">
                {ind.indices.map(idxInfo => {
                  const bd = batchData[`idx_${idxInfo.c}`] || batchData[idxInfo.c];
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
              { label: 'PB', val: indVal.pb || '—' },
              { label: 'PS', val: indVal.ps || '—' },
              { label: '股息率', val: indVal.dy ? `${indVal.dy}%` : '—' },
              { label: '涨跌幅', val: indVal.cp !== undefined ? `${parseFloat(indVal.cp) >= 0 ? '+' : ''}${indVal.cp}%` : '—' },
              { label: '总市值', val: indVal.mcap ? `${Number(indVal.mcap).toFixed(0)}亿` : '—' },
            ].map(m => (
              <div key={m.label} className="stat-cell">
                <div className="stat-label">{m.label}</div>
                <div className="stat-value">{m.val}</div>
              </div>
            ))}
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
          <h3 className="text-sm font-extrabold text-slate-900 px-0.5">相关公司</h3>
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
                  { l: 'PE', v: batchData[c.c]?.pe?.toFixed(1) || '—' },
                  { l: 'PB', v: batchData[c.c]?.pb?.toFixed(2) || '—' },
                  { l: 'ROE', v: batchData[c.c]?.roe ? `${batchData[c.c].roe.toFixed(1)}%` : '—' },
                  { l: '股息', v: batchData[c.c]?.dy ? `${batchData[c.c].dy.toFixed(1)}%` : '—' },
                  { l: 'PS', v: batchData[c.c]?.ps?.toFixed(1) || '—' },
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
                  { l: 'PE', v: batchData[c.c]?.pe?.toFixed(1) || '—' },
                  { l: 'PB', v: batchData[c.c]?.pb?.toFixed(2) || '—' },
                  { l: 'ROE', v: batchData[c.c]?.roe ? `${batchData[c.c].roe.toFixed(1)}%` : '—' },
                  { l: '股息', v: batchData[c.c]?.dy ? `${batchData[c.c].dy.toFixed(1)}%` : '—' },
                  { l: 'PS', v: batchData[c.c]?.ps?.toFixed(1) || '—' },
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

    // ─── 数据源：batchData（实时行情） + 估值结果 ───
    const isLoading = stockDetailLoading[tCode];
    const valResult = valuationResults[tCode];
    const stmts = stockStatements[tCode] || [];

    const currentPE = (livePrice?.pe && !isNaN(parseFloat(livePrice.pe)) && parseFloat(livePrice.pe) > 0 ? parseFloat(livePrice.pe) : (batchData[tCode]?.pe || 0));
    const currentPB = (livePrice?.pb && !isNaN(parseFloat(livePrice.pb)) && parseFloat(livePrice.pb) > 0 ? parseFloat(livePrice.pb) : (batchData[tCode]?.pb || 0));
    const currentDY = (livePrice?.dy && !isNaN(parseFloat(livePrice.dy)) ? parseFloat(livePrice.dy) : (batchData[tCode]?.dy || 0));
    const currentROE = batchData[tCode]?.roe || (stmts.length > 0 ? stmts[0].roe : 0);
    const currentEPS = batchData[tCode]?.eps || (currentPE > 0 && currentPrice > 0 ? currentPrice / currentPE : 0);
    const currentBVPS = stmts.length > 0 ? stmts[0].bvps : (currentPB > 0 && currentEPS > 0 ? currentEPS * currentPB : 0);
    const currentPrice = (livePrice && livePrice.p !== '—') ? parseFloat(livePrice.p) : parseFloat(batchData[tCode]?.p || '0');

    // ─── 估值结果提取 ───
    let dcfFair = { low: 0, mid: 0, high: 0 };
    let dcfImpliedPE = { low: 0, mid: 0, high: 0 };
    let relFairPE = { low: 0, mid: 0, high: 0 };
    let relFairPrice = { low: 0, mid: 0, high: 0 };
    let compositeFair = { low: 0, mid: 0, high: 0 };
    let compositeMargin = { low: 0, mid: 0, high: 0 };
    let liquidationPrice = 0;
    let impliedGrowth: number | null = null;
    let dcfWacc = 0, dcfPhases: any[] = [], dcfProjection: any[] = [], dcfTVRatio = 0, dcfBasis = 'fcf';
    let dcfSensitivity: any[] = [];
    let relIndustryPE = 0, relHistoricalPE = 0, relPEGPE = 0, relPEG = 0;
    let relHistoricalStats: any = undefined;
    let verdict: string = 'fair', verdictText = '—';
    let modelWeights = { dcf: 0.50, relative: 0.50 };
    let moatSignals: any[] = [];
    let riskSignals: any[] = [];
    let valConfidence = 0;

    if (valResult && currentPE > 0) {
      dcfFair = valResult.dcf.fairValue;
      dcfImpliedPE = valResult.dcf.impliedPE;
      dcfWacc = valResult.dcf.wacc;
      dcfPhases = valResult.dcf.phases;
      dcfProjection = valResult.dcf.projection;
      dcfTVRatio = valResult.dcf.terminalValueRatio;
      dcfBasis = valResult.dcf.usedBasis;
      dcfSensitivity = valResult.dcf.sensitivity || [];

      relFairPE = valResult.relative.fairPE;
      relFairPrice = valResult.relative.fairPrice;
      relIndustryPE = valResult.relative.industryFairPE;
      relHistoricalPE = valResult.relative.historicalFairPE;
      relPEGPE = valResult.relative.pegFairPE;
      relPEG = valResult.relative.peg;
      relHistoricalStats = valResult.relative.historicalPEStats;

      compositeFair = valResult.compositeFairValue;
      compositeMargin = valResult.marginOfSafety;
      verdict = valResult.verdict;
      verdictText = valResult.verdictText;
      modelWeights = valResult.modelWeights;
      moatSignals = valResult.moatSignals;
      riskSignals = valResult.riskSignals;
      liquidationPrice = valResult.liquidationPrice;
      impliedGrowth = valResult.impliedGrowth;
      valConfidence = valResult.confidence;
    } else if (currentPE > 0) {
      // 回退简单估值
      const rf = 0.025, erp = 0.06, beta = 1, wacc = rf + beta * erp;
      const growth = currentROE > 20 ? 0.08 : currentROE > 15 ? 0.06 : currentROE > 10 ? 0.04 : 0.02;
      const tg = 0.025, yrs = 10, eps = currentPE > 0 ? (100 / currentPE) : 0;
      let dcf = 0;
      for (let y = 1; y <= yrs; y++) dcf += eps * Math.pow(1 + growth, y) / Math.pow(1 + wacc, y);
      dcf += (eps * Math.pow(1 + growth, yrs) * (1 + tg)) / (wacc - tg) / Math.pow(1 + wacc, yrs);
      const dcfPE = eps > 0 ? (dcf / eps) : 0;
      const indPE = 20;
      const pePE = indPE * (currentROE / 15);
      const gROE = currentROE / 100, gG = Math.min(gROE * 0.3, 0.04);
      const pbV = gROE > 0 ? ((gROE - gG) / (wacc - gG)) : 0;
      const gPE = gROE > 0 ? (pbV / gROE) : 0;
      const fPE = (dcfPE + pePE + gPE) / 3;
      compositeFair = { low: fPE * 0.8, mid: fPE, high: fPE * 1.2 };
      compositeMargin = { low: 0, mid: currentPE > 0 ? ((fPE - currentPE) / currentPE * 100) : 0, high: 0 };
      verdictText = compositeMargin.mid > 10 ? '低估' : compositeMargin.mid > -10 ? '合理' : '高估';
      dcfFair = { low: dcfPE * 0.9, mid: dcfPE, high: dcfPE * 1.1 };
      relFairPE = { low: pePE * 0.8, mid: pePE, high: pePE * 1.2 };
    }

    // 合理价格 = 当前价 × (合理PE / 当前PE)
    const fairPrice = currentPE > 0 && compositeFair.mid > 0 ? currentPrice * (compositeFair.mid / currentPE) : 0;
    const margin = compositeMargin.mid;

    let vc = 'bg-slate-50 text-slate-400', vt = '—';
    if (currentPE <= 0) { vc = 'bg-amber-50 text-amber-600'; vt = '⚠️ 亏损'; }
    else if (margin > 25) { vc = 'bg-emerald-50 text-emerald-600'; vt = `低估 +${margin.toFixed(0)}%`; }
    else if (margin > -15) { vc = 'bg-amber-50 text-amber-600'; vt = `合理 ${margin >= 0 ? '+' : ''}${margin.toFixed(0)}%`; }
    else { vc = 'bg-red-50 text-red-600'; vt = `高估 ${margin.toFixed(0)}%`; }

    const rg = getGrade(currentROE, [25, 20, 15, 10]);
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
                  const cp = livePrice?.cp || batchData[tCode]?.cp;
                  if (!cp || cp === '—') return null;
                  const val = parseFloat(cp);
                  return (
                    <span className={`text-sm font-bold tabular-nums ${val >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {val >= 0 ? '+' : ''}{cp}%
                    </span>
                  );
                })()}
              </div>
            </div>

            {currentPE > 0 ? (
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex justify-between items-center">
                <div>
                  <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">估值综合</div>
                  <div className="text-lg font-bold text-indigo-600 tabular-nums">
                    {fairPrice > 0 ? `¥${fairPrice.toFixed(2)}` : '—'}
                    <span className="text-xs font-medium ml-1 opacity-70">PE {compositeFair.mid.toFixed(1)}x</span>
                  </div>
                  {impliedGrowth !== null && (
                    <div className="text-[10px] text-indigo-400 mt-1">
                      市场隐含增长 {(impliedGrowth * 100).toFixed(1)}%
                    </div>
                  )}
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
            {(() => {
              // 从 statements 获取最新年报数据作为 fallback
              const latestStmt = stmts.length > 0 ? stmts[0] : undefined;
              // EPS: batchData > price/PE 推算
              const epsVal = batchData[tCode]?.eps || (currentPE > 0 && currentPrice > 0 ? currentPrice / currentPE : 0);
              // ROA: 从 statements 计算
              const roaVal = batchData[tCode]?.roa || (latestStmt && latestStmt.totalAssets > 0 ? (latestStmt.netIncome / latestStmt.totalAssets) * 100 : 0);
              // PS: batchData > revenue/mcap 推算
              const psVal = batchData[tCode]?.ps || (latestStmt && batchData[tCode]?.mcap ? latestStmt.revenue / batchData[tCode].mcap : 0);
              // 负债率: batchData(f57) > statements
              const debtVal = batchData[tCode]?.debt || (latestStmt ? latestStmt.debtRatio : 0);
              return [
                { l: 'PE', v: livePrice?.pe || batchData[tCode]?.pe?.toFixed(1) || '—' },
                { l: 'PB', v: livePrice?.pb || batchData[tCode]?.pb?.toFixed(2) || '—' },
                { l: 'ROE', v: currentROE > 0 ? `${currentROE.toFixed(1)}%` : '—' },
                { l: '股息率', v: batchData[tCode]?.dy ? `${batchData[tCode].dy.toFixed(1)}%` : (livePrice?.dy ? `${livePrice.dy}%` : '—') },
                { l: 'PS', v: psVal > 0 ? psVal.toFixed(1) : '—' },
                { l: '市值', v: livePrice?.mcap ? `${livePrice.mcap}亿` : (batchData[tCode]?.mcap ? `${batchData[tCode].mcap.toFixed(0)}亿` : '—') },
                { l: 'EPS', v: epsVal > 0 ? epsVal.toFixed(2) : '—' },
                { l: 'ROA', v: roaVal !== 0 ? `${roaVal.toFixed(1)}%` : '—' },
                { l: '负债率', v: debtVal > 0 && debtVal <= 100 ? `${debtVal.toFixed(1)}%` : '—' },
              ].map(m => (
                <div key={m.l} className="bg-slate-50 rounded-xl p-2 text-center">
                  <div className="text-[9px] text-slate-400 font-bold uppercase">{m.l}</div>
                  <div className="text-sm font-bold text-slate-700">{m.v}</div>
                </div>
              ));
            })()}
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
            <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                  <TrendingUp size={14} /> 估值分析
                </h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => navigate('settings')} className="text-[9px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-500 font-bold hover:bg-indigo-100 transition-colors">
                    {activePreset ? VALUATION_PRESETS[activePreset].name : '自定义'} ⚙️
                  </button>
                  {isLoading && <Loader2 size={14} className="animate-spin text-indigo-400" />}
                  {stmts.length > 0 && (
                    <span className="text-[9px] text-emerald-500 font-bold">● 真实财报</span>
                  )}
                </div>
              </div>

              {/* ① DCF 现金流折现 */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">
                    ① DCF 现金流折现
                    <span className="text-[9px] ml-1 opacity-60">权重 {(modelWeights.dcf * 100).toFixed(0)}%</span>
                  </span>
                  <span className="font-mono font-bold text-slate-700">
                    ¥{dcfFair.low.toFixed(1)} ~ ¥{dcfFair.high.toFixed(1)}
                  </span>
                </div>
                <div className="text-[9px] text-slate-400 font-medium leading-relaxed">
                  WACC {(dcfWacc * 100).toFixed(1)}%
                  {dcfPhases.map((p: any, i: number) => (
                    <span key={i}> · 阶段{i+1} {(p.growth * 100).toFixed(1)}% × {p.years}年</span>
                  ))}
                  · 终值占比 {(dcfTVRatio * 100).toFixed(0)}%
                  · 基准: {dcfBasis === 'fcf' ? '自由现金流' : dcfBasis === 'netIncome' ? '净利润' : 'EPS'}
                </div>
                {/* 敏感性分析：增长率 × 折现率 热力图 */}
                {dcfSensitivity.length > 0 && (
                  <div className="text-[9px] text-slate-400">
                    <div className="font-medium mb-0.5">敏感性分析：</div>
                    <div className="grid gap-px bg-slate-200 rounded-lg overflow-hidden" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                      <div className="bg-slate-100 px-1.5 py-1 text-center font-bold text-slate-500">增长率\\折现率</div>
                      {[...new Set(dcfSensitivity.map((s: any) => s.wacc))].sort((a: number, b: number) => a - b).map((w: number, i: number) => (
                        <div key={i} className="bg-slate-100 px-1.5 py-1 text-center font-bold text-slate-500">{(w * 100).toFixed(1)}%</div>
                      ))}
                      {dcfSensitivity.filter((_: any, i: number) => i % 3 === 1).map((s: any, i: number) => (
                        <React.Fragment key={i}>
                          <div className="bg-white px-1.5 py-1 text-center font-bold text-slate-600">{(s.growth * 100).toFixed(1)}%</div>
                          {dcfSensitivity.filter((x: any) => Math.abs(x.growth - s.growth) < 0.001).map((x: any, j: number) => (
                            <div key={j} className={`bg-white px-1.5 py-1 text-center font-mono font-bold ${
                              x.value > currentPrice * 1.2 ? 'text-emerald-600' :
                              x.value < currentPrice * 0.8 ? 'text-red-500' : 'text-slate-700'
                            }`}>
                              ¥{x.value.toFixed(0)}
                            </div>
                          ))}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="border-b border-slate-200" />

              {/* ② PE 相对估值 */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">
                    ② PE 相对估值
                    <span className="text-[9px] ml-1 opacity-60">权重 {(modelWeights.relative * 100).toFixed(0)}%</span>
                  </span>
                  <span className="font-mono font-bold text-slate-700">
                    PE {relFairPE.low.toFixed(1)} ~ {relFairPE.high.toFixed(1)}x → ¥{relFairPrice.low.toFixed(1)} ~ ¥{relFairPrice.high.toFixed(1)}
                  </span>
                </div>
                <div className="text-[9px] text-slate-400 font-medium leading-relaxed">
                  行业PE {relIndustryPE.toFixed(1)} · 历史修正PE {relHistoricalPE.toFixed(1)} · PEG {relPEG.toFixed(2)} (合理PE {relPEGPE.toFixed(1)})
                </div>
                {/* 历史 PE 百分位条 */}
                {relHistoricalStats && (
                  <div className="flex items-center gap-2 text-[9px]">
                    <span className="text-slate-400 whitespace-nowrap">PE {relHistoricalStats.min.toFixed(1)}</span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full relative">
                      <div className="absolute h-full bg-gradient-to-r from-emerald-200 via-amber-200 to-red-200 rounded-full" style={{ width: '100%' }} />
                      <div className="absolute top-0 h-full w-0.5 bg-indigo-600 rounded" style={{ left: `${relHistoricalStats.percentile * 100}%` }} title={`当前 PE ${relHistoricalStats.current.toFixed(1)}`} />
                    </div>
                    <span className="text-slate-400 whitespace-nowrap">{relHistoricalStats.max.toFixed(1)}</span>
                    <span className={`font-bold ${relHistoricalStats.percentile < 0.3 ? 'text-emerald-600' : relHistoricalStats.percentile > 0.7 ? 'text-red-500' : 'text-amber-600'}`}>
                      {(relHistoricalStats.percentile * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
              <div className="border-b border-slate-200" />

              {/* 辅助信号 */}
              {moatSignals.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-500">护城河评分</div>
                  <div className="grid grid-cols-2 gap-2">
                    {moatSignals.map((ms: any, i: number) => (
                      <div key={i} className="bg-white rounded-xl p-2 border border-slate-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium text-slate-600">{ms.label}</span>
                          <span className={`text-[10px] font-bold ${
                            ms.level === 'strong' ? 'text-emerald-600' : ms.level === 'good' ? 'text-blue-600' : ms.level === 'average' ? 'text-amber-600' : 'text-red-500'
                          }`}>{ms.score}</span>
                        </div>
                        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${
                            ms.level === 'strong' ? 'bg-emerald-500' : ms.level === 'good' ? 'bg-blue-500' : ms.level === 'average' ? 'bg-amber-500' : 'bg-red-400'
                          }`} style={{ width: `${ms.score}%` }} />
                        </div>
                        <div className="text-[8px] text-slate-400 mt-0.5 truncate" title={ms.detail}>{ms.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 清算底线 + 市场预期 */}
              <div className="grid grid-cols-2 gap-2">
                {liquidationPrice > 0 && (
                  <div className="bg-white rounded-xl p-2.5 border border-slate-100 text-center">
                    <div className="text-[9px] text-slate-400 font-bold mb-0.5">清算底线</div>
                    <div className="text-sm font-bold text-slate-700">¥{liquidationPrice.toFixed(2)}</div>
                    <div className="text-[8px] text-slate-400">0.7 × 每股净资产</div>
                  </div>
                )}
                {impliedGrowth !== null && (
                  <div className="bg-white rounded-xl p-2.5 border border-slate-100 text-center">
                    <div className="text-[9px] text-slate-400 font-bold mb-0.5">市场隐含增长</div>
                    <div className="text-sm font-bold text-indigo-600">{(impliedGrowth * 100).toFixed(1)}%</div>
                    <div className="text-[8px] text-slate-400">当前股价暗含的年化增速</div>
                  </div>
                )}
              </div>

              {/* 综合结果 */}
              <div className="border-t-2 border-slate-200 pt-2.5 space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-800">估值区间</span>
                  <span className="text-indigo-600">
                    ¥{compositeFair.low.toFixed(1)} ~ ¥{compositeFair.mid.toFixed(1)} ~ ¥{compositeFair.high.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">当前价</span>
                  <span className="text-slate-700">¥{currentPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-800">安全边际</span>
                  <span className={compositeMargin.mid > 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {compositeMargin.mid > 0 ? '+' : ''}{compositeMargin.mid.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* 风险信号 */}
              {riskSignals.length > 0 && (
                <div className="space-y-1 pt-1">
                  {riskSignals.map((s: any, i: number) => (
                    <div key={i} className={`text-[10px] font-medium flex items-center gap-1 ${
                      s.level === 'danger' ? 'text-red-500' : s.level === 'warning' ? 'text-amber-500' : 'text-slate-400'
                    }`}>
                      {s.level === 'danger' ? '🔴' : s.level === 'warning' ? '🟡' : 'ℹ️'} {s.message}
                    </div>
                  ))}
                </div>
              )}

              {/* 真实财务数据摘要 */}
              {stmts.length > 0 && (
                <div className="mt-2 pt-3 border-t border-slate-200 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">最新财报 ({stmts[0].reportDate?.substring(0, 10) || stmts[0].year})</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                    {stmts[0].revenue > 0 && <div className="flex justify-between"><span className="text-slate-400">营收</span><span className="font-mono text-slate-600">{stmts[0].revenue.toFixed(1)}亿</span></div>}
                    {stmts[0].netIncome > 0 && <div className="flex justify-between"><span className="text-slate-400">净利润</span><span className="font-mono text-slate-600">{stmts[0].netIncome.toFixed(1)}亿</span></div>}
                    {stmts[0].grossMargin > 0 && <div className="flex justify-between"><span className="text-slate-400">毛利率</span><span className="font-mono text-slate-600">{stmts[0].grossMargin.toFixed(1)}%</span></div>}
                    {stmts[0].netMargin > 0 && <div className="flex justify-between"><span className="text-slate-400">净利率</span><span className="font-mono text-slate-600">{stmts[0].netMargin.toFixed(1)}%</span></div>}
                    {stmts[0].roe > 0 && <div className="flex justify-between"><span className="text-slate-400">ROE</span><span className="font-mono text-slate-600">{stmts[0].roe.toFixed(1)}%</span></div>}
                    {stmts[0].debtRatio > 0 && <div className="flex justify-between"><span className="text-slate-400">资产负债率</span><span className="font-mono text-slate-600">{stmts[0].debtRatio.toFixed(1)}%</span></div>}
                    {stmts[0].operatingCF > 0 && <div className="flex justify-between"><span className="text-slate-400">经营现金流</span><span className="font-mono text-slate-600">{stmts[0].operatingCF.toFixed(1)}亿</span></div>}
                    {stmts[0].freeCF !== 0 && <div className="flex justify-between"><span className="text-slate-400">自由现金流</span><span className={`font-mono ${stmts[0].freeCF >= 0 ? 'text-slate-600' : 'text-red-500'}`}>{stmts[0].freeCF.toFixed(1)}亿</span></div>}
                    {stmts[0].revenueGrowth !== 0 && <div className="flex justify-between"><span className="text-slate-400">营收增长</span><span className={`font-mono ${stmts[0].revenueGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{stmts[0].revenueGrowth >= 0 ? '+' : ''}{stmts[0].revenueGrowth.toFixed(1)}%</span></div>}
                    {stmts[0].netIncomeGrowth !== 0 && <div className="flex justify-between"><span className="text-slate-400">利润增长</span><span className={`font-mono ${stmts[0].netIncomeGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{stmts[0].netIncomeGrowth >= 0 ? '+' : ''}{stmts[0].netIncomeGrowth.toFixed(1)}%</span></div>}
                  </div>
                </div>
              )}

              {/* 历年利润趋势图 */}
              {stmts.length >= 2 && (
                <div className="mt-2 pt-3 border-t border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">历年趋势</div>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={[...stmts].reverse().map(s => ({
                      year: s.year,
                      profit: s.netIncome,
                      revenue: s.revenue,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="year" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8 }}
                        formatter={(value: number, name: string) => [`${value.toFixed(1)}亿`, name === 'profit' ? '净利润' : '营收']}
                      />
                      <Bar dataKey="revenue" fill="#c7d2fe" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="profit" fill="#6366f1" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          <div className="p-3 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-xl text-xs text-slate-600 leading-relaxed">
            {currentROE >= 20 ? '✅ ROE ' + currentROE + '% 优秀 ' : currentROE >= 10 ? '⚠️ ROE ' + currentROE + '% 中等 ' : '❌ ROE 仅 ' + currentROE + '% '}
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

  const handleAiAddIndex = async () => {
    if (!searchQuery) return;
    if (!config.apiKey && !(config.provider === 'gemini' && process.env.GEMINI_API_KEY)) {
      setAiIndexError('请先在设置中配置 AI API Key 才能使用自动添加功能');
      return;
    }
    setIsAddingIndex(true);
    setAiIndexError(null);
    try {
      const prompt = `用户想添加一个指数，输入是："${searchQuery}"。
      请识别这个指数，并返回它的基本信息。
      必须返回一个合法的 JSON 对象，不要包含任何 markdown 标记（如 \`\`\`json），直接返回 JSON 字符串。
      JSON 格式如下：
      {
        "c": "指数代码(如 000300 或 HSI 或 INX)",
        "n": "指数全称(如 沪深300、恒生指数)",
        "m": "A" 或 "HK" 或 "GLOBAL",
        "mk": "东方财富市场代码(A股: 上交所1 深交所0, 港股: 116, 美股/全球: 100)"
      }`;

      let text = await getAIResponse(prompt, config, []);

      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        text = match[0];
      }
      const newIdx = JSON.parse(text);
      newIdx.c = (newIdx.c || '').trim();
      newIdx.n = (newIdx.n || '').trim();
      newIdx.m = newIdx.m || 'A';
      newIdx.mk = newIdx.mk || '1';

      if (!indices.find(i => i.c === newIdx.c)) {
        const newIndices = [...indices, newIdx];
        setIndices(newIndices);
        localStorage.setItem('iv_indices', JSON.stringify(newIndices));
      }

      setSearchQuery('');
      setIndexMarket(newIdx.m);
      navigate('index_detail', newIdx);
    } catch (err) {
      console.error(err);
      setAiIndexError('添加失败，请重试或检查输入是否正确。');
    } finally {
      setIsAddingIndex(false);
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

    const indexObj: Index = {
      c: indexInfo.c,
      n: indexInfo.n,
      m: (ind.market === 'HK' ? 'HK' : 'A') as 'A' | 'HK' | 'GLOBAL',
    };

    return (
      <IndexDetailView
        idx={indexObj}
        batchData={batchData}
        indexVal={indexVal}
        setView={setView}
        toggleFav={toggleFav}
        favIndices={favIndices}
        breadcrumbNodes={
          <>
            <button onClick={() => setView('home')} className="breadcrumb-link">全部</button>
            <ChevronRight size={12} />
            <button onClick={() => navigate('ind', indIdx)} className="breadcrumb-link">{ind.nm}</button>
            <ChevronRight size={12} />
            <span>{indexInfo.n}</span>
          </>
        }
      />
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

            return (
              <motion.div
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                key={idx.c}
                onClick={() => navigate('index_detail', idx)}
                className="card-interactive p-4"
              >
                {/* Row 1: name + code + badge + actions */}
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-extrabold text-slate-900">{idx.n}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{idx.c}</span>
                    {iv?.evaType && (
                      <span className={`badge ${iv.evaType === 'low' ? 'val-low' : iv.evaType === 'mid' ? 'val-mid' : 'val-high'}`}>
                        {evText(iv.evaType)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDialog({
                          title: '删除指数',
                          message: `确定删除 "${idx.n}" 吗？`,
                          onConfirm: () => {
                            const newIndices = indices.filter(i => i.c !== idx.c);
                            setIndices(newIndices);
                            localStorage.setItem('iv_indices', JSON.stringify(newIndices));
                            setConfirmDialog(null);
                          }
                        });
                      }}
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFav(idx.c, 'index', e);
                      }}
                      className="p-2 text-amber-400 transition-colors"
                    >
                      {favIndices.includes(idx.c) ? <Star fill="currentColor" size={18} /> : <Star size={18} />}
                    </button>
                  </div>
                </div>

                {/* Row 2: price + change */}
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-lg font-bold text-slate-900 tabular-nums">{bd?.p || iv?.p || '—'}</span>
                  {(bd?.cp || iv?.cp) && (
                    <span className={`text-xs font-bold tabular-nums ${parseFloat(bd?.cp || iv?.cp) >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {parseFloat(bd?.cp || iv?.cp) >= 0 ? '+' : ''}{bd?.cp || iv?.cp}%
                    </span>
                  )}
                </div>

                {/* Row 3: PE% / ROE / 股息率 */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="stat-cell py-2">
                    <div className="stat-label">PE%</div>
                    <div className="stat-value">{iv?.pePct !== undefined ? `${(iv.pePct * 100).toFixed(2)}%` : '—'}</div>
                  </div>
                  <div className="stat-cell py-2">
                    <div className="stat-label">ROE</div>
                    <div className="stat-value">{iv?.roe !== undefined ? `${(iv.roe * 100).toFixed(2)}%` : '—'}</div>
                  </div>
                  <div className="stat-cell py-2">
                    <div className="stat-label">股息率</div>
                    <div className="stat-value">{iv?.dy !== undefined ? `${(iv.dy * 100).toFixed(2)}%` : '—'}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  };

  const [favTab, setFavTab] = useState<'stocks' | 'indices'>('stocks');
  const [dragMode, setDragMode] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reorderFavStocks = (fromIdx: number, toIdx: number) => {
    // Build ordered results matching favStocks order
    const ordered: { code: string; market: string }[] = [];
    favStocks.forEach(code => {
      for (const ind of allIndustries) {
        for (const s of ind.l2) {
          const found = (s.cs || []).find(c => c.c === code);
          if (found) { ordered.push({ code, market: ind.market || 'A' }); break; }
        }
      }
      // Also check customCompanies
      const custom = customCompanies.find(c => c.c === code);
      if (custom && !ordered.find(o => o.code === code)) {
        ordered.push({ code, market: custom.market || 'A' });
      }
    });
    if (fromIdx < 0 || fromIdx >= ordered.length || toIdx < 0 || toIdx >= ordered.length) return;
    const item = ordered.splice(fromIdx, 1)[0];
    ordered.splice(toIdx, 0, item);
    setFavStocks(ordered.map(o => o.code));
  };

  const reorderFavIndices = (fromIdx: number, toIdx: number) => {
    const ordered = favIndices.filter(c => indices.find(i => i.c === c));
    if (fromIdx < 0 || fromIdx >= ordered.length || toIdx < 0 || toIdx >= ordered.length) return;
    const item = ordered.splice(fromIdx, 1)[0];
    ordered.splice(toIdx, 0, item);
    setFavIndices(ordered);
  };

  const handleLongPressStart = (e: React.PointerEvent, idx: number) => {
    if (dragMode) return;
    longPressTimer.current = setTimeout(() => {
      setDragMode(true);
      setDragIdx(idx);
      if ('vibrate' in navigator) navigator.vibrate(30);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleFavDragEnd = (fromIdx: number, info: any, isStock: boolean) => {
    const itemHeight = 120; // approximate card height
    const toOffset = Math.round(info.offset.y / itemHeight);
    const toIdx = Math.max(0, Math.min(fromIdx + toOffset, (isStock ? favStocks.length : favIndices.length) - 1));
    if (fromIdx !== toIdx) {
      if (isStock) reorderFavStocks(fromIdx, toIdx);
      else reorderFavIndices(fromIdx, toIdx);
    }
    setDragIdx(null);
    setDragMode(false);
  };

  const renderFavStocks = () => {
    // Build results in favStocks order
    const results: any[] = [];
    favStocks.forEach(code => {
      let found = false;
      allIndustries.forEach(ind => ind.l2.forEach(s => (s.cs || []).forEach(c => {
        if (c.c === code && !found) {
          results.push({ ...c, sn: s.nm, ic: ind.ic, nm: ind.nm, market: ind.market || 'A' });
          found = true;
        }
      })));
      if (!found) {
        const custom = customCompanies.find(x => x.c === code);
        if (custom) results.push({ ...custom, sn: custom.subIndName, ic: custom.ic || '🏢', nm: custom.indName || '自定义', market: custom.market || 'A' });
      }
    });

    return (
      <div className="space-y-3">
        {results.length > 0 ? results.map((c, i) => (
          <motion.div
            key={`${c.market}-${c.c}`}
            layout
            drag={dragMode ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.5}
            onDragEnd={(_, info) => handleFavDragEnd(i, info, true)}
            onPointerDown={(e) => handleLongPressStart(e, i)}
            onPointerUp={handleLongPressEnd}
            onPointerLeave={handleLongPressEnd}
            onClick={() => { if (!dragMode) { setMarket(c.market || 'A'); navigate('comp', c.c, c.n); } }}
            className={`card-interactive p-4 relative ${dragMode ? 'ring-2 ring-brand-300 ring-dashed' : ''} ${selectMode && selectedItems.has(c.c) ? 'ring-2 ring-brand-500 bg-brand-50/30' : ''}`}
            style={{ touchAction: dragMode ? 'none' : 'auto' }}
          >
            {dragMode && (
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300">
                <GripVertical size={16} />
              </div>
            )}
            <div className={`flex justify-between items-start mb-2.5 ${dragMode ? 'pl-5' : ''}`}>
              <div>
                <div className="text-[13px] font-bold text-slate-900">{c.n}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{c.c} · {c.sn}</div>
              </div>
              <div className="flex items-center gap-1">
                {batchData[c.c] && batchData[c.c].p && !selectMode && (
                  <div className="text-right">
                    <div className="text-[13px] font-bold text-slate-900 tabular-nums">¥{batchData[c.c].p}</div>
                    <div className={`text-[10px] font-bold tabular-nums ${parseFloat(batchData[c.c].cp || '0') >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {parseFloat(batchData[c.c].cp || '0') >= 0 ? '▲' : '▼'}{Math.abs(parseFloat(batchData[c.c].cp || '0')).toFixed(2)}%
                    </div>
                  </div>
                )}
                {selectMode ? (
                  <button onClick={(e) => { e.stopPropagation(); toggleSelectItem(c.c); }} className="p-1.5">
                    {selectedItems.has(c.c)
                      ? <CheckSquare size={20} className="text-brand-500" />
                      : <Square size={20} className="text-slate-300" />
                    }
                  </button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); handleSingleUnfav(c.c, c.n, 'stock'); }} className="p-1.5 text-amber-400 ml-1">
                    <Star fill="currentColor" size={18} />
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { l: 'PE', v: batchData[c.c]?.pe?.toFixed(1) || '—' },
                { l: 'PB', v: batchData[c.c]?.pb?.toFixed(2) || '—' },
                { l: 'ROE', v: batchData[c.c]?.roe ? `${batchData[c.c].roe.toFixed(1)}%` : '—' },
                { l: '股息', v: batchData[c.c]?.dy ? `${batchData[c.c].dy.toFixed(1)}%` : '—' },
                { l: 'PS', v: batchData[c.c]?.ps?.toFixed(1) || '—' },
              ].map(m => (
                <div key={m.l} className="stat-cell py-1.5">
                  <div className="stat-label text-[7px]">{m.l}</div>
                  <div className="text-[10px] font-bold text-slate-700 tabular-nums">{m.v}</div>
                </div>
              ))}
            </div>
          </motion.div>
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
    const results = favIndices.map(code => indices.find(i => i.c === code)).filter(Boolean) as Index[];

    return (
      <div className="space-y-3">
        {results.length > 0 ? results.map((idx, i) => {
          const bd = batchData[idx.c];
          const iv = indexVal[idx.c];
          const pePct = (iv?.pePct !== undefined ? iv.pePct * 100 : idx.pePct) || 50;
          const status = pePct < 30 ? 'low' : pePct > 70 ? 'high' : 'mid';

          return (
            <motion.div
              key={idx.c}
              layout
              drag={dragMode ? "y" : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.5}
              onDragEnd={(_, info) => handleFavDragEnd(i, info, false)}
              onPointerDown={(e) => handleLongPressStart(e, i)}
              onPointerUp={handleLongPressEnd}
              onPointerLeave={handleLongPressEnd}
              onClick={() => { if (!dragMode) navigate('index_detail', idx); }}
              className={`card-interactive p-4 relative ${dragMode ? 'ring-2 ring-brand-300 ring-dashed' : ''} ${selectMode && selectedItems.has(idx.c) ? 'ring-2 ring-brand-500 bg-brand-50/30' : ''}`}
              style={{ touchAction: dragMode ? 'none' : 'auto' }}
            >
              {dragMode && (
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300">
                  <GripVertical size={16} />
                </div>
              )}
              <div className={`flex justify-between items-center mb-2 ${dragMode ? 'pl-5' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-extrabold text-slate-900">{idx.n}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{idx.c}</span>
                  {iv?.evaType && !selectMode && (
                    <span className={`badge ${iv.evaType === 'low' ? 'val-low' : iv.evaType === 'mid' ? 'val-mid' : 'val-high'}`}>
                      {evText(iv.evaType)}
                    </span>
                  )}
                </div>
                {selectMode ? (
                  <button onClick={(e) => { e.stopPropagation(); toggleSelectItem(idx.c); }} className="p-1.5">
                    {selectedItems.has(idx.c)
                      ? <CheckSquare size={20} className="text-brand-500" />
                      : <Square size={20} className="text-slate-300" />
                    }
                  </button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); handleSingleUnfav(idx.c, idx.n, 'index'); }} className="p-1.5 text-amber-400">
                    <Star fill="currentColor" size={18} />
                  </button>
                )}
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-lg font-bold text-slate-900 tabular-nums">{bd?.p || '—'}</span>
                {bd?.cp && (
                  <span className={`text-xs font-bold tabular-nums ${parseFloat(bd.cp) >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {parseFloat(bd.cp) >= 0 ? '+' : ''}{bd.cp}%
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="stat-cell py-2">
                  <div className="stat-label">PE%</div>
                  <div className="stat-value">{iv?.pePct !== undefined ? `${(iv.pePct * 100).toFixed(2)}%` : '—'}</div>
                </div>
                <div className="stat-cell py-2">
                  <div className="stat-label">ROE</div>
                  <div className="stat-value">{iv?.roe !== undefined ? `${(iv.roe * 100).toFixed(2)}%` : '—'}</div>
                </div>
                <div className="stat-cell py-2">
                  <div className="stat-label">股息率</div>
                  <div className="stat-value">{iv?.dy !== undefined ? `${(iv.dy * 100).toFixed(2)}%` : '—'}</div>
                </div>
              </div>
            </motion.div>
          );
        }) : (
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

  const handleBatchUnfav = () => {
    if (selectedItems.size === 0) return;
    setConfirmDialog({
      title: '取消收藏',
      message: `确定取消收藏选中的 ${selectedItems.size} 项吗？`,
      onConfirm: () => {
        if (favTab === 'stocks') {
          setFavStocks(prev => prev.filter(c => !selectedItems.has(c)));
        } else {
          setFavIndices(prev => prev.filter(c => !selectedItems.has(c)));
        }
        setSelectedItems(new Set());
        setSelectMode(false);
        setConfirmDialog(null);
      }
    });
  };

  const toggleSelectItem = (code: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleSingleUnfav = (code: string, name: string, type: 'stock' | 'index') => {
    setConfirmDialog({
      title: '取消收藏',
      message: `确定取消收藏 "${name}" 吗？`,
      onConfirm: () => {
        toggleFav(code, type);
        setConfirmDialog(null);
      }
    });
  };

  const renderFav = () => {
    const totalItems = favTab === 'stocks' ? favStocks.length : favIndices.length;
    return (
      <div className="space-y-4">
        <div className="flex bg-white/80 border border-slate-200/60 rounded-2xl p-1 shadow-card items-center">
          <button onClick={() => { setFavTab('stocks'); setSelectMode(false); setSelectedItems(new Set()); }} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${favTab === 'stocks' ? 'tab-pill-active' : 'tab-pill-inactive'}`}>自选股</button>
          <button onClick={() => { setFavTab('indices'); setSelectMode(false); setSelectedItems(new Set()); }} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${favTab === 'indices' ? 'tab-pill-active' : 'tab-pill-inactive'}`}>自选指数</button>
          <button
            onClick={() => { if (dragMode) { setDragMode(false); } else { setSelectMode(!selectMode); setSelectedItems(new Set()); } }}
            className={`ml-1.5 p-2 rounded-xl transition-all duration-200 ${selectMode ? 'bg-brand-500 text-white' : 'text-slate-400 hover:bg-slate-100'}`}
            title="多选"
          >
            <CheckSquare size={16} />
          </button>
          <button
            onClick={() => { if (selectMode) { setSelectMode(false); setSelectedItems(new Set()); } else { setDragMode(!dragMode); } }}
            className={`ml-1 p-2 rounded-xl transition-all duration-200 ${dragMode ? 'bg-brand-500 text-white' : 'text-slate-400 hover:bg-slate-100'}`}
            title="排序"
          >
            <GripVertical size={16} />
          </button>
        </div>
        {dragMode && (
          <div className="text-center text-[11px] text-brand-500 font-medium py-1">
            长按或拖拽卡片可调整顺序
          </div>
        )}
        {selectMode && (
          <div className="flex items-center justify-between px-1">
            <button
              onClick={() => {
                if (selectedItems.size === totalItems) {
                  setSelectedItems(new Set());
                } else {
                  const allCodes = favTab === 'stocks' ? new Set(favStocks) : new Set(favIndices);
                  setSelectedItems(allCodes);
                }
              }}
              className="text-xs text-brand-500 font-bold"
            >
              {selectedItems.size === totalItems ? '取消全选' : '全选'}
            </button>
            <span className="text-[11px] text-slate-400">已选 {selectedItems.size} 项</span>
          </div>
        )}
        {favTab === 'stocks' ? renderFavStocks() : renderFavIndices()}
        {selectMode && selectedItems.size > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="fixed bottom-20 left-4 right-4 z-50"
          >
            <button
              onClick={handleBatchUnfav}
              className="w-full py-3.5 bg-red-500 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Star size={16} />
              取消收藏 ({selectedItems.size})
            </button>
          </motion.div>
        )}
      </div>
    );
  };

  // ─── 设置页面 ───
  const renderSettings = () => {
    // 更新估值参数的辅助函数
    const updateDCF = (key: string, val: number) => {
      const newCfg = { ...valuationConfig, dcf: { ...valuationConfig.dcf, [key]: val } };
      setValuationConfig(newCfg);
      setActivePreset(null);
      localStorage.setItem('iv_val_cfg', JSON.stringify(newCfg));
      localStorage.removeItem('iv_val_preset');
    };
    const updatePE = (key: string, val: number) => {
      const newCfg = { ...valuationConfig, pe: { ...valuationConfig.pe, [key]: val } };
      setValuationConfig(newCfg);
      setActivePreset(null);
      localStorage.setItem('iv_val_cfg', JSON.stringify(newCfg));
      localStorage.removeItem('iv_val_preset');
    };
    const applyPreset = (name: PresetName) => {
      const cfg = VALUATION_PRESETS[name].config;
      setValuationConfig(cfg);
      setActivePreset(name);
      localStorage.setItem('iv_val_cfg', JSON.stringify(cfg));
      localStorage.setItem('iv_val_preset', name);
    };

    // 滑块组件
    const Slider = ({ label, value, min, max, step, unit, onChange, desc }: {
      label: string; value: number; min: number; max: number; step: number;
      unit: string; onChange: (v: number) => void; desc?: string;
    }) => (
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-600 font-medium">{label}</span>
          <span className="text-xs font-mono font-bold text-indigo-600">{(value * (unit === '%' ? 100 : 1)).toFixed(unit === '%' ? 1 : 2)}{unit}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-500"
        />
        {desc && <div className="text-[9px] text-slate-400">{desc}</div>}
      </div>
    );

    return (
      <div className="space-y-5">
        {/* Tab 切换 */}
        <div className="flex bg-white/80 border border-slate-200/60 rounded-2xl p-1 shadow-card">
          {(['ai', 'data', 'valuation'] as const).map(tab => (
            <button key={tab} onClick={() => setSettingsTab(tab)}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${settingsTab === tab ? 'tab-pill-active' : 'tab-pill-inactive'}`}>
              {tab === 'ai' ? '🤖 AI' : tab === 'data' ? '📊 数据' : '📐 估值模型'}
            </button>
          ))}
        </div>

        {/* AI 设置 */}
        {settingsTab === 'ai' && (
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">AI 服务商</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PROVIDERS).map(([id, p]) => (
                  <button key={id}
                    onClick={() => setConfig({ ...config, provider: id, apiUrl: config.apiUrl === '' || Object.values(PROVIDERS).some(prov => prov.url === config.apiUrl) ? p.url : config.apiUrl, model: p.model })}
                    className={`p-3 rounded-xl text-left transition-all ${config.provider === id ? 'border-2 border-brand-500 bg-brand-50' : 'border border-slate-200/80 bg-surface'}`}>
                    <div className={`text-sm font-bold ${config.provider === id ? 'text-brand-700' : 'text-slate-700'}`}>{p.name}</div>
                    <div className="text-[10px] text-slate-400">{p.model}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">API 地址</label>
                <input className="input-field" value={config.apiUrl} placeholder={PROVIDERS[config.provider]?.url} onChange={e => setConfig({ ...config, apiUrl: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">API Key</label>
                <input type="password" className="input-field" placeholder="sk-xxxxxxxx" value={config.apiKey} onChange={e => setConfig({ ...config, apiKey: e.target.value })} />
                <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1"><AlertCircle size={10} /> 仅保存在本地浏览器</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">模型名称</label>
                <input className="input-field" value={config.model} onChange={e => setConfig({ ...config, model: e.target.value })} />
              </div>
            </div>
            <button onClick={() => { setConfig(DEFAULT_CONFIG); localStorage.removeItem('iv_cfg'); }}
              className="btn-secondary w-full py-3">恢复 AI 默认设置</button>
          </div>
        )}

        {/* 数据设置 */}
        {settingsTab === 'data' && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase">数据来源</div>
              <div className="text-xs text-slate-600">实时行情 & 财务数据来自东方财富，每 10 秒自动刷新。</div>
            </div>
            <button onClick={() => setConfirmDialog({ title: '恢复公司数据', message: '将清除所有自定义公司，恢复初始状态。', onConfirm: () => { handleRestoreDefaults(); setConfirmDialog(null); } })}
              className="btn-danger w-full py-3 flex items-center justify-center gap-2">
              <Trash2 size={15} /> 恢复默认公司数据
            </button>
            <button onClick={handleRestoreDefaultIndices}
              className="w-full py-3 flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 text-amber-600 font-bold rounded-2xl">
              <RotateCcw size={15} /> 恢复默认指数数据
            </button>
          </div>
        )}

        {/* 估值模型设置 */}
        {settingsTab === 'valuation' && (
          <div className="space-y-5">
            {/* 预设方案 */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">预设方案</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(VALUATION_PRESETS) as [PresetName, typeof VALUATION_PRESETS[PresetName]][]).map(([key, preset]) => (
                  <button key={key} onClick={() => applyPreset(key)}
                    className={`p-3 rounded-xl text-left transition-all ${activePreset === key ? 'border-2 border-indigo-500 bg-indigo-50' : 'border border-slate-200/80 bg-surface'}`}>
                    <div className={`text-sm font-bold ${activePreset === key ? 'text-indigo-700' : 'text-slate-700'}`}>{preset.name}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{preset.desc}</div>
                  </button>
                ))}
              </div>
              {activePreset === null && <div className="text-[10px] text-amber-500 mt-2 font-medium">⚠️ 自定义参数</div>}
            </div>

            {/* DCF 参数 */}
            <div className="card-elevated p-4 space-y-3">
              <h3 className="text-xs font-bold text-indigo-600">① DCF 现金流折现</h3>
              <Slider label="无风险利率 Rf" value={valuationConfig.dcf.rf} min={0.01} max={0.06} step={0.005} unit="%" onChange={v => updateDCF('rf', v)} desc="10 年期国债收益率" />
              <Slider label="股权风险溢价 ERP" value={valuationConfig.dcf.erp} min={0.03} max={0.10} step={0.005} unit="%" onChange={v => updateDCF('erp', v)} desc="股票相对无风险资产的额外回报" />
              <Slider label="永续增长率 g" value={valuationConfig.dcf.terminalGrowth} min={0.01} max={0.05} step={0.005} unit="%" onChange={v => updateDCF('terminalGrowth', v)} desc="长期名义 GDP 增速" />
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">预测年数</span>
                <div className="flex gap-1">
                  {[5, 8, 10].map(y => (
                    <button key={y} onClick={() => updateDCF('projectionYears', y)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${valuationConfig.dcf.projectionYears === y ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {y}年
                    </button>
                  ))}
                </div>
              </div>
              <Slider label="乐观折现率" value={valuationConfig.dcf.discountRates.bull} min={0.05} max={0.12} step={0.005} unit="%" onChange={v => {
                const newCfg = { ...valuationConfig, dcf: { ...valuationConfig.dcf, discountRates: { ...valuationConfig.dcf.discountRates, bull: v } } };
                setValuationConfig(newCfg); setActivePreset(null); localStorage.setItem('iv_val_cfg', JSON.stringify(newCfg)); localStorage.removeItem('iv_val_preset');
              }} desc="低折现率 → 高估值" />
              <Slider label="中性折现率" value={valuationConfig.dcf.discountRates.base} min={0.06} max={0.14} step={0.005} unit="%" onChange={v => {
                const newCfg = { ...valuationConfig, dcf: { ...valuationConfig.dcf, discountRates: { ...valuationConfig.dcf.discountRates, base: v } } };
                setValuationConfig(newCfg); setActivePreset(null); localStorage.setItem('iv_val_cfg', JSON.stringify(newCfg)); localStorage.removeItem('iv_val_preset');
              }} desc="基准情景" />
              <Slider label="悲观折现率" value={valuationConfig.dcf.discountRates.bear} min={0.08} max={0.18} step={0.005} unit="%" onChange={v => {
                const newCfg = { ...valuationConfig, dcf: { ...valuationConfig.dcf, discountRates: { ...valuationConfig.dcf.discountRates, bear: v } } };
                setValuationConfig(newCfg); setActivePreset(null); localStorage.setItem('iv_val_cfg', JSON.stringify(newCfg)); localStorage.removeItem('iv_val_preset');
              }} desc="高折现率 → 低估值" />
            </div>

            {/* PE 相对估值参数 */}
            <div className="card-elevated p-4 space-y-3">
              <h3 className="text-xs font-bold text-indigo-600">② PE 相对估值</h3>
              <Slider label="ROE 基准值" value={valuationConfig.pe.roeBase} min={0.08} max={0.25} step={0.01} unit="%" onChange={v => updatePE('roeBase', v)} desc="ROE 达到此值可享行业平均 PE" />
              <Slider label="行业 PE 权重" value={valuationConfig.pe.industryWeight} min={0.1} max={0.6} step={0.05} unit="" onChange={v => updatePE('industryWeight', v)} />
              <Slider label="历史 PE 权重" value={valuationConfig.pe.historicalWeight} min={0.1} max={0.6} step={0.05} unit="" onChange={v => updatePE('historicalWeight', v)} />
              <Slider label="增长权重 (PEG)" value={valuationConfig.pe.growthWeight} min={0.1} max={0.5} step={0.05} unit="" onChange={v => updatePE('growthWeight', v)} />
            </div>

            {/* 辅助信号说明 */}
            <div className="card-elevated p-4 space-y-3">
              <h3 className="text-xs font-bold text-indigo-600">辅助信号（自动计算）</h3>
              <div className="text-[10px] text-slate-500 space-y-1.5 leading-relaxed">
                <p>• <b>护城河评分</b>：基于真实财报 — ROE 连续性、现金流质量（经营CF/净利润）、增长质量、负债安全</p>
                <p>• <b>清算底线</b>：0.7 × 每股净资产，股价低于此值有资产支撑</p>
                <p>• <b>市场隐含增长</b>：用二分法从当前股价反推市场预期的年化增长率</p>
                <p>• <b>敏感性分析</b>：DCF 对增长率和折现率假设的敏感度矩阵</p>
                <p>• 财务数据来自东方财富三表（利润表+资产负债表+现金流量表），本地缓存 7 天</p>
              </div>
            </div>

            <button onClick={() => applyPreset('neutral')} className="btn-secondary w-full py-3">恢复默认参数</button>
          </div>
        )}
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
             view === 'index_detail' ? '指数详情' :
             view === 'settings' ? '设置' : '自选股'}
          </h1>
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
                handleAiAddIndex={handleAiAddIndex}
                isAddingIndex={isAddingIndex}
                aiIndexError={aiIndexError}
                batchData={batchData}
              />
            )}
            {view === 'ai' && renderAI()}
            {view === 'fav' && renderFav()}
            {view === 'settings' && renderSettings()}
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

      {/* 确认弹窗 */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDialog(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl"
            >
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={24} className="text-amber-500" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 text-center mb-2">{confirmDialog.title}</h3>
              <p className="text-sm text-slate-500 text-center leading-relaxed mb-6">{confirmDialog.message}</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl active:scale-[0.98] transition-transform"
                >
                  取消
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="py-3 bg-red-500 text-white font-bold rounded-2xl active:scale-[0.98] transition-transform shadow-lg shadow-red-500/25"
                >
                  确定
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
