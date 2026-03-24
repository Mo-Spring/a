/**
 * 估值引擎 v2
 *
 * 两个核心模型：
 *   ① DCF 现金流折现（含敏感性分析）
 *   ② PE 相对估值（行业 + 历史 + PEG 加权，含历史 PE 百分位）
 *
 * 辅助信号（不参与估值计算，只提供判断依据）：
 *   • 护城河评分（ROE 稳定性、毛利率、FCF 质量）
 *   • 清算底线（0.7 × BVPS）
 *   • 市场预期反推（当前价隐含的增长率）
 */

import type {
  StockInput, IndustryData, ValuationParams,
  ValuationResult, DCFResult, RelativeResult,
  ValuationRange, MoatSignal, RiskSignal, FinancialStatement,
} from './types';

// ─── 工具 ───

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function positiveOr(v: number, fallback: number): number {
  return typeof v === 'number' && isFinite(v) && v > 0 ? v : fallback;
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = avg(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

// ═══════════════════════════════════════
// Beta 估计（启发式，基于真实数据）
// ═══════════════════════════════════════

function estimateBeta(d: StockInput): number {
  let b = 1.0;

  // 利润波动（用真实报表数据）
  const stmts = d.statements;
  if (stmts.length >= 3) {
    const incomes = stmts.map(s => s.netIncome).filter(v => v > 0);
    if (incomes.length >= 2) {
      const cv = std(incomes) / avg(incomes);
      b += clamp((cv - 0.15) * 1.2, -0.25, 0.5);
    }
  } else {
    b += 0.15; // 数据不足，稍加风险
  }

  // 市值
  if (d.mcap > 0) {
    if (d.mcap < 50) b += 0.25;
    else if (d.mcap < 200) b += 0.15;
    else if (d.mcap > 3000) b -= 0.1;
  }

  // 杠杆
  if (d.totalDebt > 70) b += 0.15;
  else if (d.totalDebt > 50) b += 0.08;
  else if (d.totalDebt < 20) b -= 0.05;

  // PE 高 → 波动大
  if (d.pe > 50) b += 0.08;
  else if (d.pe > 0 && d.pe < 10) b -= 0.05;

  return clamp(b, 0.4, 2.5);
}

// ═══════════════════════════════════════
// 数据提取：从真实报表获取关键指标
// ═══════════════════════════════════════

/** 获取每股 FCF（优先真实数据） */
function getFCFPerShare(d: StockInput): number {
  const shares = getShares(d);
  if (shares <= 0) return 0;

  // 优先：最新年报的真实 FCF
  if (d.statements.length > 0) {
    const latest = d.statements[0];
    if (latest.freeCF > 0) return (latest.freeCF * 1e8) / shares;
  }

  // Fallback 1：输入中的 freeCF
  if (d.freeCF > 0) return (d.freeCF * 1e8) / shares;

  // Fallback 2：经营现金流 × 70%
  if (d.operatingCF > 0) return (d.operatingCF * 0.7 * 1e8) / shares;

  // Fallback 3：净利润
  if (d.netIncome > 0) return (d.netIncome * 1e8) / shares;

  // Fallback 4：EPS
  if (d.eps > 0) return d.eps;

  return 0;
}

function getShares(d: StockInput): number {
  if (d.shares && d.shares > 0) return d.shares;
  if (d.mcap > 0 && d.price > 0) return (d.mcap * 1e8) / d.price;
  if (d.eps > 0 && d.pe > 0 && d.mcap > 0) return (d.mcap * 1e8) / (d.eps * d.pe);
  if (d.eps > 0 && d.netIncome > 0) return (d.netIncome * 1e8) / d.eps;
  return 1e9;
}

function getFCFBasis(d: StockInput): 'fcf' | 'netIncome' | 'eps' {
  if (d.statements.length > 0 && d.statements[0].freeCF > 0) return 'fcf';
  if (d.freeCF > 0) return 'fcf';
  if (d.netIncome > 0) return 'netIncome';
  return 'eps';
}

// ═══════════════════════════════════════
// 增长率估计（基于真实历史数据）
// ═══════════════════════════════════════

function estimateGrowthRate(d: StockInput): number {
  const estimates: { value: number; weight: number }[] = [];

  // 1. 历史净利润 CAGR（用真实报表）
  const stmts = d.statements;
  if (stmts.length >= 2) {
    const incomes = stmts.map(s => s.netIncome).filter(v => v > 0);
    if (incomes.length >= 2) {
      const latest = incomes[0], oldest = incomes[incomes.length - 1];
      const years = incomes.length - 1;
      if (oldest > 0) {
        const cagr = Math.pow(latest / oldest, 1 / years) - 1;
        if (cagr > -0.5 && cagr < 1.5) estimates.push({ value: cagr, weight: 3.0 });
      }
    }

    // 营收 CAGR
    const revenues = stmts.map(s => s.revenue).filter(v => v > 0);
    if (revenues.length >= 2) {
      const latest = revenues[0], oldest = revenues[revenues.length - 1];
      const years = revenues.length - 1;
      if (oldest > 0) {
        const cagr = Math.pow(latest / oldest, 1 / years) - 1;
        if (cagr > -0.5 && cagr < 1.5) estimates.push({ value: cagr * 0.8, weight: 1.5 });
      }
    }
  }

  // 2. 最近一期增长率
  if (d.netIncomeGrowth !== 0) {
    const g = d.netIncomeGrowth / 100;
    if (g > -0.8 && g < 2) estimates.push({ value: g, weight: 1.5 });
  }
  if (d.revenueGrowth !== 0) {
    const g = d.revenueGrowth / 100;
    if (g > -0.8 && g < 2) estimates.push({ value: g * 0.8, weight: 1.0 });
  }

  // 3. ROE × 留存率（可持续增长率）
  if (d.roe > 0 && d.roe < 50) {
    const roe = d.roe / 100;
    const payout = d.dy > 3 ? 0.4 : d.dy > 1 ? 0.6 : 0.8;
    const sg = roe * payout;
    if (sg > 0 && sg < 0.5) estimates.push({ value: sg, weight: 2.0 });
  }

  // 加权平均
  let base = 0.05;
  if (estimates.length > 0) {
    const totalW = estimates.reduce((s, e) => s + e.weight, 0);
    base = estimates.reduce((s, e) => s + e.value * e.weight, 0) / totalW;
  } else {
    if (d.roe > 20) base = 0.08;
    else if (d.roe > 15) base = 0.06;
    else if (d.roe > 10) base = 0.04;
    else base = 0.02;
    if (d.mcap > 2000) base *= 0.7;
  }

  // ROE 约束：增长率不应超过 ROE × 留存率太多
  if (d.roe > 0 && d.roe < 50) {
    const maxGrowth = (d.roe / 100) * 0.8;
    base = Math.min(base, maxGrowth);
  }

  return clamp(base, 0.01, 0.35);
}

// ═══════════════════════════════════════
// 模型 ①：DCF 现金流折现（含敏感性分析）
// ═══════════════════════════════════════

function modelDCF(d: StockInput, p: ValuationParams['dcf']): DCFResult {
  const fcfPS = getFCFPerShare(d);
  const basis = getFCFBasis(d);
  const empty: DCFResult = {
    fairValue: { low: 0, mid: 0, high: 0 },
    impliedPE: { low: 0, mid: 0, high: 0 },
    wacc: 0, terminalValueRatio: 0, phases: [], projection: [], usedBasis: basis, confidence: 0,
  };

  if (fcfPS <= 0 || d.price <= 0) return empty;

  const rf = p.rf;
  const erp = p.erp;
  const beta = estimateBeta(d);
  const wacc = clamp(rf + beta * erp, 0.04, 0.25);
  const tg = p.terminalGrowth;
  const years = p.projectionYears;
  const baseGrowth = estimateGrowthRate(d);

  if (wacc <= tg) return empty;

  // 三阶段增长
  const s1Years = Math.min(5, Math.floor(years * 0.5));
  const s2Years = years - s1Years;
  const s2Growth = (baseGrowth + tg) / 2;
  const phases = [
    { years: s1Years, growth: baseGrowth },
    { years: s2Years, growth: s2Growth },
  ];

  // 单场景 DCF 计算
  function calcScenario(w: number): { value: number; tvRatio: number; proj: DCFResult['projection'] } {
    const proj: DCFResult['projection'] = [];
    let pvSum = 0, fcf = fcfPS;

    for (let y = 1; y <= years; y++) {
      const g = y <= s1Years ? baseGrowth : s2Growth;
      fcf *= (1 + g);
      const pv = fcf / Math.pow(1 + w, y);
      pvSum += pv;
      proj.push({ year: y, fcf, pv });
    }

    const tvFCF = fcf * (1 + tg);
    const tv = tvFCF / (w - tg);
    const pvTV = tv / Math.pow(1 + w, years);
    const total = pvSum + pvTV;
    return { value: total, tvRatio: pvTV / total, proj };
  }

  const bull = calcScenario(p.discountRates.bull);
  const base = calcScenario(p.discountRates.base);
  const bear = calcScenario(p.discountRates.bear);

  // 敏感性分析：增长率 × 折现率
  const sensitivity: Array<{ growth: number; wacc: number; value: number }> = [];
  for (const g of [baseGrowth * 0.5, baseGrowth * 0.75, baseGrowth, baseGrowth * 1.25, baseGrowth * 1.5]) {
    for (const w of [p.discountRates.bull, p.discountRates.base, p.discountRates.bear]) {
      // 临时用指定增长率重算
      let pvSum = 0, fcf = fcfPS;
      for (let y = 1; y <= years; y++) {
        const gy = y <= s1Years ? g : (g + tg) / 2;
        fcf *= (1 + gy);
        pvSum += fcf / Math.pow(1 + w, y);
      }
      const tvFCF = fcf * (1 + tg);
      const tv = tvFCF / (w - tg);
      pvSum += tv / Math.pow(1 + w, years);
      sensitivity.push({ growth: g, wacc: w, value: Math.max(0, pvSum) });
    }
  }

  const eps = positiveOr(d.eps, 0.01);
  const confidence = (() => {
    let c = 0.3;
    // 有真实 FCF 加分
    if (d.statements.length > 0 && d.statements[0].freeCF > 0) c += 0.25;
    else if (d.freeCF > 0) c += 0.15;
    if (d.statements.length >= 3) c += 0.2;
    if (d.pe > 0 && d.pe < 200) c += 0.1;
    if (d.eps > 0) c += 0.05;
    return clamp(c, 0, 1);
  })();

  return {
    fairValue: {
      low: Math.max(0, bear.value),
      mid: Math.max(0, base.value),
      high: Math.max(0, bull.value),
    },
    impliedPE: {
      low: Math.max(0, bear.value) / eps,
      mid: Math.max(0, base.value) / eps,
      high: Math.max(0, bull.value) / eps,
    },
    wacc,
    terminalValueRatio: base.tvRatio,
    phases,
    projection: base.proj,
    usedBasis: basis,
    confidence,
    sensitivity,
  };
}

// ═══════════════════════════════════════
// 模型 ②：PE 相对估值（含历史 PE 百分位）
// ═══════════════════════════════════════

function modelRelative(d: StockInput, ind: IndustryData, p: ValuationParams['pe']): RelativeResult {
  const roe = d.roe > 0 ? d.roe / 100 : 0;
  const growth = d.netIncomeGrowth > 0 ? d.netIncomeGrowth / 100 : 0;
  const indPE = positiveOr(ind.pe, 20);

  // ① 行业 PE × ROE 修正
  const roeAdj = roe > 0 ? clamp(0.3 + 1.7 * (roe / 0.30), 0.3, 2.5) : 0.5;
  const industryFairPE = indPE * roeAdj;

  // ② 历史 PE（用真实报表数据计算 ROE 历史均值）
  let histFairPE = indPE;
  const stmts = d.statements;
  if (stmts.length >= 3) {
    const histROEs = stmts.slice(0, Math.min(5, stmts.length)).map(s => s.roe).filter(v => v > 0);
    if (histROEs.length >= 2) {
      const avgROE = avg(histROEs);
      histFairPE = indPE * clamp(avgROE / 15, 0.3, 3.0);
    }
  } else if (roe > 0) {
    histFairPE = indPE * clamp(roe / 0.15, 0.3, 3.0);
  }
  histFairPE = clamp(histFairPE, 3, 150);

  // ③ PEG 修正
  let pegFairPE: number;
  let peg = 0;
  if (growth > 0.02) {
    peg = d.pe > 0 ? d.pe / (growth * 100) : 0;
    pegFairPE = growth * 100; // PEG=1
  } else if (roe > 0) {
    const payout = d.dy > 3 ? 0.4 : d.dy > 1 ? 0.6 : 0.8;
    const sg = roe * payout;
    pegFairPE = clamp(sg * 100, 3, 60);
    peg = d.pe > 0 && pegFairPE > 0 ? d.pe / pegFairPE : 0;
  } else {
    pegFairPE = indPE * 0.5;
  }

  // 动态权重
  const hasHistory = stmts.length >= 3;
  const hasGrowth = growth > 0.02;
  let wInd = p.industryWeight, wHist = p.historicalWeight, wGrow = p.growthWeight;
  if (!hasHistory) { wHist *= 0.5; wGrow += wHist * 0.5; }
  if (!hasGrowth) wGrow *= 0.3;
  const totalW = wInd + wHist + wGrow;
  if (totalW > 0) { wInd /= totalW; wHist /= totalW; wGrow /= totalW; }

  const fairPE = industryFairPE * wInd + histFairPE * wHist + pegFairPE * wGrow;
  const eps = positiveOr(d.eps, 0.01);
  const fairPrice = fairPE * eps;

  // 历史 PE 百分位（简化：用当前 PE / 行业 PE 的比值在历史 ROE 修正后的分布中估算）
  let historicalPEStats: RelativeResult['historicalPEStats'] = undefined;
  if (hasHistory) {
    // 如果有同行业 peers，计算当前 PE 在同行中的百分位
    if (ind.peers && ind.peers.length >= 3) {
      const peerPEs = ind.peers.map(p => p.pe).filter(v => v > 0 && v < 500).sort((a, b) => a - b);
      if (peerPEs.length >= 3 && d.pe > 0) {
        const below = peerPEs.filter(p => p < d.pe).length;
        const percentile = below / peerPEs.length;
        historicalPEStats = {
          min: peerPEs[0],
          max: peerPEs[peerPEs.length - 1],
          median: peerPEs[Math.floor(peerPEs.length / 2)],
          current: d.pe,
          percentile,
        };
      }
    }
  }

  const confidence = (() => {
    let c = 0.3;
    if (indPE > 0) c += 0.2;
    if (hasHistory) c += 0.2;
    if (hasGrowth) c += 0.15;
    if (d.eps > 0) c += 0.15;
    return clamp(c, 0, 1);
  })();

  return {
    fairPE: { low: fairPE * 0.8, mid: fairPE, high: fairPE * 1.2 },
    fairPrice: { low: fairPrice * 0.8, mid: fairPrice, high: fairPrice * 1.2 },
    industryFairPE, historicalFairPE: histFairPE, pegFairPE,
    peg, confidence,
    historicalPEStats,
  };
}

// ═══════════════════════════════════════
// 辅助信号
// ═══════════════════════════════════════

function computeMoatSignals(d: StockInput): MoatSignal[] {
  const signals: MoatSignal[] = [];
  const stmts = d.statements;

  // ① 盈利护城河：ROE 连续 3 年 > 15% + 毛利率稳定
  if (stmts.length >= 3) {
    const recentROEs = stmts.slice(0, 3).map(s => s.roe);
    const allAbove15 = recentROEs.every(r => r > 15);
    const roeStd = std(recentROEs);
    const stable = roeStd < 5; // 标准差 < 5%
    const avgROE = avg(recentROEs);

    let score = 0;
    if (avgROE > 25) score += 40;
    else if (avgROE > 20) score += 30;
    else if (avgROE > 15) score += 20;
    else score += Math.max(0, avgROE * 0.8);

    if (stable) score += 30;
    if (allAbove15) score += 30;

    const grossMargins = stmts.slice(0, 3).map(s => s.grossMargin).filter(v => v > 0);
    if (grossMargins.length >= 2) {
      const gmStd = std(grossMargins);
      if (gmStd < 3) score = Math.min(100, score + 10);
    }

    signals.push({
      label: '盈利护城河',
      score: Math.round(score),
      level: score >= 70 ? 'strong' : score >= 50 ? 'good' : score >= 30 ? 'average' : 'weak',
      detail: `近3年 ROE ${recentROEs.map(r => r.toFixed(1) + '%').join(' / ')}，${stable ? '波动小' : '波动大'}`,
    });
  }

  // ② 现金流质量：经营CF > 净利润 的比例
  if (stmts.length >= 2) {
    const ratios = stmts.slice(0, Math.min(5, stmts.length))
      .filter(s => s.netIncome > 0)
      .map(s => s.operatingCF / s.netIncome);

    if (ratios.length >= 2) {
      const avgRatio = avg(ratios);
      const score = Math.round(clamp(avgRatio * 60, 0, 100));
      signals.push({
        label: '现金流质量',
        score,
        level: score >= 70 ? 'strong' : score >= 50 ? 'good' : score >= 30 ? 'average' : 'weak',
        detail: `经营现金流/净利润 均值 ${avgRatio.toFixed(2)}，${avgRatio > 1 ? '利润含金量高' : '利润含金量一般'}`,
      });
    }
  }

  // ③ 增长质量：营收 + 利润双增长
  if (stmts.length >= 2) {
    const recent = stmts.slice(0, Math.min(3, stmts.length));
    const revGrowthAll = recent.every(s => s.revenueGrowth > 0);
    const niGrowthAll = recent.every(s => s.netIncomeGrowth > 0);
    const avgRevGrowth = avg(recent.map(s => s.revenueGrowth));
    const avgNIGrowth = avg(recent.map(s => s.netIncomeGrowth));

    let score = 50;
    if (revGrowthAll) score += 20;
    if (niGrowthAll) score += 20;
    if (avgNIGrowth > avgRevGrowth) score += 10; // 利润增速 > 营收增速 = 提效

    signals.push({
      label: '增长质量',
      score: Math.round(clamp(score, 0, 100)),
      level: score >= 70 ? 'strong' : score >= 50 ? 'good' : score >= 30 ? 'average' : 'weak',
      detail: `近${recent.length}年 营收增长 ${avgRevGrowth.toFixed(1)}% / 净利润增长 ${avgNIGrowth.toFixed(1)}%`,
    });
  }

  // ④ 负债安全
  if (d.totalDebt > 0) {
    const score = Math.round(clamp(100 - d.totalDebt * 1.2, 0, 100));
    signals.push({
      label: '负债安全',
      score,
      level: d.totalDebt < 30 ? 'strong' : d.totalDebt < 50 ? 'good' : d.totalDebt < 70 ? 'average' : 'weak',
      detail: `资产负债率 ${d.totalDebt.toFixed(1)}%`,
    });
  }

  return signals;
}

/** 清算底线 */
function computeLiquidationPrice(d: StockInput): number {
  if (d.bvps > 0) return d.bvps * 0.7;
  if (d.statements.length > 0 && d.statements[0].bvps > 0) return d.statements[0].bvps * 0.7;
  return 0;
}

/** 市场预期反推：二分法 */
function computeImpliedGrowth(d: StockInput, p: ValuationParams['dcf']): number | null {
  if (d.price <= 0) return null;

  const rf = p.rf;
  const erp = p.erp;
  const beta = estimateBeta(d);
  const wacc = clamp(rf + beta * erp, 0.04, 0.25);
  const tg = p.terminalGrowth;
  const years = p.projectionYears;

  if (wacc <= tg) return null;

  const fcfPS = getFCFPerShare(d);
  if (fcfPS <= 0) return null;

  let lo = -0.30, hi = 0.50;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    let pvSum = 0, fcf = fcfPS;
    for (let y = 1; y <= years; y++) {
      fcf *= (1 + mid);
      pvSum += fcf / Math.pow(1 + wacc, y);
    }
    const tv = (fcf * (1 + tg)) / (wacc - tg);
    pvSum += tv / Math.pow(1 + wacc, years);
    if (pvSum < d.price) lo = mid;
    else hi = mid;
  }

  const result = (lo + hi) / 2;
  return Math.abs(result) < 0.6 ? result : null;
}

/** 风险信号 */
function generateRiskSignals(d: StockInput, dcf: DCFResult): RiskSignal[] {
  const signals: RiskSignal[] = [];

  if (d.totalDebt > 70) signals.push({ level: 'danger', message: `资产负债率 ${d.totalDebt.toFixed(1)}% 过高` });
  else if (d.totalDebt > 50) signals.push({ level: 'warning', message: `资产负债率 ${d.totalDebt.toFixed(1)}% 偏高` });

  if (d.pe > 80) signals.push({ level: 'warning', message: `PE ${d.pe.toFixed(1)} 显著偏高` });
  if (d.pe <= 0) signals.push({ level: 'danger', message: '公司当前亏损' });

  if (d.netIncomeGrowth < -30) signals.push({ level: 'danger', message: `净利润同比 ${d.netIncomeGrowth.toFixed(1)}%，大幅下滑` });

  if (dcf.terminalValueRatio > 0.75) signals.push({ level: 'info', message: `终值占比 ${(dcf.terminalValueRatio * 100).toFixed(0)}%，估值高度依赖远期假设` });

  if (d.freeCF <= 0 && d.netIncome > 0) {
    const stmts = d.statements;
    const hasRealFCF = stmts.length > 0 && stmts.some(s => s.freeCF > 0);
    if (!hasRealFCF) {
      signals.push({ level: 'info', message: '自由现金流数据缺失，DCF 基于净利润估算' });
    }
  }

  if (d.dy > 6) signals.push({ level: 'info', message: `股息率 ${d.dy.toFixed(1)}%，需确认是否可持续` });

  // 连续利润下滑
  const stmts = d.statements;
  if (stmts.length >= 3) {
    const recent = stmts.slice(0, 3);
    const allDeclining = recent.every(s => s.netIncomeGrowth < 0);
    if (allDeclining) signals.push({ level: 'danger', message: '连续3期净利润同比下滑' });
  }

  return signals;
}

// ═══════════════════════════════════════
// 综合估值入口
// ═══════════════════════════════════════

export function calculateValuation(
  data: StockInput,
  industry: IndustryData,
  params: ValuationParams,
): ValuationResult {
  const dcf = modelDCF(data, params.dcf);
  const relative = modelRelative(data, industry, params.pe);

  // 动态权重
  const growth = estimateGrowthRate(data);
  let wDCF = 0.50, wRel = 0.50;
  if (data.statements.length > 0 && data.statements[0].freeCF > 0) wDCF += 0.10;
  if (growth > 0.15) wDCF += 0.10;
  if (growth < 0.05 && data.pe > 0 && data.pe < 30) wRel += 0.10;
  if (data.statements.length >= 3) wRel += 0.05;
  const wTotal = wDCF + wRel;
  wDCF /= wTotal;
  wRel /= wTotal;

  // 综合估值
  const compositeMid = dcf.fairValue.mid * wDCF + relative.fairPrice.mid * wRel;
  const compositeLow = dcf.fairValue.low * wDCF + relative.fairPrice.low * wRel;
  const compositeHigh = dcf.fairValue.high * wDCF + relative.fairPrice.high * wRel;

  // 安全边际
  const p = data.price;
  const marginLow = p > 0 ? ((compositeLow - p) / p) * 100 : 0;
  const marginMid = p > 0 ? ((compositeMid - p) / p) * 100 : 0;
  const marginHigh = p > 0 ? ((compositeHigh - p) / p) * 100 : 0;

  // 判定
  let verdict: ValuationResult['verdict'];
  let verdictText: string;
  if (marginMid > 30) { verdict = 'deeply_undervalued'; verdictText = '严重低估'; }
  else if (marginMid > 10) { verdict = 'undervalued'; verdictText = '低估'; }
  else if (marginMid > -10) { verdict = 'fair'; verdictText = '合理'; }
  else if (marginMid > -30) { verdict = 'overvalued'; verdictText = '高估'; }
  else { verdict = 'deeply_overvalued'; verdictText = '严重高估'; }

  // 辅助信号
  const moatSignals = computeMoatSignals(data);
  const riskSignals = generateRiskSignals(data, dcf);
  const liquidationPrice = computeLiquidationPrice(data);
  const impliedGrowth = computeImpliedGrowth(data, params.dcf);

  // 综合置信度
  const confidence = clamp(
    dcf.confidence * 0.55 + relative.confidence * 0.45,
    0, 1,
  );

  return {
    dcf, relative,
    compositeFairValue: { low: Math.max(0, compositeLow), mid: Math.max(0, compositeMid), high: Math.max(0, compositeHigh) },
    currentPrice: p,
    marginOfSafety: { low: marginLow, mid: marginMid, high: marginHigh },
    verdict, verdictText,
    moatSignals, riskSignals,
    liquidationPrice, impliedGrowth,
    modelWeights: { dcf: wDCF, relative: wRel },
    confidence,
  };
}
