# Dream Travelling

面向旅行爱好者的 Web 攻略编辑器：按天手动编排景点、餐饮、交通、住宿与备注，数据保存在浏览器本地（IndexedDB）。也可浏览多渠道旅游资讯与目的地攻略。

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
npm run preview
```

## 功能

- 新建多日行程（自动生成 Day 1…N）
- 拖拽排序条目，跨天移动
- 行程预览、导出 JSON、复制纯文本
- 行程地图：按地点查看当日或全程安排（Leaflet / OpenStreetMap）
- 首页可导入 JSON 备份
- 目的地天气：按选中行程日预报，也可查看当前实况（Open-Meteo）
- **资讯与攻略浏览**（`/explore`）：聚合多渠道内容，支持按目的地搜索与频道筛选；Wikivoyage 可应用内阅读
- 行程编辑页按目的地展示「相关攻略」

## 资讯 / 攻略渠道

| 渠道 | 类型 | 说明 |
|------|------|------|
| 中文 / 英文 Wikivoyage | 目的地攻略 | MediaWiki API，可内读（CC BY-SA） |
| 维基百科摘要 | 目的地简介 | REST Summary API |
| Google 旅游资讯 / 出行动态 | 新闻 RSS | 经开发代理或 CORS 代理拉取 |
| 马蜂窝热门 / 最新游记、自由行 | 游记 | RSSHub |
| 飞客茶馆优惠 | 优惠出行 | RSSHub |
| 走进日本、国家地理 | 资讯 | RSSHub |
| iMuseum 展览 | 资讯 | RSSHub（上海 / 北京） |
| 12306 动态、国航公告、活动行 | 出行 | RSSHub |
| Lonely Planet、Travel + Leisure | 资讯 | 公开 RSS |
| Tabiji（alerts / scams / search / countries） | 提示 / 概览 | 开放 JSON API |

开发环境下，Vite 将 `/proxy/rsshub` 与 `/proxy/google-news` 代理到对应上游。生产构建默认经 `https://corsproxy.io/?` 绕过 CORS，可用环境变量覆盖：

- `VITE_CORS_PROXY`：自定义 CORS 代理前缀（会附带目标 URL）
- `VITE_RSSHUB_BASE`：自建或镜像 RSSHub 根地址（默认 `https://rsshub.app`）

公开 RSSHub 实例可能限流或返回 403；单源失败不会影响其他渠道。建议生产环境配置自建 RSSHub。

RSS / 游记仅展示标题与摘要并外链原文；不爬取需登录或付费的闭源接口。
