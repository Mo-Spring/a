import React from 'react';
import { motion } from 'motion/react';
import { Star, Trash2 } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { evText } from '../helpers';

const IndexListView = () => {
  const {
    indices, indexMarket, setIndexMarket, indexValFilter, setIndexValFilter,
    batchData, indexVal, favIndices, navigate, setIndices, setConfirmDialog,
    toggleFav,
  } = useAppContext();

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

export default IndexListView;
