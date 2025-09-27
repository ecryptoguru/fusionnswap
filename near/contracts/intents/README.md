# NEAR Intents Contract (Production Ready)

## ✅ Status: FULLY OPERATIONAL

This contract handles cross-chain intent processing for the Enhanced Cross-Chain Bridge. It receives intents from users and emits structured events that the Enhanced Agent monitors to coordinate cross-chain atomic swaps.

**Key Features:**
- ✅ Intent intake and validation
- ✅ Structured event emission for agent monitoring
- ✅ Integration with Enhanced Agent workflow
- ✅ Production-tested with real cross-chain transfers

## Build

```bash
rustup target add wasm32-unknown-unknown
cd near/contracts/intents
cargo build --target wasm32-unknown-unknown --release
```

Wasm artifact: `target/wasm32-unknown-unknown/release/near_intents.wasm`

## Local unit tests

```bash
cd near/contracts/intents
cargo test -- --nocapture
```

## Key entrypoints

- `new()` — initialize contract
- `intake_intent(intent: V1Intent)` — process a cross-chain intent
- `get_intents_count()` — get total number of processed intents

## Intent Structure (V1Intent)

```rust
pub struct V1Intent {
    pub maker_near: AccountId,        // NEAR account initiating the swap
    pub taker_near: AccountId,        // NEAR account receiving (usually same as maker)
    pub maker_asset_near: AccountId,  // Source asset on NEAR (e.g., "near", "wrap.testnet")
    pub taker_asset_evm: String,      // Target asset on EVM (hex address, "0x0...0" for ETH)
    pub making_amount: String,        // Amount being sent (in smallest units)
    pub taking_amount: String,        // Amount expected to receive (in smallest units)
    pub order_hash_hex: String,       // 32-byte order hash (0x prefixed)
    pub dst_chain_id: u64,           // Destination chain ID (11155111 for Sepolia)
    pub timelocks_hex: String,       // Packed timelocks (hex encoded)
}
```

## Usage Example

```bash
# Deploy the contract
near deploy --accountId intents.your-account.testnet --wasmFile target/wasm32-unknown-unknown/release/near_intents.wasm

# Submit a cross-chain intent
near call intents.your-account.testnet intake_intent '{
  "intent": {
    "maker_near": "your-account.testnet",
    "taker_near": "your-account.testnet", 
    "maker_asset_near": "near",
    "taker_asset_evm": "0x0000000000000000000000000000000000000000",
    "making_amount": "10000000000000000000000000",
    "taking_amount": "100000000000000000",
    "order_hash_hex": "0x1234567890abcdef...",
    "dst_chain_id": 11155111,
    "timelocks_hex": "0x..."
  }
}' --accountId your-account.testnet --gas 300000000000000

# Check total intents processed
near view intents.your-account.testnet get_intents_count
```

## Event Structure

When an intent is processed, the contract emits a structured event:

```json
{
  "standard": "near-intents",
  "version": "1.0.0", 
  "event": "IntentIntake",
  "data": {
    "seq": 1,
    "intent": { /* V1Intent structure */ }
  }
}
```

## Integration with Enhanced Agent

The Enhanced Agent monitors this contract for `IntentIntake` events and automatically:

1. **Detects** new cross-chain intents
2. **Validates** intent parameters and structure  
3. **Creates** corresponding escrows on both NEAR and EVM sides
4. **Coordinates** the atomic swap process
5. **Uses Chain Signatures** for decentralized key management

## Production Deployment

This contract is deployed and operational on NEAR testnet as part of the Enhanced Cross-Chain Bridge system. It successfully processes real cross-chain intents and coordinates with the Enhanced Agent for seamless NEAR ↔ ETH atomic swaps.
