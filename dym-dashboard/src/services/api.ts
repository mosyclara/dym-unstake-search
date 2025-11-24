import axios from 'axios'

const LCD_URL = 'https://dymension-api.polkachu.com'
const ADYM_TO_DYM = 1e18

export interface BalanceResponse {
  balances: Array<{ denom: string; amount: string }>
}

export interface DelegationResponse {
  delegation_responses: Array<{
    delegation: {
      validator_address: string
    }
    balance: {
      amount: string
      denom: string
    }
  }>
}

export interface RewardResponse {
  total: Array<{ denom: string; amount: string }>
  rewards: Array<{
    validator_address: string
    reward: Array<{ denom: string; amount: string }>
  }>
}

export interface ValidatorResponse {
  validator: {
    description: {
      moniker: string
    }
  }
}

function formatAmount(amount: string): string {
  const dym = Number(amount) / ADYM_TO_DYM
  return dym.toFixed(6)
}

export async function getBalance(address: string): Promise<string> {
  try {
    const response = await axios.get<BalanceResponse>(
      `${LCD_URL}/cosmos/bank/v1beta1/balances/${address}`
    )
    const adym = response.data.balances.find(b => b.denom === 'adym')
    return adym ? formatAmount(adym.amount) : '0'
  } catch (error) {
    console.error('Error fetching balance:', error)
    return '0'
  }
}

export async function getDelegations(address: string) {
  try {
    const response = await axios.get<DelegationResponse>(
      `${LCD_URL}/cosmos/staking/v1beta1/delegations/${address}`
    )
    
    const delegations = await Promise.all(
      response.data.delegation_responses.map(async (d) => {
        const validatorInfo = await getValidatorInfo(d.delegation.validator_address)
        return {
          validatorAddress: d.delegation.validator_address,
          validatorName: validatorInfo?.description?.moniker || 'Unknown',
          amount: formatAmount(d.balance.amount),
        }
      })
    )
    
    return delegations
  } catch (error) {
    console.error('Error fetching delegations:', error)
    return []
  }
}

export async function getRewards(address: string) {
  try {
    const response = await axios.get<RewardResponse>(
      `${LCD_URL}/cosmos/distribution/v1beta1/delegators/${address}/rewards`
    )
    
    const totalAdym = response.data.total.find(r => r.denom === 'adym')
    const totalRewards = totalAdym ? formatAmount(totalAdym.amount) : '0'
    
    const rewards = await Promise.all(
      response.data.rewards.map(async (r) => {
        const validatorInfo = await getValidatorInfo(r.validator_address)
        const adymReward = r.reward.find(reward => reward.denom === 'adym')
        return {
          validatorAddress: r.validator_address,
          validatorName: validatorInfo?.description?.moniker || 'Unknown',
          amount: adymReward ? formatAmount(adymReward.amount) : '0',
        }
      })
    )
    
    return { total: totalRewards, rewards }
  } catch (error) {
    console.error('Error fetching rewards:', error)
    return { total: '0', rewards: [] }
  }
}

export async function getValidatorInfo(validatorAddress: string) {
  try {
    const response = await axios.get<ValidatorResponse>(
      `${LCD_URL}/cosmos/staking/v1beta1/validators/${validatorAddress}`
    )
    return response.data.validator
  } catch (error) {
    console.error('Error fetching validator info:', error)
    return null
  }
}

export async function getUnbonding(address: string) {
  try {
    await axios.get(
      `${LCD_URL}/cosmos/staking/v1beta1/delegators/${address}/unbonding_delegations`
    )
    // Process unbonding data
    return []
  } catch (error) {
    console.error('Error fetching unbonding:', error)
    return []
  }
}

export async function fetchAddressInfo(address: string) {
  const [balance, delegations, rewards, unbonding] = await Promise.all([
    getBalance(address),
    getDelegations(address),
    getRewards(address),
    getUnbonding(address),
  ])
  
  const totalStaked = delegations.reduce((sum, d) => sum + parseFloat(d.amount), 0).toFixed(6)
  
  return {
    address,
    balance,
    totalStaked,
    totalRewards: rewards.total,
    delegations,
    rewards: rewards.rewards,
    unbonding,
  }
}

