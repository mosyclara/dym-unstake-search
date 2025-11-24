#!/usr/bin/env python3
"""
Dymension 链自动操作脚本
支持自动领取奖励和全部解质押
需要私钥或助记词来签名交易
"""

import requests
import json
import sys
import os
from decimal import Decimal
from typing import Dict, List, Optional
import base64
import hashlib
import hmac

# 尝试导入 cosmopy，如果没有则提示安装
try:
    from cosmpy.aerial.client import LedgerClient, NetworkConfig
    from cosmpy.aerial.wallet import LocalWallet
    from cosmpy.aerial.tx import Transaction
    from cosmpy.crypto.keypairs import PrivateKey
    from cosmpy.protos.cosmos.tx.v1beta1.tx_pb2 import Tx
    from cosmpy.protos.cosmos.distribution.v1beta1.tx_pb2 import MsgWithdrawDelegatorReward
    from cosmpy.protos.cosmos.staking.v1beta1.tx_pb2 import MsgUndelegate
    from cosmpy.protos.cosmos.base.v1beta1.coin_pb2 import Coin
    from cosmpy.aerial.faucet import FaucetApi
    COSMPY_AVAILABLE = True
except ImportError:
    COSMPY_AVAILABLE = False
    # 不在导入时打印警告，只在需要时提示

# 导入查询功能
from dymension_query import (
    LCD_URL, RPC_URL, ADYM_TO_DYM, format_amount,
    get_account_balance, get_delegations, get_rewards,
    normalize_address, query_address_info
)

# Dymension 网络配置（仅在 cosmopy 可用时创建）
DYMENSION_NETWORK_CONFIG = None
if COSMPY_AVAILABLE:
    try:
        DYMENSION_NETWORK_CONFIG = NetworkConfig(
            chain_id="dymension_1100-1",
            url=f"grpc+https://{LCD_URL.replace('https://', '').replace('http://', '')}",
            fee_minimum_gas_price=1000000000,  # 1 adym (10^9)
            fee_denomination="adym",
            staking_denomination="adym",
        )
    except Exception:
        DYMENSION_NETWORK_CONFIG = None


def create_wallet_from_private_key(private_key_hex: str):
    """
    从私钥创建钱包
    
    Args:
        private_key_hex: 十六进制私钥字符串
    
    Returns:
        LocalWallet 对象
    """
    if not COSMPY_AVAILABLE:
        return None
    
    try:
        # 移除 0x 前缀（如果有）
        if private_key_hex.startswith('0x'):
            private_key_hex = private_key_hex[2:]
        
        # 转换为字节
        private_key_bytes = bytes.fromhex(private_key_hex)
        
        # 创建私钥对象
        private_key = PrivateKey(private_key_bytes)
        
        # 创建钱包
        wallet = LocalWallet(private_key)
        
        return wallet
    except Exception as e:
        print(f"❌ 创建钱包失败: {e}")
        return None


def create_wallet_from_mnemonic(mnemonic: str):
    """
    从助记词创建钱包
    
    Args:
        mnemonic: 助记词字符串
    
    Returns:
        LocalWallet 对象
    """
    if not COSMPY_AVAILABLE:
        return None
    
    try:
        from cosmpy.crypto.keypairs import PrivateKey
        from mnemonic import Mnemonic
        
        # 使用 mnemonic 库生成种子
        mnemo = Mnemonic("english")
        seed = mnemo.to_seed(mnemonic)
        
        # 从种子生成私钥（简化版本，实际应该使用 BIP44）
        # 这里使用前 32 字节作为私钥（仅用于演示，生产环境应使用正确的派生路径）
        private_key_bytes = seed[:32]
        private_key = PrivateKey(private_key_bytes)
        wallet = LocalWallet(private_key)
        
        return wallet
    except ImportError:
        print("❌ 需要安装 mnemonic 库: pip install mnemonic")
        return None
    except Exception as e:
        print(f"❌ 从助记词创建钱包失败: {e}")
        return None


def get_account_info(address: str) -> Dict:
    """获取账户信息（账户编号和序列号）"""
    try:
        url = f'{LCD_URL}/cosmos/auth/v1beta1/accounts/{address}'
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        account = data.get('account', {})
        account_number = account.get('account_number', '0')
        sequence = account.get('sequence', '0')
        
        return {
            'account_number': account_number,
            'sequence': sequence,
            'account': account
        }
    except Exception as e:
        print(f"❌ 获取账户信息失败: {e}")
        return {'account_number': '0', 'sequence': '0', 'account': {}}


def build_claim_rewards_tx(address: str, validator_addresses: List[str]) -> Dict:
    """
    构建领取奖励的交易
    
    Args:
        address: 委托人地址
        validator_addresses: 验证者地址列表（空列表表示领取所有验证者的奖励）
    
    Returns:
        交易数据字典
    """
    if not validator_addresses:
        # 如果未指定验证者，领取所有验证者的奖励
        rewards_info = get_rewards(address)
        validator_addresses = [
            reward['validator_address'] 
            for reward in rewards_info.get('rewards_by_validator', [])
        ]
    
    # 构建消息
    messages = []
    for validator_addr in validator_addresses:
        message = {
            "@type": "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
            "delegator_address": address,
            "validator_address": validator_addr
        }
        messages.append(message)
    
    return {
        "body": {
            "messages": messages,
            "memo": "",
            "timeout_height": "0"
        }
    }


def build_undelegate_tx(address: str, validator_address: str, amount: str) -> Dict:
    """
    构建解质押交易
    
    Args:
        address: 委托人地址
        validator_address: 验证者地址
        amount: 解质押数量（adym 单位）
    
    Returns:
        交易数据字典
    """
    message = {
        "@type": "/cosmos.staking.v1beta1.MsgUndelegate",
        "delegator_address": address,
        "validator_address": validator_address,
        "amount": {
            "denom": "adym",
            "amount": str(int(Decimal(amount)))
        }
    }
    
    return {
        "body": {
            "messages": [message],
            "memo": "",
            "timeout_height": "0"
        }
    }


def generate_cli_commands(address: str) -> Dict[str, List[str]]:
    """
    生成用于领取奖励和解质押的 CLI 命令
    
    Args:
        address: Dymension 地址
    
    Returns:
        包含 CLI 命令的字典
    """
    commands = {
        'claim_rewards': [],
        'undelegate': []
    }
    
    # 查询奖励信息
    rewards_info = get_rewards(address)
    rewards_by_validator = rewards_info.get('rewards_by_validator', [])
    
    if rewards_by_validator:
        # 生成领取奖励的命令
        validator_addrs = [r['validator_address'] for r in rewards_by_validator]
        for validator_addr in validator_addrs:
            cmd = f"dymd tx distribution withdraw-rewards {validator_addr} --from <your-key-name> --chain-id dymension_1100-1 --gas auto --gas-adjustment 1.5 -y"
            commands['claim_rewards'].append(cmd)
        
        # 或者一次性领取所有奖励
        all_validators = ' '.join(validator_addrs)
        cmd_all = f"dymd tx distribution withdraw-all-rewards --from <your-key-name> --chain-id dymension_1100-1 --gas auto --gas-adjustment 1.5 -y"
        commands['claim_rewards'].append(f"# 或者一次性领取所有奖励:\n{cmd_all}")
    
    # 查询质押信息
    delegations = get_delegations(address)
    for delegation in delegations:
        validator_addr = delegation['delegation']['validator_address']
        amount = delegation['balance']['amount']
        amount_dym = Decimal(amount) / ADYM_TO_DYM
        
        # 格式化金额（去掉小数点，使用整数）
        amount_int = int(amount_dym)
        cmd = f"dymd tx staking unbond {validator_addr} {amount_int}adym --from <your-key-name> --chain-id dymension_1100-1 --gas auto --gas-adjustment 1.5 -y"
        commands['undelegate'].append(cmd)
    
    return commands


def auto_claim_rewards(address: str, private_key: str = None, mnemonic: str = None, 
                      dry_run: bool = False, generate_cli: bool = False) -> bool:
    """
    自动领取所有奖励
    
    Args:
        address: Dymension 地址
        private_key: 私钥（十六进制字符串）
        mnemonic: 助记词（可选，如果提供私钥则忽略）
        dry_run: 是否为试运行（不实际发送交易）
        generate_cli: 是否生成 CLI 命令
    
    Returns:
        是否成功
    """
    if not COSMPY_AVAILABLE and not generate_cli and not dry_run:
        print("❌ cosmopy 库未安装，无法执行实际交易")
        print("   请运行: pip install cosmpy")
        print("   或使用 --generate-cli 生成 CLI 命令")
        return False
    
    try:
        # 查询奖励信息
        print(f"\n🔍 查询地址 {address} 的奖励信息...")
        rewards_info = get_rewards(address)
        total_rewards = Decimal(rewards_info['total'])
        
        if total_rewards == 0:
            print("✔ 当前无可领取奖励")
            return True
        
        print(f"✔ 可领取奖励: {format_amount(str(total_rewards))}")
        
        rewards_by_validator = rewards_info.get('rewards_by_validator', [])
        if not rewards_by_validator:
            print("✔ 没有需要领取的奖励")
            return True
        
        validator_addresses = [r['validator_address'] for r in rewards_by_validator]
        print(f"✔ 需要从 {len(validator_addresses)} 个验证者领取奖励")
        
        if dry_run:
            print("\n🔍 [试运行模式] 将执行以下操作:")
            for i, validator_addr in enumerate(validator_addresses, 1):
                print(f"  {i}. 从验证者 {validator_addr} 领取奖励")
            print("\n⚠️  这是试运行，不会实际发送交易")
            return True
        
        if generate_cli:
            print("\n📝 生成 CLI 命令:")
            commands = generate_cli_commands(address)
            if commands['claim_rewards']:
                print("\n领取奖励命令:")
                for cmd in commands['claim_rewards']:
                    print(f"  {cmd}")
            return True
        
        # 完整自动化：签名和广播交易
        if not private_key and not mnemonic:
            print("\n❌ 需要提供私钥或助记词来签名交易")
            print("   使用方法:")
            print("   python dymension_actions.py claim <地址> --private-key <私钥>")
            print("   或")
            print("   python dymension_actions.py claim <地址> --mnemonic <助记词>")
            return False
        
        # 创建钱包
        if private_key:
            wallet = create_wallet_from_private_key(private_key)
        else:
            wallet = create_wallet_from_mnemonic(mnemonic)
        
        if not wallet:
            print("❌ 无法创建钱包")
            return False
        
        # 验证地址匹配
        wallet_address = str(wallet.address())
        if wallet_address != address:
            print(f"⚠️  警告: 钱包地址 ({wallet_address}) 与查询地址 ({address}) 不匹配")
            response = input("是否继续? (yes/no): ")
            if response.lower() != 'yes':
                return False
        
        # 创建客户端
        try:
            client = LedgerClient(DYMENSION_NETWORK_CONFIG)
        except Exception as e:
            print(f"❌ 创建客户端失败: {e}")
            print("   尝试使用 REST API 方式...")
            return claim_rewards_via_rest(address, wallet, validator_addresses)
        
        # 构建并发送交易
        try:
            print(f"\n📝 构建交易...")
            
            # 为每个验证者创建领取奖励消息
            messages = []
            for validator_addr in validator_addresses:
                msg = MsgWithdrawDelegatorReward(
                    delegator_address=address,
                    validator_address=validator_addr
                )
                messages.append(msg)
            
            # 创建交易
            tx = Transaction()
            for msg in messages:
                tx.add_message(msg)
            
            # 估算 gas
            print("⛽ 估算 Gas...")
            gas_limit = tx.estimate_gas(client, wallet)
            tx.gas_limit = gas_limit
            
            # 签名交易
            print("✍️  签名交易...")
            tx = wallet.sign_transaction(tx, DYMENSION_NETWORK_CONFIG)
            
            # 广播交易
            print("📡 广播交易...")
            result = client.broadcast_transaction(tx)
            
            print(f"\n✅ 交易已广播!")
            print(f"   交易哈希: {result.tx_hash}")
            print(f"   区块高度: {result.height}")
            
            return True
            
        except Exception as e:
            print(f"❌ 交易失败: {e}")
            import traceback
            traceback.print_exc()
            return False
        
    except Exception as e:
        print(f"❌ 领取奖励失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def auto_undelegate_all(address: str, private_key: str = None, mnemonic: str = None,
                       dry_run: bool = False, generate_cli: bool = False) -> bool:
    """
    自动解质押所有代币
    
    Args:
        address: Dymension 地址
        private_key: 私钥（十六进制字符串）
        mnemonic: 助记词（可选，如果提供私钥则忽略）
        dry_run: 是否为试运行（不实际发送交易）
        generate_cli: 是否生成 CLI 命令
    
    Returns:
        是否成功
    """
    if not COSMPY_AVAILABLE and not generate_cli and not dry_run:
        print("❌ cosmopy 库未安装，无法执行实际交易")
        print("   请运行: pip install cosmpy")
        print("   或使用 --generate-cli 生成 CLI 命令")
        return False
    
    try:
        # 查询质押信息
        print(f"\n🔍 查询地址 {address} 的质押信息...")
        delegations = get_delegations(address)
        
        if not delegations:
            print("✔ 当前无质押")
            return True
        
        print(f"✔ 当前有 {len(delegations)} 个验证者的质押")
        
        total_staked = Decimal('0')
        undelegate_list = []
        
        for delegation in delegations:
            validator_addr = delegation['delegation']['validator_address']
            amount = delegation['balance']['amount']
            total_staked += Decimal(amount)
            
            undelegate_list.append({
                'validator_address': validator_addr,
                'amount': amount
            })
            
            print(f"  - {validator_addr}: {format_amount(amount)}")
        
        print(f"\n✔ 总质押数量: {format_amount(str(total_staked))}")
        
        if dry_run:
            print("\n🔍 [试运行模式] 将执行以下操作:")
            for i, item in enumerate(undelegate_list, 1):
                print(f"  {i}. 从验证者 {item['validator_address']} 解质押 {format_amount(item['amount'])}")
            print("\n⚠️  这是试运行，不会实际发送交易")
            print("⚠️  解质押后需要等待解锁期（通常 21 天）")
            return True
        
        if generate_cli:
            print("\n📝 生成 CLI 命令:")
            commands = generate_cli_commands(address)
            if commands['undelegate']:
                print("\n解质押命令:")
                for cmd in commands['undelegate']:
                    print(f"  {cmd}")
            return True
        
        # 完整自动化：签名和广播交易
        if not private_key and not mnemonic:
            print("\n❌ 需要提供私钥或助记词来签名交易")
            print("   使用方法:")
            print("   python dymension_actions.py undelegate <地址> --private-key <私钥>")
            print("   或")
            print("   python dymension_actions.py undelegate <地址> --mnemonic <助记词>")
            return False
        
        # 创建钱包
        if private_key:
            wallet = create_wallet_from_private_key(private_key)
        else:
            wallet = create_wallet_from_mnemonic(mnemonic)
        
        if not wallet:
            print("❌ 无法创建钱包")
            return False
        
        # 验证地址匹配
        wallet_address = str(wallet.address())
        if wallet_address != address:
            print(f"⚠️  警告: 钱包地址 ({wallet_address}) 与查询地址 ({address}) 不匹配")
            response = input("是否继续? (yes/no): ")
            if response.lower() != 'yes':
                return False
        
        # 创建客户端
        try:
            client = LedgerClient(DYMENSION_NETWORK_CONFIG)
        except Exception as e:
            print(f"❌ 创建客户端失败: {e}")
            print("   尝试使用 REST API 方式...")
            return undelegate_via_rest(address, wallet, undelegate_list)
        
        # 构建并发送交易
        try:
            print(f"\n📝 构建交易...")
            
            success_count = 0
            for item in undelegate_list:
                validator_addr = item['validator_address']
                amount = item['amount']
                amount_int = int(Decimal(amount))
                
                print(f"\n  解质押 {format_amount(amount)} 从 {validator_addr}...")
                
                # 创建解质押消息
                coin = Coin(denom="adym", amount=str(amount_int))
                msg = MsgUndelegate(
                    delegator_address=address,
                    validator_address=validator_addr,
                    amount=coin
                )
                
                # 创建交易
                tx = Transaction()
                tx.add_message(msg)
                
                # 估算 gas
                gas_limit = tx.estimate_gas(client, wallet)
                tx.gas_limit = gas_limit
                
                # 签名交易
                tx = wallet.sign_transaction(tx, DYMENSION_NETWORK_CONFIG)
                
                # 广播交易
                result = client.broadcast_transaction(tx)
                
                print(f"  ✅ 交易哈希: {result.tx_hash}")
                success_count += 1
            
            print(f"\n✅ 成功解质押 {success_count}/{len(undelegate_list)} 个验证者")
            print("⚠️  解质押后需要等待解锁期（通常 21 天）")
            
            return success_count == len(undelegate_list)
            
        except Exception as e:
            print(f"❌ 交易失败: {e}")
            import traceback
            traceback.print_exc()
            return False
        
    except Exception as e:
        print(f"❌ 解质押失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def claim_rewards_via_rest(address: str, wallet, validator_addresses: List[str]) -> bool:
    """
    使用 REST API 方式领取奖励（备用方案）
    """
    print("⚠️  使用 REST API 方式（功能待完善）")
    return False


def undelegate_via_rest(address: str, wallet, undelegate_list: List[Dict]) -> bool:
    """
    使用 REST API 方式解质押（备用方案）
    """
    print("⚠️  使用 REST API 方式（功能待完善）")
    return False


def main():
    """主函数"""
    if len(sys.argv) < 3:
        print("使用方法:")
        print("  领取奖励:")
        print("    python dymension_actions.py claim <地址> [选项]")
        print("  全部解质押:")
        print("    python dymension_actions.py undelegate <地址> [选项]")
        print("  查询并操作:")
        print("    python dymension_actions.py auto <地址> [选项]")
        print("\n选项:")
        print("  --private-key <私钥>    : 使用私钥签名交易（十六进制格式）")
        print("  --mnemonic <助记词>     : 使用助记词签名交易")
        print("  --dry-run               : 试运行模式，不实际发送交易")
        print("  --generate-cli          : 生成 CLI 命令供手动执行")
        print("\n示例:")
        print("  # 生成 CLI 命令")
        print("  python dymension_actions.py claim <地址> --generate-cli")
        print("  # 自动执行（需要私钥）")
        print("  python dymension_actions.py claim <地址> --private-key <私钥>")
        print("  # 试运行")
        print("  python dymension_actions.py claim <地址> --dry-run")
        print("\n⚠️  安全提示:")
        print("  - 私钥和助记词请妥善保管，不要泄露")
        print("  - 建议先在测试网测试")
        print("  - 使用 --dry-run 预览操作")
        sys.exit(1)
    
    action = sys.argv[1].lower()
    address_input = sys.argv[2]
    dry_run = '--dry-run' in sys.argv or '-d' in sys.argv
    generate_cli = '--generate-cli' in sys.argv or '--cli' in sys.argv
    
    # 解析私钥或助记词
    private_key = None
    mnemonic = None
    
    if '--private-key' in sys.argv:
        idx = sys.argv.index('--private-key')
        if idx + 1 < len(sys.argv):
            private_key = sys.argv[idx + 1]
        else:
            print("❌ --private-key 需要指定私钥")
            sys.exit(1)
    
    if '--mnemonic' in sys.argv:
        idx = sys.argv.index('--mnemonic')
        if idx + 1 < len(sys.argv):
            mnemonic = sys.argv[idx + 1]
        else:
            print("❌ --mnemonic 需要指定助记词")
            sys.exit(1)
    
    # 标准化地址
    address, address_type = normalize_address(address_input)
    
    if address_type == 'EVM':
        print(f"输入地址 (EVM): {address_input}")
        print(f"转换后地址: {address}")
    else:
        print(f"地址: {address}")
    
    if dry_run:
        print("\n🔍 [试运行模式]")
    
    if action == 'claim':
        auto_claim_rewards(address, private_key=private_key, mnemonic=mnemonic, 
                          dry_run=dry_run, generate_cli=generate_cli)
    elif action == 'undelegate':
        auto_undelegate_all(address, private_key=private_key, mnemonic=mnemonic,
                           dry_run=dry_run, generate_cli=generate_cli)
    elif action == 'auto':
        print("\n" + "=" * 70)
        print("自动操作: 领取奖励 + 全部解质押")
        print("=" * 70)
        auto_claim_rewards(address, private_key=private_key, mnemonic=mnemonic,
                          dry_run=dry_run, generate_cli=generate_cli)
        print()
        auto_undelegate_all(address, private_key=private_key, mnemonic=mnemonic,
                           dry_run=dry_run, generate_cli=generate_cli)
    else:
        print(f"❌ 未知操作: {action}")
        print("   支持的操作: claim, undelegate, auto")
        sys.exit(1)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ 用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

