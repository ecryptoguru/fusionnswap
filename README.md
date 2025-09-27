# Enhanced Cross-Chain Resolver with Chain Signatures & NEAR Intents

A production-ready **decentralized cross-chain bridge** between **NEAR** and **Ethereum** featuring:

- 🔐 **Chain Signatures** for decentralized key management
- 🎯 **NEAR Intents** for cross-chain workflow automation  
- 🌉 **Bidirectional Atomic Swaps** (NEAR ↔ ETH)
- 🤖 **Enhanced Agent** with automated cross-chain coordination
- ⚡ **Real-time Monitoring** of both NEAR and EVM chains

## ✅ System Status

**🎉 FULLY OPERATIONAL** - Successfully tested with real cross-chain transfers:
- ✅ NEAR → ETH transfers working
- ✅ Enhanced agent coordination active
- ✅ Chain Signatures integration functional
- ✅ NEAR Intents processing operational
- ✅ Atomic swap mechanisms verified

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 22.0.0
- **pnpm** package manager
- **Foundry** for Solidity development
- **Rust** and **cargo** for NEAR contracts

### Installation

```shell
# Install dependencies
pnpm install

# Install Foundry
curl -L https://foundry.paradigm.xyz | bash

# Initialize submodules
git submodule update --init --recursive

# Build contracts
forge build
```

### Configuration

Copy and configure your environment:

```shell
cp .env.example .env
# Edit .env with your API keys and account details
```

### Running the System

```shell
# Run integration tests
pnpm test

# Start the enhanced agent
pnpm agent

# Test cross-chain transfer (in another terminal)
tsx scripts/transfer-near-to-eth-correct.ts
```

## 🏗️ Architecture

### Core Components

- **Enhanced Agent** (`scripts/enhanced-agent.ts`) - Monitors both chains and coordinates swaps
- **Chain Signatures Service** - Decentralized key management via NEAR MPC
- **NEAR Intents Service** - Processes cross-chain intents and triggers workflows
- **EVM Resolver Contract** - Handles Ethereum-side escrow and atomic swaps
- **NEAR Escrow Contract** - Manages NEAR-side escrow and withdrawals

### Cross-Chain Flow

1. **Intent Submission** - User submits cross-chain intent via NEAR Intents
2. **Escrow Creation** - Funds locked in source chain escrow
3. **Agent Detection** - Enhanced agent detects and processes the intent
4. **Destination Escrow** - Agent creates matching escrow on destination chain
5. **Atomic Swap** - User withdraws from destination using secret, revealing it to complete the swap

## 🔧 Environment Configuration

Essential environment variables (see `.env.example`):

```bash
# EVM Configuration (Sepolia Testnet)
ETH_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY

# NEAR Configuration (Testnet) 
NEAR_NODE_URL=https://test.rpc.fastnear.com
NEAR_ACCOUNT_ID=your-account.testnet
NEAR_PRIVATE_KEY=ed25519:YOUR_NEAR_KEY
NEAR_INTENTS_ACCOUNT_ID=intents.your-account.testnet

# Chain Signatures
NEAR_MPC_CONTRACT_ID=v2.multichain-mpc.testnet
CS_ENDPOINT=https://test.rpc.fastnear.com
```

## 🔧 Available Scripts

```bash
# Core functionality
pnpm test                    # Run integration tests
pnpm agent                   # Start enhanced agent
pnpm lint                    # Lint TypeScript files

# Deployment
pnpm deploy:near:intents     # Deploy NEAR Intents contract
pnpm deploy:near:escrow      # Deploy NEAR Escrow contract

# Cross-chain transfers
pnpm transfer:near-to-eth    # Test NEAR → ETH transfer
pnpm transfer:eth-to-near    # Test ETH → NEAR transfer

# End-to-end testing
pnpm e2e:all                 # Run all E2E tests
pnpm e2e:bidirectional       # Test bidirectional flows
```

## ⚠️ Important Notes

### Decimal Precision Handling
- **ETH**: 18 decimals (1 ETH = 10^18 wei)
- **NEAR**: 24 decimals (1 NEAR = 10^24 yoctoNEAR)
- The system automatically handles conversion between these precision levels

### RPC Endpoints
- **Recommended NEAR RPC**: `https://test.rpc.fastnear.com` (higher rate limits)
- **Avoid**: `https://rpc.testnet.near.org` (deprecated, rate limited)

## 🐛 Troubleshooting

### Common Issues

**NEAR RPC Rate Limiting**
```bash
# Error: Rate limits exceeded
# Solution: Update .env to use FastNEAR
NEAR_NODE_URL=https://test.rpc.fastnear.com
CS_ENDPOINT=https://test.rpc.fastnear.com
```

**Chain Signatures MPC Issues**
```bash
# Warning: MPC contract deserialization errors
# This is normal for testnet - functionality still works
```

**NEAR Intents Account ID Validation**
```bash
# Error: Account ID contains invalid character
# Solution: Ensure NEAR_INTENTS_ACCOUNT_ID is set
NEAR_INTENTS_ACCOUNT_ID=intents.your-account.testnet
```

**Escrow Creation Failures**
```bash
# Error: Method doesn't accept deposit
# Solution: Contract uses create_dst_simple method (automatically handled)
```

### System Requirements
- **Node.js** >= 22.0.0 (required for BigInt handling)
- **pnpm** (preferred package manager)
- **Foundry** (for Solidity compilation)
- **Rust** (for NEAR contract compilation)

## Test accounts

### Available Accounts

```
(0) 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" Owner of EscrowFactory
(1) 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" User
(2) 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" Resolver
```

## Phase 5 — NEAR Intents Integration (DRY_RUN)

This repo includes a DRY_RUN agent that consumes NEAR Intents and prints a structured Fusion+ meta-order payload, without posting to any REST APIs or submitting Fusion orders.

### 1) Start the agent (DRY_RUN)

````bash
FILTER_DST_CHAIN_ID=11155111 \
FILTER_ORDER_HASH=0x000000000000000000000000000000000000000000000000000000000000abcd \
DRY_RUN=true \
MODE=listen \
pnpm run agent
``)

What you’ll see on new intents:

- `[NEAR IntentIntake] {...}`
- `[DRY_RUN] Fusion+ MetaOrder {...}`
- `[DRY_RUN] Fusion+ SDK payload (example, not submitted) {...}`

No Fusion/REST submissions are performed. Keep `FUSION_SUBMIT` unset/false.

### 2) Submit a NEAR intent (uses near-api-js)

Ensure `.env` has `NEAR_NODE_URL` set (e.g., Pagoda testnet RPC) and `NEAR_INTENTS_ACCOUNT_ID` correctly configured.

```bash
pnpm tsx scripts/submit-intent.ts
````

By default this reads `intent2.json` in repo root. To submit a different JSON:

```bash
INTENT_PATH=./intent.json pnpm tsx scripts/submit-intent.ts
```

### 3) Offline validation harness (no network)

```bash
pnpm tsx scripts/print-meta-order.ts
INTENT_PATH=./intent.json pnpm tsx scripts/print-meta-order.ts
```

This prints the structured meta-order and example SDK payload. No external calls.

### 4) Optional: NEAR-only action (no Fusion)

To mirror a destination escrow on NEAR without Fusion or REST:

```bash
ACTION=near-deploy-escrow \
DRY_RUN=false \
pnpm run agent
```

This calls `create_dst_simple` on `NEAR_ESCROW_ACCOUNT_ID` using fields from the intent (and `.env` fallbacks). Use carefully; funds may move on-chain.

### Notes

- If `zod` is installed, intent payloads are strictly validated. Otherwise the agent falls back to lightweight checks.
- Keep `FUSION_SUBMIT` unset/false to guarantee that no Fusion orders are posted.
