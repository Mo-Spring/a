/**
 * 估值模型服务
 * DCF 现金流折现 / PE 相对估值 / Gordon 股利折现
 */

import type { CompleteStockData } from './stockDataService';
import type { ValuationConfig, DCFParams, PERelativeParams, GordonParams } from '../types';
import { VALUATION_PRESETS } from '../types';

// ─── 类型定义 ───

export interface DCFResult {
  /** 内在价值（每股） */
  intrinsicValue: number;
  /** 隐含合理 PE */
  impliedPE: number;
  /** 参数 */
  params: {
    wacc: number;
    growthPhases: Array<{ years: number; growth: number }>;
    terminalGrowth: number;
    currentEPS: number;
    currentFCF: number;
    projectionYears: number;
  };
  /** 每年折现现金流明细 */
  projection: Array<{ year: number; fcf: number; discountedFCF: number }>;
  /** 终值 */
  terminalValue: number;
  discountedTerminalValue: number;
  /** 安全边际 */
  marginOfSafety: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface PERelativeResult {
  /** 隐含合理 PE */
  fairPE: number;
  /** 隐含合理价格 */
  fairPrice: number;
  /** 参数 */
  params: {
    industryPE: number;
    historicalPE: number;
    roeAdjustment: number;
    growthAdjustment: number;
    currentROE: number;
    currentGrowth: number;
  };
  /** 来源权重 */
  weights: { industry: number; historical: number; growth: number };
  confidence: 'high' | 'medium' | 'low';
}

export interface GordonResult {
  /** Gordon 模型隐含价值（每股） */
  intrinsicValue: number;
  /** 隐含合理 PE */
  impliedPE: number;
  /** 隐含合理 PB */
  impliedPB: number;
  /** 参数 */
  params: {
    currentDividend: number;
    dividendGrowthRate: number;
    requiredReturn: number;
    retentionRatio: number;
    roe: number;
  };
  /** 安全边际 */
  marginOfSafety: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface ValuationSummary {
  dcf: DCFResult;
  peRelative: PERelativeResult;
  gordon: GordonResult;
  /** 加权综合合理 PE */
  compositeFairPE: number;
  /** 加权综合合理价格 */
  compositeFairPrice: number;
  /** 当前价格 */
  currentPrice: number;
  /** 综合安全边际 % */
  compositeMargin: number;
  /** 估值结论 */
  verdict: 'deeply_undervalued' | 'undervalued' | 'fair' | 'overvalued' | 'deeply_overvalued';
  verdictText: string;
  /** 各模型信心权重 */
  modelWeights: { dcf: number; pe: number; gordon: number };
}

// ─── 工具函数 ───

/** 安全取值：>0 才算有效，否则返回 fallback */
function validNum(v: number, fallback: number): number {
  return typeof v === 'number' && isFinite(v) && v > 0 ? v : fallback;
}

/** 限幅 */
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ─── DCF 现金流折现模型 ───

/**
 * 多阶段 DCF 模型
 *
 * 阶段1: 高速增长期（基于历史增长率和行业判断）
 * 阶段2: 过渡增长期（增长率逐步收敛到永续增长率）
 * 终值: Gordon Growth Model
 *
 * WACC = Rf + β × ERP（资本资产定价模型）
 */
export function calculateDCF(data: CompleteStockData, params?: DCFParams): DCFResult {
  const p = params || VALUATION_PRESETS.neutral.config.dcf;
  const Rf = p.rf;
  const ERP = p.erp;
  const beta = estimateBeta(data);

  const wacc = Rf + beta * ERP;
  const terminalGrowth = p.terminalGrowth;
  const projectionYears = p.projectionYears;

  // 基础 EPS（必须 > 0 才能做 DCF）
  const currentEPS = validNum(data.eps, 0);
  const currentROE = data.roe > 0 ? data.roe / 100 : 0;

  // 估算自由现金流
  const currentFCF = validNum(data.freeCF, validNum(data.netIncome, currentEPS * estimateShares(data)));

  // 确定分阶段增长率
  const growthPhases = estimateGrowthPhases(data, projectionYears, currentROE);

  // 计算每年折现现金流
  const projection: DCFResult['projection'] = [];
  let pvSum = 0;
  let currentFCFPerYear = currentFCF;

  for (let y = 1; y <= projectionYears; y++) {
    const phase = getPhaseForYear(growthPhases, y);
    currentFCFPerYear *= (1 + phase);
    const discounted = currentFCFPerYear / Math.pow(1 + wacc, y);
    pvSum += discounted;
    projection.push({ year: y, fcf: currentFCFPerYear, discountedFCF: discounted });
  }

  // 终值（Gordon Growth Model）
  const terminalFCF = currentFCFPerYear * (1 + terminalGrowth);
  let terminalValue = 0;
  let discountedTerminalValue = 0;
  if (wacc > terminalGrowth) {
    terminalValue = terminalFCF / (wacc - terminalGrowth);
    discountedTerminalValue = terminalValue / Math.pow(1 + wacc, projectionYears);
  }

  const totalValue = pvSum + discountedTerminalValue;
  const shares = estimateShares(data);
  const intrinsicValue = shares > 0 ? totalValue / shares : 0;
  const impliedPE = currentEPS > 0 ? intrinsicValue / currentEPS : 0;
  const marginOfSafety = data.price > 0 ? ((intrinsicValue - data.price) / data.price) * 100 : 0;

  // 信心评估
  const hasRealFCF = data.freeCF > 0 || data.netIncome > 0;
  const hasHistory = data.history && data.history.years.length >= 3;
  const hasReasonablePE = data.pe > 0 && data.pe < 200;
  const hasEPS = currentEPS > 0;
  const confidence: DCFResult['confidence'] = (hasRealFCF && hasHistory && hasReasonablePE && hasEPS) ? 'high'
    : (hasEPS && (hasHistory || hasReasonablePE)) ? 'medium' : 'low';

  return {
    intrinsicValue,
    impliedPE,
    params: {
      wacc,
      growthPhases,
      terminalGrowth,
      currentEPS,
      currentFCF,
      projectionYears,
    },
    projection,
    terminalValue,
    discountedTerminalValue,
    marginOfSafety,
    confidence,
  };
}

/**
 * 根据 PE、ROE、历史波动连续估算 Beta
 * 不再用离散档位，而是用连续公式
 *
 * 逻辑：
 * - 高 PE → 高 Beta（市场预期高，波动大）
 * - 高 ROE → 低 Beta（盈利能力强，相对稳定）
 * - 两者交叉修正
 */
function estimateBeta(data: CompleteStockData): number {
  const pe = validNum(data.pe, 20);    // 默认 20
  const roe = validNum(data.roe, 10) / 100;  // 默认 10%

  // PE 贡献：PE 从 5 到 100，Beta 从 0.7 到 1.4
  const peComponent = 0.7 + 0.7 * clamp((pe - 5) / 95, 0, 1);

  // ROE 贡献：ROE 从 0 到 30%，Beta 减少 0 到 0.3
  const roeDiscount = 0.3 * clamp(roe / 0.30, 0, 1);

  // 历史净利润波动（如果有历史数据）
  let volatilityAdjust = 0;
  if (data.history && data.history.netIncomes.length >= 3) {
    const incomes = data.history.netIncomes.filter(v => v > 0);
    if (incomes.length >= 2) {
      const mean = incomes.reduce((a, b) => a + b, 0) / incomes.length;
      const stdDev = Math.sqrt(incomes.reduce((s, v) => s + (v - mean) ** 2, 0) / incomes.length);
      const cv = mean > 0 ? stdDev / mean : 0; // 变异系数
      volatilityAdjust = clamp(cv * 0.5, 0, 0.3); // 波动大 → Beta +0~0.3
    }
  }

  return clamp(peComponent - roeDiscount + volatilityAdjust, 0.5, 2.0);
}

/**
 * 连续估算分阶段增长率
 * 不再用固定默认值，而是基于可获取的数据连续计算
 */
function estimateGrowthPhases(data: CompleteStockData, totalYears: number, roe: number): Array<{ years: number; growth: number }> {
  // ── 多维度增长率估算 ──
  const growthEstimates: number[] = [];
  const weights: number[] = [];

  // 维度1：历史净利润 CAGR（权重最高）
  if (data.history && data.history.netIncomes.length >= 2) {
    const incomes = data.history.netIncomes;
    const latest = incomes[0];
    const oldest = incomes[incomes.length - 1];
    if (oldest > 0 && latest > 0 && incomes.length >= 2) {
      const cagr = Math.pow(latest / oldest, 1 / (incomes.length - 1)) - 1;
      if (cagr > -0.5 && cagr < 1.5) {
        growthEstimates.push(cagr);
        weights.push(3.0);
      }
    }
  }

  // 维度2：最近一年净利润同比增长
  if (data.netIncomeGrowth && data.netIncomeGrowth !== 0) {
    const g = data.netIncomeGrowth / 100;
    if (g > -0.8 && g < 2) {
      growthEstimates.push(g);
      weights.push(1.5);
    }
  }

  // 维度3：最近一年营收同比增长
  if (data.revenueGrowth && data.revenueGrowth !== 0) {
    const g = data.revenueGrowth / 100;
    if (g > -0.8 && g < 2) {
      growthEstimates.push(g * 0.8); // 营收增长打 8 折作为利润增长近似
      weights.push(1.0);
    }
  }

  // 维度4：ROE × 留存率（可持续增长率 g = ROE × b）
  if (roe > 0 && roe < 0.5) {
    // 估算留存率：高分红公司留存率低
    const payoutEst = data.dy > 3 ? 0.4 : data.dy > 1 ? 0.6 : 0.8;
    const sustainableGrowth = roe * payoutEst;
    if (sustainableGrowth > 0 && sustainableGrowth < 0.5) {
      growthEstimates.push(sustainableGrowth);
      weights.push(2.0);
    }
  }

  // 加权平均
  let baseGrowth = 0.05; // 仅在完全没有数据时使用
  if (growthEstimates.length > 0) {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    baseGrowth = growthEstimates.reduce((sum, g, i) => sum + g * weights[i], 0) / totalWeight;
  }

  // 用 ROE 作为增长上限约束
  if (roe > 0 && roe < 0.5) {
    baseGrowth = Math.min(baseGrowth, roe * 0.8);
  }

  // 确保在合理范围内
  baseGrowth = clamp(baseGrowth, 0.01, 0.35);

  // 阶段1：前 half 年较高增长
  const phase1Years = Math.min(5, Math.floor(totalYears / 2));
  // 阶段2：收敛到永续增长率
  const phase2Years = totalYears - phase1Years;
  const phase2Growth = (baseGrowth + 0.03) / 2;

  return [
    { years: phase1Years, growth: baseGrowth },
    { years: phase2Years, growth: phase2Growth },
  ];
}

function getPhaseForYear(phases: Array<{ years: number; growth: number }>, year: number): number {
  let acc = 0;
  for (const phase of phases) {
    acc += phase.years;
    if (year <= acc) return phase.growth;
  }
  return phases[phases.length - 1].growth;
}

/**
 * 连续估算总股本
 * 优先用市值/价格推算
 */
function estimateShares(data: CompleteStockData): number {
  if (data.mcap > 0 && data.price > 0) {
    return (data.mcap * 1e8) / data.price;
  }
  if (data.eps > 0 && data.pe > 0 && data.mcap > 0) {
    const impliedPrice = data.eps * data.pe;
    if (impliedPrice > 0) {
      return (data.mcap * 1e8) / impliedPrice;
    }
  }
  return 1;
}

// ─── PE 相对估值模型 ───

/**
 * PE 相对估值
 *
 * 综合三个维度：
 * 1. 行业平均 PE × ROE 修正（连续函数，非离散）
 * 2. 历史 PE 中位数
 * 3. PEG 修正（PE / 增长率）
 */
export function calculatePERelative(
  data: CompleteStockData,
  industryPE: number,
  params?: PERelativeParams
): PERelativeResult {
  const p = params || VALUATION_PRESETS.neutral.config.pe;
  const currentROE = data.roe > 0 ? data.roe / 100 : 0;
  const currentGrowth = data.netIncomeGrowth > 0 ? data.netIncomeGrowth / 100 : 0;

  // ① 行业 PE × ROE 修正（连续函数）
  // ROE 从 0% 到 30%，修正系数从 0.3 到 2.0
  const roeAdjustment = currentROE > 0
    ? clamp(0.3 + 1.7 * (currentROE / 0.30), 0.3, 2.5)
    : 0.5;
  const industryFairPE = industryPE * roeAdjustment;

  // ② 历史 PE：用当前 PE 作为历史估值参考
  let historicalFairPE = industryPE;
  if (data.pe > 0 && data.pe < 500) {
    historicalFairPE = data.pe;
  } else if (data.history && data.history.years.length >= 2) {
    // 如果有历史数据，用历史 PE 作为参考
    historicalFairPE = industryPE;
  }

  // ③ PEG 修正：合理 PE = 增长率 × 100（PEG=1）
  // 增长率 0% → PE = 行业×0.3；增长率 20% → PE = 20
  let growthPE: number;
  if (currentGrowth > 0.02) {
    growthPE = currentGrowth * 100;
  } else {
    growthPE = industryPE * 0.4;
  }

  // 权重分配
  const hasHistory = data.history && data.history.years.length >= 3;
  const hasGrowth = currentGrowth > 0.02;
  const weights = {
    industry: p.industryWeight,
    historical: hasHistory ? p.historicalWeight : p.historicalWeight * 0.5,
    growth: hasGrowth ? p.growthWeight + (hasHistory ? 0 : p.historicalWeight * 0.5) : p.growthWeight * 0.3,
  };

  // 归一化权重
  const totalW = weights.industry + weights.historical + weights.growth;
  if (totalW > 0) {
    weights.industry /= totalW;
    weights.historical /= totalW;
    weights.growth /= totalW;
  }

  // 加权平均
  const fairPE = industryFairPE * weights.industry
    + historicalFairPE * weights.historical
    + growthPE * weights.growth;

  const fairPrice = data.eps > 0 ? fairPE * data.eps : 0;

  // 信心评估
  const confidence: PERelativeResult['confidence'] =
    (industryPE > 0 && hasHistory && hasGrowth && data.eps > 0) ? 'high'
    : (industryPE > 0 && data.eps > 0) ? 'medium' : 'low';

  return {
    fairPE,
    fairPrice,
    params: {
      industryPE,
      historicalPE: historicalFairPE,
      roeAdjustment,
      growthAdjustment: currentGrowth,
      currentROE,
      currentGrowth,
    },
    weights,
    confidence,
  };
}

// ─── Gordon 股利折现模型 ───

/**
 * Gordon Growth Model (DDM)
 *
 * V = D₁ / (r - g) = D₀ × (1 + g) / (r - g)
 *
 * 对于低分红公司，用 RIM（剩余收益模型）近似：
 * V = BV + Σ (ROE - r) × BV₍ₜ₋₁₎ / (1+r)ᵗ
 */
export function calculateGordon(data: CompleteStockData, params?: GordonParams): GordonResult {
  const p = params || VALUATION_PRESETS.neutral.config.gordon;
  const currentBVPS = validNum(data.bvps, 0);
  const currentROE = data.roe > 0 ? data.roe / 100 : 0;
  const currentDY = data.dy > 0 ? data.dy / 100 : 0;
  const currentEPS = validNum(data.eps, 0);

  // 要求回报率（连续计算）
  const Rf = 0.025;
  const ERP = 0.06;
  const beta = estimateBeta(data);
  const requiredReturn = Rf + beta * ERP;

  // 连续估算当前每股股利
  let currentDividend = 0;
  if (data.dividendPerShare > 0) {
    currentDividend = data.dividendPerShare;
  } else if (currentDY > 0 && data.price > 0) {
    currentDividend = data.price * currentDY;
  } else if (currentEPS > 0) {
    const payoutRatio = estimatePayoutRatio(data);
    currentDividend = currentEPS * payoutRatio;
  }

  // 分红增长率 = ROE × 留存率（连续计算）
  const payoutRatio = currentEPS > 0 ? clamp(currentDividend / currentEPS, 0, 1) : p.defaultPayoutRatio;
  const retentionRatio = clamp(1 - payoutRatio, 0, 1);
  const dividendGrowthRate = clamp(currentROE * retentionRatio, 0, p.maxGrowthRate);

  let intrinsicValue = 0;
  let impliedPE = 0;
  let impliedPB = 0;
  let marginOfSafety = 0;

  // 判断用 Gordon 还是 RIM
  const isHighDividend = currentDividend > 0 && currentDY > 0.02;

  if (isHighDividend && dividendGrowthRate < requiredReturn - 0.005) {
    // Gordon Growth Model
    const D1 = currentDividend * (1 + dividendGrowthRate);
    intrinsicValue = D1 / (requiredReturn - dividendGrowthRate);
    impliedPE = currentEPS > 0 ? intrinsicValue / currentEPS : 0;
    impliedPB = currentBVPS > 0 ? intrinsicValue / currentBVPS : 0;
  } else if (currentBVPS > 0 && currentROE > 0) {
    // RIM（剩余收益模型）— 逐 year 计算
    const rimYears = 10;
    let rimValue = currentBVPS;
    let bv = currentBVPS;
    const roeFadeRate = (currentROE - requiredReturn) * 0.05; // ROE 每年衰减

    for (let y = 1; y <= rimYears; y++) {
      const yearROE = Math.max(currentROE - (y - 1) * roeFadeRate, requiredReturn);
      const residualIncome = (yearROE - requiredReturn) * bv;
      if (residualIncome > 0) {
        rimValue += residualIncome / Math.pow(1 + requiredReturn, y);
      }
      // 账面价值增长也逐 year 衰减
      const yearGrowth = currentROE * retentionRatio * Math.pow(0.95, y);
      bv = bv * (1 + yearGrowth);
    }

    // 终值
    const terminalROE = Math.max(currentROE - rimYears * roeFadeRate, requiredReturn + 0.01);
    const terminalRI = (terminalROE - requiredReturn) * bv;
    if (terminalRI > 0) {
      const tv = terminalRI / (requiredReturn - 0.03);
      rimValue += tv / Math.pow(1 + requiredReturn, rimYears);
    }

    intrinsicValue = rimValue;
    impliedPE = currentEPS > 0 ? intrinsicValue / currentEPS : 0;
    impliedPB = currentBVPS > 0 ? intrinsicValue / currentBVPS : 0;
  } else if (currentBVPS > 0) {
    // 兜底：PB 合理估值
    intrinsicValue = currentBVPS * 1.5;
    impliedPB = 1.5;
    impliedPE = currentEPS > 0 ? intrinsicValue / currentEPS : 0;
  }

  marginOfSafety = data.price > 0 ? ((intrinsicValue - data.price) / data.price) * 100 : 0;

  const confidence: GordonResult['confidence'] =
    (isHighDividend && currentROE > 0.1) ? 'high'
    : (currentBVPS > 0 && currentROE > 0.05) ? 'medium' : 'low';

  return {
    intrinsicValue,
    impliedPE,
    impliedPB,
    params: {
      currentDividend,
      dividendGrowthRate,
      requiredReturn,
      retentionRatio,
      roe: currentROE,
    },
    marginOfSafety,
    confidence,
  };
}

/**
 * 连续估算分红比例
 * 不再用离散档位，而是用 PE 和 ROE 连续插值
 */
function estimatePayoutRatio(data: CompleteStockData): number {
  const roe = data.roe > 0 ? data.roe / 100 : 0.1;
  const pe = validNum(data.pe, 20);
  const dy = data.dy > 0 ? data.dy / 100 : 0;

  // 如果有实际股息率，直接用
  if (dy > 0 && data.price > 0 && data.eps > 0) {
    return clamp(dy / (data.eps / data.price), 0, 1);
  }

  // 连续公式：高 ROE + 低 PE → 高分红；高 PE → 低分红（成长期）
  // 基准分红比例 30%
  let payout = 0.30;

  // ROE 修正：ROE 越高，分红越多（盈利能力强）
  // ROE 5%→-10%, ROE 25%→+15%
  payout += (roe - 0.15) * 0.5;

  // PE 修正：PE 越高，分红越少（成长期保留利润）
  // PE 10→+10%, PE 50→-15%
  payout -= (pe - 20) * 0.005;

  return clamp(payout, 0.05, 0.7);
}

// ─── 综合估值 ───

/**
 * 三个模型加权综合估值
 *
 * 权重根据：
 * - DCF: 对现金流稳定的公司权重更高
 * - PE: 对有行业可比的公司权重更高
 * - Gordon: 对高分红的公司权重更高
 */
export function calculateValuationSummary(
  data: CompleteStockData,
  industryPE: number,
  config?: ValuationConfig
): ValuationSummary {
  const cfg = config || VALUATION_PRESETS.neutral.config;
  const dcf = calculateDCF(data, cfg.dcf);
  const peRelative = calculatePERelative(data, industryPE, cfg.pe);
  const gordon = calculateGordon(data, cfg.gordon);

  // 动态权重（基于数据质量）
  const isHighDividend = data.dy > 3;
  const hasStableCF = data.history && data.history.years.length >= 3;
  const hasIndustryComp = industryPE > 0;
  const dcfConf = dcf.confidence === 'high' ? 1 : dcf.confidence === 'medium' ? 0.6 : 0.3;
  const peConf = peRelative.confidence === 'high' ? 1 : peRelative.confidence === 'medium' ? 0.6 : 0.3;
  const gordonConf = gordon.confidence === 'high' ? 1 : gordon.confidence === 'medium' ? 0.6 : 0.3;

  const modelWeights = {
    dcf: (hasStableCF ? 0.4 : 0.25) * dcfConf,
    pe: (hasIndustryComp ? 0.35 : 0.25) * peConf,
    gordon: (isHighDividend ? 0.4 : 0.2) * gordonConf,
  };

  // 归一化权重
  const totalWeight = modelWeights.dcf + modelWeights.pe + modelWeights.gordon;
  if (totalWeight > 0) {
    modelWeights.dcf /= totalWeight;
    modelWeights.pe /= totalWeight;
    modelWeights.gordon /= totalWeight;
  }

  // 加权合理 PE（过滤异常值）
  const safeDcfPE = isFinite(dcf.impliedPE) && dcf.impliedPE > 0 && dcf.impliedPE < 1000 ? dcf.impliedPE : 0;
  const safePePE = isFinite(peRelative.fairPE) && peRelative.fairPE > 0 && peRelative.fairPE < 1000 ? peRelative.fairPE : 0;
  const safeGordonPE = isFinite(gordon.impliedPE) && gordon.impliedPE > 0 && gordon.impliedPE < 1000 ? gordon.impliedPE : 0;

  const compositeFairPE = safeDcfPE * modelWeights.dcf
    + safePePE * modelWeights.pe
    + safeGordonPE * modelWeights.gordon;

  // 加权合理价格
  const safeDcfPrice = isFinite(dcf.intrinsicValue) && dcf.intrinsicValue > 0 ? dcf.intrinsicValue : 0;
  const safePePrice = isFinite(peRelative.fairPrice) && peRelative.fairPrice > 0 ? peRelative.fairPrice : 0;
  const safeGordonPrice = isFinite(gordon.intrinsicValue) && gordon.intrinsicValue > 0 ? gordon.intrinsicValue : 0;

  const compositeFairPrice = safeDcfPrice * modelWeights.dcf
    + safePePrice * modelWeights.pe
    + safeGordonPrice * modelWeights.gordon;

  const compositeMargin = data.price > 0 && compositeFairPrice > 0
    ? ((compositeFairPrice - data.price) / data.price) * 100
    : 0;

  // 判定
  let verdict: ValuationSummary['verdict'];
  let verdictText: string;
  if (compositeMargin > 30) { verdict = 'deeply_undervalued'; verdictText = '严重低估'; }
  else if (compositeMargin > 10) { verdict = 'undervalued'; verdictText = '低估'; }
  else if (compositeMargin > -10) { verdict = 'fair'; verdictText = '合理'; }
  else if (compositeMargin > -30) { verdict = 'overvalued'; verdictText = '高估'; }
  else { verdict = 'deeply_overvalued'; verdictText = '严重高估'; }

  return {
    dcf,
    peRelative,
    gordon,
    compositeFairPE,
    compositeFairPrice,
    currentPrice: data.price,
    compositeMargin,
    verdict,
    verdictText,
    modelWeights,
  };
}
