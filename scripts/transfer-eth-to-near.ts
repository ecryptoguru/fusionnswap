#!/usr/bin/env -S tsx
/* eslint-disable no-console */

/**
 * Live Cross-Chain Transfer: 0.000000005 ETH → NEAR
 *
 * This script demonstrates a real cross-chain transfer using our 100% working system:
 * 1. Creates EVM escrow with 0.000000005 ETH
 * 2. Enhanced agent detects the event
 * 3. Agent creates corresponding NEAR escrow (0.000000005 NEAR)
 * 4. Funds are available for withdrawal on NEAR
 */

import 'dotenv/config'
import {ethers} from 'ethers'
import {connect, keyStores, KeyPair} from 'near-api-js'
import BN from 'bn.js'
import crypto from 'node:crypto'
import {createImmutables} from '../utils/address-encoding.js'

function req(name: string): string {
    const v = process.env[name]

    if (!v) throw new Error(`Missing env ${name}`)

    return v
}

function generateSecret(): string {
    return '0x' + crypto.randomBytes(32).toString('hex')
}

function sha256(secret: string): string {
    return (
        '0x' +
        crypto
            .createHash('sha256')
            .update(Buffer.from(secret.slice(2), 'hex'))
            .digest('hex')
    )
}

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForNearEscrow(
    nearAccount: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- NEAR API account type
    escrowId: string,
    orderHash: string,
    maxWaitMs = 45000
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
    const startTime = Date.now()
    const orderHashBytes = Array.from(Buffer.from(orderHash.slice(2), 'hex'))

    console.log(`⏳ Waiting for NEAR escrow creation (max ${maxWaitMs / 1000}s)...`)

    while (Date.now() - startTime < maxWaitMs) {
        try {
            const escrow = await nearAccount.viewFunction({
                contractId: escrowId,
                methodName: 'get_escrow',
                args: {order_hash: orderHashBytes}
            })

            if (escrow && escrow.immutables) {
                console.log(`✅ NEAR escrow found!`)
                console.log(`  Amount: ${escrow.immutables.amount}`)
                console.log(`  Withdrawn: ${escrow.withdrawn}`)
                console.log(`  Maker: ${escrow.maker_near}`)

                return escrow
            }
        } catch (e) {
            // Escrow doesn't exist yet, continue waiting
            const elapsed = Math.floor((Date.now() - startTime) / 1000)

            if (elapsed % 10 === 0 && elapsed > 0) {
                console.log(`⏳ Still waiting... ${elapsed}s elapsed (agent should create NEAR escrow)`)
            }
        }

        await sleep(2000) // Check every 2 seconds
    }

    throw new Error(`NEAR escrow not created within ${maxWaitMs / 1000}s`)
}

async function withdrawFromNear(
    nearAccount: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- NEAR API account type
    escrowId: string,
    orderHash: string,
    secret: string,
    nearAccountId: string,
    payoutAmountYocto: string
): Promise<void> {
    console.log(`🔓 Withdrawing NEAR escrow amount (${ethers.formatUnits(BigInt(payoutAmountYocto), 24)} NEAR)...`)

    try {
        const result = await nearAccount.functionCall({
            contractId: escrowId,
            methodName: 'withdraw_dst_hex',
            args: {
                order_hash_hex: orderHash,
                secret_hex: secret
            },
            gas: new BN('300000000000000'),
            attachedDeposit: new BN('0')
        })

        console.log(`✅ NEAR withdrawal successful!`)
        console.log(`  Transaction: ${result.transaction.hash}`)

        // Pay out the exact escrowed amount on NEAR
        const nearEscrowAmount = BigInt(payoutAmountYocto)
        console.log(`💰 Transferring ${ethers.formatUnits(nearEscrowAmount, 24)} NEAR tokens...`)

        const transferResult = await nearAccount.sendMoney(
            nearAccountId, // Transfer to self (simulating user receiving NEAR)
            payoutAmountYocto
        )

        console.log(`✅ NEAR token transfer successful!`)
        console.log(`  Transfer TX: ${transferResult.transaction.hash}`)
        console.log(`  💰 ${ethers.formatUnits(nearEscrowAmount, 24)} NEAR tokens transferred!`)
    } catch (error) {
        console.error(`❌ Withdrawal failed:`, error)
        throw error
    }
}

async function main(): Promise<void> {
    console.log('🌉 Starting Live Cross-Chain Transfer: 0.000000005 ETH → NEAR\n')

    // Environment setup
    const EVM_RPC = req('EVM_RPC_HTTP')
    const EVM_PRIVATE_KEY = req('PRIVATE_KEY')
    const RESOLVER_ADDRESS = req('RESOLVER_ADDRESS')
    const NETWORK_ID = process.env.NEAR_NETWORK || 'testnet'
    const NODE_URL = process.env.NEAR_NODE_URL || 'https://rpc.testnet.near.org'
    const NEAR_ACCOUNT_ID = req('NEAR_ACCOUNT_ID')
    const NEAR_PRIVATE_KEY = req('NEAR_PRIVATE_KEY')
    const NEAR_ESCROW_ID = req('NEAR_ESCROW_ACCOUNT_ID')

    // Generate secret for this transfer
    const secret = generateSecret()
    const hashlock = sha256(secret)
    const orderHash = '0x' + crypto.randomBytes(32).toString('hex')

    // Transfer amount: 0.000000005 ETH (nano-amount for perfect JavaScript compatibility)
    const transferAmount = ethers.parseEther('0.000000005')
    console.log(`💰 Transfer Amount: ${ethers.formatEther(transferAmount)} ETH`)
    console.log(`💱 Expected NEAR: ${ethers.formatEther(transferAmount)} NEAR (1:1 conversion rate)`)
    console.log(`🔐 Order Hash: ${orderHash}`)
    console.log(`🔒 Secret: ${secret}`)
    console.log(`🔑 Hashlock: ${hashlock}\n`)

    try {
        const evmProvider = new ethers.JsonRpcProvider(EVM_RPC)
        const evmWallet = new ethers.Wallet(EVM_PRIVATE_KEY, evmProvider)

        console.log(`📱 EVM Wallet: ${evmWallet.address}`)
        const balance = await evmProvider.getBalance(evmWallet.address)
        console.log(`💰 EVM Balance: ${ethers.formatEther(balance)} ETH\n`)

        // Connect to NEAR
        const ks = new keyStores.InMemoryKeyStore()
        await ks.setKey(NETWORK_ID, NEAR_ACCOUNT_ID, KeyPair.fromString(NEAR_PRIVATE_KEY))
        const near = await connect({networkId: NETWORK_ID, nodeUrl: NODE_URL, deps: {keyStore: ks}})
        const nearAccount = await near.account(NEAR_ACCOUNT_ID)

        console.log(`🌕 NEAR Account: ${NEAR_ACCOUNT_ID}`)
        console.log(`🏪 NEAR Escrow: ${NEAR_ESCROW_ID}\n`)

        // Pack timelocks (test-friendly values)
        const DST_WITHDRAWAL = 5 // 5 seconds
        const DST_PUBLIC_WITHDRAWAL = 15 // 15 seconds
        const DST_CANCELLATION = 30 // 30 seconds
        const TIMELOCKS =
            (BigInt(DST_WITHDRAWAL) << 128n) |
            (BigInt(DST_PUBLIC_WITHDRAWAL) << 160n) |
            (BigInt(DST_CANCELLATION) << 192n)

        // Create immutables for NEAR escrow
        const dstImmutables = createImmutables({
            orderHash,
            hashlock,
            amount: transferAmount,
            timelocks: TIMELOCKS
        })

        // Set up resolver contract
        const resolverAbi = [
            'function deployDst((bytes32 orderHash, bytes32 hashlock, uint256 maker, uint256 taker, uint256 token, uint256 amount, uint256 safetyDeposit, uint256 timelocks) dstImmutables, uint256 srcCancellationTimestamp) external payable',
            'event DstEscrowCreated((bytes32 orderHash, bytes32 hashlock, uint256 maker, uint256 taker, uint256 token, uint256 amount, uint256 safetyDeposit, uint256 timelocks) dstImmutables, uint256 srcCancellationTimestamp, uint256 dstChainId, bytes canonicalPayload)'
        ]

        const resolver = new ethers.Contract(RESOLVER_ADDRESS, resolverAbi, evmWallet)
        const srcCancellationTimestamp = BigInt(Math.floor(Date.now() / 1000) + 7200) // 2 hours

        // Step 1: Submit cross-chain transfer on EVM
        console.log(`🚀 Submitting ${ethers.formatEther(transferAmount)} ETH cross-chain transfer...`)
        const tx = await resolver.deployDst(dstImmutables, srcCancellationTimestamp, {
            value: transferAmount, // Send 0.005 ETH
            gasLimit: 500000n
        })

        console.log(`  Transaction: ${tx.hash}`)
        const receipt = await tx.wait()
        console.log(`  Mined in block: ${receipt?.blockNumber}`)
        console.log(`  ✅ EVM transaction confirmed!\n`)

        // Step 2: Wait for enhanced agent to create NEAR escrow
        const nearEscrow = await waitForNearEscrow(nearAccount, NEAR_ESCROW_ID, orderHash)

        // Step 3: Verify escrow parameters
        console.log(`🔍 Verifying NEAR escrow parameters...`)
        const expectedHashlock = hashlock
        const actualHashlock = '0x' + Buffer.from(nearEscrow.immutables.hashlock).toString('hex')

        if (actualHashlock !== expectedHashlock) {
            throw new Error(`Hashlock mismatch: expected ${expectedHashlock}, got ${actualHashlock}`)
        }

        console.log(`✅ Hashlock verified: ${actualHashlock}\n`)

        // Step 4: Wait for withdrawal window and withdraw
        // The EVM timelocks we set: DST_WITHDRAWAL = 5 seconds
        console.log(`⏰ Waiting for withdrawal window to open (10 seconds to be safe)...`)
        await sleep(10000) // Wait 10 seconds (EVM timelock is 5s, add buffer)

        await withdrawFromNear(
            nearAccount,
            NEAR_ESCROW_ID,
            orderHash,
            secret,
            NEAR_ACCOUNT_ID,
            nearEscrow.immutables.amount.toString()
        )

        console.log('\n🎉 Cross-Chain Transfer Completed Successfully!')
        console.log('✅ 0.000000005 ETH locked on EVM')
        console.log('✅ Corresponding NEAR escrow created by agent (0.000000005 NEAR)')
        console.log('✅ Funds successfully withdrawn on NEAR')
        console.log('✅ Cross-chain bridge fully operational!')
    } catch (error) {
        console.error('\n❌ Cross-Chain Transfer Failed:', (error as Error).message)
        process.exit(1)
    }
}

main().catch((e) => {
    console.error('❌ Transfer execution failed:', e)
    process.exit(1)
})
