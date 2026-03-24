import React from 'react';
import { AlertCircle, Trash2, RotateCcw } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { VALUATION_PRESETS, PresetName } from '../types';
import { DEFAULT_CONFIG, PROVIDERS } from '../constants';

const SettingsView = () => {
  const {
    config, setConfig, settingsTab, setSettingsTab,
    valuationConfig, setValuationConfig,
    activePreset, setActivePreset,
    setConfirmDialog, handleRestoreDefaults, handleRestoreDefaultIndices,
  } = useAppContext();

  const updateDCF = (key: string, val: number) => {
    const newCfg = { ...valuationConfig, dcf: { ...valuationConfig.dcf, [key]: val } };
    setValuationConfig(newCfg);
    setActivePreset(null);
    localStorage.setItem('iv_val_cfg', JSON.stringify(newCfg));
    localStorage.removeItem('iv_val_preset');
  };
  const updatePE = (key: string, val: number) => {
    const newCfg = { ...valuationConfig, pe: { ...valuationConfig.pe, [key]: val } };
    setValuationConfig(newCfg);
    setActivePreset(null);
    localStorage.setItem('iv_val_cfg', JSON.stringify(newCfg));
    localStorage.removeItem('iv_val_preset');
  };
  const applyPreset = (name: PresetName) => {
    const cfg = VALUATION_PRESETS[name].config;
    setValuationConfig(cfg);
    setActivePreset(name);
    localStorage.setItem('iv_val_cfg', JSON.stringify(cfg));
    localStorage.setItem('iv_val_preset', name);
  };

  const Slider = ({ label, value, min, max, step, unit, onChange, desc }: {
    label: string; value: number; min: number; max: number; step: number;
    unit: string; onChange: (v: number) => void; desc?: string;
  }) => (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-600 font-medium">{label}</span>
        <span className="text-xs font-mono font-bold text-indigo-600">{(value * (unit === '%' ? 100 : 1)).toFixed(unit === '%' ? 1 : 2)}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-500"
      />
      {desc && <div className="text-[9px] text-slate-400">{desc}</div>}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Tab 切换 */}
      <div className="flex bg-white/80 border border-slate-200/60 rounded-2xl p-1 shadow-card">
        {(['ai', 'data', 'valuation'] as const).map(tab => (
          <button key={tab} onClick={() => setSettingsTab(tab)}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${settingsTab === tab ? 'tab-pill-active' : 'tab-pill-inactive'}`}>
            {tab === 'ai' ? '🤖 AI' : tab === 'data' ? '📊 数据' : '📐 估值模型'}
          </button>
        ))}
      </div>

      {/* AI 设置 */}
      {settingsTab === 'ai' && (
        <div className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">AI 服务商</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PROVIDERS).map(([id, p]) => (
                <button key={id}
                  onClick={() => setConfig({ ...config, provider: id, apiUrl: config.apiUrl === '' || Object.values(PROVIDERS).some(prov => prov.url === config.apiUrl) ? p.url : config.apiUrl, model: p.model })}
                  className={`p-3 rounded-xl text-left transition-all ${config.provider === id ? 'border-2 border-brand-500 bg-brand-50' : 'border border-slate-200/80 bg-surface'}`}>
                  <div className={`text-sm font-bold ${config.provider === id ? 'text-brand-700' : 'text-slate-700'}`}>{p.name}</div>
                  <div className="text-[10px] text-slate-400">{p.model}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">API 地址</label>
              <input className="input-field" value={config.apiUrl} placeholder={PROVIDERS[config.provider]?.url} onChange={e => setConfig({ ...config, apiUrl: e.target.value })} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">API Key</label>
              <input type="password" className="input-field" placeholder="sk-xxxxxxxx" value={config.apiKey} onChange={e => setConfig({ ...config, apiKey: e.target.value })} />
              <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1"><AlertCircle size={10} /> 仅保存在本地浏览器</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">模型名称</label>
              <input className="input-field" value={config.model} onChange={e => setConfig({ ...config, model: e.target.value })} />
            </div>
          </div>
          <button onClick={() => { setConfig(DEFAULT_CONFIG); localStorage.removeItem('iv_cfg'); }}
            className="btn-secondary w-full py-3">恢复 AI 默认设置</button>
        </div>
      )}

      {/* 数据设置 */}
      {settingsTab === 'data' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase">数据来源</div>
            <div className="text-xs text-slate-600">实时行情 & 财务数据来自东方财富，每 10 秒自动刷新。</div>
          </div>
          <button onClick={() => setConfirmDialog({ title: '恢复公司数据', message: '将清除所有自定义公司，恢复初始状态。', onConfirm: () => { handleRestoreDefaults(); setConfirmDialog(null); } })}
            className="btn-danger w-full py-3 flex items-center justify-center gap-2">
            <Trash2 size={15} /> 恢复默认公司数据
          </button>
          <button onClick={handleRestoreDefaultIndices}
            className="w-full py-3 flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 text-amber-600 font-bold rounded-2xl">
            <RotateCcw size={15} /> 恢复默认指数数据
          </button>
        </div>
      )}

      {/* 估值模型设置 */}
      {settingsTab === 'valuation' && (
        <div className="space-y-5">
          {/* 预设方案 */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">预设方案</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(VALUATION_PRESETS) as [PresetName, typeof VALUATION_PRESETS[PresetName]][]).map(([key, preset]) => (
                <button key={key} onClick={() => applyPreset(key)}
                  className={`p-3 rounded-xl text-left transition-all ${activePreset === key ? 'border-2 border-indigo-500 bg-indigo-50' : 'border border-slate-200/80 bg-surface'}`}>
                  <div className={`text-sm font-bold ${activePreset === key ? 'text-indigo-700' : 'text-slate-700'}`}>{preset.name}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">{preset.desc}</div>
                </button>
              ))}
            </div>
            {activePreset === null && <div className="text-[10px] text-amber-500 mt-2 font-medium">⚠️ 自定义参数</div>}
          </div>

          {/* DCF 参数 */}
          <div className="card-elevated p-4 space-y-3">
            <h3 className="text-xs font-bold text-indigo-600">① DCF 现金流折现</h3>
            <Slider label="无风险利率 Rf" value={valuationConfig.dcf.rf} min={0.01} max={0.06} step={0.005} unit="%" onChange={v => updateDCF('rf', v)} desc="10 年期国债收益率" />
            <Slider label="股权风险溢价 ERP" value={valuationConfig.dcf.erp} min={0.03} max={0.10} step={0.005} unit="%" onChange={v => updateDCF('erp', v)} desc="股票相对无风险资产的额外回报" />
            <Slider label="永续增长率 g" value={valuationConfig.dcf.terminalGrowth} min={0.01} max={0.05} step={0.005} unit="%" onChange={v => updateDCF('terminalGrowth', v)} desc="长期名义 GDP 增速" />
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-600">预测年数</span>
              <div className="flex gap-1">
                {[5, 8, 10].map(y => (
                  <button key={y} onClick={() => updateDCF('projectionYears', y)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${valuationConfig.dcf.projectionYears === y ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {y}年
                  </button>
                ))}
              </div>
            </div>
            <Slider label="乐观折现率" value={valuationConfig.dcf.discountRates.bull} min={0.05} max={0.12} step={0.005} unit="%" onChange={v => {
              const newCfg = { ...valuationConfig, dcf: { ...valuationConfig.dcf, discountRates: { ...valuationConfig.dcf.discountRates, bull: v } } };
              setValuationConfig(newCfg); setActivePreset(null); localStorage.setItem('iv_val_cfg', JSON.stringify(newCfg)); localStorage.removeItem('iv_val_preset');
            }} desc="低折现率 → 高估值" />
            <Slider label="中性折现率" value={valuationConfig.dcf.discountRates.base} min={0.06} max={0.14} step={0.005} unit="%" onChange={v => {
              const newCfg = { ...valuationConfig, dcf: { ...valuationConfig.dcf, discountRates: { ...valuationConfig.dcf.discountRates, base: v } } };
              setValuationConfig(newCfg); setActivePreset(null); localStorage.setItem('iv_val_cfg', JSON.stringify(newCfg)); localStorage.removeItem('iv_val_preset');
            }} desc="基准情景" />
            <Slider label="悲观折现率" value={valuationConfig.dcf.discountRates.bear} min={0.08} max={0.18} step={0.005} unit="%" onChange={v => {
              const newCfg = { ...valuationConfig, dcf: { ...valuationConfig.dcf, discountRates: { ...valuationConfig.dcf.discountRates, bear: v } } };
              setValuationConfig(newCfg); setActivePreset(null); localStorage.setItem('iv_val_cfg', JSON.stringify(newCfg)); localStorage.removeItem('iv_val_preset');
            }} desc="高折现率 → 低估值" />
          </div>

          {/* PE 相对估值参数 */}
          <div className="card-elevated p-4 space-y-3">
            <h3 className="text-xs font-bold text-indigo-600">② PE 相对估值</h3>
            <Slider label="ROE 基准值" value={valuationConfig.pe.roeBase} min={0.08} max={0.25} step={0.01} unit="%" onChange={v => updatePE('roeBase', v)} desc="ROE 达到此值可享行业平均 PE" />
            <Slider label="行业 PE 权重" value={valuationConfig.pe.industryWeight} min={0.1} max={0.6} step={0.05} unit="" onChange={v => updatePE('industryWeight', v)} />
            <Slider label="历史 PE 权重" value={valuationConfig.pe.historicalWeight} min={0.1} max={0.6} step={0.05} unit="" onChange={v => updatePE('historicalWeight', v)} />
            <Slider label="增长权重 (PEG)" value={valuationConfig.pe.growthWeight} min={0.1} max={0.5} step={0.05} unit="" onChange={v => updatePE('growthWeight', v)} />
          </div>

          {/* 辅助信号说明 */}
          <div className="card-elevated p-4 space-y-3">
            <h3 className="text-xs font-bold text-indigo-600">辅助信号（自动计算）</h3>
            <div className="text-[10px] text-slate-500 space-y-1.5 leading-relaxed">
              <p>• <b>护城河评分</b>：基于真实财报 — ROE 连续性、现金流质量（经营CF/净利润）、增长质量、负债安全</p>
              <p>• <b>清算底线</b>：0.7 × 每股净资产，股价低于此值有资产支撑</p>
              <p>• <b>市场隐含增长</b>：用二分法从当前股价反推市场预期的年化增长率</p>
              <p>• <b>敏感性分析</b>：DCF 对增长率和折现率假设的敏感度矩阵</p>
              <p>• 财务数据来自东方财富三表（利润表+资产负债表+现金流量表），本地缓存 7 天</p>
            </div>
          </div>

          <button onClick={() => applyPreset('neutral')} className="btn-secondary w-full py-3">恢复默认参数</button>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
