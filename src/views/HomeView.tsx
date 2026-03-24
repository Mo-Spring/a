import React from 'react';
import { motion } from 'motion/react';
import { useAppContext } from '../AppContext';
import { getIndustryValuation, evText } from '../helpers';

const HomeView = () => {
  const {
    market, setMarket, currentIndustries, filter, setFilter,
    navigate, batchData,
  } = useAppContext();

  return (
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
            {currentIndustries.filter(i => getIndustryValuation(i, batchData).ev === 'low').length}
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
        {currentIndustries.filter(i => filter === 'all' || getIndustryValuation(i, batchData).ev === filter).map((ind) => {
          const indVal = getIndustryValuation(ind, batchData);
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
};

export default HomeView;
