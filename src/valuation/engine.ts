/**
 * 五维估值引擎
 *
 * 1. DCF 三阶段现金流折现
 * 2. 相对估值 (PE + PEG)
 * 3. ROIC 质量模型
 * 4. 资产估值 (PB / 清算)
 * 5. 市场预期反推
 *
 * 全部使用连续函数，不同公司输入 → 不同输出
 */

import type {
  StockInput, IndustryData, ValuationParams,
  ValuationResult, DCFResult, RelativeResult, ROICResult,
  AssetResult, ReverseDCFResult, ValuationRange, ModelWeights, RiskSignal,
} from './types';

// ─── 工具 ───

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function safe(v: number, fallback = 0): number {
  return typeof v === 'number' && isFinite(v) ? v : fallback;
}

function positiveOr(v: number, fallback: number): number {
  return typeof v === 'number' && isFinite(v) && v > 0 ? v : fallback;
}

/** 根据置信度收缩估值区间 */
function confidenceRange(low: number, mid: number, high: number, conf: number): ValuationRange {
  const c = clamp(conf, 0, 1);
  return {
    low: Math.max(0, mid - (mid - low) * c),
    mid: Math.max(0, mid),
    high: Math.max(0, mid + (high - mid) * c),
  };
}

// ─── 数据层 ───

function getWACC(d: StockInput, p: ValuationParams['dcf']): number {
  const rf = p.rf;
  const erp = p.erp;
  const beta = estimateBeta(d);
  return clamp(rf + beta * erp, 0.04, 0.25);
}

function estimateBeta(d: StockInput): number {
  let b = 1.0;

  // 净利润波动
  if (d.history && d.history.netIncomes.length >= 3) {
    const arr = d.history.netIncomes.filter(v => v > 0);
    if (arr.length >= 2) {
      const mean = arr.reduce((a, v) => a + v, 0) / arr.length;
      const std = Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
      const cv = mean > 0 ? std / mean : 0;
      b += clamp((cv - 0.15) * 1.2, -0.25, 0.5);
    }
  } else {
    b += 0.15;
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

  // PE 高→波动大
  if (d.pe > 50) b += 0.08;
  else if (d.pe > 0 && d.pe < 10) b -= 0.05;

  return clamp(b, 0.4, 2.5);
}

function getShares(d: StockInput): number {
  if (d.shares && d.shares > 0) return d.shares;
  if (d.mcap > 0 && d.price > 0) return (d.mcap * 1e8) / d.price;
  if (d.eps > 0 && d.pe > 0 && d.mcap > 0) return (d.mcap * 1e8) / (d.eps * d.pe);
  if (d.eps > 0 && d.netIncome > 0) return (d.netIncome * 1e8) / d.eps;
  return 1e9; // fallback
}

/** 估算 FCF，返回每股 */
function getFCFPerShare(d: StockInput): number {
  const shares = getShares(d);
  if (shares <= 0) return 0;

  // 优先：真实 FCF
  if (d.freeCF > 0) return (d.freeCF * 1e8) / shares;

  // Fallback 1：经营现金流 × 70% (粗估 CapEx)
  if (d.operatingCF > 0) return (d.operatingCF * 0.7 * 1e8) / shares;

  // Fallback 2：净利润
  if (d.netIncome > 0) return (d.netIncome * 1e8) / shares;

  // Fallback 3：EPS
  if (d.eps > 0) return d.eps;

  return 0;
}

function getFCFBasis(d: StockInput): 'fcf' | 'netIncome' | 'eps' {
  if (d.freeCF > 0) return 'fcf';
  if (d.netIncome > 0) return 'netIncome';
  return 'eps';
}

/** 多维度加权估算增长率 */
function estimateGrowthRate(d: StockInput): number {
  const estimates: { value: number; weight: number }[] = [];

  // 1. 历史净利润 CAGR（最高权重）
  if (d.history && d.history.netIncomes.length >= 2) {
    const inc = d.history.netIncomes;
    const latest = inc[0], oldest = inc[inc.length - 1];
    if (oldest > 0 && latest > 0) {
      const cagr = Math.pow(latest / oldest, 1 / (inc.length - 1)) - 1;
      if (cagr > -0.5 && cagr < 1.5) estimates.push({ value: cagr, weight: 3.0 });
    }
  }

  // 2. 最近净利润增长
  if (d.netIncomeGrowth !== 0) {
    const g = d.netIncomeGrowth / 100;
    if (g > -0.8 && g < 2) estimates.push({ value: g, weight: 1.5 });
  }

  // 3. 营收增长（打折 80% 作为利润增长近似）
  if (d.revenueGrowth !== 0) {
    const g = d.revenueGrowth / 100;
    if (g > -0.8 && g < 2) estimates.push({ value: g * 0.8, weight: 1.0 });
  }

  // 4. ROE × 留存率（可持续增长率）
  if (d.roe > 0 && d.roe < 50) {
    const roe = d.roe / 100;
    const payout = d.dy > 3 ? 0.4 : d.dy > 1 ? 0.6 : 0.8;
    const sg = roe * payout;
    if (sg > 0 && sg < 0.5) estimates.push({ value: sg, weight: 2.0 });
  }

  let base = 0.05;
  if (estimates.length > 0) {
    const totalW = estimates.reduce((s, e) => s + e.weight, 0);
    base = estimates.reduce((s, e) => s + e.value * e.weight, 0) / totalW;
  } else {
    // 无数据 fallback：根据特征差异化
    if (d.roe > 20) base = 0.08;
    else if (d.roe > 15) base = 0.06;
    else if (d.roe > 10) base = 0.04;
    else base = 0.02;
    if (d.mcap > 2000) base *= 0.7;
    else if (d.mcap < 50) base *= 1.3;
  }

  // ROE 约束
  if (d.roe > 0 && d.roe < 50) base = Math.min(base, (d.roe / 100) * 0.8);

  return clamp(base, 0.01, 0.35);
}

/** ROIC = NOPAT / 投入资本 */
function calcROIC(d: StockInput): number {
  const nopat = d.netIncome; // 简化：用净利润代替 NOPAT
  if (nopat <= 0) return 0;

  // 投入资本 = 总资产 - 现金 - 无息流动负债
  // 简化：用净资产（PB × BVPS × 股数 / 1e8）或市值/PE 推算
  let investedCapital = 0;
  if (d.bvps > 0 && d.mcap > 0 && d.pb > 0) {
    // 总股本 × 每股净资产
    const shares = getShares(d);
    investedCapital = (d.bvps * shares) / 1e8; // 亿
  }
  if (investedCapital <= 0 && d.netIncome > 0 && d.roe > 0) {
    investedCapital = d.netIncome / (d.roe / 100); // 从 ROE 反推
  }
  if (investedCapital <= 0) return 0;

  return (nopat / investedCapital) * 100; // %
}

// ═══════════════════════════════════════
// 模型 1：DCF 三阶段现金流折现
// ═══════════════════════════════════════

function modelDCF(d: StockInput, p: ValuationParams['dcf']): DCFResult {
  const fcfPS = getFCFPerShare(d);
  const basis = getFCFBasis(d);

  // 完全无法估值
  if (fcfPS <= 0 || d.price <= 0) {
    return {
      fairValue: { low: 0, mid: 0, high: 0 },
      impliedPE: { low: 0, mid: 0, high: 0 },
      terminalValueRatio: 0, wacc: 0, phases: [], projection: [], usedBasis: basis, confidence: 0,
    };
  }

  const wacc = getWACC(d, p);
  const tg = p.terminalGrowth;
  const years = p.projectionYears;
  const baseGrowth = estimateGrowthRate(d);

  if (wacc <= tg) {
    // 无法收敛
    return {
      fairValue: { low: 0, mid: 0, high: 0 },
      impliedPE: { low: 0, mid: 0, high: 0 },
      terminalValueRatio: 0, wacc, phases: [], projection: [], usedBasis: basis, confidence: 0,
    };
  }

  // 三阶段
  const s1Years = Math.min(5, Math.floor(years * 0.5));
  const s2Years = years - s1Years;
  const s2Growth = (baseGrowth + tg) / 2;
  const phases = [
    { years: s1Years, growth: baseGrowth },
    { years: s2Years, growth: s2Growth },
  ];

  // 计算三种情景
  const scenarios = p.discountRates;

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

  const bull = calcScenario(scenarios.bull);
  const base = calcScenario(scenarios.base);
  const bear = calcScenario(scenarios.bear);

  // 用 base 场景的 projection
  const eps = positiveOr(d.eps, 0.01);

  const confidence = (() => {
    let c = 0.5;
    if (d.freeCF > 0) c += 0.2;
    if (d.history && d.history.years.length >= 3) c += 0.15;
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
    terminalValueRatio: base.tvRatio,
    wacc,
    phases,
    projection: base.proj,
    usedBasis: basis,
    confidence,
  };
}

// ═══════════════════════════════════════
// 模型 2：相对估值 (PE + PEG)
// ═══════════════════════════════════════

function modelRelative(d: StockInput, ind: IndustryData, p: ValuationParams['pe']): RelativeResult {
  const roe = d.roe > 0 ? d.roe / 100 : 0;
  const growth = d.netIncomeGrowth > 0 ? d.netIncomeGrowth / 100 : 0;
  const indPE = positiveOr(ind.pe, 20);

  // ① 行业 PE × ROE 修正
  const roeAdj = roe > 0 ? clamp(0.3 + 1.7 * (roe / 0.30), 0.3, 2.5) : 0.5;
  const industryFairPE = indPE * roeAdj;

  // ② 历史 PE（用行业 PE × 历史 ROE 修正，避免循环论证）
  let histFairPE = indPE;
  if (d.history && d.history.roes.length >= 3) {
    const avgROE = d.history.roes.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, d.history.roes.length);
    if (avgROE > 0) histFairPE = indPE * clamp(avgROE / 15, 0.3, 3.0);
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
  const hasHistory = d.history && d.history.years.length >= 3;
  const hasGrowth = growth > 0.02;
  let wInd = p.industryWeight, wHist = p.historicalWeight, wGrow = p.growthWeight;
  if (!hasHistory) { wHist *= 0.5; wGrow += wHist * 0.5; }
  if (!hasGrowth) wGrow *= 0.3;
  const totalW = wInd + wHist + wGrow;
  if (totalW > 0) { wInd /= totalW; wHist /= totalW; wGrow /= totalW; }

  const fairPE = industryFairPE * wInd + histFairPE * wHist + pegFairPE * wGrow;
  const eps = positiveOr(d.eps, 0.01);
  const fairPrice = fairPE * eps;

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
  };
}

// ═══════════════════════════════════════
// 模型 3：ROIC 质量模型
// ═══════════════════════════════════════

function modelROIC(d: StockInput, wacc: number): ROICResult {
  const roic = calcROIC(d);

  if (roic <= 0 || wacc <= 0) {
    return {
      roic, wacc: wacc * 100, spread: 0, createsValue: false,
      valuationMultiplier: 0.7, quality: 'poor', confidence: 0.2,
    };
  }

  const waccPct = wacc * 100;
  const spread = roic - waccPct;
  const createsValue = spread > 0;

  // 估值调整系数：连续函数
  // spread > 10% → 1.3, spread = 0 → 1.0, spread < -10% → 0.7
  const multiplier = clamp(1.0 + spread / 20, 0.5, 1.5);

  let quality: ROICResult['quality'];
  if (spread > 10) quality = 'excellent';
  else if (spread > 3) quality = 'good';
  else if (spread > -3) quality = 'average';
  else quality = 'poor';

  const confidence = (d.roe > 0 && d.bvps > 0) ? 0.8 : (d.roe > 0 ? 0.5 : 0.2);

  return { roic, wacc: waccPct, spread, createsValue, valuationMultiplier: multiplier, quality, confidence };
}

// ═══════════════════════════════════════
// 模型 4：资产估值 (PB / 清算)
// ═══════════════════════════════════════

function modelAsset(d: StockInput, ind: IndustryData): AssetResult {
  const bvps = positiveOr(d.bvps, 0);
  const indPB = positiveOr(ind.pb, 1.5);

  if (bvps <= 0) {
    return { fairPB: 0, fairPrice: 0, liquidationPrice: 0, currentPB: 0, discount: 0, confidence: 0 };
  }

  const currentPB = d.pb > 0 ? d.pb : (bvps > 0 ? d.price / bvps : 0);

  // 合理 PB：基于 ROE 修正
  let fairPB = indPB;
  if (d.roe > 0) {
    // 高 ROE → 合理 PB 高，低 ROE → 合理 PB 低
    fairPB = indPB * clamp(d.roe / 15, 0.3, 3.0);
  }
  fairPB = clamp(fairPB, 0.3, 10);

  const fairPrice = fairPB * bvps;
  const liquidationPrice = bvps * 0.7; // 清算打 7 折
  const discount = currentPB > 0 ? ((currentPB - fairPB) / fairPB) * 100 : 0;

  const confidence = (bvps > 0 && d.roe > 0 && ind.pb > 0) ? 0.9 : (bvps > 0 ? 0.5 : 0);

  return { fairPB, fairPrice, liquidationPrice, currentPB, discount, confidence };
}

// ═══════════════════════════════════════
// 模型 5：市场预期反推
// ═══════════════════════════════════════

function modelReverse(d: StockInput, p: ValuationParams['dcf'], userGrowth?: number): ReverseDCFResult {
  if (d.price <= 0) {
    return { impliedGrowthRates: { fcf: null, eps: null }, consensusGrowth: null, userGrowth: userGrowth ?? null, gap: null, isOverpriced: null, confidence: 0 };
  }

  const wacc = getWACC(d, p);
  const tg = p.terminalGrowth;
  const years = p.projectionYears;

  if (wacc <= tg) {
    return { impliedGrowthRates: { fcf: null, eps: null }, consensusGrowth: null, userGrowth: userGrowth ?? null, gap: null, isOverpriced: null, confidence: 0 };
  }

  function bisection(fcfPS: number): number | null {
    if (fcfPS <= 0) return null;

    let lo = -0.30, hi = 0.50;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      // 简化 DCF：单一增长率
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

  const fcfImplied = bisection(getFCFPerShare(d));
  const epsImplied = bisection(positiveOr(d.eps, 0));

  let consensus: number | null = null;
  if (fcfImplied !== null && epsImplied !== null) {
    consensus = (fcfImplied * 0.6 + epsImplied * 0.4);
  } else {
    consensus = fcfImplied ?? epsImplied;
  }

  let gap: number | null = null;
  let isOverpriced: boolean | null = null;
  if (userGrowth !== undefined && consensus !== null) {
    gap = userGrowth - consensus;
    isOverpriced = gap < 0;
  }

  const confidence = consensus !== null ? 0.7 : 0;

  return { impliedGrowthRates: { fcf: fcfImplied, eps: epsImplied }, consensusGrowth: consensus, userGrowth: userGrowth ?? null, gap, isOverpriced, confidence };
}

// ═══════════════════════════════════════
// 动态权重系统
// ═══════════════════════════════════════

function computeWeights(d: StockInput, roic: ROICResult): ModelWeights {
  let wDCF = 0.30, wRel = 0.30, wROIC = 0.20, wAsset = 0.20;

  // ① 高成长 → DCF 权重高
  const growth = estimateGrowthRate(d);
  if (growth > 0.15) wDCF += 0.15;
  else if (growth > 0.08) wDCF += 0.08;

  // ② 成熟低增长 → PE 权重高
  if (growth < 0.05 && d.pe > 0 && d.pe < 30) wRel += 0.12;

  // ③ 高分红 → 资产/Gordon 更有意义（这里用资产模型代表）
  if (d.dy > 4) wAsset += 0.10;

  // ④ ROIC 差 → 整体估值打折，ROIC 模型权重高
  if (!roic.createsValue) wROIC += 0.10;

  // ⑤ FCF 质量好 → DCF 权重高
  if (d.freeCF > 0) wDCF += 0.08;

  // ⑥ 有行业数据 → 相对估值权重高
  if (d.history && d.history.years.length >= 3) wRel += 0.05;

  // ⑦ 重资产公司 → 资产估值权重高
  if (d.pb > 0 && d.pb < 1.5 && d.bvps > 0) wAsset += 0.10;

  // ⑧ 数据缺失 → 降权
  if (d.freeCF <= 0 && d.netIncome <= 0) wDCF -= 0.10;
  if (!d.history) wRel -= 0.05;

  // 归一化
  const total = Math.max(wDCF + wRel + wROIC + wAsset, 0.01);
  return {
    dcf: clamp(wDCF / total, 0.05, 0.60),
    relative: clamp(wRel / total, 0.05, 0.60),
    roic: clamp(wROIC / total, 0.05, 0.50),
    asset: clamp(wAsset / total, 0.05, 0.50),
  };
}

// ═══════════════════════════════════════
// 风险信号
// ═══════════════════════════════════════

function generateRiskSignals(d: StockInput, roic: ROICResult, dcf: DCFResult): RiskSignal[] {
  const signals: RiskSignal[] = [];

  if (d.totalDebt > 70) signals.push({ level: 'danger', message: `资产负债率 ${d.totalDebt.toFixed(1)}% 过高` });
  else if (d.totalDebt > 50) signals.push({ level: 'warning', message: `资产负债率 ${d.totalDebt.toFixed(1)}% 偏高` });

  if (d.pe > 80) signals.push({ level: 'warning', message: `PE ${d.pe.toFixed(1)} 显著偏高` });
  if (d.pe <= 0) signals.push({ level: 'danger', message: '公司当前亏损' });

  if (!roic.createsValue && roic.roic > 0) signals.push({ level: 'warning', message: `ROIC ${roic.roic.toFixed(1)}% < WACC ${roic.wacc.toFixed(1)}%，未创造经济价值` });

  if (d.netIncomeGrowth < -30) signals.push({ level: 'danger', message: `净利润同比 ${d.netIncomeGrowth.toFixed(1)}%，大幅下滑` });

  if (dcf.terminalValueRatio > 0.75) signals.push({ level: 'info', message: `终值占比 ${(dcf.terminalValueRatio * 100).toFixed(0)}%，估值高度依赖远期假设` });

  if (d.freeCF <= 0 && d.netIncome > 0) signals.push({ level: 'info', message: '自由现金流为负或缺失，DCF 基于净利润估算' });

  if (d.dy > 6) signals.push({ level: 'info', message: `股息率 ${d.dy.toFixed(1)}%，需确认是否可持续` });

  if (d.roe > 30) signals.push({ level: 'info', message: `ROE ${d.roe.toFixed(1)}% 异常高，需关注是否可持续` });

  return signals;
}

// ═══════════════════════════════════════
// 综合估值
// ═══════════════════════════════════════

export function calculateValuation(
  data: StockInput,
  industry: IndustryData,
  params: ValuationParams,
  userGrowth?: number,
): ValuationResult {
  const dcf = modelDCF(data, params.dcf);
  const relative = modelRelative(data, industry, params.pe);
  const roic = modelROIC(data, dcf.wacc / 100);
  const asset = modelAsset(data, industry);
  const reverse = modelReverse(data, params.dcf, userGrowth);

  const weights = computeWeights(data, roic);

  // ROIC 质量调整
  const roicMult = roic.valuationMultiplier;

  // 综合合理价值 = Σ(模型估值 × 权重) × ROIC 调整
  const dcfVal = dcf.fairValue.mid * weights.dcf;
  const relVal = relative.fairPrice.mid * weights.relative;
  const assetVal = asset.fairPrice * weights.asset;
  // ROIC 模型贡献 = 调整系数作用于其他模型
  const rawComposite = (dcfVal + relVal + assetVal) * roicMult;
  const normFactor = weights.dcf + weights.relative + weights.asset;
  const compositeMid = normFactor > 0 ? rawComposite / normFactor : 0;

  // 区间（用各模型的 low/high 加权）
  const dcfLow = dcf.fairValue.low * weights.dcf;
  const relLow = relative.fairPrice.low * weights.relative;
  const rawLow = (dcfLow + relLow + asset.fairPrice * 0.9 * weights.asset) * roicMult;
  const compositeLow = normFactor > 0 ? rawLow / normFactor : 0;

  const dcfHigh = dcf.fairValue.high * weights.dcf;
  const relHigh = relative.fairPrice.high * weights.relative;
  const rawHigh = (dcfHigh + relHigh + asset.fairPrice * 1.1 * weights.asset) * roicMult;
  const compositeHigh = normFactor > 0 ? rawHigh / normFactor : 0;

  const compositeFairValue = confidenceRange(compositeLow, compositeMid, compositeHigh, 0.8);

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

  // 综合置信度
  const confidence = clamp(
    dcf.confidence * 0.3 + relative.confidence * 0.3 + roic.confidence * 0.2 + asset.confidence * 0.2,
    0, 1,
  );

  const riskSignals = generateRiskSignals(data, roic, dcf);

  return {
    dcf, relative, roic, asset, reverse,
    compositeFairValue,
    currentPrice: p,
    marginOfSafety: { low: marginLow, mid: marginMid, high: marginHigh },
    verdict, verdictText,
    modelWeights: weights,
    riskSignals,
    confidence,
  };
}
