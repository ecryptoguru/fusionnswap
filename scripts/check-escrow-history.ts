#!/usr/bin/env -S tsx
/* eslint-disable max-depth */
/* eslint-disable no-console */

/**
 * Check the escrow account's transaction history
 */

import 'dotenv/config'
import {keyStores, connect, KeyPair} from 'near-api-js'

async function checkEscrowHistory(): Promise<void> {
    console.log('🔍 Checking Escrow Account History')
    console.log('='.repeat(50))

    try {
        const NETWORK_ID = 'testnet'
        const NODE_URL = process.env.NEAR_NODE_URL || 'https://rpc.testnet.near.org'
        const NEAR_ACCOUNT_ID = process.env.NEAR_ACCOUNT_ID!
        const NEAR_PRIVATE_KEY = process.env.NEAR_PRIVATE_KEY!
        const NEAR_ESCROW_ID = process.env.NEAR_ESCROW_ACCOUNT_ID!

        const ks = new keyStores.InMemoryKeyStore()
        await ks.setKey(NETWORK_ID, NEAR_ACCOUNT_ID, KeyPair.fromString(NEAR_PRIVATE_KEY))
        const near = await connect({networkId: NETWORK_ID, nodeUrl: NODE_URL, deps: {keyStore: ks}})
        const nearAccount = await near.account(NEAR_ACCOUNT_ID)

        console.log(`\n🏪 Escrow Account: ${NEAR_ESCROW_ID}`)

        const escrowAccount = await near.account(NEAR_ESCROW_ID)
        const escrowBalance = await escrowAccount.getAccountBalance()
        console.log(`💰 Current Balance: ${(parseInt(escrowBalance.available) / 1e24).toFixed(6)} NEAR`)
        console.log(`   Available: ${escrowBalance.available} yoctoNEAR`)

        // Check recent blocks for transactions TO the escrow account
        const provider = nearAccount.connection.provider
        const currentBlock = await provider.status()
        const currentHeight = currentBlock.sync_info.latest_block_height

        console.log(`\n📋 Scanning last 50 blocks from height ${currentHeight}`)

        let totalTransfers = 0
        let totalAmount = 0
        const transfers: Array<{hash: string; amount: string; block: number}> = []

        for (let i = 0; i < 50; i++) {
            const blockHeight = currentHeight - i
            try {
                const block = await provider.block({blockId: blockHeight})

                for (const chunk of block.chunks) {
                    if (chunk.tx_root === '11111111111111111111111111111111') continue

                    try {
                        const chunkDetails = await provider.chunk(chunk.chunk_hash)

                        for (const tx of chunkDetails.transactions) {
                            if (tx.receiver_id === NEAR_ESCROW_ID) {
                                // Check if this is a transfer
                                for (const action of tx.actions) {
                                    if (action.Transfer) {
                                        const amount = parseInt(action.Transfer.deposit)
                                        totalTransfers++
                                        totalAmount += amount
                                        transfers.push({
                                            hash: tx.hash,
                                            amount: action.Transfer.deposit,
                                            block: blockHeight
                                        })
                                        console.log(`   📤 Block ${blockHeight}: ${tx.hash}`)
                                        console.log(`      From: ${tx.signer_id}`)
                                        console.log(`      Amount: ${(amount / 1e24).toFixed(6)} NEAR`)
                                    }
                                }
                            }
                        }
                    } catch (chunkError) {
                        // Skip chunks we can't read
                    }
                }
            } catch (blockError) {
                // Skip blocks we can't read
            }
        }

        console.log(`\n📊 Summary:`)
        console.log(`   Total transfers found: ${totalTransfers}`)
        console.log(`   Total amount transferred: ${(totalAmount / 1e24).toFixed(6)} NEAR`)
        console.log(`   Current escrow balance: ${(parseInt(escrowBalance.available) / 1e24).toFixed(6)} NEAR`)

        if (totalAmount > 0) {
            const difference = parseInt(escrowBalance.available) - totalAmount
            console.log(`   Difference: ${(difference / 1e24).toFixed(6)} NEAR`)

            if (Math.abs(difference) > 1e20) {
                // More than 0.0001 NEAR difference
                console.log(`   ⚠️ Significant difference detected - there may be other transactions`)
            }
        }

        // Check if the latest transaction was successful
        if (transfers.length > 0) {
            const latestTransfer = transfers[0]
            console.log(`\n🔍 Latest Transfer Details:`)
            console.log(`   Hash: ${latestTransfer.hash}`)
            console.log(`   Amount: ${(parseInt(latestTransfer.amount) / 1e24).toFixed(6)} NEAR`)
            console.log(`   Block: ${latestTransfer.block}`)

            // Verify this specific transaction
            try {
                const txResult = await provider.txStatus(latestTransfer.hash, NEAR_ACCOUNT_ID)
                const isSuccess =
                    txResult.status &&
                    (txResult.status.SuccessValue !== undefined ||
                        txResult.status.SuccessReceiptId !== undefined ||
                        (typeof txResult.status === 'object' && 'SuccessValue' in txResult.status))
                console.log(`   Status: ${isSuccess ? '✅ SUCCESS' : '❌ FAILED'}`)
            } catch (txError) {
                console.log(`   Status: ❓ Could not verify`)
            }
        }
    } catch (error) {
        console.error('\n❌ Failed to check escrow history:', error)
    }
}

checkEscrowHistory()
