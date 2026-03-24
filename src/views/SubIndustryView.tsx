import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useAppContext } from '../AppContext';

interface SubIndustryViewProps {
  idx: number;
  sidx: number;
}

const SubIndustryView = ({ idx, sidx }: SubIndustryViewProps) => {
  const {
    setView, navigate, currentIndustries, batchData,
  } = useAppContext();

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

export default SubIndustryView;
