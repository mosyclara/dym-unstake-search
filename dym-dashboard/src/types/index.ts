export interface AddressInfo {
  address: string
  evmAddress?: string
  balance: string
  totalStaked: string
  totalRewards: string
  delegations: Delegation[]
  rewards: Reward[]
  unbonding: Unbonding[]
}

export interface Delegation {
  validatorAddress: string
  validatorName: string
  amount: string
}

export interface Reward {
  validatorAddress: string
  validatorName: string
  amount: string
}

export interface Unbonding {
  validatorAddress: string
  validatorName: string
  amount: string
  completionTime: string
}

export interface WalletInfo {
  address: string
  name: string
  isConnected: boolean
}

export type WalletType = 'keplr' | 'leap' | 'okx' | null

