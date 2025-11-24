# Dymension 自动操作完整指南

## 功能概述

`dymension_actions.py` 提供了完整的自动化功能，支持：
- ✅ 自动领取奖励
- ✅ 自动全部解质押
- ✅ 自动签名和广播交易
- ✅ 试运行模式（安全预览）
- ✅ CLI 命令生成（备用方案）

## 安装依赖

### 基础功能（查询和生成 CLI 命令）
```bash
pip install requests bech32
```

### 完整自动化（自动签名和广播）
```bash
pip install cosmpy mnemonic
```

## 使用方法

### 1. 试运行模式（推荐先使用）

预览操作，不实际执行：

```bash
# 预览领取奖励操作
python dymension_actions.py claim <地址> --dry-run

# 预览解质押操作
python dymension_actions.py undelegate <地址> --dry-run

# 预览自动操作
python dymension_actions.py auto <地址> --dry-run
```

### 2. 生成 CLI 命令（手动执行）

生成命令后手动执行：

```bash
# 生成领取奖励的命令
python dymension_actions.py claim <地址> --generate-cli

# 生成解质押的命令
python dymension_actions.py undelegate <地址> --generate-cli
```

### 3. 完整自动化（自动执行）

#### 使用私钥

```bash
# 自动领取奖励
python dymension_actions.py claim <地址> --private-key <私钥>

# 自动解质押
python dymension_actions.py undelegate <地址> --private-key <私钥>

# 自动执行：领取奖励 + 全部解质押
python dymension_actions.py auto <地址> --private-key <私钥>
```

#### 使用助记词

```bash
# 自动领取奖励
python dymension_actions.py claim <地址> --mnemonic "<助记词>"

# 自动解质押
python dymension_actions.py undelegate <地址> --mnemonic "<助记词>"
```

## 完整示例

### 示例 1: 试运行预览

```bash
python dymension_actions.py auto 0xbfca2883a2e2847e0d97f4be63e58404d748bffb --dry-run
```

输出：
```
🔍 [试运行模式]
🔍 查询地址的奖励信息...
✔ 可领取奖励: 4.65 DYM
✔ 需要从 1 个验证者领取奖励

🔍 [试运行模式] 将执行以下操作:
  1. 从验证者 xxx 领取奖励
  2. 从验证者 xxx 解质押 58 DYM

⚠️  这是试运行，不会实际发送交易
```

### 示例 2: 生成 CLI 命令

```bash
python dymension_actions.py claim 0xbfca2883a2e2847e0d97f4be63e58404d748bffb --generate-cli
```

输出：
```
📝 生成 CLI 命令:

领取奖励命令:
  dymd tx distribution withdraw-all-rewards --from <your-key-name> \
    --chain-id dymension_1100-1 --gas auto --gas-adjustment 1.5 -y
```

### 示例 3: 完整自动化

```bash
# 使用私钥自动执行
python dymension_actions.py auto 0xbfca2883a2e2847e0d97f4be63e58404d748bffb \
  --private-key "your_private_key_hex"
```

输出：
```
🔍 查询地址的奖励信息...
✔ 可领取奖励: 4.65 DYM
✔ 需要从 1 个验证者领取奖励

📝 构建交易...
⛽ 估算 Gas...
✍️  签名交易...
📡 广播交易...

✅ 交易已广播!
   交易哈希: ABC123...
   区块高度: 12345

🔍 查询地址的质押信息...
✔ 当前有 1 个验证者的质押

📝 构建交易...
  解质押 58 DYM 从 xxx...
  ✅ 交易哈希: DEF456...

✅ 成功解质押 1/1 个验证者
⚠️  解质押后需要等待解锁期（通常 21 天）
```

## 安全提示

### ⚠️ 重要安全注意事项

1. **私钥安全**
   - 永远不要将私钥或助记词分享给任何人
   - 不要在公共场合输入私钥
   - 考虑使用环境变量存储私钥：
     ```bash
     export PRIVATE_KEY="your_private_key"
     python dymension_actions.py claim <地址> --private-key "$PRIVATE_KEY"
     ```

2. **测试建议**
   - 先在测试网测试
   - 使用 `--dry-run` 预览操作
   - 小额测试后再大额操作

3. **Gas 费用**
   - 确保账户有足够的余额支付 Gas
   - 每次交易都会消耗 Gas

4. **解质押周期**
   - 解质押后需要等待解锁期（通常 21 天）
   - 在此期间资金无法转移

## 故障排除

### 问题 1: cosmopy 未安装

**错误信息**：
```
❌ cosmopy 库未安装，无法执行实际交易
```

**解决方案**：
```bash
pip install cosmpy mnemonic
```

### 问题 2: 地址不匹配

**错误信息**：
```
⚠️  警告: 钱包地址 (xxx) 与查询地址 (yyy) 不匹配
```

**解决方案**：
- 确认私钥/助记词对应的地址正确
- 检查地址转换是否正确

### 问题 3: Gas 不足

**错误信息**：
```
❌ 交易失败: insufficient funds
```

**解决方案**：
- 确保账户有足够的余额
- 检查 Gas 价格设置

## 高级用法

### 批量操作

可以编写脚本批量处理多个地址：

```python
#!/usr/bin/env python3
import subprocess

addresses = [
    "0xaddress1...",
    "0xaddress2...",
    "0xaddress3...",
]

private_key = "your_private_key"

for address in addresses:
    subprocess.run([
        "python3", "dymension_actions.py", "auto", address,
        "--private-key", private_key
    ])
```

### 使用环境变量

```bash
# 设置环境变量
export DYM_PRIVATE_KEY="your_private_key_hex"

# 在脚本中使用
python dymension_actions.py claim <地址> --private-key "$DYM_PRIVATE_KEY"
```

## 支持

如有问题，请检查：
1. 依赖是否正确安装
2. 网络连接是否正常
3. 地址格式是否正确
4. 私钥/助记词是否正确

