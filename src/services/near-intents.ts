/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable max-depth */
/**
 * NEAR Intents Service
 *
 * Seamlessly connects NEAR Intents to the cross-chain workflow.
 * Processes user intents and triggers appropriate cross-chain escrow creation.
 */

import {connect, keyStores, KeyPair, Account} from 'near-api-js'
import BN from 'bn.js'
import crypto from 'node:crypto'
import {ChainSignaturesService} from './chain-signatures.js'

export interface IntentConfig {
    nearNetworkId: string
    nearNodeUrl: string
    nearAccountId: string
    nearPrivateKey: string
    intentsContractId: string
    escrowContractId: string
}

export interface CrossChainIntent {
    id: string
    user: string
    sourceChain: string
    targetChain: string
    sourceToken: string
    targetToken: string
    sourceAmount: string
    targetAmount: string
    deadline: number
    recipient?: string
    metadata?: Record<string, unknown>
}

export interface ProcessedIntent {
    intent: CrossChainIntent
    orderHash: string
    escrowCreated: boolean
    timestamp: number
}

/**
 * Event emitted when an intent is ready for cross-chain processing
 */
export type IntentProcessedCallback = (intent: ProcessedIntent) => Promise<void>

/**
 * NEAR Intents service for cross-chain workflow integration
 */
export class NearIntentsService {
    private config: IntentConfig

    private nearAccount: Account | null = null

    private chainSignatures: ChainSignaturesService | null = null

    private isListening: boolean = false

    private intentCallbacks: IntentProcessedCallback[] = []

    constructor(config: IntentConfig, chainSignatures?: ChainSignaturesService) {
        this.config = config
        this.chainSignatures = chainSignatures || null
    }

    /**
     * Initialize the intents service
     */
    async initialize(): Promise<void> {
        // Initializing NEAR Intents service

        // Connect to NEAR
        const keyStore = new keyStores.InMemoryKeyStore()
        await keyStore.setKey(
            this.config.nearNetworkId,
            this.config.nearAccountId,
            KeyPair.fromString(this.config.nearPrivateKey)
        )

        const near = await connect({
            networkId: this.config.nearNetworkId,
            nodeUrl: this.config.nearNodeUrl,
            deps: {keyStore}
        })

        this.nearAccount = await near.account(this.config.nearAccountId)

        // NEAR Intents service initialized
    }

    /**
     * Submit a cross-chain intent
     */
    async submitIntent(intent: Omit<CrossChainIntent, 'id'>): Promise<string> {
        if (!this.nearAccount) {
            throw new Error('Intents service not initialized')
        }

        const intentId = this.generateIntentId()
        const fullIntent: CrossChainIntent = {
            ...intent,
            id: intentId
        }

        // Submitting cross-chain intent

        try {
            // Submit to NEAR Intents contract using the correct method name
            await this.nearAccount.functionCall({
                contractId: this.config.intentsContractId,
                methodName: 'intake_intent',
                args: {
                    intent: {
                        maker_near: intent.user,
                        taker_near: intent.user, // Use the same NEAR account for taker
                        maker_asset_near: intent.sourceToken === 'near' ? 'near' : intent.sourceToken,
                        taker_asset_evm:
                            intent.targetToken === 'eth'
                                ? '0x0000000000000000000000000000000000000000'
                                : intent.targetToken,
                        making_amount: intent.sourceAmount,
                        taking_amount: intent.targetAmount,
                        order_hash_hex: '0x' + intentId.padStart(64, '0'), // Convert intent ID to 32-byte hex
                        dst_chain_id: intent.targetChain === 'ethereum' ? 11155111 : 1, // Sepolia testnet
                        timelocks_hex: '0x' + intent.deadline.toString(16).padStart(16, '0') // Convert deadline to hex
                    }
                },
                gas: new BN('300000000000000') // No deposit required
            })

            // Intent submitted successfully

            // Automatically process if this is a cross-chain intent
            if (this.shouldProcessForCrossChain(fullIntent)) {
                await this.processIntentForCrossChain(fullIntent)
            }

            return intentId
        } catch (error) {
            // Failed to submit intent
            throw new Error(`Intent submission failed: ${error}`)
        }
    }

    /**
     * Process an intent for cross-chain execution
     */
    private async processIntentForCrossChain(intent: CrossChainIntent): Promise<void> {
        // Processing intent for cross-chain execution

        try {
            // Generate order hash for the cross-chain swap
            const orderHash = await this.generateOrderHash(intent)

            // Create escrow on NEAR side
            const escrowCreated = await this.createNearEscrow(intent, orderHash)

            const processedIntent: ProcessedIntent = {
                intent,
                orderHash,
                escrowCreated,
                timestamp: Date.now()
            }

            // Notify callbacks
            for (const callback of this.intentCallbacks) {
                try {
                    await callback(processedIntent)
                } catch (error) {
                    // Intent callback error
                }
            }

            // Intent processed for cross-chain execution
        } catch (error) {
            // Failed to process intent for cross-chain
        }
    }

    /**
     * Create NEAR escrow for the intent
     */
    private async createNearEscrow(intent: CrossChainIntent, orderHash: string): Promise<boolean> {
        if (!this.nearAccount) {
            return false
        }

        // Creating NEAR escrow for intent

        try {
            // Generate a temporary secret for the hashlock
            const secret =
                '0x' +
                Buffer.from('temp_secret_' + intent.id)
                    .toString('hex')
                    .padStart(64, '0')

            // Create escrow via the simpler create_dst_simple method
            await this.nearAccount.functionCall({
                contractId: this.config.escrowContractId,
                methodName: 'create_dst_simple',
                args: {
                    order_hash_hex: orderHash,
                    hashlock_hex: secret,
                    maker_hex20: '0x0000000000000000000000000000000000000000', // Zero address
                    taker_hex20: '0x0000000000000000000000000000000000000000', // Zero address
                    token_hex20: '0x0000000000000000000000000000000000000000', // Native NEAR
                    amount: intent.targetAmount, // Keep as string for large u128
                    safety_deposit: '0', // Keep as string for u128
                    timelocks: this.packTimelocks(),
                    maker_near: intent.user,
                    taker_near: this.config.nearAccountId
                },
                gas: new BN('300000000000000') // No deposit needed since safety_deposit is 0
            })

            // NEAR escrow created

            return true
        } catch (error) {
            // Failed to create NEAR escrow

            return false
        }
    }

    /**
     * Start listening for intents and processing them
     */
    async startListening(): Promise<void> {
        if (this.isListening) {
            return
        }

        // Starting to listen for NEAR intents
        this.isListening = true

        // Poll for new intents every 10 seconds
        const pollInterval = setInterval(async () => {
            if (!this.isListening) {
                clearInterval(pollInterval)

                return
            }

            await this.pollForNewIntents()
        }, 10000)

        // Intent listener started
    }

    /**
     * Stop listening for intents
     */
    stopListening(): void {
        this.isListening = false
        // Intent listener stopped
    }

    /**
     * Poll for new intents from the contract
     */
    private async pollForNewIntents(): Promise<void> {
        if (!this.nearAccount) {
            return
        }

        try {
            // Get recent intents from the contract
            const recentIntents = await this.nearAccount.viewFunction({
                contractId: this.config.intentsContractId,
                methodName: 'get_recent_intents',
                args: {limit: 10}
            })

            if (Array.isArray(recentIntents)) {
                for (const intentData of recentIntents) {
                    const intent = this.parseIntentFromContract(intentData)

                    if (intent && this.shouldProcessForCrossChain(intent)) {
                        await this.processIntentForCrossChain(intent)
                    }
                }
            }
        } catch (error) {
            // Silently continue if polling fails
            // Intent polling error
        }
    }

    /**
     * Parse intent data from contract format
     */
    private parseIntentFromContract(intentData: unknown): CrossChainIntent | null {
        try {
            const data = intentData as Record<string, unknown>

            return {
                id: String(data.id || 'unknown'),
                user: String(data.user || data.submitter || ''),
                sourceChain: String(data.source_chain || 'near'),
                targetChain: String(data.target_chain || 'ethereum'),
                sourceToken: String(data.source_token || 'near'),
                targetToken: String(data.target_token || 'eth'),
                sourceAmount: String(data.source_amount || '0'),
                targetAmount: String(data.target_amount || '0'),
                deadline: Number(data.deadline) || Date.now() + 3600000, // 1 hour default
                recipient: data.recipient ? String(data.recipient) : undefined,
                metadata: (data.metadata as Record<string, unknown>) || {}
            }
        } catch (error) {
            // Failed to parse intent data

            return null
        }
    }

    /**
     * Add callback for when intents are processed
     */
    onIntentProcessed(callback: IntentProcessedCallback): void {
        this.intentCallbacks.push(callback)
    }

    /**
     * Remove intent processed callback
     */
    removeIntentCallback(callback: IntentProcessedCallback): void {
        const index = this.intentCallbacks.indexOf(callback)

        if (index > -1) {
            this.intentCallbacks.splice(index, 1)
        }
    }

    /**
     * Check if intent should be processed for cross-chain
     */
    private shouldProcessForCrossChain(intent: CrossChainIntent): boolean {
        const isNearSource = intent.sourceChain.toLowerCase().includes('near')
        const isEvmTarget = ['ethereum', 'eth', 'sepolia'].some((chain) =>
            intent.targetChain.toLowerCase().includes(chain)
        )

        return isNearSource && isEvmTarget
    }

    /**
     * Generate a unique order hash for the intent
     */
    private async generateOrderHash(intent: CrossChainIntent): Promise<string> {
        const data = JSON.stringify({
            intentId: intent.id,
            user: intent.user,
            sourceChain: intent.sourceChain,
            targetChain: intent.targetChain,
            timestamp: Date.now()
        })

        const hash = crypto.createHash('sha256').update(data).digest('hex')

        return '0x' + hash
    }

    /**
     * Generate unique intent ID
     */
    private generateIntentId(): string {
        const timestamp = Date.now()
        const random = Math.random().toString(36).substring(2, 15)

        return `intent_${timestamp}_${random}`
    }

    /**
     * Pack timelocks for escrow creation
     */
    private packTimelocks(): Record<string, string> {
        const now = Math.floor(Date.now() / 1000) // Current time in seconds

        return {
            deployed_at: now.toString(),
            src_withdrawal: '600', // 10 min
            src_public_withdrawal: '1800', // 30 min
            src_cancellation: '3600', // 1 hour
            src_public_cancellation: '7200', // 2 hours
            dst_withdrawal: '600', // 10 min
            dst_public_withdrawal: '1800', // 30 min
            dst_cancellation: '3600' // 1 hour
        }
    }

    /**
     * Get service status
     */
    getStatus(): {
        initialized: boolean
        listening: boolean
        intentsContract: string
        escrowContract: string
        callbackCount: number
    } {
        return {
            initialized: this.nearAccount !== null,
            listening: this.isListening,
            intentsContract: this.config.intentsContractId,
            escrowContract: this.config.escrowContractId,
            callbackCount: this.intentCallbacks.length
        }
    }
}

/**
 * Create and initialize NEAR Intents service from environment variables
 */
export async function createNearIntentsService(chainSignatures?: ChainSignaturesService): Promise<NearIntentsService> {
    const config: IntentConfig = {
        nearNetworkId: process.env.NEAR_NETWORK || 'testnet',
        nearNodeUrl: process.env.NEAR_NODE_URL || 'https://rpc.testnet.near.org',
        nearAccountId: process.env.NEAR_ACCOUNT_ID || '',
        nearPrivateKey: process.env.NEAR_PRIVATE_KEY || '',
        intentsContractId: process.env.NEAR_INTENTS_ACCOUNT_ID || '',
        escrowContractId: process.env.NEAR_ESCROW_ACCOUNT_ID || ''
    }

    const service = new NearIntentsService(config, chainSignatures)
    await service.initialize()

    return service
}
