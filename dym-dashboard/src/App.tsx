import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Textarea } from './components/ui/textarea'
import { fetchAddressInfo } from './services/api'
import { connectWallet, claimRewards, undelegateAll } from './services/wallet'
import type { WalletInfo } from './types'
import { normalizeAddress } from './utils/address'
import { Wallet, Search, TrendingUp, Coins, Loader2 } from 'lucide-react'
import type { AddressInfo } from './types'

function App() {
  console.log('App component rendering...')
  
  const [addresses, setAddresses] = useState<string>('')
  const [addressList, setAddressList] = useState<string[]>([])
  const [wallet, setWallet] = useState<WalletInfo | null>(null)
  const [walletType, setWalletType] = useState<string | null>(null)

  const handleAddressInput = (value: string) => {
    setAddresses(value)
    const lines = value.split('\n').filter(line => line.trim())
    setAddressList(lines)
  }

  const { data: addressInfos, isLoading, refetch } = useQuery({
    queryKey: ['addressInfos', addressList],
    queryFn: async () => {
      if (addressList.length === 0) return []
      
      const results = await Promise.all(
        addressList.map(async (addr) => {
          try {
            const normalized = normalizeAddress(addr)
            const info = await fetchAddressInfo(normalized.address)
            return { ...info, evmAddress: normalized.isEVM ? addr : undefined }
          } catch (error: any) {
            console.error(`Error fetching ${addr}:`, error)
            // Return error info instead of null to show in UI
            return {
              address: addr,
              balance: '0',
              totalStaked: '0',
              totalRewards: '0',
              delegations: [],
              rewards: [],
              unbonding: [],
              error: error.message || '查询失败',
            } as AddressInfo
          }
        })
      )
      return results as AddressInfo[]
    },
    enabled: addressList.length > 0,
  })

  const handleConnectWallet = async (type: 'keplr' | 'leap' | 'okx') => {
    try {
      const walletInfo = await connectWallet(type)
      setWallet(walletInfo)
      setWalletType(type)
    } catch (error: any) {
      // Use a more readable error display
      const errorMsg = error.message || '未知错误'
      // Replace \n with actual line breaks for better readability
      const formattedMsg = errorMsg.replace(/\\n/g, '\n')
      alert(`连接钱包失败:\n\n${formattedMsg}`)
      console.error('Wallet connection error:', error)
    }
  }

  const handleClaimRewards = async () => {
    if (!walletType || !addressInfos || !wallet) return
    
    try {
      const allValidatorAddresses = addressInfos.flatMap(info => 
        info.rewards.map(r => r.validatorAddress)
      )
      
      if (allValidatorAddresses.length === 0) {
        alert('没有可领取的奖励')
        return
      }
      
      const result = await claimRewards(walletType as any, allValidatorAddresses, wallet.address)
      alert(`奖励领取成功！\n交易哈希: ${result.txHash}`)
      refetch()
    } catch (error: any) {
      alert(`领取奖励失败: ${error.message}`)
    }
  }

  const handleUndelegateAll = async () => {
    if (!walletType || !addressInfos || !wallet) return
    
    if (!confirm('确定要解质押所有代币吗？解质押后需要等待解锁期（通常 21 天）。')) {
      return
    }
    
    try {
      const allDelegations = addressInfos.flatMap(info =>
        info.delegations.map(d => ({
          validatorAddress: d.validatorAddress,
          amount: d.amount,
        }))
      )
      
      if (allDelegations.length === 0) {
        alert('没有可解质押的代币')
        return
      }
      
      const result = await undelegateAll(walletType as any, allDelegations, wallet.address)
      alert(`解质押成功！\n交易哈希: ${result.txHashes.join('\n')}`)
      refetch()
    } catch (error: any) {
      alert(`解质押失败: ${error.message}`)
    }
  }

  const totalBalance = addressInfos?.reduce((sum, info) => sum + parseFloat(info.balance), 0) || 0
  const totalStaked = addressInfos?.reduce((sum, info) => sum + parseFloat(info.totalStaked), 0) || 0
  const totalRewards = addressInfos?.reduce((sum, info) => sum + parseFloat(info.totalRewards), 0) || 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Dymension 批量查询面板
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            批量查询 DYM 余额、质押情况和奖励
          </p>
        </div>

        {/* Wallet Connection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              钱包连接
            </CardTitle>
            <CardDescription>
              连接 Keplr、Leap 或 OKX 钱包以执行批量操作
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!wallet ? (
              <div className="flex gap-4 flex-wrap">
                <Button onClick={() => handleConnectWallet('keplr')} variant="outline">
                  <Wallet className="w-4 h-4 mr-2" />
                  连接 Keplr
                </Button>
                <Button onClick={() => handleConnectWallet('leap')} variant="outline">
                  <Wallet className="w-4 h-4 mr-2" />
                  连接 Leap
                </Button>
                <Button onClick={() => handleConnectWallet('okx')} variant="outline">
                  <Wallet className="w-4 h-4 mr-2" />
                  连接 OKX
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{wallet.name}</p>
                  <p className="text-sm text-muted-foreground">{wallet.address}</p>
                </div>
                <Button variant="outline" onClick={() => setWallet(null)}>
                  断开连接
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Address Input */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              批量输入地址
            </CardTitle>
            <CardDescription>
              每行一个地址，支持 EVM 地址（0x...）或 Dymension 地址（dym1...）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="0xbfca2883a2e2847e0d97f4be63e58404d748bffb&#10;dym1xxxxx..."
              value={addresses}
              onChange={(e) => handleAddressInput(e.target.value)}
              className="min-h-[120px] font-mono"
            />
            <div className="mt-4 flex gap-2">
              <Button onClick={() => refetch()} disabled={addressList.length === 0 || isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    查询中...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    查询
                  </>
                )}
              </Button>
              {wallet && (
                <>
                  <Button 
                    onClick={handleClaimRewards} 
                    disabled={!addressInfos || totalRewards === 0}
                    variant="default"
                  >
                    <Coins className="w-4 h-4 mr-2" />
                    批量领取奖励
                  </Button>
                  <Button 
                    onClick={handleUndelegateAll} 
                    disabled={!addressInfos || totalStaked === 0}
                    variant="destructive"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    批量解除质押
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        {addressInfos && addressInfos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>总余额</CardDescription>
                <CardTitle className="text-2xl">{totalBalance.toFixed(6)} DYM</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>总质押</CardDescription>
                <CardTitle className="text-2xl">{totalStaked.toFixed(6)} DYM</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>总奖励</CardDescription>
                <CardTitle className="text-2xl">{totalRewards.toFixed(6)} DYM</CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Address Details */}
        {isLoading && (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>正在查询地址信息...</p>
            </CardContent>
          </Card>
        )}

        {addressInfos && addressInfos.length > 0 && (
          <div className="space-y-4">
            {addressInfos.map((info, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg font-mono break-all">
                    {info.evmAddress || info.address}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">余额</p>
                      <p className="text-lg font-semibold">{info.balance} DYM</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">质押</p>
                      <p className="text-lg font-semibold">{info.totalStaked} DYM</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">奖励</p>
                      <p className="text-lg font-semibold text-green-600">{info.totalRewards} DYM</p>
                    </div>
                  </div>

                  {info.delegations.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium mb-2">质押详情</p>
                      <div className="space-y-2">
                        {info.delegations.map((d, i) => (
                          <div key={i} className="flex justify-between text-sm p-2 bg-muted rounded">
                            <span>{d.validatorName}</span>
                            <span className="font-medium">{d.amount} DYM</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {info.rewards.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">奖励详情</p>
                      <div className="space-y-2">
                        {info.rewards.map((r, i) => (
                          <div key={i} className="flex justify-between text-sm p-2 bg-green-50 dark:bg-green-900/20 rounded">
                            <span>{r.validatorName}</span>
                            <span className="font-medium text-green-600">{r.amount} DYM</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default App

