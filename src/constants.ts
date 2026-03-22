import { Industry, AIConfig } from './types';

export const PROVIDERS: Record<string, { url: string; model: string; name: string }> = {
  gemini: { url: 'https://generativelanguage.googleapis.com', model: 'gemini-3-flash-preview', name: 'Google Gemini' },
  openai: { url: 'https://api.openai.com/v1', model: 'gpt-4o', name: 'OpenAI' },
  deepseek: { url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', name: 'DeepSeek' },
  zhipu: { url: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4', name: '智谱' },
  moonshot: { url: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', name: '月之暗面' },
};

export const DEFAULT_CONFIG: AIConfig = {
  provider: 'gemini',
  apiUrl: 'https://generativelanguage.googleapis.com',
  apiKey: '',
  model: 'gemini-3-flash-preview',
};

// ─── 港股行业（仅结构，无硬编码指标）───
export const HK_INDUSTRIES: Industry[] = [
  {
    id: 'hk-tech', nm: '资讯科技', ic: '💻', ev: 'low', market: 'HK', l2: [
      { nm: '互联网', cs: [{ c: '00700', n: '腾讯控股', market: 'HK' }, { c: '09988', n: '阿里巴巴-W', market: 'HK' }, { c: '03690', n: '美团-W', market: 'HK' }] },
      { nm: '硬件', cs: [{ c: '01810', n: '小米集团-W', market: 'HK' }] },
    indices: [{ c: 'HSTECH', n: '恒生科技', t: 'broad' }]
  },
  {
    id: 'hk-fin', nm: '金融业', ic: '🏦', ev: 'low', market: 'HK', l2: [
      { nm: '银行', cs: [{ c: '00005', n: '汇丰控股', market: 'HK' }, { c: '00939', n: '建设银行', market: 'HK' }] },
      { nm: '保险', cs: [{ c: '01299', n: '友邦保险', market: 'HK' }, { c: '02318', n: '中国平安', market: 'HK' }] },
      { nm: '多元金融', cs: [{ c: '00388', n: '香港交易所', market: 'HK' }] },
    indices: [{ c: 'HSI', n: '恒生指数', t: 'broad' }, { c: 'HSCEI', n: '国企指数', t: 'broad' }]
  },
  {
    id: 'hk-cons', nm: '非必需性消费', ic: '🛍️', ev: 'mid', market: 'HK', l2: [
      { nm: '汽车', cs: [{ c: '01211', n: '比亚迪股份', market: 'HK' }, { c: '02015', n: '理想汽车-W', market: 'HK' }] },
      { nm: '体育用品', cs: [{ c: '02020', n: '安踏体育', market: 'HK' }, { c: '02331', n: '李宁', market: 'HK' }] },
      { nm: '餐饮', cs: [{ c: '06862', n: '海底捞', market: 'HK' }] },
    indices: [{ c: 'HSTECH', n: '恒生科技', t: 'broad' }]
  },
  {
    id: 'hk-cons-staples', nm: '必需性消费', ic: '🍷', ev: 'mid', market: 'HK', l2: [
      { nm: '饮料', cs: [{ c: '09633', n: '农夫山泉', market: 'HK' }, { c: '00291', n: '华润啤酒', market: 'HK' }] },
      { nm: '乳品', cs: [{ c: '02319', n: '蒙牛乳业', market: 'HK' }] },
    indices: [{ c: 'HSI', n: '恒生指数', t: 'broad' }]
  },
  {
    id: 'hk-re', nm: '地产建筑', ic: '🏢', ev: 'low', market: 'HK', l2: [
      { nm: '香港地产', cs: [{ c: '00016', n: '新鸿基地产', market: 'HK' }, { c: '00001', n: '长和', market: 'HK' }] },
      { nm: '内房股', cs: [{ c: '01109', n: '华润置地', market: 'HK' }, { c: '00688', n: '中国海外发展', market: 'HK' }] },
    indices: [{ c: 'HSI', n: '恒生指数', t: 'broad' }]
  },
  {
    id: 'hk-tele', nm: '电讯业', ic: '📡', ev: 'low', market: 'HK', l2: [
      { nm: '电讯服务', cs: [{ c: '00941', n: '中国移动', market: 'HK' }, { c: '00728', n: '中国电信', market: 'HK' }] },
    indices: [{ c: 'HSI', n: '恒生指数', t: 'broad' }]
  },
  {
    id: 'hk-energy', nm: '能源业', ic: '🛢️', ev: 'low', market: 'HK', l2: [
      { nm: '石油天然气', cs: [{ c: '00883', n: '中国海洋石油', market: 'HK' }, { c: '00857', n: '中国石油股份', market: 'HK' }] },
      { nm: '煤炭', cs: [{ c: '01088', n: '中国神华', market: 'HK' }] },
    indices: [{ c: 'HSI', n: '恒生指数', t: 'broad' }]
  },
  {
    id: 'hk-health', nm: '医疗保健', ic: '🏥', ev: 'low', market: 'HK', l2: [
      { nm: '制药', cs: [{ c: '01093', n: '石药集团', market: 'HK' }, { c: '01177', n: '中国生物制药', market: 'HK' }] },
      { nm: 'CXO', cs: [{ c: '02269', n: '药明生物', market: 'HK' }] },
    indices: [{ c: 'HSTECH', n: '恒生科技', t: 'broad' }]
  },
  {
    id: 'hk-materials', nm: '原材料业', ic: '💎', ev: 'mid', market: 'HK', l2: [
      { nm: '黄金及贵金属', cs: [{ c: '02899', n: '紫金矿业', market: 'HK' }, { c: '01818', n: '招金矿业', market: 'HK' }] },
      { nm: '工业金属', cs: [{ c: '02600', n: '中国铝业', market: 'HK' }] },
    indices: [{ c: 'HSI', n: '恒生指数', t: 'broad' }]
  },
  {
    id: 'hk-industrials', nm: '工业', ic: '⚙️', ev: 'mid', market: 'HK', l2: [
      { nm: '重型机械', cs: [{ c: '02039', n: '中集集团', market: 'HK' }, { c: '01157', n: '中联重科', market: 'HK' }] },
      { nm: '航运', cs: [{ c: '01919', n: '中远海控', market: 'HK' }] },
    indices: [{ c: 'HSI', n: '恒生指数', t: 'broad' }]
  },
  {
    id: 'hk-util', nm: '公用事业', ic: '💧', ev: 'mid', market: 'HK', l2: [
      { nm: '电力', cs: [{ c: '00002', n: '中电控股', market: 'HK' }, { c: '00836', n: '华润电力', market: 'HK' }] },
      { nm: '燃气', cs: [{ c: '00384', n: '中国燃气', market: 'HK' }] },
    indices: [{ c: 'HSI', n: '恒生指数', t: 'broad' }]
  },
  {
    id: 'hk-conglom', nm: '综合企业', ic: '🏢', ev: 'low', market: 'HK', l2: [
      { nm: '综合', cs: [{ c: '00267', n: '中信股份', market: 'HK' }, { c: '00656', n: '复星国际', market: 'HK' }] },
    indices: [{ c: 'HSI', n: '恒生指数', t: 'broad' }]
  }
];

// ─── A 股行业（仅结构，无硬编码指标）───
export const INDUSTRIES: Industry[] = [
  {
    id: 'food', nm: '食品饮料', ic: '🍷', ev: 'low', bk: 'BK0438', l2: [
      { nm: '白酒', cs: [{ c: '600519', n: '贵州茅台' }, { c: '000858', n: '五粮液' }, { c: '000568', n: '泸州老窖' }, { c: '002304', n: '洋河股份' }, { c: '600809', n: '山西汾酒' }] },
      { nm: '啤酒', cs: [{ c: '600600', n: '青岛啤酒' }, { c: '600132', n: '重庆啤酒' }] },
      { nm: '乳品', cs: [{ c: '600887', n: '伊利股份' }] },
      { nm: '调味品', cs: [{ c: '603288', n: '海天味业' }] },
      { nm: '休闲食品', cs: [{ c: '002557', n: '洽洽食品' }] },
    ],
    indices: [{ c: '000932', n: '300消费', t: 'broad' }, { c: '399997', n: '中证白酒', t: 'theme' }, { c: '000815', n: '食品饮料', t: 'broad' }]
  },
  {
    id: 'pharma', nm: '医药生物', ic: '💊', ev: 'low', bk: 'BK0465', l2: [
      { nm: '化学制药', cs: [{ c: '600276', n: '恒瑞医药' }, { c: '002422', n: '科伦药业' }] },
      { nm: '中药', cs: [{ c: '000538', n: '云南白药' }, { c: '600436', n: '片仔癀' }] },
      { nm: '医疗器械', cs: [{ c: '300760', n: '迈瑞医疗' }] },
      { nm: 'CXO', cs: [{ c: '603259', n: '药明康德' }] },
      { nm: '生物制品', cs: [{ c: '300122', n: '智飞生物' }] },
    ],
    indices: [{ c: '000991', n: '全指医药', t: 'broad' }, { c: '000978', n: '医药100', t: 'broad' }, { c: '000933', n: '300医药', t: 'broad' }, { c: '399989', n: '中证医疗', t: 'theme' }, { c: '931152', n: '创新药', t: 'theme' }, { c: '930011', n: '中证中药', t: 'theme' }]
  },
  {
    id: 'bank', nm: '银行', ic: '🏦', ev: 'high', bk: 'BK0475', l2: [
      { nm: '国有大行', cs: [{ c: '601398', n: '工商银行' }, { c: '601939', n: '建设银行' }, { c: '601288', n: '农业银行' }] },
      { nm: '股份行', cs: [{ c: '600036', n: '招商银行' }, { c: '601166', n: '兴业银行' }] },
      { nm: '城商行', cs: [{ c: '002142', n: '宁波银行' }] },
    ],
    indices: [{ c: '000931', n: '300银行', t: 'broad' }, { c: '399986', n: '中证银行', t: 'broad' }]
  },
  {
    id: 'fin', nm: '非银金融', ic: '📈', ev: 'low', bk: 'BK0473', l2: [
      { nm: '证券', cs: [{ c: '600030', n: '中信证券' }, { c: '601688', n: '华泰证券' }] },
      { nm: '保险', cs: [{ c: '601318', n: '中国平安' }, { c: '601628', n: '中国人寿' }] },,
    indices: [{ c: '399975', n: '证券公司', t: 'theme' }]
  },
  {
    id: 're', nm: '房地产', ic: '🏠', ev: 'low', bk: 'BK0451', l2: [
      { nm: '开发', cs: [{ c: '600048', n: '保利发展' }, { c: '000002', n: '万科A' }] },
    indices: [{ c: '399393', n: '国证地产', t: 'broad' }]
  },
  {
    id: 'auto', nm: '汽车', ic: '🚗', ev: 'mid', bk: 'BK0481', l2: [
      { nm: '整车', cs: [{ c: '002594', n: '比亚迪' }, { c: '601633', n: '长城汽车' }, { c: '600104', n: '上汽集团' }] },
      { nm: '零部件', cs: [{ c: '002050', n: '三花智控' }, { c: '600741', n: '华域汽车' }] },,
    indices: [{ c: '399996', n: '300可选', t: 'broad' }, { c: '930606', n: '新能源车', t: 'theme' }]
  },
  {
    id: 'elec', nm: '电子', ic: '💻', ev: 'high', bk: 'BK0447', l2: [
      { nm: '半导体', cs: [{ c: '688981', n: '中芯国际' }, { c: '002371', n: '北方华创' }, { c: '603501', n: '韦尔股份' }] },
      { nm: '消费电子', cs: [{ c: '002475', n: '立讯精密' }] },
      { nm: 'PCB', cs: [{ c: '002463', n: '沪电股份' }] },
    ],
    indices: [{ c: '931865', n: '半导体', t: 'theme' }, { c: '931000', n: '中证芯片', t: 'theme' }, { c: '000046', n: '中证电子', t: 'broad' }]
  },
  {
    id: 'comp', nm: '计算机', ic: '🖥️', ev: 'high', bk: 'BK0448', l2: [
      { nm: '软件', cs: [{ c: '002415', n: '海康威视' }, { c: '002230', n: '科大讯飞' }] },
      { nm: 'IT服务', cs: [{ c: '603019', n: '中科曙光' }, { c: '000977', n: '浪潮信息' }] },
    ],
    indices: [{ c: '000047', n: '中证全指计算机', t: 'broad' }, { c: '930902', n: '中证大数据', t: 'theme' }]
  },
  {
    id: 'tele', nm: '通信', ic: '📡', ev: 'mid', bk: 'BK0449', l2: [
      { nm: '光模块', cs: [{ c: '300308', n: '中际旭创' }, { c: '300502', n: '新易盛' }] },
      { nm: '通信设备', cs: [{ c: '000063', n: '中兴通讯' }] },
      { nm: '运营商', cs: [{ c: '600941', n: '中国移动' }] },
    ],
    indices: [{ c: '000045', n: '中证全指通信', t: 'broad' }, { c: '931079', n: '中证5G通信', t: 'theme' }]
  },
  {
    id: 'media', nm: '传媒', ic: '🎬', ev: 'high', bk: 'BK0480', l2: [
      { nm: '游戏', cs: [{ c: '002555', n: '三七互娱' }] },
      { nm: '数字媒体', cs: [{ c: '300413', n: '芒果超媒' }] },
    ],
    indices: [{ c: '399971', n: '中证传媒', t: 'broad' }, { c: '930901', n: '中证动漫游戏', t: 'theme' }]
  },
  {
    id: 'equip', nm: '电力设备', ic: '⚡', ev: 'mid', bk: 'BK0428', l2: [
      { nm: '逆变器', cs: [{ c: '300274', n: '阳光电源' }] },
      { nm: '锂电池', cs: [{ c: '300750', n: '宁德时代' }, { c: '002594', n: '亿纬锂能' }] },
      { nm: '光伏', cs: [{ c: '601012', n: '隆基绿能' }] },
      { nm: '风电', cs: [{ c: '601016', n: '金风科技' }] },
    ],
    indices: [{ c: '399808', n: '中证新能', t: 'broad' }, { c: '931151', n: '光伏产业', t: 'theme' }, { c: '930606', n: '新能源车', t: 'theme' }]
  },
  {
    id: 'coal', nm: '煤炭', ic: '⛏️', ev: 'high', bk: 'BK0437', l2: [
      { nm: '煤炭开采', cs: [{ c: '601088', n: '中国神华' }, { c: '600188', n: '兖矿能源' }] },
    indices: [{ c: '399998', n: '中证煤炭', t: 'broad' }]
  },
  {
    id: 'oil', nm: '石油石化', ic: '🛢️', ev: 'mid', bk: 'BK0464', l2: [
      { nm: '油气', cs: [{ c: '601857', n: '中国石油' }, { c: '600028', n: '中国石化' }] },
    indices: [{ c: '000042', n: '中证全指能源', t: 'broad' }]
  },
  {
    id: 'chem', nm: '化工', ic: '🧪', ev: 'mid', bk: 'BK0462', l2: [
      { nm: '化学制品', cs: [{ c: '600309', n: '万华化学' }, { c: '002601', n: '龙佰集团' }] },
    indices: [{ c: '000043', n: '中证全指化工', t: 'broad' }]
  },
  {
    id: 'steel', nm: '钢铁', ic: '🔩', ev: 'mid', bk: 'BK0478', l2: [
      { nm: '普钢', cs: [{ c: '600019', n: '宝钢股份' }, { c: '000932', n: '华菱钢铁' }] },
    indices: [{ c: '000043', n: '中证全指材料', t: 'broad' }]
  },
  {
    id: 'metal', nm: '有色金属', ic: '🥇', ev: 'mid', bk: 'BK0479', l2: [
      { nm: '工业金属', cs: [{ c: '601899', n: '紫金矿业' }, { c: '603993', n: '洛阳钼业' }] },
      { nm: '贵金属', cs: [{ c: '600547', n: '山东黄金' }] },
      { nm: '能源金属', cs: [{ c: '002460', n: '赣锋锂业' }] },,
    indices: [{ c: '000043', n: '中证全指材料', t: 'broad' }]
  },
  {
    id: 'build', nm: '建筑装饰', ic: '🏗️', ev: 'mid', bk: 'BK0424', l2: [
      { nm: '基建', cs: [{ c: '601668', n: '中国建筑' }, { c: '601186', n: '中国铁建' }] },
    indices: [{ c: '000043', n: '中证全指材料', t: 'broad' }]
  },
  {
    id: 'bmat', nm: '建筑材料', ic: '🧱', ev: 'low', bk: 'BK0425', l2: [
      { nm: '水泥', cs: [{ c: '600585', n: '海螺水泥' }] },
    indices: [{ c: '000043', n: '中证全指材料', t: 'broad' }]
  },
  {
    id: 'appl', nm: '家用电器', ic: '📺', ev: 'mid', bk: 'BK0456', l2: [
      { nm: '白电', cs: [{ c: '000333', n: '美的集团' }, { c: '000651', n: '格力电器' }, { c: '600690', n: '海尔智家' }] }
    ],
    indices: [{ c: '399996', n: '中证家电', t: 'broad' }]
  },
  {
    id: 'text', nm: '纺织服饰', ic: '👔', ev: 'low', bk: 'BK0436', l2: [
      { nm: '服装', cs: [{ c: '600398', n: '海澜之家' }] },
    indices: [{ c: '000043', n: '中证全指材料', t: 'broad' }]
  },
  {
    id: 'trans', nm: '交通运输', ic: '🚢', ev: 'mid', bk: 'BK0429', l2: [
      { nm: '航运', cs: [{ c: '601919', n: '中远海控' }] },
      { nm: '快递', cs: [{ c: '002352', n: '顺丰控股' }] }
    ],
    indices: [{ c: '000044', n: '中证全指交运', t: 'broad' }]
  },
  {
    id: 'util', nm: '公用事业', ic: '💡', ev: 'mid', bk: 'BK0427', l2: [
      { nm: '电力', cs: [{ c: '600900', n: '长江电力' }, { c: '600886', n: '国投电力' }] }
    ],
    indices: [{ c: '000041', n: '中证全指公用', t: 'broad' }]
  },
  {
    id: 'agri', nm: '农林牧渔', ic: '🌾', ev: 'mid', bk: 'BK0433', l2: [
      { nm: '养殖', cs: [{ c: '002714', n: '牧原股份' }, { c: '300498', n: '温氏股份' }] }
    ],
    indices: [{ c: '000040', n: '中证全指农牧', t: 'broad' }]
  },
  {
    id: 'mil', nm: '国防军工', ic: '🛡️', ev: 'high', bk: 'BK0459', l2: [
      { nm: '航空装备', cs: [{ c: '600760', n: '中航沈飞' }, { c: '600893', n: '航发动力' }] }
    ],
    indices: [{ c: '399967', n: '中证军工', t: 'broad' }]
  },
  {
    id: 'beauty', nm: '美容护理', ic: '💄', ev: 'mid', bk: 'BK0440', l2: [
      { nm: '化妆品', cs: [{ c: '603605', n: '珀莱雅' }] },
    indices: [{ c: '000043', n: '中证全指材料', t: 'broad' }]
  },
  {
    id: 'social', nm: '社会服务', ic: '🍽️', ev: 'mid', bk: 'BK0450', l2: [
      { nm: '酒店', cs: [{ c: '600258', n: '首旅酒店' }] },
    indices: [{ c: '000043', n: '中证全指消费', t: 'broad' }]
  },
  {
    id: 'light', nm: '轻工制造', ic: '📦', ev: 'low', bk: 'BK0453', l2: [
      { nm: '家居', cs: [{ c: '603816', n: '顾家家居' }, { c: '002572', n: '索菲亚' }] },
    indices: [{ c: '000043', n: '中证全指材料', t: 'broad' }]
  },
  {
    id: 'env', nm: '环保', ic: '🌿', ev: 'high', bk: 'BK0426', l2: [
      { nm: '治理', cs: [{ c: '300070', n: '碧水源' }] },
    indices: [{ c: '000827', n: '中证环保', t: 'broad' }]
  },
  {
    id: 'retail', nm: '商贸零售', ic: '🛒', ev: 'mid', bk: 'BK0454', l2: [
      { nm: '百货', cs: [{ c: '600859', n: '王府井' }] },
    indices: [{ c: '000043', n: '中证全指消费', t: 'broad' }]
  },
  {
    id: 'machinery', nm: '机械设备', ic: '⚙️', ev: 'mid', bk: 'BK0452', l2: [
      { nm: '工程机械', cs: [{ c: '600031', n: '三一重工' }, { c: '000422', n: '湖北宜化' }] },
      { nm: '液压', cs: [{ c: '601100', n: '恒立液压' }] },
    indices: [{ c: '000043', n: '中证全指工业', t: 'broad' }]
  },
  {
    id: 'comp2', nm: '综合', ic: '🔷', ev: 'mid', bk: 'BK0471', l2: []
  },
];
