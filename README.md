# Dymension 链质押信息查询脚本

一个可直接运行的 Python 脚本，用于自动查询 Dymension 链上的质押信息。

## 功能特性

✔ 当前质押（delegations）  
✔ 解绑中（unbonding）  
✔ 可领取奖励（rewards）  
✔ 可用余额  
✔ 质押总数  
✔ 所有验证者信息  
✔ 是否存在历史赎回未领取  
✔ **支持 EVM 地址自动转换为 Dymension 地址**  
✔ **批量查询多个地址**  
✔ **自动生成 Markdown 格式报告**  

## 安装依赖

```bash
pip install -r requirements.txt
```

## 使用方法

### 单个地址查询

```bash
python dymension_query.py <地址>
```

脚本支持两种地址格式：

#### 1. Dymension Bech32 地址
```bash
python dymension_query.py dym1xxxxx...
```

#### 2. EVM 地址（自动转换）
```bash
# 带 0x 前缀
python dymension_query.py 0x1234567890abcdef1234567890abcdef12345678

# 不带 0x 前缀
python dymension_query.py 1234567890abcdef1234567890abcdef12345678
```

### 批量查询

#### 从文件读取地址列表
```bash
python dymension_query.py --file addresses.txt --output report.md
```

**地址文件格式说明**：

- **每行一个地址**，支持以下格式：
  - EVM 地址：`0x1234567890123456789012345678901234567890`（带 0x 前缀）
  - EVM 地址：`1234567890123456789012345678901234567890`（不带 0x 前缀）
  - Dymension Bech32 地址：`dym1xxxxx...`
- **支持注释**：以 `#` 开头的行会被忽略
- **忽略空行**：空行会被自动跳过
- **自动去空格**：地址前后的空格会自动去除
- **可混合使用**：可以在同一个文件中混合使用不同格式的地址

**地址文件示例** (`addresses.txt`):
```
# Dymension 地址列表
# 这是注释行，会被忽略

# EVM 地址（带 0x 前缀）
0xbfca2883a2e2847e0d97f4be63e58404d748bffb

# EVM 地址（不带 0x 前缀）
bfca2883a2e2847e0d97f4be63e58404d748bffb

# Dymension Bech32 地址
dym1hl9z3qazu2z8urvh7jlx8evyqnt530lmdthms9

# 可以混合使用不同格式
0x1234567890123456789012345678901234567890
dym1xxxxx...
```

#### 命令行多个地址
```bash
python dymension_query.py <地址1> <地址2> <地址3> --output report.md
```

#### 参数说明
- `--file` 或 `-f`: 从文件读取地址列表
- `--output` 或 `-o`: 指定报告输出文件（可选，默认自动生成）
- `--quiet` 或 `-q`: 静默模式，不显示详细查询过程

脚本会自动识别 EVM 地址并转换为 Dymension Bech32 地址进行查询。

## 输出信息

### 单个地址查询
脚本会显示以下信息：

1. **可用余额** - 账户中可用的 DYM 代币
2. **当前质押** - 所有验证者的质押详情和总质押数
3. **解绑中** - 正在解绑的代币数量和完成时间
4. **可领取奖励** - 各验证者的奖励详情和总奖励
5. **验证者信息** - 所有验证者的列表和状态
6. **历史赎回** - 检查是否存在未完成的赎回记录
7. **汇总信息** - 总资产估值

### 批量查询报告

批量查询会自动生成 Markdown 格式的报告，包含：

- **汇总统计表** - 所有地址的总体情况
- **详细地址信息** - 每个地址的完整质押详情
  - 基本信息（余额、质押、奖励等）
  - 质押详情表格
  - 解绑中信息
  - 可领取奖励列表
  - 历史赎回记录

报告文件默认命名为 `dymension_report_YYYYMMDD_HHMMSS.md`，可通过 `--output` 参数自定义。

## 注意事项

- 脚本使用公开的 RPC 端点，无需 API KEY
- 所有金额以 DYM 为单位显示（1 DYM = 1,000,000 uDYM）
- 网络请求有 10 秒超时设置
- 如果某个查询失败，脚本会继续执行其他查询
- 支持 EVM 地址（0x...）自动转换为 Dymension Bech32 地址（dym1...）

## 使用示例

### 示例 1: 查询单个地址
```bash
python dymension_query.py 0xbfca2883a2e2847e0d97f4be63e58404d748bffb
```

### 示例 2: 从文件批量查询并生成报告
```bash
# 创建地址文件 addresses.txt
echo "0xbfca2883a2e2847e0d97f4be63e58404d748bffb" > addresses.txt
echo "dym1xxxxx..." >> addresses.txt

# 批量查询并生成报告
python dymension_query.py --file addresses.txt --output my_report.md
```

### 示例 3: 命令行多个地址查询
```bash
python dymension_query.py 0x1234... 0x5678... 0x9abc... --output report.md
```

## RPC 端点

脚本使用以下公开端点：
- LCD API: `https://dymension-api.polkachu.com` (备用: `https://lcd.dymension.xyz`)
- RPC: `https://rpc.dymension.xyz`

如果端点不可用，可以修改脚本中的 `LCD_URL` 和 `RPC_URL` 变量。

## 自动操作功能

### 领取奖励和解质押

脚本 `dymension_actions.py` 提供了自动操作功能：

#### 使用方法

```bash
# 领取奖励（生成 CLI 命令）
python dymension_actions.py claim <地址> --generate-cli

# 全部解质押（生成 CLI 命令）
python dymension_actions.py undelegate <地址> --generate-cli

# 自动操作：领取奖励 + 全部解质押
python dymension_actions.py auto <地址> --generate-cli

# 试运行模式（预览操作，不实际执行）
python dymension_actions.py auto <地址> --dry-run
```

#### 参数说明

- `claim`: 领取所有验证者的奖励
- `undelegate`: 解质押所有代币
- `auto`: 自动执行领取奖励和解质押
- `--generate-cli`: 生成 CLI 命令供手动执行
- `--dry-run`: 试运行模式，只预览不执行

#### 示例

```bash
# 生成领取奖励的 CLI 命令
python dymension_actions.py claim 0xbfca2883a2e2847e0d97f4be63e58404d748bffb --generate-cli

# 输出示例：
# dymd tx distribution withdraw-all-rewards --from <your-key-name> \
#   --chain-id dymension_1100-1 --gas auto --gas-adjustment 1.5 -y
```

#### 注意事项

⚠️ **重要提示**：

1. **当前版本**：脚本会生成 CLI 命令，需要手动执行
2. **私钥安全**：如果将来实现自动签名，请妥善保管私钥
3. **解质押周期**：解质押后需要等待解锁期（通常 21 天）
4. **Gas 费用**：确保账户有足够的余额支付交易费用
5. **测试建议**：在测试网络上先测试，确认无误后再在主网执行

#### 完整自动化（自动签名和广播）

要启用完整的自动化功能（自动签名和广播交易），需要安装依赖：

```bash
pip install cosmpy mnemonic
```

然后可以使用私钥或助记词自动执行交易：

```bash
# 使用私钥自动领取奖励
python dymension_actions.py claim <地址> --private-key <私钥>

# 使用助记词自动解质押
python dymension_actions.py undelegate <地址> --mnemonic <助记词>

# 自动执行：领取奖励 + 全部解质押
python dymension_actions.py auto <地址> --private-key <私钥>
```

**安全提示**：
- ⚠️ **私钥和助记词请妥善保管，不要泄露给任何人**
- ⚠️ **建议先在测试网测试，确认无误后再在主网执行**
- ⚠️ **使用 `--dry-run` 参数可以预览操作，不实际发送交易**
- ⚠️ **确保账户有足够的余额支付 Gas 费用**

**完整自动化流程**：
1. 脚本会自动查询地址的奖励和质押信息
2. 构建相应的交易消息
3. 使用提供的私钥或助记词签名交易
4. 自动广播交易到 Dymension 网络
5. 返回交易哈希和确认信息

