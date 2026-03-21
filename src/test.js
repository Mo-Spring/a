const https = require('https');
https.get('https://push2.eastmoney.com/api/qt/ulist.np/get?secids=1.600519,0.000858,116.00700&fields=f12,f14,f2,f3,f9,f23,f116,f162,f167,f173', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(data));
});
