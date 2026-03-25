import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { getIndustryValuation, evText } from '../helpers';

interface IndustryViewProps {
  idx: number;
}

const IndustryView = ({ idx }: IndustryViewProps) => {
  const {
    setView, navigate, currentIndustries, batchData,
  } = useAppContext();

  const ind = currentIndustries[idx];
  if (!ind) return null;
  const indVal = getIndustryValuation(ind, batchData);
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
            <div className={`grid gap-2 ${ind.indices.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {ind.indices.map(idxInfo => {
                const bd = batchData[idxInfo.c];
                const isUp = bd?.cp ? parseFloat(bd.cp) >= 0 : false;
                return (
                  <button
                    key={idxInfo.c}
                    onClick={() => navigate('index', idx, idxInfo.c)}
                    className="text-left p-2.5 rounded-xl border border-slate-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/30 active:scale-[0.97] transition-all"
                  >
                    <div className="text-[10px] font-bold text-slate-500 truncate">{idxInfo.n}</div>
                    <div className="text-sm font-extrabold text-slate-900 tabular-nums mt-0.5">{bd?.p || '—'}</div>
                    {bd?.cp && (
                      <span className={`inline-block text-[10px] font-bold tabular-nums mt-0.5 px-1.5 py-0.5 rounded-md ${isUp ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'}`}>
                        {isUp ? '▲' : '▼'}{Math.abs(parseFloat(bd.cp)).toFixed(2)}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
                { l: 'PE', v: batchData[c.c]?.pe?.toFixed(1) },
                { l: 'PB', v: batchData[c.c]?.pb?.toFixed(2) },
                { l: 'ROE', v: batchData[c.c]?.roe ? `${batchData[c.c].roe.toFixed(1)}%` : undefined },
                { l: '股息', v: batchData[c.c]?.dy ? `${batchData[c.c].dy.toFixed(1)}%` : undefined },
                { l: '市值', v: batchData[c.c]?.mcap ? `${batchData[c.c].mcap.toFixed(0)}亿` : undefined },
              ].filter(m => m.v).map(m => (
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

export default IndustryView;
