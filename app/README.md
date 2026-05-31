# 行程记录 · TripDiary

> 个人自用的旅行/单日行记录 Web App。手机为主，PC 兼顾。所有数据在本地，不上传任何外部服务。

## 当前版本
v0.1.0 · 步骤 1（项目骨架） · 2026-05-30

## 技术栈
- 纯 HTML / CSS / JavaScript（ES Modules）
- 无构建工具、无框架、无依赖
- IndexedDB 存元数据 + 照片缩略图
- PWA（可加桌面、可离线）

## 目录结构
```
app/
  index.html              入口 HTML 壳
  manifest.json           PWA 元数据
  service-worker.js       离线缓存
  css/
    tokens.css            设计 token（配色 / 字体 / 间距）
    base.css              reset + 全局基础
    layout.css            5 个页面通用布局（顶部栏 / tab 栏）
  js/
    main.js               入口
    db.js                 IndexedDB 封装（步骤 2）
    router.js             hash 路由
    pages/
      home.js             首页 · 行程列表（步骤 4）
      trip-detail.js      多日行详情（步骤 6）
      dayout-detail.js    单日行详情（步骤 7）
      footprints.js       足迹（步骤 9）
      stats.js            统计（步骤 10）
      reader.js           阅读态游记渲染（步骤 8）
      edit-trip.js        新建/编辑多日行
      edit-dayout.js      新建/编辑单日行
      edit-entry.js       新建/编辑条目
  icons/                  PWA 图标
```

## 设计 Token

### 配色
| Token | 值 | 用途 |
|---|---|---|
| `--c-bg` | `#FAF8F1` 米白 | 全局底色 / 阅读态背景 |
| `--c-surface` | `#FFFFFF` 白 | 卡片内层 / 内文 |
| `--c-primary` | `#5E8F4A` 深绿 | 主操作 / 链接 / 时间轴圆点 |
| `--c-accent` | `#D4E25C` 柠檬黄绿 | 当前选中 / 关键徽章 / 强调 |
| `--c-warm` | `#E8C285` 杏色 | "进行中"状态 / 星级 / 温度 |
| `--c-text-1` | `#2A2E1F` 墨绿黑 | 正文 |
| `--c-text-2` | `#8B897D` 暖灰 | 次要信息 |
| `--c-border` | `#E5E2D5` | 卡片边 / 分隔线 |

### 字体
- 全无衬线，系统字体栈优先：`-apple-system, "PingFang SC", "Microsoft YaHei", "Source Han Sans SC", sans-serif`
- 字号阶梯：10 / 11 / 12 / 13 / 14 / 16 / 18 / 22 / 26 px
- 字重：400 / 500

### 间距 & 圆角
- 圆角：6 / 8 / 12 / 14 / 999px
- 内边距：12 / 14 / 16 / 18 / 24px

## 数据模型（步骤 2 落地）
```
trip {
  id, type:'trip', title, coverPhotoId,
  intro,                  // 前言（阅读态封面）
  review, rating,         // 评价（阅读态尾页）
  startDate, endDate,
  country, province[], city[],
  status: 'planning'|'ongoing'|'done',
  createdAt, updatedAt
}

entry {
  id, tripId, datetime,
  category: '景点'|'美食'|'住宿'|'交通'|'购物',
  title, location, note,
  photos: [{id, thumbBlob, originalName, takenAt}],
  cost
}

dayout {
  id, type:'dayout', title, coverPhotoId,
  date, country, province, city,
  subtype: '爬山'|'骑行'|'逛展'|'聚餐'|'散步'|'其他',
  rating, note,
  photos: [...], cost,
  createdAt, updatedAt
}

photo {
  id, blob(thumbnail ~30KB),
  originalName, takenAt, addedAt
}
```

## 路由
- `#/` → 首页（行程列表）
- `#/trip/:id` → 多日行详情（记录态时间轴）
- `#/trip/:id?mode=read` → 多日行详情（阅读态游记）
- `#/dayout/:id` → 单日行详情
- `#/footprints` → 足迹
- `#/stats` → 统计
- `#/me` → 我的
- `#/edit/trip/:id?` → 新建/编辑多日行
- `#/edit/dayout/:id?` → 新建/编辑单日行
- `#/edit/entry/:tripId/:id?` → 新建/编辑条目

## 开发约定
- 模块用原生 ES Module（`<script type="module">`）
- 所有页面通过 `js/router.js` 渲染到 `#app`
- DOM 用纯 `document.createElement` + helper，不引模板引擎
- 缩略图最大边 600px，jpeg quality 0.7（≈30-60KB/张）

## 部署
- 双击 `index.html`（file:// 协议）即可使用
- 手机用：手机本地 / Edge / Chrome 打开 → 「添加到主屏幕」
- 真正 PWA 安装需要 https 或 localhost；file:// 下 service worker 不工作，但 IndexedDB 正常
