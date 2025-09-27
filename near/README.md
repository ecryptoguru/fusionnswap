# NEAR Contracts

This directory contains the NEAR-side smart contracts for the Enhanced Cross-Chain Bridge system.

## 📁 Directory Structure

```
near/
├── contracts/
│   ├── escrow/          # NEAR HTLC Escrow contract
│   └── intents/         # NEAR Intents processing contract
└── README.md           # This file
```

## 🏗️ Contracts Overview

### 1. NEAR HTLC Escrow (`contracts/escrow/`)

**Status**: ✅ Production Ready

The NEAR-side Hash Time Locked Contract (HTLC) that enables atomic swaps with Ethereum.

**Key Features:**
- ✅ Hashlock/timelock verification
- ✅ Single and multi-fill support  
- ✅ NEP-141 token integration
- ✅ Safety deposit mechanisms
- ✅ Tested with real cross-chain transfers

**Main Methods:**
- `create_dst_simple()` - Create escrow (recommended)
- `withdraw_dst_hex()` - Withdraw with secret
- `cancel_dst()` - Cancel after timeout

### 2. NEAR Intents (`contracts/intents/`)

**Status**: ✅ Production Ready

Processes cross-chain intents and emits events for the Enhanced Agent to monitor.

**Key Features:**
- ✅ Intent validation and processing
- ✅ Structured event emission
- ✅ Enhanced Agent integration
- ✅ Cross-chain workflow coordination

**Main Methods:**
- `intake_intent()` - Process cross-chain intent
- `get_intents_count()` - Query processed intents

## 🚀 Building Contracts

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add WASM target
rustup target add wasm32-unknown-unknown
```

### Build All Contracts

```bash
# Build escrow contract
cd near/contracts/escrow
cargo build --target wasm32-unknown-unknown --release

# Build intents contract  
cd near/contracts/intents
cargo build --target wasm32-unknown-unknown --release
```

### Run Tests

```bash
# Test escrow contract
cd near/contracts/escrow
cargo test -- --nocapture

# Test intents contract
cd near/contracts/intents  
cargo test -- --nocapture
```

## 📦 Deployment

### Using Deployment Scripts

```bash
# Deploy escrow contract
pnpm deploy:near:escrow

# Deploy intents contract
pnpm deploy:near:intents
```

### Manual Deployment

```bash
# Deploy escrow
near deploy --accountId escrow.your-account.testnet \
  --wasmFile near/contracts/escrow/target/wasm32-unknown-unknown/release/near_htlc_escrow.wasm

# Deploy intents
near deploy --accountId intents.your-account.testnet \
  --wasmFile near/contracts/intents/target/wasm32-unknown-unknown/release/near_intents.wasm
```

## 🔧 Configuration

Both contracts require proper configuration in your `.env` file:

```bash
# NEAR Configuration
NEAR_NETWORK=testnet
NEAR_NODE_URL=https://test.rpc.fastnear.com
NEAR_ACCOUNT_ID=your-account.testnet
NEAR_PRIVATE_KEY=ed25519:YOUR_PRIVATE_KEY

# Contract-specific
NEAR_ESCROW_ACCOUNT_ID=escrow.your-account.testnet
NEAR_INTENTS_ACCOUNT_ID=intents.your-account.testnet
```

## 🔄 Integration with Enhanced Agent

These contracts work seamlessly with the Enhanced Agent:

1. **Intent Submission**: Users submit intents to the intents contract
2. **Event Emission**: Intents contract emits structured events
3. **Agent Detection**: Enhanced Agent monitors for these events
4. **Escrow Creation**: Agent creates matching escrows on both chains
5. **Atomic Execution**: Cross-chain atomic swaps are coordinated

## 📊 Production Status

**✅ FULLY OPERATIONAL**

Both contracts have been:
- ✅ Successfully deployed to NEAR testnet
- ✅ Tested with real cross-chain transfers
- ✅ Integrated with Enhanced Agent coordination
- ✅ Validated for production use

The contracts demonstrate robust cross-chain functionality with proper error handling, event emission, and integration with the broader Enhanced Cross-Chain Bridge ecosystem.

## 🔍 Contract Addresses (Testnet)

Current deployment addresses:
- **Escrow**: `escrow-1758571635851-2zms531y.fusionswap.testnet`
- **Intents**: `intents.fusionswap.testnet`

These contracts are actively processing real cross-chain transactions and coordinating with the Enhanced Agent for seamless NEAR ↔ ETH atomic swaps.
