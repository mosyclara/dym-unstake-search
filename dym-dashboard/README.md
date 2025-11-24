# Dymension 批量查询面板

React + Tailwind + Shadcn/UI 构建的 DYM 批量查询和操作面板。

## 功能特性

- ✅ 批量输入地址（支持 EVM 和 Dymension 地址）
- ✅ 查询 DYM 余额、质押情况、奖励
- ✅ 可视化数据展示
- ✅ 接入 Keplr / Leap / OKX Wallet
- ✅ 批量领取奖励
- ✅ 批量解除质押

## 安装依赖

如果遇到 npm 权限问题，可以尝试：

```bash
# 方法 1: 使用 yarn
yarn install

# 方法 2: 修复 npm 权限（需要管理员权限）
sudo chown -R $(whoami) ~/.npm

# 然后重新安装
npm install
```

## 运行开发服务器

```bash
npm run dev
```

应用将在 http://localhost:3000 启动

## 使用说明

1. **连接钱包**：点击连接 Keplr/Leap/OKX 钱包
2. **输入地址**：在文本框中批量输入地址（每行一个）
3. **查询**：点击查询按钮获取所有地址的信息
4. **批量操作**：连接钱包后可以使用批量领取奖励和批量解除质押功能

## 技术栈

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Shadcn/UI
- TanStack Query
- CosmJS (Cosmos SDK)
- Keplr/Leap/OKX Wallet

## 项目结构

```
src/
├── components/     # React 组件
│   └── ui/        # Shadcn UI 组件
├── services/      # API 和钱包服务
├── types/         # TypeScript 类型定义
├── utils/         # 工具函数
└── App.tsx        # 主应用组件
```

