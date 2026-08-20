# SP1 Development Environment Setup

> **Reference:** [AGF OpenSpec v1.0 — Section 7.1, Sprint 1](./AGF_OpenSpec_v1.md#71-phase-1-foundation-weeks-1-4)
>
> **Status:** ✅ Verified — 2026-03-06

---

## Prerequisites (All Verified ✅)

| Dependency | Required | Installed Version |
|---|---|---|
| **Git** | ✅ | 2.46.2 |
| **Rust** | ✅ (MSRV 1.91) | 1.93.1 (stable), 1.93.0-dev (succinct) |
| **Docker** | ✅ | 29.1.3 |
| **protoc** | ✅ | libprotoc 34.0 |
| **SP1 CLI** (`cargo prove`) | ✅ | sp1 v6.0.2 (7028cb0) |
| **Succinct Toolchain** | ✅ | `succinct` (via rustup) |

## Installation Steps

### 1. Install protoc (if missing)

```bash
brew install protobuf
```

### 2. Install SP1 Toolchain

```bash
# Install sp1up (the SP1 toolchain installer)
curl -L https://sp1up.succinct.xyz | bash
source ~/.zshenv

# Install the SP1 toolchain + cargo-prove CLI
sp1up
```

### 3. Verify Installation

```bash
# Verify cargo-prove CLI
cargo prove --version
# Expected: cargo-prove sp1 (7028cb0 2026-02-26T21:38:11.876176000Z)

# Verify succinct Rust toolchain
rustup toolchain list | grep succinct
# Expected: succinct

# Verify protoc
protoc --version
# Expected: libprotoc 34.0
```

## Project Structure

```
agf/
├── docs/
│   ├── AGF_OpenSpec_v1.md          # Master specification (reference for all work)
│   └── SP1_DEV_SETUP.md           # This file
├── businesscase/                   # Original business case documents
├── agf-sp1/                       # SP1 project workspace
│   ├── Cargo.toml                 # Workspace root
│   ├── program/                   # Guest program (runs inside zkVM)
│   │   └── src/main.rs            # zkVM entrypoint
│   ├── script/                    # Host script (orchestrates proving)
│   │   └── src/bin/
│   │       ├── fibonacci.rs       # Execute & prove fibonacci
│   │       ├── evm.rs             # EVM verification script
│   │       └── vkey.rs            # Verification key export
│   └── lib/                       # Shared library (types/logic)
│       └── src/lib.rs             # Fibonacci logic + public value types
└── tmp/
    └── sp1/                       # SP1 source repo (reference)
```

## Quick Start — Execute Inside zkVM

Per [OpenSpec Section 7.1](./AGF_OpenSpec_v1.md), the first sprint deliverable is a working SP1 Hello World:

```bash
cd agf-sp1

# Execute the fibonacci program inside the zkVM (no proof, just execution)
RUST_LOG=info cargo run --release --bin fibonacci -- --execute

# Expected output:
# n: 20
# a: 6765
# b: 10946
# Values are correct!
# Number of cycles: 9596
```

## Generate a Proof

```bash
cd agf-sp1

# Generate a ZK proof (CPU prover — slower but no GPU needed)
RUST_LOG=info cargo run --release --bin fibonacci -- --prove

# This will:
# 1. Execute the program inside the zkVM
# 2. Generate a core STARK proof
# 3. Verify the proof
```

> **Note:** First proof generation on CPU will take several minutes. GPU proving
> (per [OpenSpec Section 7.3, Sprint 7](./AGF_OpenSpec_v1.md)) requires CUDA and
> is dramatically faster.

## Environment Variables

See `.env.example` in the `agf-sp1/` directory:

| Variable | Purpose | Default |
|---|---|---|
| `SP1_PROVER` | Prover backend (`cpu`, `cuda`, `network`, `mock`) | `cpu` |
| `SP1_PRIVATE_KEY` | Key for Succinct Prover Network | (none) |
| `SKIP_SIMULATION` | Skip execution simulation before proving | `false` |

## Verified Benchmark (2026-03-06)

| Metric | Value |
|---|---|
| **Program** | Fibonacci (n=20) |
| **Cycle Count** | 9,596 |
| **Execution Time** | ~1.19ms |
| **Proof Mode** | Execute-only (no proving) |
| **Platform** | macOS ARM64 (Apple Silicon) |

> Per [OpenSpec Section 8.2, Test B](./AGF_OpenSpec_v1.md), this confirms that
> simple rule evaluations will fall in the ~1,000-10,000 cycle range, well within
> the <200ms proving target.

## Next Steps (from OpenSpec)

1. **Test A:** Write a compliance rule SP1 program ([OpenSpec §8.2](./AGF_OpenSpec_v1.md#82-immediate-testing-actions-start-now))
2. **Test B:** Benchmark rule complexity scaling
3. **Sprint 2:** TEE integration PoC
4. **Sprint 3:** Design ARSL (AGF Rule Specification Language)
