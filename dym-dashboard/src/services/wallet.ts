import { WalletType } from '../types'
import { SigningStargateClient } from '@cosmjs/stargate'
// @ts-ignore
import { MsgWithdrawDelegatorReward } from 'cosmjs-types/cosmos/distribution/v1beta1/tx'
// @ts-ignore
import { MsgUndelegate } from 'cosmjs-types/cosmos/staking/v1beta1/tx'

export interface WalletInfo {
  address: string
  name: string
  isConnected: boolean
}

declare global {
  interface Window {
    keplr?: any
    leap?: any
    okxwallet?: {
      keplr?: any
    }
  }
}

// RPC 返回的实际 Chain ID 是 dymension_1100-1（从日志确认）
const DYMENSION_CHAIN_ID = 'dymension_1100-1'
// 使用能正常工作的 RPC 端点（dymension-rpc.publicnode.com 已验证可用）
const DYMENSION_RPC = 'https://dymension-rpc.publicnode.com'
const DYMENSION_REST = 'https://dymension-api.polkachu.com'

// Alternative RPC endpoints
const ALTERNATIVE_RPCS = [
  'https://dymension-evm.blockpi.network/v1/rpc/public',
  'https://dymension-mainnet-tendermint.public.blastapi.io',
  'https://dymension-rpc.publicnode.com',
]

const DYMENSION_CHAIN_INFO = {
  chainId: DYMENSION_CHAIN_ID,
  chainName: 'Dymension',
  rpc: DYMENSION_RPC,
  rest: DYMENSION_REST,
  bip44: {
    coinType: 118,
  },
  bech32Config: {
    bech32PrefixAccAddr: 'dym',
    bech32PrefixAccPub: 'dympub',
    bech32PrefixValAddr: 'dymvaloper',
    bech32PrefixValPub: 'dymvaloperpub',
    bech32PrefixConsAddr: 'dymvalcons',
    bech32PrefixConsPub: 'dymvalconspub',
  },
  currencies: [
    {
      coinDenom: 'DYM',
      coinMinimalDenom: 'adym',
      coinDecimals: 18,
      coinGeckoId: 'dymension',
    },
  ],
  feeCurrencies: [
    {
      coinDenom: 'DYM',
      coinMinimalDenom: 'adym',
      coinDecimals: 18,
      coinGeckoId: 'dymension',
      gasPriceStep: {
        low: 0.01,
        average: 0.025,
        high: 0.04,
      },
    },
  ],
  stakeCurrency: {
    coinDenom: 'DYM',
    coinMinimalDenom: 'adym',
    coinDecimals: 18,
    coinGeckoId: 'dymension',
  },
  features: ['ibc-transfer', 'ibc-go'],
  explorerUrlToTx: 'https://dym.fyi/tx/{txHash}',
}

// Helper function to check if chain is registered
async function isChainRegistered(keplr: any, chainId: string): Promise<boolean> {
  try {
    // Try to get key for the chain - this is the most reliable way to check
    if (keplr.getKey) {
      await keplr.getKey(chainId)
      return true
    }
  } catch (e: any) {
    // If getKey fails, try checking chainInfos
    try {
      if (keplr.getChainInfosWithoutEndpoints) {
        const chainInfo = await keplr.getChainInfosWithoutEndpoints()
        return chainInfo.some((chain: any) => chain.chainId === chainId)
      }
    } catch (e2) {
      return false
    }
  }
  return false
}

export async function connectKeplr(): Promise<WalletInfo | null> {
  if (!window.keplr) {
    throw new Error('Keplr wallet not found. Please install Keplr extension.')
  }
  
  try {
    // Check if chain is already registered
    let chainRegistered = await isChainRegistered(window.keplr, DYMENSION_CHAIN_ID)
    
    // Register chain if not already registered
    if (!chainRegistered) {
      console.log('Registering Dymension chain info...')
      
      try {
        // Try experimentalSuggestChain first (newer API)
        if (window.keplr.experimentalSuggestChain) {
          await window.keplr.experimentalSuggestChain(DYMENSION_CHAIN_INFO as any)
          console.log('Chain suggested via experimentalSuggestChain')
        } else if (window.keplr.suggestChain) {
          // Fallback to suggestChain
          await window.keplr.suggestChain(DYMENSION_CHAIN_INFO as any)
          console.log('Chain suggested via suggestChain')
        } else {
          throw new Error('Keplr does not support suggestChain API')
        }
        
        // Wait and verify chain is registered (with retries)
        let retries = 5
        while (retries > 0 && !chainRegistered) {
          await new Promise(resolve => setTimeout(resolve, 500))
          chainRegistered = await isChainRegistered(window.keplr, DYMENSION_CHAIN_ID)
          retries--
        }
        
        if (!chainRegistered) {
          throw new Error('链信息注册后验证失败。请确保在钱包弹窗中点击了"Approve"或"允许"按钮。')
        }
        
        console.log('Chain successfully registered and verified')
      } catch (suggestError: any) {
        console.error('Failed to suggest chain:', suggestError)
        throw new Error(`无法注册 Dymension 链信息。请确保在钱包弹窗中点击了"Approve"或"允许"按钮。如果问题持续，请手动在 Keplr 钱包中添加链信息。错误: ${suggestError.message || suggestError}`)
      }
    } else {
      console.log('Chain already registered')
    }
    
    // Now enable the chain
    await window.keplr.enable(DYMENSION_CHAIN_ID)
    const offlineSigner = window.keplr.getOfflineSigner(DYMENSION_CHAIN_ID)
    const accounts = await offlineSigner.getAccounts()
    
    return {
      address: accounts[0].address,
      name: 'Keplr',
      isConnected: true,
    }
  } catch (error: any) {
    console.error('Error connecting to Keplr:', error)
    // Provide more helpful error message
    if (error.message && error.message.includes('no chain info')) {
      throw new Error('链信息未找到。请确保在钱包弹窗中点击了"Approve"或"允许"按钮来添加 Dymension 链。如果问题持续，请手动在 Keplr 钱包设置中添加链信息。')
    }
    throw error
  }
}

export async function connectLeap(): Promise<WalletInfo | null> {
  if (!window.leap) {
    throw new Error('Leap wallet not found. Please install Leap extension.')
  }
  
  try {
    // Check if chain is already registered
    let chainRegistered = false
    try {
      if (window.leap.getKey) {
        await window.leap.getKey(DYMENSION_CHAIN_ID)
        chainRegistered = true
      }
    } catch (e) {
      chainRegistered = false
    }
    
    // Register chain if not already registered
    if (!chainRegistered) {
      console.log('Registering Dymension chain info in Leap...')
      
      try {
        if (window.leap.experimentalSuggestChain) {
          await window.leap.experimentalSuggestChain(DYMENSION_CHAIN_INFO as any)
        } else if (window.leap.suggestChain) {
          await window.leap.suggestChain(DYMENSION_CHAIN_INFO as any)
        } else {
          throw new Error('Leap does not support suggestChain API')
        }
        
        // Wait and verify chain is registered (with retries)
        let retries = 5
        while (retries > 0 && !chainRegistered) {
          await new Promise(resolve => setTimeout(resolve, 500))
          try {
            if (window.leap.getKey) {
              await window.leap.getKey(DYMENSION_CHAIN_ID)
              chainRegistered = true
            }
          } catch (e) {
            // Continue retrying
          }
          retries--
        }
        
        if (!chainRegistered) {
          throw new Error('链信息注册后验证失败。请确保在钱包弹窗中点击了"Approve"或"允许"按钮。')
        }
        
        console.log('Chain successfully registered and verified')
      } catch (suggestError: any) {
        console.error('Failed to suggest chain:', suggestError)
        throw new Error(`无法注册 Dymension 链信息。请确保在钱包弹窗中点击了"Approve"或"允许"按钮。如果问题持续，请手动在 Leap 钱包中添加链信息。错误: ${suggestError.message || suggestError}`)
      }
    }
    
    await window.leap.enable(DYMENSION_CHAIN_ID)
    const offlineSigner = window.leap.getOfflineSigner(DYMENSION_CHAIN_ID)
    const accounts = await offlineSigner.getAccounts()
    
    return {
      address: accounts[0].address,
      name: 'Leap',
      isConnected: true,
    }
  } catch (error: any) {
    console.error('Error connecting to Leap:', error)
    if (error.message && error.message.includes('no chain info')) {
      throw new Error('链信息未找到。请确保在钱包弹窗中点击了"Approve"或"允许"按钮来添加 Dymension 链。如果问题持续，请手动在 Leap 钱包设置中添加链信息。')
    }
    throw error
  }
}

// Helper function to try enabling with a specific chain ID
async function tryEnableChain(keplr: any, chainId: string): Promise<{ success: boolean; accounts?: any[] }> {
  try {
    await keplr.enable(chainId)
    const offlineSigner = keplr.getOfflineSigner(chainId)
    const accounts = await offlineSigner.getAccounts()
    return { success: true, accounts }
  } catch (e: any) {
    return { success: false }
  }
}

// Helper function to check RPC chain ID
async function checkRPCChainId(rpcUrl: string): Promise<string | null> {
  try {
    // Try Cosmos/Tendermint RPC
    const response = await fetch(`${rpcUrl}/status`)
    if (response.ok) {
      const data = await response.json()
      const chainId = data?.result?.node_info?.network || data?.result?.node_info?.network
      if (chainId) {
        console.log(`RPC ${rpcUrl} 返回的 Chain ID (Tendermint):`, chainId)
        return chainId
      }
    }
  } catch (e) {
    // Try EVM/JSON-RPC
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: 1,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        const chainIdHex = data?.result
        if (chainIdHex) {
          const chainIdDecimal = parseInt(chainIdHex, 16).toString()
          console.log(`RPC ${rpcUrl} 返回的 Chain ID (EVM):`, chainIdHex, `(${chainIdDecimal} 十进制)`)
          return chainIdDecimal
        }
      }
    } catch (e2) {
      console.log(`无法从 ${rpcUrl} 获取 Chain ID:`, e2)
    }
  }
  return null
}

export async function connectOKX(): Promise<WalletInfo | null> {
  if (!window.okxwallet?.keplr) {
    throw new Error('OKX wallet not found. Please install OKX extension.')
  }
  
  const keplr = window.okxwallet.keplr
  
  try {
    // First, check what Chain ID the RPC returns
    console.log('=== 检查 RPC 返回的 Chain ID ===')
    const rpcChainId = await checkRPCChainId(DYMENSION_RPC)
    if (rpcChainId) {
      console.log(`✅ RPC 返回的 Chain ID: ${rpcChainId}`)
      console.log(`当前使用的 Chain ID: ${DYMENSION_CHAIN_ID}`)
      if (rpcChainId !== DYMENSION_CHAIN_ID && rpcChainId !== 'dymension_1100-1') {
        console.warn(`⚠️ Chain ID 不匹配！RPC 返回: ${rpcChainId}, 我们使用: ${DYMENSION_CHAIN_ID}`)
      }
    } else {
      console.log('⚠️ 无法从 RPC 获取 Chain ID')
    }
    
    // Try alternative RPCs
    for (const altRpc of ALTERNATIVE_RPCS) {
      const altChainId = await checkRPCChainId(altRpc)
      if (altChainId) {
        console.log(`备用 RPC ${altRpc} 返回的 Chain ID: ${altChainId}`)
      }
    }
    // First, try to register chain info if not already registered
    // RPC 返回的实际 Chain ID 是 dymension_1100-1，使用这个注册
    console.log('=== Attempting to register Dymension chain in OKX ===')
    console.log('使用 Chain ID: dymension_1100-1 (RPC 返回的实际值)')
    
    try {
      if (keplr.experimentalSuggestChain) {
        console.log('Using experimentalSuggestChain to register chain...')
        await keplr.experimentalSuggestChain(DYMENSION_CHAIN_INFO as any)
        console.log('Chain info registered, waiting 5 seconds for registration to complete...')
        await new Promise(resolve => setTimeout(resolve, 5000)) // 增加等待时间
      } else if (keplr.suggestChain) {
        console.log('Using suggestChain to register chain...')
        await keplr.suggestChain(DYMENSION_CHAIN_INFO as any)
        console.log('Chain info registered, waiting 5 seconds for registration to complete...')
        await new Promise(resolve => setTimeout(resolve, 5000))
      } else {
        console.log('⚠️ OKX wallet does not support suggestChain API')
      }
    } catch (suggestError: any) {
      console.warn('Could not suggest chain (may already be registered):', suggestError.message || suggestError)
      // Continue anyway - chain might already be registered
    }
    
    // First, try to inspect what's actually in OKX wallet
    console.log('=== Inspecting OKX wallet ===')
    console.log('OKX keplr object:', keplr)
    console.log('Available methods:', Object.keys(keplr))
    
    // Try to get all available chains (if method exists)
    try {
      if (keplr.getChainInfosWithoutEndpoints) {
        const allChains = await keplr.getChainInfosWithoutEndpoints()
        console.log('All chains in OKX:', allChains)
        console.log('Chain IDs:', allChains.map((c: any) => c.chainId))
        
        // Look for Dymension-related chains
        const dymensionChains = allChains.filter((c: any) => 
          c.chainName?.toLowerCase().includes('dymension') ||
          c.chainId?.toLowerCase().includes('dymension') ||
          c.chainId === '1100' ||
          c.chainId === '0x44c'
        )
        console.log('Dymension-related chains:', dymensionChains)
        
        if (dymensionChains.length > 0) {
          // Try to use the first found Dymension chain
          const foundChainId = dymensionChains[0].chainId
          console.log(`Found Dymension chain with ID: ${foundChainId}, trying to connect...`)
          const result = await tryEnableChain(keplr, foundChainId)
          if (result.success && result.accounts) {
            console.log(`Successfully connected with found Chain ID: ${foundChainId}`)
            return {
              address: result.accounts[0].address,
              name: 'OKX',
              isConnected: true,
            }
          }
        }
      }
    } catch (e) {
      console.log('Could not get chain infos:', e)
    }
    
    // Try common Chain ID variations
    // RPC 返回的实际 Chain ID 是 dymension_1100-1，优先使用这个
    const possibleChainIds = [
      'dymension_1100-1',  // RPC 返回的实际 Chain ID（已验证）
      DYMENSION_CHAIN_ID,  // dymension_1100-1 (same as above)
      '1100',              // OKX wallet 可能使用的格式
      '0x44c',            // OKX wallet hex format (1100 in hex)
      'dymension-1100-1',  // with dash instead of underscore
      'dymension1100-1',  // without underscore
      'dymension_1100_1', // with underscore instead of dash
      'DYMENSION_1100-1',  // uppercase
    ]
    
    console.log('Trying different Chain ID variations...')
    for (const chainId of possibleChainIds) {
      console.log(`Trying Chain ID: ${chainId}`)
      try {
        const result = await tryEnableChain(keplr, chainId)
        if (result.success && result.accounts) {
          console.log(`Successfully connected with Chain ID: ${chainId}`)
          return {
            address: result.accounts[0].address,
            name: 'OKX',
            isConnected: true,
          }
        }
      } catch (e: any) {
        console.log(`Failed for ${chainId}:`, e.message || e)
      }
    }
    
    // If all variations failed, try to get the actual chain ID from OKX
    // by attempting to get key (this might reveal the actual chain ID)
    console.log('All Chain ID variations failed, trying to get key...')
    try {
      // Try to get key - this might work if chain exists but with different ID
      const key = await keplr.getKey(DYMENSION_CHAIN_ID)
      console.log('Got key, chain exists:', key)
      // If we got here, chain exists, try enable again
      await keplr.enable(DYMENSION_CHAIN_ID)
      const offlineSigner = keplr.getOfflineSigner(DYMENSION_CHAIN_ID)
      const accounts = await offlineSigner.getAccounts()
      
      return {
        address: accounts[0].address,
        name: 'OKX',
        isConnected: true,
      }
    } catch (keyError: any) {
      console.error('Could not get key:', keyError)
      
      // Last resort: try suggestChain (even though it failed before)
      // Sometimes it works on retry
      try {
        if (keplr.experimentalSuggestChain) {
          console.log('Trying experimentalSuggestChain as last resort...')
          await keplr.experimentalSuggestChain(DYMENSION_CHAIN_INFO as any)
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          const result = await tryEnableChain(keplr, DYMENSION_CHAIN_ID)
          if (result.success && result.accounts) {
            return {
              address: result.accounts[0].address,
              name: 'OKX',
              isConnected: true,
            }
          }
        }
      } catch (suggestError: any) {
        console.error('suggestChain failed:', suggestError)
      }
    }
    
    // If we get here, all attempts failed
    throw new Error(
      `无法连接到 OKX 钱包中的 Dymension 链。\n\n` +
      `已尝试的 Chain ID:\n` +
      possibleChainIds.map(id => `  - ${id}`).join('\n') +
      `\n\n请执行以下步骤：\n` +
      `1. 打开 OKX 钱包扩展\n` +
      `2. 切换到 Dymension 网络\n` +
      `3. 在 Dymension 网络设置中查看实际的 Chain ID\n` +
      `4. 如果 Chain ID 不是 "1100"，请告诉我实际的 Chain ID，我会更新代码\n` +
      `5. 或者尝试在 OKX 钱包中删除并重新添加 Dymension 链，使用以下信息：\n` +
      `   - Chain ID: 1100\n` +
      `   - RPC: https://rpc.dymension.xyz\n` +
      `   - REST: https://dymension-api.polkachu.com`
    )
  } catch (error: any) {
    console.error('Error connecting to OKX:', error)
    throw error
  }
}

export function getWalletType(): WalletType {
  if (window.keplr) return 'keplr'
  if (window.leap) return 'leap'
  if (window.okxwallet?.keplr) return 'okx'
  return null
}

export async function connectWallet(type: WalletType): Promise<WalletInfo | null> {
  switch (type) {
    case 'keplr':
      return connectKeplr()
    case 'leap':
      return connectLeap()
    case 'okx':
      return connectOKX()
    default:
      throw new Error('Unsupported wallet type')
  }
}

export async function claimRewards(
  walletType: WalletType,
  validatorAddresses: string[],
  delegatorAddress: string
) {
  if (!walletType) throw new Error('Wallet not connected')
  
  const wallet = walletType === 'keplr' ? window.keplr :
                 walletType === 'leap' ? window.leap :
                 window.okxwallet?.keplr
  
  if (!wallet) throw new Error('Wallet not found')
  
  try {
    // Ensure chain is registered
    try {
      if (wallet.experimentalSuggestChain) {
        await wallet.experimentalSuggestChain(DYMENSION_CHAIN_INFO as any)
      } else if (wallet.suggestChain) {
        await wallet.suggestChain(DYMENSION_CHAIN_INFO as any)
      }
    } catch (error: any) {
      console.warn('Could not suggest chain:', error)
      // Continue anyway - chain might already be registered
    }
    
    await wallet.enable(DYMENSION_CHAIN_ID)
    const offlineSigner = wallet.getOfflineSigner(DYMENSION_CHAIN_ID)
    const accounts = await offlineSigner.getAccounts()
    
    if (accounts[0].address !== delegatorAddress) {
      throw new Error('Wallet address does not match')
    }
    
    // Note: SigningStargateClient will get chain ID from RPC
    // The offlineSigner uses the chain ID from wallet (1100)
    // If there's a mismatch, we need to handle it
    // Check RPC Chain ID before connecting
    console.log('=== 检查 RPC Chain ID (claimRewards) ===')
    const rpcChainIdBefore = await checkRPCChainId(DYMENSION_RPC)
    if (rpcChainIdBefore) {
      console.log(`RPC 返回的 Chain ID: ${rpcChainIdBefore}`)
      console.log(`钱包使用的 Chain ID: ${DYMENSION_CHAIN_ID}`)
    }
    
    const client = await SigningStargateClient.connectWithSigner(
      DYMENSION_RPC,
      offlineSigner
    )
    
    // Verify chain ID matches
    const rpcChainId = await client.getChainId()
    console.log('✅ SigningStargateClient 从 RPC 获取的 Chain ID:', rpcChainId)
    console.log('✅ 钱包使用的 Chain ID:', DYMENSION_CHAIN_ID)
    console.log('✅ Chain ID 是否匹配:', rpcChainId === DYMENSION_CHAIN_ID || rpcChainId === 'dymension_1100-1')
    
    // If chain IDs don't match, log a warning
    if (rpcChainId !== DYMENSION_CHAIN_ID && rpcChainId !== 'dymension_1100-1') {
      console.warn(`⚠️ Chain ID 不匹配！`)
      console.warn(`   RPC 返回: ${rpcChainId}`)
      console.warn(`   钱包使用: ${DYMENSION_CHAIN_ID}`)
      console.warn(`   建议: 如果 RPC 返回 '${rpcChainId}'，请更新代码中的 Chain ID`)
    }
    
    // Build messages for each validator
    const messages = validatorAddresses.map(validatorAddress => ({
      typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
      value: MsgWithdrawDelegatorReward.fromPartial({
        delegatorAddress,
        validatorAddress,
      }),
    }))
    
    // Send transaction
    const result = await client.signAndBroadcast(
      delegatorAddress,
      messages,
      'auto',
      '批量领取奖励'
    )
    
    return { success: true, txHash: result.transactionHash }
  } catch (error: any) {
    console.error('Error claiming rewards:', error)
    throw new Error(error.message || '领取奖励失败')
  }
}

export async function undelegateAll(
  walletType: WalletType,
  delegations: Array<{ validatorAddress: string; amount: string }>,
  delegatorAddress: string
) {
  if (!walletType) throw new Error('Wallet not connected')
  
  const wallet = walletType === 'keplr' ? window.keplr :
                 walletType === 'leap' ? window.leap :
                 window.okxwallet?.keplr
  
  if (!wallet) throw new Error('Wallet not found')
  
  try {
    // Ensure chain is registered
    try {
      if (wallet.experimentalSuggestChain) {
        await wallet.experimentalSuggestChain(DYMENSION_CHAIN_INFO as any)
      } else if (wallet.suggestChain) {
        await wallet.suggestChain(DYMENSION_CHAIN_INFO as any)
      }
    } catch (error: any) {
      console.warn('Could not suggest chain:', error)
      // Continue anyway - chain might already be registered
    }
    
    await wallet.enable(DYMENSION_CHAIN_ID)
    const offlineSigner = wallet.getOfflineSigner(DYMENSION_CHAIN_ID)
    const accounts = await offlineSigner.getAccounts()
    
    if (accounts[0].address !== delegatorAddress) {
      throw new Error('Wallet address does not match')
    }
    
    // Note: SigningStargateClient will get chain ID from RPC
    // The offlineSigner uses the chain ID from wallet (1100)
    // If there's a mismatch, we need to handle it
    // Check RPC Chain ID before connecting
    console.log('=== 检查 RPC Chain ID (claimRewards) ===')
    const rpcChainIdBefore = await checkRPCChainId(DYMENSION_RPC)
    if (rpcChainIdBefore) {
      console.log(`RPC 返回的 Chain ID: ${rpcChainIdBefore}`)
      console.log(`钱包使用的 Chain ID: ${DYMENSION_CHAIN_ID}`)
    }
    
    const client = await SigningStargateClient.connectWithSigner(
      DYMENSION_RPC,
      offlineSigner
    )
    
    // Verify chain ID matches
    const rpcChainId = await client.getChainId()
    console.log('✅ SigningStargateClient 从 RPC 获取的 Chain ID:', rpcChainId)
    console.log('✅ 钱包使用的 Chain ID:', DYMENSION_CHAIN_ID)
    console.log('✅ Chain ID 是否匹配:', rpcChainId === DYMENSION_CHAIN_ID || rpcChainId === 'dymension_1100-1')
    
    // If chain IDs don't match, log a warning
    if (rpcChainId !== DYMENSION_CHAIN_ID && rpcChainId !== 'dymension_1100-1') {
      console.warn(`⚠️ Chain ID 不匹配！`)
      console.warn(`   RPC 返回: ${rpcChainId}`)
      console.warn(`   钱包使用: ${DYMENSION_CHAIN_ID}`)
      console.warn(`   建议: 如果 RPC 返回 '${rpcChainId}'，请更新代码中的 Chain ID`)
    }
    
    const txHashes: string[] = []
    
    // Send separate transaction for each delegation
    for (const delegation of delegations) {
      const amount = Math.floor(parseFloat(delegation.amount) * 1e18).toString()
      
      const message = {
        typeUrl: '/cosmos.staking.v1beta1.MsgUndelegate',
        value: MsgUndelegate.fromPartial({
          delegatorAddress,
          validatorAddress: delegation.validatorAddress,
          amount: {
            denom: 'adym',
            amount: amount,
          },
        }),
      }
      
      const result = await client.signAndBroadcast(
        delegatorAddress,
        [message],
        'auto',
        `解质押 ${delegation.amount} DYM`
      )
      
      txHashes.push(result.transactionHash)
    }
    
    return { success: true, txHashes }
  } catch (error: any) {
    console.error('Error undelegating:', error)
    throw new Error(error.message || '解质押失败')
  }
}

