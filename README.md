# Cart Milestone

> **产品迁移**：本模块已归入独立产品 [Conversion Pulse](https://github.com/Alohamonde/conversion-pulse)（`apps/cart-milestone`）。本仓库保留作历史源码。

购物车里程碑 Shopify App：**免运费进度条**、**阶梯订单折扣**、**智能凑单推荐**。基于 Remix + Theme App Extension + Shopify Functions，与 Omni Store Toolkit（购前店面）、Gift Auto（购中赠品）、Checkout Pulse（购后追加销售）形成完整转化漏斗。

![Shopify](https://img.shields.io/badge/Shopify-App-7AB55C?logo=shopify&logoColor=white)
![Remix](https://img.shields.io/badge/Remix-000?logo=remix&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)

## 功能

| 模块 | 说明 |
|------|------|
| **免运费进度条** | Theme Extension 在购物车页 / 抽屉实时展示距免运费的进度 |
| **阶梯订单折扣** | Discount Function 在小计达到门槛时自动应用最高档订单百分比折扣 |
| **智能凑单** | 距下一阶梯还差少量金额时，推荐系列商品帮助顾客凑单 |
| **转化分析** | 追踪进度条曝光、阶梯达标与凑单点击 |

## 与现有项目的差异化

| 项目 | 场景 | 核心技术 |
|------|------|----------|
| Omni Store Toolkit | 购前店面 | Theme Extension、App Proxy、批量编辑 |
| Gift Auto | 购中赠品 | Theme Extension、赠品 Discount Function |
| Checkout Pulse | 购后 Checkout | Checkout UI Extension、Discount Function |
| **Cart Milestone** | **购物车凑单** | **Theme Extension、订单 Discount Function、App Proxy** |

## 吸取的经验

- **Gift Auto**：监听 `/cart/*` 请求 + 防抖对账，兼容 Dawn 抽屉与 Ajax 购物车主题
- **Omni Store Toolkit**：App Proxy 下发配置 + 事件上报，Theme Extension 零后端依赖展示
- **Checkout Pulse**：Shop Metafield 同步规则 + Discount Function 自动折扣 + Polaris 后台 CRUD

## 技术栈

- Remix + React + TypeScript
- Shopify Polaris + App Bridge
- Prisma + SQLite（开发）
- Theme App Extension（进度条 + 全局 Embed）
- Shopify Discount Function（订单阶梯折扣）
- Shop Metafields（`$app:cart_milestone`）+ App Proxy

## 快速开始

### 环境要求

- Node.js 20+
- [Shopify Partner](https://partners.shopify.com) 账号
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)

### 安装运行

```bash
cd cart-milestone
cp .env.example .env
npm install
npm run setup
npm run dev
```

### 店面启用

1. 主题编辑器 **App embeds** → 启用 **Cart Milestone Embed**
2. 或在购物车页添加 **Cart Milestone Bar** 区块
3. App 后台配置免运费门槛与阶梯规则

## 项目结构

```text
app/routes/
  app._index.tsx                    # 总览 + KPI
  app.milestones.tsx                # 阶梯规则 CRUD
  app.settings.tsx                  # 进度条与凑单设置
  apps.cart-milestone.config.tsx    # App Proxy 配置
extensions/
  cart-milestone-bar/               # Theme App Extension
  milestone-discount/               # Discount Function
```

## License

MIT
