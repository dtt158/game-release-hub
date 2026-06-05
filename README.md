# 游戏发售日历

一个部署到 GitHub Pages 的中文游戏发售信息整合站点。它按平台和月份浏览游戏发售日期，并通过 GitHub Actions 每日自动更新静态数据。

## 本地运行

```bash
npm install
npm run fetch:data
npm run dev
```

## GitHub Pages 部署

1. 在仓库 Settings -> Secrets and variables -> Actions 中添加可选密钥：
   - `IGDB_CLIENT_ID`
   - `IGDB_CLIENT_SECRET`
   - `RAWG_API_KEY`
2. 在 Settings -> Pages 中选择 GitHub Actions 作为发布来源。
3. workflow 会每日运行，也可在 Actions 页面手动触发。

没有密钥时，采集脚本会生成内置样例数据并标记为降级模式。
