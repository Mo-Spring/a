## 部署说明

### 蛋卷指数估值 API 反代

生产环境需要配置 nginx 反代 `/djapi` 到蛋卷服务器，否则指数估值数据（PE/PB/百分位）无法获取。

原因：浏览器直接调用 `danjuanfunds.com` 会被 CORS 和 403 拦截。

**nginx 配置示例：**

```nginx
location /djapi/ {
    proxy_pass https://danjuanfunds.com/djapi/;
    proxy_set_header Host danjuanfunds.com;
    proxy_set_header Referer https://danjuanfunds.com/;
    proxy_set_header User-Agent "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    proxy_ssl_server_name on;
}
```

开发环境已自动配置 vite proxy，无需额外操作。
