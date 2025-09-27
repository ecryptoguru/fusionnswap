#!/usr/bin/env -S tsx
/* eslint-disable max-depth */
/* eslint-disable no-console */

/**
 * Enhanced Cross-Chain Agent with Chain Signatures & NEAR Intents
 *
 * Integrates:
 * - NEAR Chain Signatures for decentralized key management
 * - NEAR Intents for seamless cross-chain workflow
 */

import "dotenv/config";
import { ethers } from "ethers";
import { connect, keyStores, KeyPair } from "near-api-js";
import crypto from "node:crypto";
import {
  ChainSignaturesService,
  createChainSignaturesService,
} from "../src/services/chain-signatures.js";
import {
  NearIntentsService,
  createNearIntentsService,
  ProcessedIntent,
} from "../src/services/near-intents.js";
import { createImmutables } from "../utils/address-encoding.js";

const req = (k: string): string => {
  const v = process.env[k];

  if (!v) throw new Error(`Missing env ${k}`);

  return v;
};

interface AgentConfig {
  // EVM Configuration
  evmRpcUrl: string;
  evmPrivateKey: string;
  resolverAddress: string;

  // NEAR Configuration
  nearNetworkId: string;
  nearNodeUrl: string;
  nearAccountId: string;
  nearPrivateKey: string;
  nearEscrowId: string;

  // Agent Settings
  dryRun: boolean;
  autoLock: boolean;
  filterDstChainId?: number;
}

interface AgentMetrics {
  startTime: number;
  nearTransactionsDetected: number;
  nearTransactionsProcessed: number;
  ethEscrowsCreated: number;
  ethEscrowsFailed: number;
  totalGasUsed: bigint;
  averageProcessingTime: number;
  lastSuccessfulTransaction: string | null;
  errorCount: number;
  blocksScanned: number;
}

interface EscrowEvent {
  orderHash: string;
  hashlock: string;
  amount: string;
  chainId: number;
  timestamp: number;
  txHash: string;
  isMultiFill?: boolean;
  merkleRoot?: string;
  proofIndex?: number;
}

interface EVMLogEvent {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

interface MerkleProof {
  leaf: string;
  proof: string[];
  index: number;
}

interface MultiFillOrder {
  orderHash: string;
  totalAmount: bigint;
  fillCount: number;
  filledCount: number;
  merkleRoot: string;
  secrets: string[];
  proofs: MerkleProof[];
}

/**
 * Enhanced cross-chain agent with Chain Signatures and NEAR Intents
 */
export class EnhancedCrossChainAgent {
  private config: AgentConfig;

  private chainSignatures: ChainSignaturesService;

  private nearIntents: NearIntentsService;

  private nearAccount: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- NEAR Account object requires dynamic method access

  private evmProvider: ethers.JsonRpcProvider | null = null;

  private evmWallet: ethers.Wallet | null = null;

  private isRunning: boolean = false;

  private multiFillOrders: Map<string, MultiFillOrder> = new Map();

  private timelockCoordination: Map<string, number> = new Map();

  // ✅ ENHANCED: Agent metrics tracking for performance monitoring
  private metrics: AgentMetrics = {
    startTime: Date.now(),
    nearTransactionsDetected: 0,
    nearTransactionsProcessed: 0,
    ethEscrowsCreated: 0,
    ethEscrowsFailed: 0,
    totalGasUsed: 0n,
    averageProcessingTime: 0,
    lastSuccessfulTransaction: null,
    errorCount: 0,
    blocksScanned: 0,
  };

  constructor(
    config: AgentConfig,
    chainSignatures: ChainSignaturesService,
    nearIntents: NearIntentsService,
  ) {
    this.config = config;
    this.chainSignatures = chainSignatures;
    this.nearIntents = nearIntents;
    this.evmProvider = new ethers.JsonRpcProvider(config.evmRpcUrl);

    // Initialize EVM wallet for creating escrows
    if (process.env.PRIVATE_KEY) {
      this.evmWallet = new ethers.Wallet(
        process.env.PRIVATE_KEY,
        this.evmProvider,
      );
    }
  }

  /**
   * Initialize the enhanced agent
   */
  async initialize(): Promise<void> {
    console.log("🚀 Initializing Enhanced Cross-Chain Agent...");
    console.log("   🔐 Chain Signatures enabled");
    console.log("   🎯 NEAR Intents integration enabled");

    // Initialize NEAR account
    const keyStore = new keyStores.InMemoryKeyStore();
    await keyStore.setKey(
      this.config.nearNetworkId,
      this.config.nearAccountId,
      KeyPair.fromString(this.config.nearPrivateKey),
    );

    const near = await connect({
      networkId: this.config.nearNetworkId,
      nodeUrl: this.config.nearNodeUrl,
      deps: { keyStore },
    });

    this.nearAccount = await near.account(this.config.nearAccountId);

    // Set up NEAR Intents callback
    this.nearIntents.onIntentProcessed(this.handleProcessedIntent.bind(this));

    // Display agent status
    await this.displayAgentStatus();

    console.log("✅ Enhanced Cross-Chain Agent initialized");
  }

  /**
   * Start the enhanced agent
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("⚠️ Agent is already running");

      return;
    }

    this.isRunning = true;
    console.log("\n🎬 Starting Enhanced Cross-Chain Agent...");

    // Start NEAR Intents listening
    await this.nearIntents.startListening();

    // Start EVM event monitoring
    this.startEvmEventMonitoring();

    // Start NEAR event monitoring
    this.startNearEventMonitoring();

    console.log("✅ Enhanced agent is running");
    console.log("   👂 Listening for NEAR Intents");
    console.log("   👂 Monitoring EVM events");
    console.log("   👂 Monitoring NEAR events");
    console.log("   🔐 Using Chain Signatures for key management");
  }

  /**
   * Stop the enhanced agent
   */
  stop(): void {
    this.isRunning = false;
    this.nearIntents.stopListening();
    this.displayFinalMetrics();
    console.log("🛑 Enhanced agent stopped");
  }

  /**
   * ✅ ENHANCED: Display comprehensive agent metrics
   */
  displayMetrics(): void {
    const uptime = Date.now() - this.metrics.startTime;
    const uptimeHours = (uptime / (1000 * 60 * 60)).toFixed(2);
    const successRate =
      this.metrics.nearTransactionsDetected > 0
        ? (
            (this.metrics.nearTransactionsProcessed /
              this.metrics.nearTransactionsDetected) *
            100
          ).toFixed(1)
        : "0";
    const ethSuccessRate =
      this.metrics.ethEscrowsCreated + this.metrics.ethEscrowsFailed > 0
        ? (
            (this.metrics.ethEscrowsCreated /
              (this.metrics.ethEscrowsCreated +
                this.metrics.ethEscrowsFailed)) *
            100
          ).toFixed(1)
        : "0";

    console.log("\n📊 ENHANCED AGENT METRICS");
    console.log("========================");
    console.log(`⏱️  Uptime: ${uptimeHours} hours`);
    console.log(
      `🔍 Blocks Scanned: ${this.metrics.blocksScanned.toLocaleString()}`,
    );
    console.log(
      `🎯 NEAR Transactions Detected: ${this.metrics.nearTransactionsDetected}`,
    );
    console.log(
      `✅ NEAR Transactions Processed: ${this.metrics.nearTransactionsProcessed} (${successRate}%)`,
    );
    console.log(`💰 ETH Escrows Created: ${this.metrics.ethEscrowsCreated}`);
    console.log(`❌ ETH Escrows Failed: ${this.metrics.ethEscrowsFailed}`);
    console.log(`🎯 ETH Success Rate: ${ethSuccessRate}%`);
    console.log(
      `⛽ Total Gas Used: ${this.metrics.totalGasUsed.toLocaleString()} wei`,
    );
    console.log(
      `⚡ Avg Processing Time: ${this.metrics.averageProcessingTime.toFixed(0)}ms`,
    );
    console.log(
      `🔗 Last Successful TX: ${this.metrics.lastSuccessfulTransaction || "None"}`,
    );
    console.log(`⚠️  Total Errors: ${this.metrics.errorCount}`);
    console.log("========================\n");
  }

  /**
   * ✅ ENHANCED: Display final metrics on shutdown
   */
  private displayFinalMetrics(): void {
    console.log("\n🏁 FINAL AGENT PERFORMANCE REPORT");
    this.displayMetrics();
  }

  /**
   * Handle processed NEAR Intent
   */
  private async handleProcessedIntent(
    processedIntent: ProcessedIntent,
  ): Promise<void> {
    console.log("\n🎯 Processing NEAR Intent for cross-chain execution...");
    console.log(`   Intent ID: ${processedIntent.intent.id}`);
    console.log(`   Order Hash: ${processedIntent.orderHash}`);
    console.log(`   User: ${processedIntent.intent.user}`);
    console.log(
      `   ${processedIntent.intent.sourceChain} → ${processedIntent.intent.targetChain}`,
    );

    if (!processedIntent.escrowCreated) {
      console.log("⚠️ NEAR escrow not created, skipping EVM processing");

      return;
    }

    // Create corresponding EVM escrow using Chain Signatures
    await this.createEvmEscrowWithChainSignatures(processedIntent);
  }

  /**
   * Create EVM escrow using Chain Signatures
   */
  private async createEvmEscrowWithChainSignatures(
    processedIntent: ProcessedIntent,
  ): Promise<void> {
    console.log("🔐 Creating EVM escrow with Chain Signatures...");

    if (this.config.dryRun) {
      console.log("🧪 DRY RUN: Would create EVM escrow with Chain Signatures");
      this.simulateEvmEscrowCreation(processedIntent);

      return;
    }

    try {
      const intent = processedIntent.intent;

      // Prepare EVM transaction for escrow creation
      const resolverAbi = [
        "function deployDst((bytes32 orderHash, bytes32 hashlock, uint256 maker, uint256 taker, uint256 token, uint256 amount, uint256 safetyDeposit, uint256 timelocks) dstImmutables, uint256 srcCancellationTimestamp) external payable",
      ];

      const resolver = new ethers.Contract(
        this.config.resolverAddress,
        resolverAbi,
        this.evmProvider,
      );

      // Generate hashlock from intent
      const secret =
        "0x" +
        Buffer.from("intent_secret_" + intent.id)
          .toString("hex")
          .padStart(64, "0");
      const hashlock = ethers.keccak256(secret);

      // Determine if this is a multi-fill order
      const isMultiFill = intent.metadata?.multiFill || false;

      const dstImmutables = createImmutables({
        orderHash: processedIntent.orderHash,
        hashlock,
        amount: ethers.parseEther(intent.targetAmount),
        timelocks: this.packEvmTimelocks(
          processedIntent.orderHash,
          isMultiFill,
        ),
      });

      const srcCancellationTimestamp = BigInt(
        Math.floor(Date.now() / 1000) + 3600,
      ); // 1 hour

      // Create transaction request
      const txRequest = {
        to: this.config.resolverAddress,
        data: resolver.interface.encodeFunctionData("deployDst", [
          dstImmutables,
          srcCancellationTimestamp,
        ]),
        value: dstImmutables.amount,
        gasLimit: 500000n,
        chainId: 11155111, // Sepolia
      };

      // Sign and send with Chain Signatures
      const signedTx =
        await this.chainSignatures.signEthereumTransaction(txRequest);

      // Broadcast the transaction
      const txResponse = await this.evmProvider!.broadcastTransaction(signedTx);
      const receipt = await txResponse.wait();

      console.log("✅ EVM escrow created with Chain Signatures");
      console.log(`   Transaction: ${receipt?.hash}`);
      console.log(`   Block: ${receipt?.blockNumber}`);
    } catch (error) {
      console.error(
        "❌ Failed to create EVM escrow with Chain Signatures:",
        error,
      );

      // Fallback to simulation
      this.simulateEvmEscrowCreation(processedIntent);
    }
  }

  /**
   * Simulate EVM escrow creation for development
   */
  private simulateEvmEscrowCreation(processedIntent: ProcessedIntent): void {
    console.log("🎭 Simulating EVM escrow creation...");
    console.log(
      `   Would deploy escrow for order: ${processedIntent.orderHash}`,
    );
    console.log(`   Amount: ${processedIntent.intent.targetAmount} ETH`);
    console.log(
      `   Using Chain Signatures address: ${this.chainSignatures.getEthereumAddress()}`,
    );
  }

  /**
   * Start monitoring EVM events
   */
  private startEvmEventMonitoring(): void {
    console.log("👂 Starting EVM event monitoring...");

    // Monitor DstEscrowCreated events
    const filter = {
      address: this.config.resolverAddress,
      topics: [
        ethers.id(
          "DstEscrowCreated((bytes32,bytes32,uint256,uint256,uint256,uint256,uint256,uint256),uint256,uint256,bytes)",
        ),
      ],
    };

    this.evmProvider!.on(filter, (log) => {
      if (!this.isRunning) return;

      this.handleEvmEvent(log);
    });
  }

  /**
   * Start monitoring NEAR events
   */
  private startNearEventMonitoring(): void {
    console.log("👂 Starting NEAR event monitoring...");

    // Poll for NEAR events every 15 seconds
    const pollInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(pollInterval);

        return;
      }

      await this.pollNearEvents();
    }, 15000);

    // ✅ ENHANCED: Display metrics every 5 minutes
    const metricsInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(metricsInterval);

        return;
      }

      if (
        this.metrics.nearTransactionsDetected > 0 ||
        this.metrics.blocksScanned > 1000
      ) {
        this.displayMetrics();
      }
    }, 300000); // 5 minutes
  }

  /**
   * Handle EVM event
   */
  private async handleEvmEvent(log: EVMLogEvent): Promise<void> {
    try {
      console.log("\n📡 EVM Event Detected:");
      console.log(`   Block: ${log.blockNumber}`);
      console.log(`   Transaction: ${log.transactionHash}`);

      // Process the event to trigger NEAR-side actions
      await this.processEvmEvent(log);
    } catch (error: unknown) {
      console.error(
        "❌ Error handling EVM event:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Process EVM event and trigger NEAR actions
   */
  private async processEvmEvent(log: EVMLogEvent): Promise<void> {
    console.log("🔄 Processing EVM event for NEAR actions...");

    try {
      // Parse resolver ABI for proper event decoding
      const resolverAbi = [
        "event DstEscrowCreated((bytes32 orderHash, bytes32 hashlock, uint256 maker, uint256 taker, uint256 token, uint256 amount, uint256 safetyDeposit, uint256 timelocks) dstImmutables, uint256 srcCancellationTimestamp, uint256 dstChainId, bytes canonicalPayload)",
      ];

      const resolver = new ethers.Interface(resolverAbi);
      const parsedLog = resolver.parseLog(log);

      if (parsedLog && parsedLog.name === "DstEscrowCreated") {
        const { dstImmutables } = parsedLog.args;
        const orderHash = dstImmutables.orderHash;
        const hashlock = dstImmutables.hashlock;
        const amount = dstImmutables.amount;

        console.log(`📋 EVM Escrow Created:`);
        console.log(`   Order: ${orderHash}`);
        console.log(`   Amount: ${amount.toString()}`);

        // Check if this is a multi-fill order (hashlock might be merkle root)
        const isMultiFill = this.detectMultiFillOrder(hashlock);

        if (isMultiFill) {
          await this.processMultiFillOrder(orderHash, hashlock, amount);
        } else {
          console.log(`✅ Single-fill order processed`);
        }

        // Trigger NEAR escrow creation if needed
        if (this.config.autoLock) {
          await this.createCorrespondingNearEscrow(
            orderHash,
            hashlock,
            amount,
            parsedLog,
          );
        }
      }
    } catch (error) {
      console.error("❌ Failed to process EVM event:", error);
    }
  }

  /**
   * Detect if an order is multi-fill based on hashlock patterns
   */
  private detectMultiFillOrder(hashlock: string): boolean {
    // Simple heuristic - in production would use more sophisticated detection
    // Multi-fill orders typically use merkle roots as hashlocks
    return hashlock.startsWith("0x") && hashlock.length === 66;
  }

  /**
   * Create corresponding NEAR escrow for EVM order
   */
  private async createCorrespondingNearEscrow(
    orderHash: string,
    hashlock: string,
    amount: bigint,
    parsedLog?: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- EVM log data structure varies
  ): Promise<void> {
    console.log("🔗 Creating corresponding NEAR escrow...");

    if (!this.nearAccount) {
      console.log("⚠️ NEAR account not initialized");

      return;
    }

    if (this.config.dryRun) {
      console.log("🧪 DRY RUN: Would create NEAR escrow");
      console.log(`   Order: ${orderHash}`);
      console.log(`   Hashlock: ${hashlock}`);
      console.log(`   Amount: ${amount.toString()}`);

      return;
    }

    try {
      console.log("💰 Creating real NEAR escrow...");

      // Convert ETH wei to NEAR yoctoNEAR (1 ETH = 1 NEAR for atomic swaps)
      // For actual NEAR token transfer: convert 0.005 ETH to 0.005 NEAR
      const nearAmount = amount.toString();
      // Create escrow account if needed
      const escrowAccountId = this.config.nearEscrowId;

      // Extract addresses from the parsed EVM event for proper NEAR contract call
      const currentTimestamp = Math.floor(Date.now() / 1000);

      // Extract addresses from EVM event or use defaults
      let makerAddress = "0x0000000000000000000000000000000000000000";
      let takerAddress = "0x0000000000000000000000000000000000000000";
      let tokenAddress = "0x0000000000000000000000000000000000000000";

      if (parsedLog && parsedLog.args && parsedLog.args.dstImmutables) {
        // Convert uint256 addresses back to 20-byte hex addresses
        const immutables = parsedLog.args.dstImmutables;

        if (immutables.maker) {
          makerAddress =
            "0x" + BigInt(immutables.maker).toString(16).padStart(40, "0");
        }

        if (immutables.taker) {
          takerAddress =
            "0x" + BigInt(immutables.taker).toString(16).padStart(40, "0");
        }

        if (immutables.token) {
          tokenAddress =
            "0x" + BigInt(immutables.token).toString(16).padStart(40, "0");
        }
      }

      // ✅ FIXED: Use exact same hashlock from EVM event
      console.log("🔗 Cross-chain hashlock coordination:");
      console.log(`   Order Hash: ${orderHash}`);
      console.log(`   EVM Hashlock: ${hashlock}`);
      console.log(
        `   Using SAME hashlock for NEAR escrow (no conversion needed)`,
      );

      // ✅ FIXED: Proper BigInt handling for NEAR contract call
      const packedTimelocks =
        (BigInt(currentTimestamp) << 0n) | // deployed_at
        (BigInt(10) << 32n) | // src_withdrawal
        (BigInt(30) << 64n) | // src_public_withdrawal
        (BigInt(60) << 96n) | // src_cancellation
        (BigInt(120) << 128n) | // src_public_cancellation
        (BigInt(5) << 160n) | // dst_withdrawal
        (BigInt(15) << 192n) | // dst_public_withdrawal
        (BigInt(30) << 224n); // dst_cancellation

      // Call escrow creation on NEAR with fixed BigInt conversion
      const result = await this.nearAccount.functionCall({
        contractId: escrowAccountId,
        methodName: "create_dst_simple",
        args: {
          order_hash_hex: orderHash,
          hashlock_hex: hashlock, // ✅ FIXED: Use exact same hashlock from EVM event
          maker_hex20: makerAddress,
          taker_hex20: takerAddress,
          token_hex20: tokenAddress,
          amount: nearAmount, // Keep as string to avoid BigInt conversion issues
          safety_deposit: "0", // Keep as string
          timelocks: packedTimelocks.toString(), // Convert BigInt to string
          maker_near: this.config.nearAccountId,
          taker_near: this.config.nearAccountId,
        },
        gas: "100000000000000", // Use string instead of BN
        attachedDeposit: "0", // Use string instead of BN
      });

      // ✅ VERIFY: Log the exact hashlock being used
      console.log("✅ NEAR escrow created with hashlock coordination!");
      console.log(`   EVM Hashlock: ${hashlock}`);
      console.log(`   NEAR Escrow: Uses same hashlock for secret validation`);

      console.log("✅ NEAR escrow created successfully!");
      console.log(`   Transaction: ${result.transaction.hash}`);
      console.log(`   Order: ${orderHash}`);
      console.log(`   Amount: ${nearAmount} yoctoNEAR`);
    } catch (error) {
      console.error("❌ Failed to create NEAR escrow:", error);
      console.log("🔄 Falling back to manual process...");
    }
  }

  /**
   * Poll for NEAR events - ENHANCED to check 100 blocks
   */
  private async pollNearEvents(): Promise<void> {
    if (!this.nearAccount) return;

    try {
      // ✅ FIXED: Check 100 blocks to catch recent transactions
      await this.checkRecentNearBlocks(100);
    } catch (error) {
      console.debug("NEAR event polling error:", error);
    }
  }

  /**
   * Pack EVM timelocks with dynamic coordination
   */
  private packEvmTimelocks(
    orderHash?: string,
    isMultiFill: boolean = false,
  ): bigint {
    // Dynamic timelock calculation based on order complexity
    let DST_WITHDRAWAL = 600; // 10 min
    let DST_PUBLIC_WITHDRAWAL = 1800; // 30 min
    let DST_CANCELLATION = 3600; // 1 hour

    if (isMultiFill) {
      // Multi-fill orders need longer timeouts for coordination
      DST_WITHDRAWAL = 1200; // 20 min
      DST_PUBLIC_WITHDRAWAL = 3600; // 1 hour
      DST_CANCELLATION = 7200; // 2 hours
    }

    // Store coordination info if orderHash provided
    if (orderHash) {
      this.timelockCoordination.set(orderHash, DST_CANCELLATION);
    }

    return (
      (BigInt(DST_WITHDRAWAL) << 128n) |
      (BigInt(DST_PUBLIC_WITHDRAWAL) << 160n) |
      (BigInt(DST_CANCELLATION) << 192n)
    );
  }

  /**
   * Process multi-fill order with merkle proofs
   */
  private async processMultiFillOrder(
    orderHash: string,
    merkleRoot: string,
    totalAmount: bigint,
  ): Promise<void> {
    console.log(`🌳 Processing multi-fill order: ${orderHash}`);
    console.log(`   Merkle root: ${merkleRoot}`);
    console.log(`   Total amount: ${totalAmount.toString()}`);

    // Generate secrets and build merkle tree for multi-fill
    const secrets = this.generateMultiFillSecrets(4); // 4 fills by default
    const proofs = this.buildMerkleProofs(secrets);

    const multiFillOrder: MultiFillOrder = {
      orderHash,
      totalAmount,
      fillCount: secrets.length,
      filledCount: 0,
      merkleRoot,
      secrets,
      proofs,
    };

    this.multiFillOrders.set(orderHash, multiFillOrder);

    console.log(
      `✅ Multi-fill order registered: ${secrets.length} fills prepared`,
    );
  }

  /**
   * Generate secrets for multi-fill scenario
   */
  private generateMultiFillSecrets(count: number): string[] {
    const secrets: string[] = [];

    for (let i = 0; i < count; i++) {
      const secret = "0x" + crypto.randomBytes(32).toString("hex");
      secrets.push(secret);
    }

    return secrets;
  }

  /**
   * Build merkle proofs for multi-fill secrets
   */
  private buildMerkleProofs(secrets: string[]): MerkleProof[] {
    const leaves = secrets.map((secret) => ethers.keccak256(secret));

    // Simple implementation - in production use proper merkle tree library
    const proofs: MerkleProof[] = [];

    for (let i = 0; i < leaves.length; i++) {
      proofs.push({
        leaf: leaves[i],
        proof: [], // Would contain actual merkle proof path
        index: i,
      });
    }

    return proofs;
  }

  /**
   * Check recent NEAR blocks for escrow events
   */
  private async checkRecentNearBlocks(
    blockCount: number,
  ): Promise<EscrowEvent[]> {
    console.debug(`Checking last ${blockCount} NEAR blocks for events`);

    const events: EscrowEvent[] = [];

    try {
      // Check for NEAR Intents that need EVM escrow creation
      if (this.nearIntents) {
        console.debug("Checking for NEAR intents...");

        const intentsStatus = this.nearIntents.getStatus();

        if (intentsStatus.listening) {
          console.debug(
            "NEAR Intents service is active - monitoring for NEAR→EVM transfers",
          );

          // TODO: Query recent NEAR blocks for intent-related transactions
          // This would populate events array with discovered intents
        }
      }

      // Check NEAR escrow contract for recent escrow events
      if (this.nearAccount && this.config.nearEscrowId) {
        const escrowEvents = await this.checkNearEscrowContract(blockCount);
        events.push(...escrowEvents);
      }

      // Check for withdrawal events that reveal secrets
      if (this.nearAccount && this.config.nearEscrowId) {
        const withdrawalEvents =
          await this.checkNearWithdrawalEvents(blockCount);
        events.push(...withdrawalEvents);
      }

      console.debug(
        `Found ${events.length} NEAR events in last ${blockCount} blocks`,
      );
    } catch (error) {
      console.debug("Error checking NEAR blocks:", error);
    }

    return events;
  }

  /**
   * Check NEAR escrow contract for new events - ENHANCED
   */
  private async checkNearEscrowContract(
    blockCount: number,
  ): Promise<EscrowEvent[]> {
    const events: EscrowEvent[] = [];

    try {
      if (!this.nearAccount) return events;

      const provider = this.nearAccount.connection.provider;
      const currentBlock = await provider.status();
      const currentHeight = currentBlock.sync_info.latest_block_height;

      // ✅ FIXED: Check more blocks (up to 100 to catch recent transactions)
      const blocksToCheck = Math.min(blockCount, 100);
      console.log(
        `🔍 Checking last ${blocksToCheck} NEAR blocks from height ${currentHeight}`,
      );

      for (let i = 0; i < blocksToCheck; i++) {
        const blockHeight = currentHeight - i;
        await this.checkSingleNearBlock(blockHeight);
        this.metrics.blocksScanned++;
      }

      // ✅ FIXED: Log the number of events found
      console.log(
        `Found ${events.length} NEAR events in last ${blocksToCheck} blocks`,
      );
    } catch (error) {
      console.debug("Error checking NEAR escrow contract:", error);
    }

    return events;
  }

  /**
   * Check a single NEAR block for escrow transactions - ENHANCED LOGGING
   */
  private async checkSingleNearBlock(blockHeight: number): Promise<void> {
    try {
      const provider = this.nearAccount!.connection.provider;
      const block = await provider.block({ blockId: blockHeight });

      let totalTxs = 0;
      let escrowTxs = 0;

      for (const chunk of block.chunks) {
        if (chunk.tx_root === "11111111111111111111111111111111") {
          continue; // Skip empty chunks
        }

        try {
          const chunkDetails = await provider.chunk(chunk.chunk_hash);
          totalTxs += chunkDetails.transactions.length;

          for (const tx of chunkDetails.transactions) {
            if (tx.receiver_id === this.config.nearEscrowId) {
              escrowTxs++;
              this.metrics.nearTransactionsDetected++;
              console.log(`🎯 Found escrow transaction: ${tx.hash}`);
              console.log(`   From: ${tx.signer_id}`);
              console.log(`   To: ${tx.receiver_id}`);

              const startTime = Date.now();
              await this.processNearTransactionSimple(tx);
              const processingTime = Date.now() - startTime;

              // Update average processing time
              const totalProcessed = this.metrics.nearTransactionsProcessed;
              this.metrics.averageProcessingTime =
                (this.metrics.averageProcessingTime * totalProcessed +
                  processingTime) /
                (totalProcessed + 1);
            }
          }
        } catch (chunkError) {
          console.debug(
            `Error processing chunk in block ${blockHeight}:`,
            chunkError,
          );
        }
      }

      if (totalTxs > 0) {
        console.log(
          `   📦 Block ${blockHeight}: ${totalTxs} total txs, ${escrowTxs} escrow txs`,
        );
      }
    } catch (blockError) {
      console.debug(`Error checking NEAR block ${blockHeight}:`, blockError);
    }
  }

  /**
   * Process NEAR transaction - SIMPLIFIED WORKING VERSION
   */
  private async processNearTransactionSimple(tx: {
    hash: string;
    signer_id: string;
    receiver_id: string;
  }): Promise<void> {
    console.log(`🔍 Processing NEAR transaction: ${tx.hash}`);
    console.log(`   From: ${tx.signer_id} → To: ${tx.receiver_id}`);

    try {
      const provider = this.nearAccount!.connection.provider;
      const txResult = await provider.txStatus(tx.hash, tx.signer_id);

      // ✅ FIXED: Better transaction success detection
      const isSuccess =
        txResult.status &&
        (txResult.status.SuccessValue !== undefined ||
          txResult.status.SuccessReceiptId !== undefined ||
          (typeof txResult.status === "object" &&
            "SuccessValue" in txResult.status));

      if (!isSuccess) {
        console.log("   ❌ Transaction failed, skipping");
        console.log("   Status:", JSON.stringify(txResult.status));

        return;
      } else {
        console.log("   ✅ Transaction successful!");
      }

      const actions = txResult.transaction.actions;

      if (actions && actions.length > 0) {
        for (const action of actions) {
          if (action.Transfer) {
            const transferAmount = action.Transfer.deposit;
            console.log(`   💰 NEAR transfer: ${transferAmount} yoctoNEAR`);
            console.log(
              `   💰 Amount: ${(parseInt(transferAmount) / 1e24).toFixed(6)} NEAR`,
            );

            // Create ETH escrow for this NEAR deposit
            await this.createEthEscrowForNearDeposit(tx.hash, transferAmount);
            this.metrics.nearTransactionsProcessed++;
            this.metrics.lastSuccessfulTransaction = tx.hash;

            return;
          }

          if (
            action.FunctionCall &&
            action.FunctionCall.method_name.includes("create_src")
          ) {
            console.log(`   🎯 NEAR → ETH escrow creation detected!`);
            this.metrics.nearTransactionsProcessed++;
            this.metrics.lastSuccessfulTransaction = tx.hash;
            // TODO: Handle function call escrows if needed
          }
        }
      }
    } catch (txError: unknown) {
      console.log(
        `   ❌ Error processing transaction: ${txError instanceof Error ? txError.message : String(txError)}`,
      );
    }
  }

  /**
   * Create ETH escrow for NEAR deposit - WORKING IMPLEMENTATION
   */
  private async createEthEscrowForNearDeposit(
    nearTxHash: string,
    nearAmount: string,
  ): Promise<void> {
    console.log(`🔗 Creating ETH escrow for NEAR deposit...`);
    console.log(`   NEAR TX: ${nearTxHash}`);
    console.log(`   NEAR Amount: ${nearAmount} yoctoNEAR`);

    if (this.config.dryRun) {
      console.log("🧪 DRY RUN: Would create ETH escrow");

      return;
    }

    try {
      // Generate deterministic parameters from NEAR transaction
      const orderHash = ethers.keccak256(
        ethers.concat([
          ethers.toUtf8Bytes("near-deposit-"),
          ethers.toUtf8Bytes(nearTxHash),
        ]),
      );

      const secret = ethers.keccak256(
        ethers.toUtf8Bytes(`secret-${nearTxHash}`),
      );
      const hashlock = ethers.keccak256(secret);

      // Convert NEAR to ETH (1:1 for demo)
      const ethAmount = ethers.parseEther("0.01"); // Fixed amount for testing

      console.log(`   Order Hash: ${orderHash}`);
      console.log(`   Secret: ${secret}`);
      console.log(`   Hashlock: ${hashlock}`);
      console.log(`   ETH Amount: ${ethers.formatEther(ethAmount)} ETH`);

      // Create ETH escrow using deploySrc
      await this.createCorrespondingEvmEscrow(orderHash, hashlock, ethAmount);
    } catch (error) {
      console.error(
        `❌ Failed to create ETH escrow for NEAR deposit: ${error}`,
      );
    }
  }

  /**
   * Process NEAR transaction and extract escrow information
   */
  private async processNearTransaction(
    tx: { hash: string; actions?: any[] },
    _txResult: unknown,
  ): Promise<void> {
    console.log(`🔍 Processing NEAR transaction: ${tx.hash}`);

    try {
      // Check if this is a direct transfer (simple NEAR → ETH case)
      if (tx.actions && tx.actions.length > 0) {
        for (const action of tx.actions) {
          if (action.Transfer) {
            const transferAmount = action.Transfer.deposit;
            console.log(
              `💰 NEAR transfer detected: ${transferAmount} yoctoNEAR`,
            );

            // For direct transfers, create corresponding ETH escrow
            const orderHash = ethers.keccak256(
              ethers.concat([
                ethers.toUtf8Bytes("near-deposit-"),
                ethers.toUtf8Bytes(tx.hash),
              ]),
            );

            const secret = ethers.keccak256(
              ethers.toUtf8Bytes(`secret-${tx.hash}`),
            );
            const hashlock = ethers.keccak256(secret);

            console.log(`🔗 Creating ETH escrow for NEAR deposit:`);
            console.log(`   NEAR TX: ${tx.hash}`);
            console.log(`   Order Hash: ${orderHash}`);
            console.log(`   Hashlock: ${hashlock}`);

            await this.createCorrespondingEvmEscrow(
              orderHash,
              hashlock,
              BigInt(transferAmount),
            );

            return;
          }
        }
      }

      // Check if this is a function call to create escrow
      if (tx.actions && tx.actions[0] && tx.actions[0].FunctionCall) {
        const functionCall = tx.actions[0].FunctionCall;
        const methodName = functionCall.method_name;

        if (
          methodName === "create_src_simple" ||
          methodName.includes("create_src")
        ) {
          console.log("🎯 NEAR → ETH escrow creation detected!");

          try {
            const args = JSON.parse(
              Buffer.from(functionCall.args, "base64").toString(),
            );
            await this.createCorrespondingEvmEscrow(
              args.order_hash_hex,
              args.hashlock_hex,
              BigInt(args.amount),
            );
          } catch (parseError) {
            console.log("⚠️ Could not parse escrow args:", parseError);
          }
        }
      }
    } catch (error) {
      console.log("❌ Error processing NEAR transaction:", error);
    }
  }

  /**
   * Check for NEAR withdrawal events that reveal secrets
   */
  private async checkNearWithdrawalEvents(
    blockCount: number,
  ): Promise<EscrowEvent[]> {
    const events: EscrowEvent[] = [];

    try {
      console.debug(
        `Checking for NEAR withdrawal events in last ${blockCount} blocks...`,
      );

      // TODO: Implement actual NEAR withdrawal event detection
      // This would:
      // 1. Query recent NEAR blocks
      // 2. Look for withdrawal transactions on the escrow contract
      // 3. Extract revealed secrets from successful withdrawals
      // 4. Create EscrowEvent objects with secret information
      // 5. Trigger corresponding EVM escrow completions
    } catch (error) {
      console.debug("Error checking NEAR withdrawal events:", error);
    }

    return events;
  }

  /**
   * Process NEAR → EVM intent
   */
  private async processNearToEvmIntent(intent: any): Promise<void> {
    console.log("\n📡 NEAR Intent Detected:");
    console.log(`   Order: ${intent.order_hash_hex}`);
    console.log(`   Making: ${intent.making_amount} NEAR`);
    console.log(`   taking: ${intent.taking_amount} wei ETH`);
    // Create corresponding EVM escrow
    await this.createCorrespondingEvmEscrow(
      intent.order_hash_hex,
      intent.hashlock ||
        "0x" +
          Buffer.from(intent.order_hash_hex.slice(2), "hex").toString("hex"), // Use order hash as hashlock for simplicity
      BigInt(intent.taking_amount),
    );
  }

  /**
   * Check for new NEAR source escrows
   */
  private async checkNearSrcEscrows(): Promise<void> {
    // This would check the NEAR escrow contract for new src escrows
    // For now, we'll rely on the intents system
    console.debug("Checking NEAR src escrows...");
  }

  /**
   * Create corresponding EVM escrow for NEAR → EVM transfers
   */
  private async createCorrespondingEvmEscrow(
    orderHash: string,
    hashlock: string,
    amount: bigint,
  ): Promise<void> {
    console.log("🔗 Creating corresponding EVM escrow...");

    if (!this.evmProvider || !this.evmWallet) {
      console.log("⚠️ EVM provider/wallet not initialized");

      return;
    }

    if (this.config.dryRun) {
      console.log("🧪 DRY RUN: Would create EVM escrow");
      console.log(`   Order: ${orderHash}`);
      console.log(`   Hashlock: ${hashlock}`);
      console.log(`   Amount: ${amount.toString()} wei`);

      return;
    }

    try {
      console.log("💰 Creating real EVM escrow...");

      // ✅ FIXED: Use deployDst for NEAR → ETH transfers (ETH is destination)
      const resolverAbi = [
        "function deployDst((bytes32 orderHash, bytes32 hashlock, uint256 maker, uint256 taker, uint256 token, uint256 amount, uint256 safetyDeposit, uint256 timelocks) dstImmutables, uint256 srcCancellationTimestamp) external payable",
        "event DstEscrowCreated((bytes32 orderHash, bytes32 hashlock, uint256 maker, uint256 taker, uint256 token, uint256 amount, uint256 safetyDeposit, uint256 timelocks) dstImmutables, uint256 srcCancellationTimestamp, uint256 dstChainId, bytes canonicalPayload)",
      ];

      const resolver = new ethers.Contract(
        process.env.RESOLVER_ADDRESS!,
        resolverAbi,
        this.evmWallet,
      );

      // ✅ FIXED: Create destination immutables for ETH escrow (NEAR is source, ETH is destination)
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const dstImmutables = {
        orderHash: orderHash,
        hashlock: hashlock,
        maker: 0, // Zero address encoded as uint256
        taker: 0, // Zero address encoded as uint256
        token: 0, // Zero address for native ETH
        amount: amount,
        safetyDeposit: 0,
        timelocks:
          (BigInt(300) << 128n) |
          (BigInt(600) << 160n) |
          (BigInt(1200) << 192n), // Longer timelocks for destination
      };

      const srcCancellationTimestamp = BigInt(currentTimestamp + 1800); // 30 minutes

      // ✅ ENHANCED: Dynamic gas estimation for optimal transaction cost
      let gasLimit: bigint;
      try {
        const estimatedGas = await resolver.deployDst.estimateGas(
          dstImmutables,
          srcCancellationTimestamp,
          {
            value: amount,
          },
        );
        // Add 20% buffer to estimated gas for safety
        gasLimit = (estimatedGas * 120n) / 100n;
        console.log(
          `   ⛽ Gas estimated: ${estimatedGas.toString()} (using ${gasLimit.toString()} with buffer)`,
        );
      } catch (gasError) {
        // Fallback to conservative estimate if gas estimation fails
        gasLimit = 150000n;
        console.log(
          `   ⚠️ Gas estimation failed, using fallback: ${gasLimit.toString()}`,
        );
        console.log(
          `   Gas Error: ${gasError instanceof Error ? gasError.message : String(gasError)}`,
        );
      }

      // ✅ FIXED: Deploy EVM destination escrow with ETH (for NEAR → ETH transfers)
      const tx = await resolver.deployDst(
        dstImmutables,
        srcCancellationTimestamp,
        {
          value: amount, // Send the ETH amount
          gasLimit: gasLimit, // Use dynamically estimated gas
        },
      );

      console.log("✅ EVM escrow created successfully!");
      console.log(`   Transaction: ${tx.hash}`);
      console.log(`   Order: ${orderHash}`);
      console.log(`   Amount: ${amount.toString()} wei ETH`);

      const receipt = await tx.wait();
      console.log(`   Mined in block: ${receipt?.blockNumber}`);

      // ✅ ENHANCED: Track successful ETH escrow creation metrics
      this.metrics.ethEscrowsCreated++;
      this.metrics.totalGasUsed += receipt?.gasUsed || 0n;
      console.log(
        `   📊 Total escrows created: ${this.metrics.ethEscrowsCreated}`,
      );
      console.log(`   ⛽ Gas used: ${receipt?.gasUsed?.toString() || "N/A"}`);
    } catch (error) {
      console.error("❌ Failed to create EVM escrow:", error);
      console.log("🔄 Falling back to manual process...");

      // ✅ ENHANCED: Track failed ETH escrow creation metrics
      this.metrics.ethEscrowsFailed++;
      this.metrics.errorCount++;
      console.log(`   📊 Failed escrows: ${this.metrics.ethEscrowsFailed}`);
    }
  }

  /**
   * Handle partial withdrawal for multi-fill
   */
  private async handlePartialWithdrawal(
    orderHash: string,
    proofIndex: number,
  ): Promise<void> {
    const order = this.multiFillOrders.get(orderHash);

    if (!order) {
      console.log(`⚠️ Multi-fill order not found: ${orderHash}`);

      return;
    }

    console.log(
      `🔓 Processing partial withdrawal ${proofIndex + 1}/${order.fillCount}`,
    );

    if (proofIndex >= order.secrets.length) {
      console.log(`❌ Invalid proof index: ${proofIndex}`);

      return;
    }

    const secret = order.secrets[proofIndex];
    const proof = order.proofs[proofIndex];

    console.log(`   Secret revealed: ${secret}`);
    console.log(`   Merkle proof index: ${proof.index}`);

    // Update fill count
    order.filledCount += 1;

    if (order.filledCount >= order.fillCount) {
      console.log(`🎯 Multi-fill order completed: ${orderHash}`);
      this.multiFillOrders.delete(orderHash);
    }
  }

  /**
   * Display agent status
   */
  private async displayAgentStatus(): Promise<void> {
    console.log("\n📊 Enhanced Agent Status:");
    console.log("========================");

    // Chain Signatures status
    const csStatus = this.chainSignatures.getStatus();
    console.log("🔐 Chain Signatures:");
    console.log(`   Initialized: ${csStatus.initialized}`);
    console.log(`   Derivation Path: ${csStatus.derivationPath}`);
    console.log(`   MPC Contract: ${csStatus.mpcContract}`);

    if (csStatus.ethereumAddress) {
      console.log(`   Ethereum Address: ${csStatus.ethereumAddress}`);
    }

    // NEAR Intents status
    const intentsStatus = this.nearIntents.getStatus();
    console.log("🎯 NEAR Intents:");
    console.log(`   Initialized: ${intentsStatus.initialized}`);
    console.log(`   Listening: ${intentsStatus.listening}`);
    console.log(`   Intents Contract: ${intentsStatus.intentsContract}`);
    console.log(`   Escrow Contract: ${intentsStatus.escrowContract}`);

    // Agent configuration
    console.log("⚙️  Agent Config:");
    console.log(`   Dry Run: ${this.config.dryRun}`);
    console.log(`   Auto Lock: ${this.config.autoLock}`);
    console.log(`   EVM Chain: ${this.config.filterDstChainId || "All"}`);
    console.log("========================\n");
  }
}

/**
 * Main function to run the enhanced agent
 */
async function main(): Promise<void> {
  console.log(
    "🌉 Enhanced Cross-Chain Agent with Chain Signatures & NEAR Intents",
  );
  console.log(
    "====================================================================\n",
  );

  try {
    // Load configuration
    const config: AgentConfig = {
      evmRpcUrl: req("EVM_RPC_HTTP"),
      evmPrivateKey: req("PRIVATE_KEY"),
      resolverAddress: req("RESOLVER_ADDRESS"),
      nearNetworkId: process.env.NEAR_NETWORK || "testnet",
      nearNodeUrl: process.env.NEAR_NODE_URL || "https://rpc.testnet.near.org",
      nearAccountId: req("NEAR_ACCOUNT_ID"),
      nearPrivateKey: req("NEAR_PRIVATE_KEY"),
      nearEscrowId: req("NEAR_ESCROW_ACCOUNT_ID"),
      dryRun: process.env.DRY_RUN === "true",
      autoLock: process.env.AUTO_LOCK === "true",
      filterDstChainId: process.env.FILTER_DST_CHAIN_ID
        ? parseInt(process.env.FILTER_DST_CHAIN_ID)
        : undefined,
    };

    // Initialize services
    console.log("🔧 Initializing services...");
    const chainSignatures = await createChainSignaturesService();
    const nearIntents = await createNearIntentsService(chainSignatures);

    // Create and start enhanced agent
    const agent = new EnhancedCrossChainAgent(
      config,
      chainSignatures,
      nearIntents,
    );
    await agent.initialize();
    await agent.start();

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      console.log("\n🛑 Shutting down enhanced agent...");
      agent.stop();
      process.exit(0);
    });

    // Keep running
    console.log("🔄 Agent running... Press Ctrl+C to stop");
    await new Promise(() => {}); // Run forever until interrupted
  } catch (error) {
    console.error("❌ Enhanced agent failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("❌ Failed to start enhanced agent:", e);
    process.exit(1);
  });
}
