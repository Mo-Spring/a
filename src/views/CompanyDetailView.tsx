import React, { useState } from 'react';
import { ChevronRight, Star, Trash2, TrendingUp, Loader2, BarChart3, Calculator } from 'lucide-react';
import { motion } from 'motion/react';
import { Industry } from '../types';
import { useAppContext } from '../AppContext';
import { getGrade, gColor } from '../helpers';
import FinancialStatementsView from './FinancialStatementsView';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { VALUATION_PRESETS } from '../types';

interface CompanyDetailViewProps {
  code: string;
  name: string;
}

const CompanyDetailView = ({ code, name }: CompanyDetailViewProps) => {
  const {
    allIndustries, customCompanies, currentIndustries,
    setView, navigate, toggleFav, favStocks,
    batchData, livePrice, stockStatements, stockDetailLoading,
    valuationResults, activePreset, valuationConfig,
    handleDeleteCompany,
  } = useAppContext();

  let ind: Industry | undefined;
  let c: any;
  
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
  
  if (!c) {
    const found = customCompanies.find(x => x.c === tCode);
    if (found) {
      c = found;
      ind = allIndustries.find(i => i.nm === (found.indName || '其他行业')) || allIndustries[0];
    }
  }

  if (!c || !ind) return <div className="p-8 text-center text-gray-500">未找到公司数据 ({tCode})</div>;

  const ii = currentIndustries.findIndex(i => i.id === ind?.id);

  const [detailTab, setDetailTab] = useState<'valuation' | 'financial'>('valuation');
  const isLoading = stockDetailLoading[tCode];
  const valResult = valuationResults[tCode];
  const stmts = stockStatements[tCode] || [];

  const currentPrice = (livePrice && livePrice.p !== '—') ? parseFloat(livePrice.p) : parseFloat(batchData[tCode]?.p || '0');
  const currentPE = (livePrice?.pe && !isNaN(parseFloat(livePrice.pe)) && parseFloat(livePrice.pe) > 0 ? parseFloat(livePrice.pe) : (batchData[tCode]?.pe || 0));
  const currentPB = (livePrice?.pb && !isNaN(parseFloat(livePrice.pb)) && parseFloat(livePrice.pb) > 0 ? parseFloat(livePrice.pb) : (batchData[tCode]?.pb || 0));
  const currentDY = (livePrice?.dy && !isNaN(parseFloat(livePrice.dy)) ? parseFloat(livePrice.dy) : (batchData[tCode]?.dy || 0));
  const currentROE = batchData[tCode]?.roe || (stmts.length > 0 ? stmts[0].roe : 0);
  const currentEPS = batchData[tCode]?.eps || (currentPE > 0 && currentPrice > 0 ? currentPrice / currentPE : 0);
  const currentBVPS = stmts.length > 0 ? stmts[0].bvps : (currentPB > 0 && currentEPS > 0 ? currentEPS * currentPB : 0);

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
  } else if (currentPE > 0 && currentPrice > 0) {
    // Fallback：简化估值（引擎未跑完时），所有输出统一为「每股价值 ¥」
    const rf = 0.025, erp = 0.06, beta = 1, wacc = rf + beta * erp;
    const growth = currentROE > 20 ? 0.08 : currentROE > 15 ? 0.06 : currentROE > 10 ? 0.04 : 0.02;
    const tg = 0.025, yrs = 10;

    // DCF：用 EPS 做简化折现 → 输出每股价值
    let dcfValue = 0;
    for (let y = 1; y <= yrs; y++) dcfValue += currentEPS * Math.pow(1 + growth, y) / Math.pow(1 + wacc, y);
    dcfValue += (currentEPS * Math.pow(1 + growth, yrs) * (1 + tg)) / (wacc - tg) / Math.pow(1 + wacc, yrs);
    dcfValue = Math.max(0, dcfValue);
    dcfFair = { low: dcfValue * 0.9, mid: dcfValue, high: dcfValue * 1.1 };

    // PE 相对：合理 PE × EPS → 每股价值
    const fairPE = clamp(20 * clamp(0.5 + 5 * (currentROE / 100 - 0.10), 0.3, 2.0), 3, 60);
    const relValue = fairPE * currentEPS;
    relFairPE = { low: fairPE * 0.8, mid: fairPE, high: fairPE * 1.2 };

    // 综合：两个都是 ¥，安全加权
    const mid = (dcfValue + relValue) / 2;
    compositeFair = { low: mid * 0.8, mid, high: mid * 1.2 };
    compositeMargin = {
      low: ((compositeFair.low - currentPrice) / currentPrice) * 100,
      mid: ((mid - currentPrice) / currentPrice) * 100,
      high: ((compositeFair.high - currentPrice) / currentPrice) * 100,
    };
    verdictText = compositeMargin.mid > 10 ? '低估' : compositeMargin.mid > -10 ? '合理' : '高估';
  }

  const fairPrice = compositeFair.mid > 0 ? compositeFair.mid : 0;
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
            const latestStmt = stmts.length > 0 ? stmts[0] : undefined;
            const epsVal = batchData[tCode]?.eps || (currentPE > 0 && currentPrice > 0 ? currentPrice / currentPE : 0);
            const roaVal = batchData[tCode]?.roa || (latestStmt && latestStmt.totalAssets > 0 ? (latestStmt.netIncome / latestStmt.totalAssets) * 100 : 0);
            const psVal = batchData[tCode]?.ps || (latestStmt && batchData[tCode]?.mcap ? latestStmt.revenue / batchData[tCode].mcap : 0);
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

        {/* Detail Tabs */}
        <div className="flex gap-2 bg-slate-100 rounded-2xl p-1">
          <button
            onClick={() => setDetailTab('valuation')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              detailTab === 'valuation'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Calculator size={14} /> 估值分析
          </button>
          <button
            onClick={() => setDetailTab('financial')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              detailTab === 'financial'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <BarChart3 size={14} /> 财务数据
          </button>
        </div>

        {/* 估值分析 Tab */}
        {detailTab === 'valuation' && currentPE > 0 && (
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

            {/* ① DCF */}
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
              {dcfSensitivity.length > 0 && (
                <div className="text-[9px] text-slate-400">
                  <div className="font-medium mb-0.5">敏感性分析：</div>
                  <div className="grid gap-px bg-slate-200 rounded-lg overflow-hidden" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    <div className="bg-slate-100 px-1.5 py-1 text-center font-bold text-slate-500">增长率{'\\'}折现率</div>
                    {[...new Set(dcfSensitivity.map((s: any) => s.wacc))].sort((a: number, b: number) => a - b).map((w: number, i: number) => (
                      <div key={i} className="bg-slate-100 px-1.5 py-1 text-center font-bold text-slate-500">{(w * 100).toFixed(1)}%</div>
                    ))}
                    {[...new Set(dcfSensitivity.map((s: any) => s.growth))].sort((a: number, b: number) => a - b).map((g: number, i: number) => (
                      <React.Fragment key={i}>
                        <div className="bg-white px-1.5 py-1 text-center font-bold text-slate-600">{(g * 100).toFixed(1)}%</div>
                        {dcfSensitivity.filter((x: any) => Math.abs(x.growth - g) < 0.0001)
                          .sort((a: any, b: any) => a.wacc - b.wacc)
                          .map((x: any, j: number) => (
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

            {/* 护城河评分 */}
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

        {/* 财务数据 Tab */}
        {detailTab === 'financial' && (
          <FinancialStatementsView stmts={stmts} code={tCode} batchData={batchData} />
        )}

        {/* 概览卡片（始终显示） */}
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

export default CompanyDetailView;
