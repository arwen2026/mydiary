# MyDiary · 个人生活记录 PWA

> 旅行 / 单日外出 / 生活随笔 三合一记录小工具，纯前端 + 本地 IndexedDB，**数据不上云**。

## 在线访问

部署后访问：https://arwen2026.github.io/mydiary/app/

## 特性

- 📖 三类记录：多日行程 / 单日外出 / 生活随笔
- 📷 图文混排，照片本地压缩存储（thumb ≤ 1200px）
- 📅 时间轴 + 阅读态双形态
- 🌍 足迹汇总 / 花费统计 / 评价回顾
- 💾 一键 JSON 导入导出，便于跨设备迁移
- 📱 PWA 离线可用，可加到主屏

## 技术栈

- 纯原生 HTML / CSS / JS（无构建工具）
- IndexedDB 本地存储
- Service Worker 离线缓存
- 配色系统（米白 + 深绿 + 黄绿 + 杏色）

## 本地开发

```bash
cd app
python -m http.server 5176
# 浏览器打开 http://localhost:5176
```

## 隐私声明

所有照片和文字数据**只存在本设备的浏览器 IndexedDB 中**，从不上传任何服务器。仓库代码 Public，但不包含任何用户数据。
