import React, { useState, useRef } from 'react';
import { Star, CheckSquare, Square, GripVertical } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppContext } from '../AppContext';
import { evText } from '../helpers';
import { Index } from '../types';

const FavoritesView = () => {
  const {
    favStocks, favIndices, setFavStocks, setFavIndices,
    allIndustries, customCompanies, indices, batchData, indexVal,
    navigate, setMarket, setConfirmDialog, toggleFav,
  } = useAppContext();

  const [favTab, setFavTab] = useState<'stocks' | 'indices'>('stocks');
  const [dragMode, setDragMode] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reorderFavStocks = (fromIdx: number, toIdx: number) => {
    const ordered: { code: string; market: string }[] = [];
    favStocks.forEach(code => {
      for (const ind of allIndustries) {
        for (const s of ind.l2) {
          const found = (s.cs || []).find(c => c.c === code);
          if (found) { ordered.push({ code, market: ind.market || 'A' }); break; }
        }
      }
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
    const itemHeight = 120;
    const toOffset = Math.round(info.offset.y / itemHeight);
    const toIdx = Math.max(0, Math.min(fromIdx + toOffset, (isStock ? favStocks.length : favIndices.length) - 1));
    if (fromIdx !== toIdx) {
      if (isStock) reorderFavStocks(fromIdx, toIdx);
      else reorderFavIndices(fromIdx, toIdx);
    }
    setDragIdx(null);
    setDragMode(false);
  };

  const handleBatchUnfav = () => {
    if (selectedItems.size === 0) return;
    setConfirmDialog({
      title: '取消收藏',
      message: `确定取消收藏选中的 ${selectedItems.size} 项吗？`,
      onConfirm: () => {
        if (favTab === 'stocks') {
          setFavStocks((prev: string[]) => prev.filter(c => !selectedItems.has(c)));
        } else {
          setFavIndices((prev: string[]) => prev.filter(c => !selectedItems.has(c)));
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

  const renderFavStocks = () => {
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

export default FavoritesView;
