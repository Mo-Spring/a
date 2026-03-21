/**
 * 估值模型服务
 * DCF 现金流折现 / PE 相对估值 / Gordon 股利折现
 */

import type { CompleteStockData } from './stockDataService';

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
export function calculateDCF(data: CompleteStockData): DCFResult {
  // 参数设置
  const Rf = 0.025;          // 无风险利率（10年期国债收益率）
  const ERP = 0.06;          // 股权风险溢价
  const beta = estimateBeta(data); // 估算 Beta

  const wacc = Rf + beta * ERP;
  const terminalGrowth = 0.03; // 永续增长率（中国名义GDP增速约3-4%）
  const projectionYears = 10;

  // 基础 EPS
  const currentEPS = data.eps > 0 ? data.eps : 0;
  const currentBVPS = data.bvps > 0 ? data.bvps : 0;
  const currentROE = data.roe > 0 ? data.roe / 100 : 0;

  // 估算自由现金流（如果没有精确数据，用净利润近似）
  const currentFCF = data.freeCF > 0 
    ? data.freeCF 
    : (data.netIncome > 0 ? data.netIncome : currentEPS * estimateShares(data));

  // 确定分阶段增长率
  const growthPhases = estimateGrowthPhases(data, projectionYears);

  // 计算每年折现现金流
  const projection: DCFResult['projection'] = [];
  let pvSum = 0;
  let currentFCFPerYear = currentFCF;

  for (let y = 1; y <= projectionYears; y++) {
    // 确定当前年份的增长率
    const phase = getPhaseForYear(growthPhases, y);
    currentFCFPerYear *= (1 + phase);
    const discounted = currentFCFPerYear / Math.pow(1 + wacc, y);
    pvSum += discounted;
    projection.push({ year: y, fcf: currentFCFPerYear, discountedFCF: discounted });
  }

  // 终值（Gordon Growth Model）
  const terminalFCF = currentFCFPerYear * (1 + terminalGrowth);
  const terminalValue = terminalFCF / (wacc - terminalGrowth);
  const discountedTerminalValue = terminalValue / Math.pow(1 + wacc, projectionYears);

  const totalValue = pvSum + discountedTerminalValue;
  const shares = estimateShares(data);
  const intrinsicValue = shares > 0 ? totalValue / shares : 0;
  const impliedPE = currentEPS > 0 ? intrinsicValue / currentEPS : 0;
  const marginOfSafety = data.price > 0 ? ((intrinsicValue - data.price) / data.price) * 100 : 0;

  // 信心评估
  const hasRealFCF = data.freeCF > 0;
  const hasHistory = data.history && data.history.years.length >= 3;
  const hasReasonablePE = data.pe > 0 && data.pe < 100;
  const confidence: DCFResult['confidence'] = (hasRealFCF && hasHistory && hasReasonablePE) ? 'high'
    : (hasHistory || hasReasonablePE) ? 'medium' : 'low';

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

/** 根据行业和历史数据估算 Beta */
function estimateBeta(data: CompleteStockData): number {
  const pe = data.pe;
  const roe = data.roe / 100;
  
  // 高估值 + 低ROE → 高波动 → 高 Beta
  if (pe > 50) return 1.3;
  if (pe > 30) return 1.1;
  if (roe > 0.15 && pe < 20) return 0.9;
  if (roe > 0.1) return 1.0;
  return 1.05;
}

/** 估算分阶段增长率 */
function estimateGrowthPhases(data: CompleteStockData, totalYears: number): Array<{ years: number; growth: number }> {
  const roe = data.roe / 100;
  const revenueGrowth = data.revenueGrowth / 100;
  const netIncomeGrowth = data.netIncomeGrowth / 100;

  // 用历史增长率和 ROE 综合判断
  let baseGrowth = 0.05; // 默认 5%

  if (data.history && data.history.netIncomes.length >= 2) {
    // 用近3年净利润复合增长率
    const incomes = data.history.netIncomes;
    if (incomes.length >= 3 && incomes[incomes.length - 1] !== 0) {
      const cagr = Math.pow(incomes[0] / Math.abs(incomes[incomes.length - 1]), 1 / (incomes.length - 1)) - 1;
      if (cagr > -0.5 && cagr < 1) baseGrowth = Math.max(cagr, 0.02);
    }
  }

  // 用 ROE 作为增长上限参考
  if (roe > 0 && roe < 0.5) {
    baseGrowth = Math.min(baseGrowth, roe * 0.7); // 增长率不超过 ROE 的 70%
  }

  // 阶段1：前5年较高增长
  const phase1Growth = Math.min(Math.max(baseGrowth, 0.03), 0.25);
  // 阶段2：后5年过渡到永续增长率
  const phase2Growth = (phase1Growth + 0.03) / 2;

  return [
    { years: Math.min(5, Math.floor(totalYears / 2)), growth: phase1Growth },
    { years: totalYears - Math.min(5, Math.floor(totalYears / 2)), growth: phase2Growth },
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

function estimateShares(data: CompleteStockData): number {
  if (data.mcap > 0 && data.price > 0) {
    return (data.mcap * 1e8) / data.price; // mcap 是亿
  }
  // 用市值/价格估算
  if (data.eps > 0 && data.pe > 0) {
    const impliedPrice = data.eps * data.pe;
    if (impliedPrice > 0 && data.mcap > 0) {
      return (data.mcap * 1e8) / impliedPrice;
    }
  }
  return 1; // 兜底
}

// ─── PE 相对估值模型 ───

/**
 * PE 相对估值
 * 
 * 综合三个维度：
 * 1. 行业平均 PE × ROE 修正
 * 2. 历史 PE 中位数
 * 3. PEG 修正（PE / 增长率）
 */
export function calculatePERelative(
  data: CompleteStockData,
  industryPE: number
): PERelativeResult {
  const currentROE = data.roe / 100;
  const currentGrowth = Math.max(data.netIncomeGrowth / 100, 0);

  // ① 行业 PE × ROE 修正
  // ROE 越高，相对于行业平均可享受更高 PE
  const roeAdjustment = currentROE > 0 ? Math.min(currentROE / 0.15, 2.0) : 0.5;
  const industryFairPE = industryPE * roeAdjustment;

  // ② 历史 PE（如果有历史数据，取中位数；否则用行业PE）
  let historicalPE = industryPE;
  if (data.history && data.history.years.length >= 2) {
    // 用历史数据的均值作为参考
    historicalPE = data.pe > 0 ? data.pe : industryPE;
  }
  const historicalFairPE = historicalPE;

  // ③ PEG 修正
  // 合理 PEG = 1，所以合理 PE = 增长率 × 100
  // 但增长率过低时用最低 PE
  const growthPE = currentGrowth > 0.02 ? currentGrowth * 100 : industryPE * 0.5;
  const growthAdjustment = currentGrowth;

  // 权重分配
  const hasHistory = data.history && data.history.years.length >= 3;
  const weights = {
    industry: 0.4,
    historical: hasHistory ? 0.35 : 0.2,
    growth: hasHistory ? 0.25 : 0.4,
  };

  // 加权平均
  const fairPE = industryFairPE * weights.industry
    + historicalFairPE * weights.historical
    + growthPE * weights.growth;

  const fairPrice = data.eps > 0 ? fairPE * data.eps : 0;

  // 信心评估
  const confidence: PERelativeResult['confidence'] = 
    (industryPE > 0 && hasHistory && currentGrowth > 0) ? 'high'
    : (industryPE > 0) ? 'medium' : 'low';

  return {
    fairPE,
    fairPrice,
    params: {
      industryPE,
      historicalPE: historicalFairPE,
      roeAdjustment,
      growthAdjustment,
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
 * 其中：
 * - D₀ = 当前每股股利
 * - g = 股利永续增长率（由 ROE × 留存率 估算）
 * - r = 投资者要求回报率
 * 
 * 对于低分红公司，用 RIM（剩余收益模型）近似：
 * V = BV + Σ (ROE - r) × BV₍ₜ₋₁₎ / (1+r)ᵗ
 */
export function calculateGordon(data: CompleteStockData): GordonResult {
  const currentBVPS = data.bvps > 0 ? data.bvps : 0;
  const currentROE = data.roe / 100;
  const currentDY = data.dy / 100;
  const currentEPS = data.eps > 0 ? data.eps : 0;
  
  // 要求回报率（与 DCF 一致）
  const Rf = 0.025;
  const ERP = 0.06;
  const beta = estimateBeta(data);
  const requiredReturn = Rf + beta * ERP;

  // 估算当前每股股利
  let currentDividend = 0;
  if (data.dividendPerShare > 0) {
    currentDividend = data.dividendPerShare;
  } else if (currentDY > 0 && data.price > 0) {
    currentDividend = data.price * currentDY;
  } else if (currentEPS > 0) {
    // 估算分红比例
    const payoutRatio = estimatePayoutRatio(data);
    currentDividend = currentEPS * payoutRatio;
  }

  // 分红增长率 = ROE × 留存率
  const payoutRatio = currentEPS > 0 ? (currentDividend / currentEPS) : 0.3;
  const retentionRatio = Math.max(1 - payoutRatio, 0);
  const dividendGrowthRate = Math.min(currentROE * retentionRatio, 0.10); // 上限 10%

  let intrinsicValue = 0;
  let impliedPE = 0;
  let impliedPB = 0;
  let marginOfSafety = 0;

  // 判断用 Gordon 还是 RIM
  const isHighDividend = currentDividend > 0 && currentDY > 0.02; // 股息率 > 2%

  if (isHighDividend && dividendGrowthRate < requiredReturn) {
    // Gordon Growth Model
    const D1 = currentDividend * (1 + dividendGrowthRate);
    intrinsicValue = D1 / (requiredReturn - dividendGrowthRate);
    impliedPE = currentEPS > 0 ? intrinsicValue / currentEPS : 0;
    impliedPB = currentBVPS > 0 ? intrinsicValue / currentBVPS : 0;
  } else if (currentBVPS > 0 && currentROE > 0) {
    // RIM（剩余收益模型）
    const projectionYears = 10;
    let rimValue = currentBVPS;
    let bv = currentBVPS;
    const fadeRate = (currentROE - requiredReturn) * 0.05; // ROE 衰减率

    for (let y = 1; y <= projectionYears; y++) {
      const ri = (currentROE - (y - 1) * fadeRate - requiredReturn) * bv;
      if (ri > 0) {
        rimValue += ri / Math.pow(1 + requiredReturn, y);
      }
      bv = bv * (1 + currentROE * retentionRatio * Math.pow(0.95, y)); // 账面价值增长衰减
    }

    // 终值
    const terminalROE = Math.max(currentROE - projectionYears * fadeRate, requiredReturn);
    const terminalRI = (terminalROE - requiredReturn) * bv;
    if (terminalRI > 0) {
      const terminalValue = terminalRI / (requiredReturn - 0.03);
      rimValue += terminalValue / Math.pow(1 + requiredReturn, projectionYears);
    }

    intrinsicValue = rimValue;
    impliedPE = currentEPS > 0 ? intrinsicValue / currentEPS : 0;
    impliedPB = currentBVPS > 0 ? intrinsicValue / currentBVPS : 0;
  } else {
    // 兜底：用 PB 合理估值
    intrinsicValue = currentBVPS * 1.5;
    impliedPE = currentEPS > 0 ? intrinsicValue / currentEPS : 0;
    impliedPB = 1.5;
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

/** 根据行业和公司特征估算分红比例 */
function estimatePayoutRatio(data: CompleteStockData): number {
  const roe = data.roe / 100;
  const pe = data.pe;

  // 高 ROE + 低 PE → 通常分红较高
  if (roe > 0.15 && pe < 15) return 0.5;
  if (roe > 0.1 && pe < 20) return 0.35;
  // 高成长公司 → 低分红
  if (pe > 40) return 0.1;
  if (pe > 25) return 0.2;
  // 默认
  return 0.3;
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
  industryPE: number
): ValuationSummary {
  const dcf = calculateDCF(data);
  const peRelative = calculatePERelative(data, industryPE);
  const gordon = calculateGordon(data);

  // 动态权重
  const isHighDividend = data.dy > 3;
  const hasStableCF = data.history && data.history.years.length >= 3;
  const hasIndustryComp = industryPE > 0;

  const modelWeights = {
    dcf: hasStableCF ? 0.4 : 0.25,
    pe: hasIndustryComp ? 0.35 : 0.25,
    gordon: isHighDividend ? 0.4 : 0.2,
  };

  // 归一化权重
  const totalWeight = modelWeights.dcf + modelWeights.pe + modelWeights.gordon;
  modelWeights.dcf /= totalWeight;
  modelWeights.pe /= totalWeight;
  modelWeights.gordon /= totalWeight;

  // 加权合理 PE
  const compositeFairPE = dcf.impliedPE * modelWeights.dcf
    + peRelative.fairPE * modelWeights.pe
    + gordon.impliedPE * modelWeights.gordon;

  // 加权合理价格
  const compositeFairPrice = dcf.intrinsicValue * modelWeights.dcf
    + peRelative.fairPrice * modelWeights.pe
    + gordon.intrinsicValue * modelWeights.gordon;

  const compositeMargin = data.price > 0
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
