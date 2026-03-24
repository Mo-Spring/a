import React from 'react';
import { Star, ChevronRight, Trash2 } from 'lucide-react';
import { Index } from '../types';
import { useAppContext } from '../AppContext';

interface IndexDetailViewProps {
  idx: Index;
  batchData: Record<string, any>;
  indexVal: Record<string, { pe?: number; pb?: number; dy?: number; pePct?: number; pbPct?: number; roe?: number; peg?: number; evaType?: string; bondYield?: number; source?: string; peOverHistory?: number; pbOverHistory?: number; evaTypeInt?: number; date?: string; p?: string; cp?: string }>;
  breadcrumbNodes?: React.ReactNode;
}

const IndexDetailView = ({ idx, batchData, indexVal, breadcrumbNodes }: IndexDetailViewProps) => {
  const { setView, toggleFav, favIndices, indices, setIndices } = useAppContext();

  const djIv = indexVal[idx.c];
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
            <span>{'\u26a0\ufe0f'}</span> PE/PB 为从行业成分股推算，非指数直接数据
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

        {/* 整体估值水平 */}
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

        {/* 估值分析 */}
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

export default IndexDetailView;
