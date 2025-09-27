/**
 * Address Encoding Utilities for Cross-Chain Contracts
 *
 * The cross-chain contracts use custom `Address` type (uint256) instead of regular address type.
 * This utility provides proper encoding/decoding functions.
 */

/**
 * Converts a regular Ethereum address to the uint256 format expected by contracts
 */
export function addressToUint256(address: string): bigint {
    // Remove 0x prefix if present and ensure lowercase
    const cleanAddress = address.toLowerCase().replace('0x', '')

    // Pad to 40 characters (20 bytes)
    const paddedAddress = cleanAddress.padStart(40, '0')

    // Convert to bigint
    return BigInt('0x' + paddedAddress)
}

/**
 * Creates a zero address in uint256 format
 */
export function zeroAddressUint256(): bigint {
    return 0n
}

/**
 * Converts a uint256 back to a regular Ethereum address
 */
export function uint256ToAddress(value: bigint): string {
    // Convert to hex and pad to 64 characters (32 bytes)
    const hex = value.toString(16).padStart(64, '0')

    // Take only the last 40 characters (20 bytes) for address
    const addressHex = hex.slice(-40)

    return '0x' + addressHex
}

/**
 * Helper to create immutables object with proper address encoding
 */
export function createImmutables(params: {
    orderHash: string
    hashlock: string
    maker?: string | bigint
    taker?: string | bigint
    token?: string | bigint
    amount: bigint
    safetyDeposit?: bigint
    timelocks?: bigint
}): {
    orderHash: string
    hashlock: string
    maker: bigint
    taker: bigint
    token: bigint
    amount: bigint
    safetyDeposit: bigint
    timelocks: bigint
} {
    return {
        orderHash: params.orderHash,
        hashlock: params.hashlock,
        maker:
            typeof params.maker === 'string' ? addressToUint256(params.maker) : (params.maker ?? zeroAddressUint256()),
        taker:
            typeof params.taker === 'string' ? addressToUint256(params.taker) : (params.taker ?? zeroAddressUint256()),
        token:
            typeof params.token === 'string' ? addressToUint256(params.token) : (params.token ?? zeroAddressUint256()),
        amount: params.amount,
        safetyDeposit: params.safetyDeposit ?? 0n,
        timelocks: params.timelocks ?? 0n
    }
}
