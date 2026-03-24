import { Industry } from './types';

export const pColor = (v: number) => v < 30 ? 'text-emerald-600' : v < 70 ? 'text-amber-600' : 'text-red-600';
export const pBg = (v: number) => v < 30 ? 'bg-emerald-600' : v < 70 ? 'bg-amber-600' : 'bg-red-600';
export const evColor = (e: string) => e === 'low' ? 'bg-emerald-50 text-emerald-600' : e === 'mid' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600';
export const evText = (e: string) => e === 'low' ? '低估' : e === 'mid' ? '适中' : '高估';

export const getGrade = (v: number, ts: number[]) => v >= ts[0] ? 'A+' : v >= ts[1] ? 'A' : v >= ts[2] ? 'B+' : v >= ts[3] ? 'B' : 'C';
export const gColor = (g: string) => g.includes('A') ? 'text-emerald-600' : g === 'B+' ? 'text-amber-600' : 'text-red-600';

export const computeEv = (pe: number | undefined | string): 'low' | 'mid' | 'high' => {
  const val = Number(pe);
  if (!val || val <= 0) return 'mid';
  if (val < 15) return 'low';
  if (val > 30) return 'high';
  return 'mid';
};

export const getIndustryValuation = (ind: Industry, batchData: Record<string, any>) => {
  // Priority: Use BK index data if available
  if (ind.bk && batchData[ind.bk]) {
    const bkd = batchData[ind.bk];
    return {
      p: bkd.p,
      pe: bkd.pe,
      pb: bkd.pb,
      dy: bkd.dy,
      cp: bkd.cp,
      ps: bkd.ps,
      mcap: bkd.mcap,
      ev: computeEv(bkd.pe),
      source: 'index'
    };
  }

  let totalPE = 0, totalPB = 0, totalDY = 0, totalCP = 0, totalMCap = 0;
  let peCount = 0, pbCount = 0, dyCount = 0, cpCount = 0;

  ind.l2.forEach(sub => {
    sub.cs.forEach(c => {
      const bd = batchData[c.c];
      const pe = bd?.pe ? parseFloat(bd.pe) : undefined;
      const pb = bd?.pb ? parseFloat(bd.pb) : undefined;
      const dy = bd?.dy ? parseFloat(bd.dy) : undefined;
      const mcap = bd?.mcap ? parseFloat(bd.mcap) : 1;
      const cp = bd?.cp ? parseFloat(bd.cp) : undefined;

      if (pe && pe > 0) { totalPE += pe * mcap; peCount += mcap; }
      if (pb && pb > 0) { totalPB += pb * mcap; pbCount += mcap; }
      if (dy && dy > 0) { totalDY += dy * mcap; dyCount += mcap; }
      if (cp !== undefined) { totalCP += cp * mcap; cpCount += mcap; }
    });
  });

  const avgPE = peCount > 0 ? (totalPE / peCount).toFixed(1) : undefined;
  const avgPB = pbCount > 0 ? (totalPB / pbCount).toFixed(2) : undefined;
  const avgDY = dyCount > 0 ? (totalDY / dyCount).toFixed(2) : undefined;
  const avgCP = cpCount > 0 ? (totalCP / cpCount).toFixed(2) : undefined;

  return { pe: avgPE, pb: avgPB, dy: avgDY, cp: avgCP, ev: computeEv(avgPE), source: 'calc' };
};
