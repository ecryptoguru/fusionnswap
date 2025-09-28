#!/usr/bin/env -S tsx
/* eslint-disable max-depth */
/* eslint-disable no-console */

/**
 * Check both NEAR and ETH account balances to verify transaction status
 */

import 'dotenv/config'
import {ethers} from 'ethers'
import {keyStores, connect, KeyPair} from 'near-api-js'

function req(name: string): string {
    const v = process.env[name]

    if (!v) throw new Error(`Missing env ${name}`)

    return v
}

async function checkBalances(): Promise<void> {
    console.log('🔍 Checking Account Balances')
    console.log('='.repeat(50))

    try {
        // NEAR Configuration
        const NETWORK_ID = 'testnet'
        const NODE_URL = req('NEAR_NODE_URL')
        const NEAR_ACCOUNT_ID = req('NEAR_ACCOUNT_ID')
        const NEAR_PRIVATE_KEY = req('NEAR_PRIVATE_KEY')
        const NEAR_ESCROW_ID = req('NEAR_ESCROW_ACCOUNT_ID')

        // EVM Configuration
        const EVM_RPC = req('EVM_RPC_HTTP')
        const EVM_PRIVATE_KEY = req('PRIVATE_KEY')

        // Connect to NEAR
        const ks = new keyStores.InMemoryKeyStore()
        await ks.setKey(NETWORK_ID, NEAR_ACCOUNT_ID, KeyPair.fromString(NEAR_PRIVATE_KEY))
        const near = await connect({networkId: NETWORK_ID, nodeUrl: NODE_URL, deps: {keyStore: ks}})
        const nearAccount = await near.account(NEAR_ACCOUNT_ID)

        // Connect to EVM
        const evmProvider = new ethers.JsonRpcProvider(EVM_RPC)
        const evmWallet = new ethers.Wallet(EVM_PRIVATE_KEY, evmProvider)

        console.log('\n📊 Account Information:')
        console.log(`🌕 NEAR Account: ${NEAR_ACCOUNT_ID}`)
        console.log(`📱 EVM Account: ${evmWallet.address}`)
        console.log(`🏪 NEAR Escrow: ${NEAR_ESCROW_ID}`)

        // Check NEAR balances
        console.log('\n💰 NEAR Balances:')
        const nearBalance = await nearAccount.getAccountBalance()
        console.log(`   Main Account: ${(parseInt(nearBalance.available) / 1e24).toFixed(6)} NEAR`)
        console.log(`   Available: ${nearBalance.available} yoctoNEAR`)
        console.log(`   Staked: ${nearBalance.staked} yoctoNEAR`)
        console.log(`   Storage Used: ${nearBalance.storageUsage} bytes`)

        // Check NEAR escrow balance
        try {
            const escrowAccount = await near.account(NEAR_ESCROW_ID)
            const escrowBalance = await escrowAccount.getAccountBalance()
            console.log(`   Escrow Account: ${(parseInt(escrowBalance.available) / 1e24).toFixed(6)} NEAR`)
            console.log(`   Escrow Available: ${escrowBalance.available} yoctoNEAR`)
        } catch (escrowError) {
            console.log(`   ⚠️ Could not check escrow balance: ${escrowError}`)
        }

        // Check EVM balance
        console.log('\n💰 EVM Balances:')
        const evmBalance = await evmProvider.getBalance(evmWallet.address)
        console.log(`   ETH Balance: ${ethers.formatEther(evmBalance)} ETH`)
        console.log(`   Wei Balance: ${evmBalance.toString()} wei`)

        // Get recent transactions
        console.log('\n📋 Recent Transaction Analysis:')

        // Check if there are any recent NEAR transactions
        try {
            const provider = nearAccount.connection.provider
            const currentBlock = await provider.status()
            const currentHeight = currentBlock.sync_info.latest_block_height

            console.log(`   Current NEAR block: ${currentHeight}`)

            // Check last few blocks for transactions to escrow
            let recentEscrowTxs = 0

            for (let i = 0; i < 10; i++) {
                const blockHeight = currentHeight - i
                try {
                    const block = await provider.block({blockId: blockHeight})

                    for (const chunk of block.chunks) {
                        if (chunk.tx_root === '11111111111111111111111111111111') continue

                        const chunkDetails = await provider.chunk(chunk.chunk_hash)

                        for (const tx of chunkDetails.transactions) {
                            if (tx.receiver_id === NEAR_ESCROW_ID && tx.signer_id === NEAR_ACCOUNT_ID) {
                                recentEscrowTxs++
                                console.log(`   📤 Found escrow TX: ${tx.hash}`)
                            }
                        }
                    }
                } catch (blockError) {
                    // Skip blocks we can't read
                }
            }

            console.log(`   Recent escrow transactions: ${recentEscrowTxs}`)
        } catch (nearError) {
            console.log(`   ⚠️ Could not analyze NEAR transactions: ${nearError}`)
        }

        // Check EVM network status
        try {
            const evmBlockNumber = await evmProvider.getBlockNumber()
            console.log(`   Current EVM block: ${evmBlockNumber}`)

            const network = await evmProvider.getNetwork()
            console.log(`   EVM Network: ${network.name} (Chain ID: ${network.chainId})`)
        } catch (evmError) {
            console.log(`   ⚠️ Could not check EVM status: ${evmError}`)
        }

        console.log('\n✅ Balance check completed')
    } catch (error) {
        console.error('\n❌ Balance check failed:', error)
        process.exit(1)
    }
}

checkBalances().catch((e) => {
    console.error('❌ Failed to check balances:', e)
    process.exit(1)
})
