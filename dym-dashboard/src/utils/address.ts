// @ts-ignore
import { bech32 } from 'bech32'

export function evmToDymAddress(evmAddress: string): string {
  try {
    // Remove 0x prefix
    const cleanAddress = evmAddress.startsWith('0x') 
      ? evmAddress.slice(2) 
      : evmAddress
    
    if (cleanAddress.length !== 40) {
      throw new Error('Invalid EVM address length')
    }
    
    // Convert hex to bytes
    const hexBytes = new Uint8Array(cleanAddress.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
    
    // Convert to bech32 - bech32 v2 API
    // @ts-ignore
    const words = bech32.toWords(hexBytes)
    // @ts-ignore  
    return bech32.encode('dym', words)
  } catch (error) {
    console.error('Error converting EVM address:', error)
    throw error
  }
}

export function normalizeAddress(address: string): { address: string; isEVM: boolean } {
  const lower = address.toLowerCase().trim()
  
  if (lower.startsWith('dym1')) {
    return { address: lower, isEVM: false }
  }
  
  if (lower.startsWith('0x') || lower.length === 40) {
    const cleanAddress = lower.startsWith('0x') ? lower : `0x${lower}`
    return { address: evmToDymAddress(cleanAddress), isEVM: true }
  }
  
  throw new Error('Invalid address format')
}

