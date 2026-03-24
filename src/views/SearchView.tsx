import React, { useState, useEffect } from 'react';
import { Search, Loader2, Bot } from 'lucide-react';
import { useAppContext } from '../AppContext';

interface SearchViewProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const SearchView = ({
  searchQuery,
  setSearchQuery,
}: SearchViewProps) => {
  const {
    allIndustries, customCompanies, indices, setIndices,
    navigate, setMarket, setIndexMarket,
    handleAiAddCompany, isAddingCompany, aiAddError,
    handleAiAddIndex, isAddingIndex, aiIndexError,
    batchData,
  } = useAppContext();

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

            if (item.QuoteID && item.QuoteID.includes('.')) {
              const parts = item.QuoteID.split('.');
              mk = parts[0];
              if (mk === '116') m = 'HK';
              else if (['105', '106', '107', '100'].includes(mk)) m = 'GLOBAL';
              else m = 'A';
            } else {
              if (mk === '116') m = 'HK';
              else if (['105', '106', '107', '100'].includes(mk)) m = 'GLOBAL';
              else m = 'A';
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

export default SearchView;
