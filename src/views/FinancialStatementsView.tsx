import React, { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Shield, AlertTriangle } from 'lucide-react';
import { FinancialStatement } from '../valuation/types';
import { MarketData } from '../types/market';
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend } from 'recharts';

interface FinancialStatementsViewProps {
  stmts: FinancialStatement[];
  code: string;
  batchData: Record<string, MarketData>;
}

type TabKey = 'income' | 'balance' | 'cashflow' | 'derived' | 'analysis';

/** 格式化大数字（亿） */
const fmt = (v: number, d = 1): string => {
  if (!isFinite(v)) return '—';
  if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(d)}万亿`;
  if (Math.abs(v) >= 1) return `${v.toFixed(d)}亿`;
  if (Math.abs(v) >= 0.01) return `${(v * 100).toFixed(1)}百万`;
  return v.toFixed(d);
};

/** 增长率颜色 */
const growthColor = (v: number): string => v > 10 ? 'text-emerald-600' : v > 0 ? 'text-emerald-500' : v > -10 ? 'text-amber-500' : 'text-red-500';

/** 增长率箭头 */
const growthArrow = (v: number): string => v > 5 ? '↑' : v > 0 ? '↗' : v > -5 ? '↘' : '↓';

/** 趋势判断 */
const trendLabel = (values: number[]): { text: string; color: string } => {
  const valid = values.filter(v => isFinite(v) && v !== 0);
  if (valid.length < 2) return { text: '数据不足', color: 'text-slate-400' };
  const recent = valid.slice(0, 3);
  const older = valid.slice(-3);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  if (olderAvg === 0) return { text: '—', color: 'text-slate-400' };
  const change = ((recentAvg - olderAvg) / Math.abs(olderAvg)) * 100;
  if (change > 20) return { text: '持续增长', color: 'text-emerald-600' };
  if (change > 5) return { text: '温和增长', color: 'text-emerald-500' };
  if (change > -5) return { text: '基本持平', color: 'text-amber-500' };
  if (change > -20) return { text: '温和下滑', color: 'text-amber-600' };
  return { text: '持续下滑', color: 'text-red-500' };
};

/** 表格行组件 */
const Row: React.FC<{ label: string; values: (string | number | null)[]; bold?: boolean; colorFn?: (v: number) => string }> = ({ label, values, bold, colorFn }) => (
  <tr className={`border-b border-slate-50 ${bold ? 'bg-slate-50/50' : ''}`}>
    <td className={`py-1.5 pr-2 text-[10px] whitespace-nowrap ${bold ? 'font-bold text-slate-700' : 'text-slate-500'}`}>{label}</td>
    {values.map((v, i) => {
      const num = typeof v === 'number' ? v : NaN;
      const color = colorFn && !isNaN(num) ? colorFn(num) : 'text-slate-700';
      return (
        <td key={i} className={`py-1.5 px-1.5 text-right text-[10px] font-mono tabular-nums ${color} ${bold ? 'font-bold' : ''}`}>
          {v === null || v === undefined ? '—' : typeof v === 'number' ? (v > 0 ? fmt(v) : v === 0 ? '0' : `(${fmt(Math.abs(v))})`) : v}
        </td>
      );
    })}
  </tr>
);

/** 比率行 */
const RatioRow: React.FC<{ label: string; values: (number | null)[]; suffix?: string; thresholds?: number[]; invert?: boolean }> = ({ label, values, suffix = '%', thresholds, invert }) => (
  <tr className="border-b border-slate-50">
    <td className="py-1.5 pr-2 text-[10px] text-slate-500 whitespace-nowrap">{label}</td>
    {values.map((v, i) => {
      if (v === null || v === undefined || !isFinite(v)) return <td key={i} className="py-1.5 px-1.5 text-right text-[10px] text-slate-300">—</td>;
      let color = 'text-slate-700';
      if (thresholds) {
        const effective = invert ? -v : v;
        if (effective >= thresholds[0]) color = 'text-emerald-600 font-bold';
        else if (effective >= thresholds[1]) color = 'text-emerald-500';
        else if (effective >= thresholds[2]) color = 'text-amber-500';
        else color = 'text-red-500';
      }
      return <td key={i} className={`py-1.5 px-1.5 text-right text-[10px] font-mono tabular-nums ${color}`}>{v.toFixed(1)}{suffix}</td>;
    })}
  </tr>
);

const FinancialStatementsView: React.FC<FinancialStatementsViewProps> = ({ stmts, code, batchData }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('income');

  if (stmts.length === 0) {
    return (
      <div className="card-elevated p-8 text-center">
        <BarChart3 size={32} className="mx-auto text-slate-300 mb-3" />
        <div className="text-sm text-slate-500 font-medium">暂无财务数据</div>
        <div className="text-xs text-slate-400 mt-1">数据加载中或该股票暂无公开财报</div>
      </div>
    );
  }

  // 按时间正序排列（最新在右）
  const sorted = [...stmts].sort((a, b) => a.year.localeCompare(b.year));
  const years = sorted.map(s => s.year);

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'income', label: '利润表', icon: <DollarSign size={12} /> },
    { key: 'balance', label: '资产负债', icon: <Shield size={12} /> },
    { key: 'cashflow', label: '现金流', icon: <TrendingUp size={12} /> },
    { key: 'derived', label: '指标', icon: <BarChart3 size={12} /> },
    { key: 'analysis', label: '分析', icon: <AlertTriangle size={12} /> },
  ];

  // ─── 利润表 ───
  const renderIncome = () => (
    <div className="space-y-3">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-slate-200">
            <th className="py-2 pr-2 text-left text-[9px] text-slate-400 font-bold uppercase">项目</th>
            {years.map(y => <th key={y} className="py-2 px-1.5 text-right text-[9px] text-slate-400 font-bold">{y}</th>)}
          </tr>
        </thead>
        <tbody>
          <Row label="营业收入" values={sorted.map(s => s.revenue)} bold />
          <Row label="营业成本" values={sorted.map(s => s.costOfRevenue)} colorFn={v => v < 0 ? 'text-red-500' : 'text-slate-700'} />
          <Row label="毛利润" values={sorted.map(s => s.grossProfit)} />
          <RatioRow label="毛利率" values={sorted.map(s => s.grossMargin)} thresholds={[40, 25, 10]} />
          <Row label="归母净利润" values={sorted.map(s => s.netIncome)} bold colorFn={v => v < 0 ? 'text-red-500' : 'text-slate-700'} />
          <Row label="基本EPS" values={sorted.map(s => s.eps)} />
          <RatioRow label="净利率" values={sorted.map(s => s.netMargin)} thresholds={[20, 10, 5]} />
          <tr className="h-2" />
          <RatioRow label="营收同比增长" values={sorted.map(s => s.revenueGrowth)} thresholds={[15, 5, 0]} />
          <RatioRow label="利润同比增长" values={sorted.map(s => s.netIncomeGrowth)} thresholds={[15, 5, 0]} />
        </tbody>
      </table>
      {/* 趋势图 */}
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={sorted.map(s => ({ year: s.year, 营收: s.revenue, 净利润: s.netIncome, 毛利率: s.grossMargin }))}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="year" tick={{ fontSize: 9, fill: '#94a3b8' }} />
          <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#94a3b8' }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#94a3b8' }} />
          <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8, padding: '4px 8px' }} />
          <Bar yAxisId="left" dataKey="营收" fill="#c7d2fe" radius={[2, 2, 0, 0]} />
          <Bar yAxisId="left" dataKey="净利润" fill="#6366f1" radius={[2, 2, 0, 0]} />
          <Line yAxisId="right" dataKey="毛利率" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

  // ─── 资产负债表 ───
  const renderBalance = () => (
    <div className="space-y-3">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-slate-200">
            <th className="py-2 pr-2 text-left text-[9px] text-slate-400 font-bold uppercase">项目</th>
            {years.map(y => <th key={y} className="py-2 px-1.5 text-right text-[9px] text-slate-400 font-bold">{y}</th>)}
          </tr>
        </thead>
        <tbody>
          <Row label="总资产" values={sorted.map(s => s.totalAssets)} bold />
          <Row label="股东权益" values={sorted.map(s => s.totalEquity)} />
          <Row label="总负债" values={sorted.map(s => s.totalDebt)} />
          <Row label="每股净资产" values={sorted.map(s => s.bvps)} />
          <tr className="h-2" />
          <RatioRow label="资产负债率" values={sorted.map(s => s.debtRatio)} thresholds={[30, 50, 70]} invert />
          <RatioRow label="权益乘数" values={sorted.map(s => s.totalAssets > 0 && s.totalEquity > 0 ? s.totalAssets / s.totalEquity : null)} />
        </tbody>
      </table>
      <ResponsiveContainer width="100%" height={140}>
        <ComposedChart data={sorted.map(s => ({ year: s.year, 总资产: s.totalAssets, 净资产: s.totalEquity, 负债率: s.debtRatio }))}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="year" tick={{ fontSize: 9, fill: '#94a3b8' }} />
          <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#94a3b8' }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#94a3b8' }} domain={[0, 100]} />
          <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8, padding: '4px 8px' }} />
          <Bar yAxisId="left" dataKey="总资产" fill="#bfdbfe" radius={[2, 2, 0, 0]} />
          <Bar yAxisId="left" dataKey="净资产" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          <Line yAxisId="right" dataKey="负债率" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

  // ─── 现金流量表 ───
  const renderCashflow = () => (
    <div className="space-y-3">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-slate-200">
            <th className="py-2 pr-2 text-left text-[9px] text-slate-400 font-bold uppercase">项目</th>
            {years.map(y => <th key={y} className="py-2 px-1.5 text-right text-[9px] text-slate-400 font-bold">{y}</th>)}
          </tr>
        </thead>
        <tbody>
          <Row label="经营活动现金流" values={sorted.map(s => s.operatingCF)} bold colorFn={v => v < 0 ? 'text-red-500' : 'text-slate-700'} />
          <Row label="投资活动现金流" values={sorted.map(s => s.investingCF)} colorFn={v => v < 0 ? 'text-slate-700' : 'text-amber-500'} />
          <Row label="筹资活动现金流" values={sorted.map(s => s.financingCF)} colorFn={v => v < 0 ? 'text-slate-700' : 'text-amber-500'} />
          <Row label="资本支出" values={sorted.map(s => s.capex)} />
          <Row label="自由现金流" values={sorted.map(s => s.freeCF)} bold colorFn={v => v < 0 ? 'text-red-500' : 'text-emerald-600'} />
          <Row label="分红支出" values={sorted.map(s => s.dividendPaid)} />
          <tr className="h-2" />
          <RatioRow label="经营CF/净利润" values={sorted.map(s => s.netIncome > 0 ? (s.operatingCF / s.netIncome) * 100 : null)} thresholds={[100, 80, 50]} />
          <RatioRow label="分红比例" values={sorted.map(s => s.payoutRatio)} />
        </tbody>
      </table>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={sorted.map(s => ({
          year: s.year,
          经营CF: s.operatingCF,
          投资CF: s.investingCF,
          筹资CF: s.financingCF,
          自由CF: s.freeCF,
        }))}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="year" tick={{ fontSize: 9, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
          <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8, padding: '4px 8px' }} />
          <Bar dataKey="经营CF" fill="#10b981" radius={[2, 2, 0, 0]} />
          <Bar dataKey="投资CF" fill="#f59e0b" radius={[2, 2, 0, 0]} />
          <Bar dataKey="自由CF" fill="#6366f1" radius={[2, 2, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

  // ─── 综合指标 ───
  const renderDerived = () => (
    <div className="space-y-3">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-slate-200">
            <th className="py-2 pr-2 text-left text-[9px] text-slate-400 font-bold uppercase">指标</th>
            {years.map(y => <th key={y} className="py-2 px-1.5 text-right text-[9px] text-slate-400 font-bold">{y}</th>)}
          </tr>
        </thead>
        <tbody>
          <RatioRow label="ROE" values={sorted.map(s => s.roe)} thresholds={[20, 15, 10]} />
          <RatioRow label="ROA" values={sorted.map(s => s.roa)} thresholds={[10, 5, 2]} />
          <RatioRow label="毛利率" values={sorted.map(s => s.grossMargin)} thresholds={[40, 25, 10]} />
          <RatioRow label="净利率" values={sorted.map(s => s.netMargin)} thresholds={[20, 10, 5]} />
          <RatioRow label="资产负债率" values={sorted.map(s => s.debtRatio)} thresholds={[30, 50, 70]} invert />
          <RatioRow label="分红比例" values={sorted.map(s => s.payoutRatio)} />
          <Row label="EPS" values={sorted.map(s => s.eps)} />
          <Row label="BVPS" values={sorted.map(s => s.bvps)} />
        </tbody>
      </table>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={sorted.map(s => ({ year: s.year, ROE: s.roe, ROA: s.roa, 毛利率: s.grossMargin }))}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="year" tick={{ fontSize: 9, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
          <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8, padding: '4px 8px' }} />
          <Line type="monotone" dataKey="ROE" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="ROA" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="毛利率" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  // ─── 财务分析 ───
  const renderAnalysis = () => {
    const latest = sorted[sorted.length - 1]; // 最新年
    const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
    const analyses: { title: string; icon: React.ReactNode; items: { text: string; level: 'good' | 'warn' | 'bad' | 'info' }[] }[] = [];

    // 1. 盈利能力分析
    const profitItems: { text: string; level: 'good' | 'warn' | 'bad' | 'info' }[] = [];
    if (latest.roe >= 20) profitItems.push({ text: `ROE ${latest.roe.toFixed(1)}%，盈利能力优秀`, level: 'good' });
    else if (latest.roe >= 15) profitItems.push({ text: `ROE ${latest.roe.toFixed(1)}%，盈利能力良好`, level: 'good' });
    else if (latest.roe >= 10) profitItems.push({ text: `ROE ${latest.roe.toFixed(1)}%，盈利能力中等`, level: 'warn' });
    else if (latest.roe > 0) profitItems.push({ text: `ROE ${latest.roe.toFixed(1)}%，盈利能力偏弱`, level: 'bad' });
    else profitItems.push({ text: `ROE 为负，公司处于亏损状态`, level: 'bad' });

    if (latest.grossMargin >= 40) profitItems.push({ text: `毛利率 ${latest.grossMargin.toFixed(1)}%，产品/服务有较强定价权`, level: 'good' });
    else if (latest.grossMargin >= 20) profitItems.push({ text: `毛利率 ${latest.grossMargin.toFixed(1)}%，处于行业正常水平`, level: 'info' });
    else if (latest.grossMargin > 0) profitItems.push({ text: `毛利率 ${latest.grossMargin.toFixed(1)}%，利润率偏低，关注成本控制`, level: 'warn' });

    if (latest.netMargin >= 15) profitItems.push({ text: `净利率 ${latest.netMargin.toFixed(1)}%，费用管控优秀`, level: 'good' });
    else if (latest.netMargin >= 5) profitItems.push({ text: `净利率 ${latest.netMargin.toFixed(1)}%，费用管控一般`, level: 'info' });
    else if (latest.netMargin > 0) profitItems.push({ text: `净利率 ${latest.netMargin.toFixed(1)}%，注意费用占比`, level: 'warn' });
    else profitItems.push({ text: `净利率为负，收入无法覆盖全部成本费用`, level: 'bad' });

    // ROE 趋势
    const roeTrend = trendLabel(sorted.map(s => s.roe));
    if (sorted.length >= 3) {
      profitItems.push({ text: `ROE趋势: ${roeTrend.text}`, level: roeTrend.color.includes('emerald') ? 'good' : roeTrend.color.includes('amber') ? 'warn' : roeTrend.color.includes('red') ? 'bad' : 'info' });
    }

    analyses.push({ title: '盈利能力', icon: <TrendingUp size={14} />, items: profitItems });

    // 2. 成长性分析
    const growthItems: { text: string; level: 'good' | 'warn' | 'bad' | 'info' }[] = [];
    if (latest.revenueGrowth > 20) growthItems.push({ text: `营收同比增长 ${latest.revenueGrowth.toFixed(1)}%，高速增长`, level: 'good' });
    else if (latest.revenueGrowth > 5) growthItems.push({ text: `营收同比增长 ${latest.revenueGrowth.toFixed(1)}%，稳定增长`, level: 'good' });
    else if (latest.revenueGrowth > 0) growthItems.push({ text: `营收同比增长 ${latest.revenueGrowth.toFixed(1)}%，低速增长`, level: 'info' });
    else if (latest.revenueGrowth > -10) growthItems.push({ text: `营收同比下降 ${Math.abs(latest.revenueGrowth).toFixed(1)}%，短期承压`, level: 'warn' });
    else growthItems.push({ text: `营收同比下降 ${Math.abs(latest.revenueGrowth).toFixed(1)}%，需关注业务萎缩风险`, level: 'bad' });

    if (latest.netIncomeGrowth > 30) growthItems.push({ text: `利润同比增长 ${latest.netIncomeGrowth.toFixed(1)}%，盈利弹性大`, level: 'good' });
    else if (latest.netIncomeGrowth > 10) growthItems.push({ text: `利润同比增长 ${latest.netIncomeGrowth.toFixed(1)}%，利润增长健康`, level: 'good' });
    else if (latest.netIncomeGrowth > 0) growthItems.push({ text: `利润同比增长 ${latest.netIncomeGrowth.toFixed(1)}%`, level: 'info' });
    else if (latest.netIncomeGrowth > -20) growthItems.push({ text: `利润同比下降 ${Math.abs(latest.netIncomeGrowth).toFixed(1)}%`, level: 'warn' });
    else growthItems.push({ text: `利润大幅下滑 ${Math.abs(latest.netIncomeGrowth).toFixed(1)}%，可能面临周期性或结构性困境`, level: 'bad' });

    // CAGR（复合增长率）
    if (sorted.length >= 3) {
      const revCAGR = sorted[sorted.length - 1].revenue > 0 && sorted[0].revenue > 0
        ? (Math.pow(sorted[sorted.length - 1].revenue / sorted[0].revenue, 1 / (sorted.length - 1)) - 1) * 100 : null;
      const profCAGR = sorted[sorted.length - 1].netIncome > 0 && sorted[0].netIncome > 0
        ? (Math.pow(sorted[sorted.length - 1].netIncome / sorted[0].netIncome, 1 / (sorted.length - 1)) - 1) * 100 : null;
      if (revCAGR !== null && isFinite(revCAGR)) growthItems.push({ text: `${sorted.length}年营收 CAGR ${revCAGR.toFixed(1)}%`, level: revCAGR > 10 ? 'good' : revCAGR > 0 ? 'info' : 'warn' });
      if (profCAGR !== null && isFinite(profCAGR)) growthItems.push({ text: `${sorted.length}年利润 CAGR ${profCAGR.toFixed(1)}%`, level: profCAGR > 10 ? 'good' : profCAGR > 0 ? 'info' : 'warn' });
    }

    analyses.push({ title: '成长性', icon: <TrendingUp size={14} />, items: growthItems });

    // 3. 现金流质量
    const cfItems: { text: string; level: 'good' | 'warn' | 'bad' | 'info' }[] = [];
    if (latest.operatingCF > 0 && latest.netIncome > 0) {
      const ratio = latest.operatingCF / latest.netIncome;
      if (ratio >= 1) cfItems.push({ text: `经营CF/净利润 ${ratio.toFixed(0)}%，现金流质量优秀，利润含金量高`, level: 'good' });
      else if (ratio >= 0.7) cfItems.push({ text: `经营CF/净利润 ${ratio.toFixed(0)}%，现金流质量尚可`, level: 'info' });
      else cfItems.push({ text: `经营CF/净利润 ${ratio.toFixed(0)}%，利润含金量偏低，可能存在应收账款积压`, level: 'warn' });
    } else if (latest.operatingCF < 0) {
      cfItems.push({ text: '经营活动现金流为负，主营业务尚未产生正向现金流入', level: 'bad' });
    }

    if (latest.freeCF > 0) cfItems.push({ text: `自由现金流 ${fmt(latest.freeCF)}，公司有充裕的可分配资金`, level: 'good' });
    else if (latest.freeCF < 0) cfItems.push({ text: `自由现金流为负，资本支出较大，需关注投资回报`, level: 'warn' });

    // 现金流趋势
    if (sorted.length >= 3) {
      const cfTrend = trendLabel(sorted.map(s => s.operatingCF));
      cfItems.push({ text: `经营CF趋势: ${cfTrend.text}`, level: cfTrend.color.includes('emerald') ? 'good' : cfTrend.color.includes('amber') ? 'warn' : cfTrend.color.includes('red') ? 'bad' : 'info' });
    }

    analyses.push({ title: '现金流质量', icon: <DollarSign size={14} />, items: cfItems });

    // 4. 财务风险
    const riskItems: { text: string; level: 'good' | 'warn' | 'bad' | 'info' }[] = [];
    if (latest.debtRatio > 70) riskItems.push({ text: `资产负债率 ${latest.debtRatio.toFixed(1)}%，杠杆率高，财务风险较大`, level: 'bad' });
    else if (latest.debtRatio > 50) riskItems.push({ text: `资产负债率 ${latest.debtRatio.toFixed(1)}%，需关注偿债压力`, level: 'warn' });
    else if (latest.debtRatio > 0) riskItems.push({ text: `资产负债率 ${latest.debtRatio.toFixed(1)}%，财务结构健康`, level: 'good' });

    if (latest.totalEquity > 0 && prev && prev.totalEquity > 0) {
      const equityGrowth = ((latest.totalEquity - prev.totalEquity) / prev.totalEquity) * 100;
      if (equityGrowth < -5) riskItems.push({ text: `净资产同比减少 ${Math.abs(equityGrowth).toFixed(1)}%，可能因亏损或大额分红侵蚀`, level: 'warn' });
      else if (equityGrowth > 10) riskItems.push({ text: `净资产同比增长 ${equityGrowth.toFixed(1)}%，股东权益在增厚`, level: 'good' });
    }

    // 利息覆盖（近似）
    if (latest.operatingCF > 0 && latest.totalDebt > 0) {
      riskItems.push({ text: `以经营CF计，约需 ${latest.totalDebt > 0 ? (latest.totalDebt / Math.max(latest.operatingCF, 0.1)).toFixed(1) : '—'} 年偿还全部负债`, level: latest.totalDebt / latest.operatingCF < 3 ? 'good' : latest.totalDebt / latest.operatingCF < 6 ? 'info' : 'warn' });
    }

    analyses.push({ title: '财务风险', icon: <Shield size={14} />, items: riskItems });

    // 5. 分红回报
    const divItems: { text: string; level: 'good' | 'warn' | 'bad' | 'info' }[] = [];
    if (latest.payoutRatio > 50) divItems.push({ text: `分红比例 ${latest.payoutRatio.toFixed(1)}%，对股东回报慷慨`, level: 'good' });
    else if (latest.payoutRatio > 20) divItems.push({ text: `分红比例 ${latest.payoutRatio.toFixed(1)}%，分红适中`, level: 'info' });
    else if (latest.payoutRatio > 0) divItems.push({ text: `分红比例 ${latest.payoutRatio.toFixed(1)}%，留存较多用于再投资`, level: 'info' });

    const bd = batchData[code];
    if (bd?.dy && bd.dy > 3) divItems.push({ text: `当前股息率 ${bd.dy.toFixed(1)}%，具有较好的分红吸引力`, level: 'good' });
    else if (bd?.dy && bd.dy > 1) divItems.push({ text: `当前股息率 ${bd.dy.toFixed(1)}%`, level: 'info' });

    if (divItems.length > 0) analyses.push({ title: '分红回报', icon: <DollarSign size={14} />, items: divItems });

    const levelColors = { good: 'bg-emerald-50 border-emerald-200 text-emerald-700', warn: 'bg-amber-50 border-amber-200 text-amber-700', bad: 'bg-red-50 border-red-200 text-red-700', info: 'bg-slate-50 border-slate-200 text-slate-600' };
    const levelDots = { good: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-red-500', info: 'bg-slate-400' };

    return (
      <div className="space-y-4">
        <div className="text-[10px] text-slate-400 leading-relaxed">
          基于 {sorted.length} 期财报数据（{years[0]} ~ {years[years.length - 1]}）自动生成的财务分析摘要
        </div>
        {analyses.map((section, si) => (
          <div key={si} className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              {section.icon} {section.title}
            </div>
            {section.items.map((item, ii) => (
              <div key={ii} className={`flex items-start gap-2 px-3 py-2 rounded-xl border text-[11px] leading-relaxed ${levelColors[item.level]}`}>
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${levelDots[item.level]}`} />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="card-elevated p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
          <BarChart3 size={16} className="text-indigo-500" /> 财务数据
        </h3>
        <span className="text-[9px] text-slate-400">
          {years[0]} ~ {years[years.length - 1]} · {stmts.length}期
        </span>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
              activeTab === t.key
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-200'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* 内容 */}
      <div className="overflow-x-auto">
        {activeTab === 'income' && renderIncome()}
        {activeTab === 'balance' && renderBalance()}
        {activeTab === 'cashflow' && renderCashflow()}
        {activeTab === 'derived' && renderDerived()}
        {activeTab === 'analysis' && renderAnalysis()}
      </div>
    </div>
  );
};

export default FinancialStatementsView;
