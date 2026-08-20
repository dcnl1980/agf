//! AGF Feasibility Benchmark — SP1 Host Script
//!
//! This is the host-side orchestrator that:
//! 1. Prepares compliance rule inputs
//! 2. Feeds them to the SP1 zkVM guest program
//! 3. Executes the program (and optionally generates a proof)
//! 4. Verifies the output and reports benchmarks
//!
//! Reference: AGF OpenSpec v1.0, Section 8.2 — Tests A & B
//!
//! Usage:
//!   # Execute only (fast, no proof)
//!   RUST_LOG=info cargo run --release --bin benchmark -- --execute
//!
//!   # Execute and generate Core STARK proof
//!   RUST_LOG=info cargo run --release --bin benchmark -- --prove
//!
//!   # Generate Groth16 compressed proof (~250KB, EVM-verifiable)
//!   RUST_LOG=info cargo run --release --bin benchmark -- --prove --groth16
//!
//!   # Generate PLONK compressed proof (alternative to Groth16)
//!   RUST_LOG=info cargo run --release --bin benchmark -- --prove --plonk
//!
//!   # Run with custom rule count for scaling test (Test B)
//!   RUST_LOG=info cargo run --release --bin benchmark -- --execute --rules 50

use clap::Parser;
use sp1_sdk::{
    blocking::{ProveRequest, Prover, ProverClient},
    include_elf, Elf, ProvingKey, SP1Stdin,
};
use std::time::Instant;

use agf_lib::{sample_fca_rules, ComplianceBatch, ComplianceInput, ConditionKind};

/// The ELF binary for the AGF compliance rule evaluator (compiled for SP1 zkVM).
const AGF_ELF: Elf = include_elf!("agf-program");

/// Which proof system to use for compressed proofs.
#[derive(Debug, Clone, Copy, PartialEq)]
enum ProofSystem {
    /// Core STARK proof (~7.4MB, off-chain verification only)
    Core,
    /// Groth16 compressed proof (~250KB, EVM-verifiable, requires ~16GB RAM)
    Groth16,
    /// PLONK compressed proof (~400KB, EVM-verifiable, universal setup)
    Plonk,
}

impl std::fmt::Display for ProofSystem {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProofSystem::Core => write!(f, "Core STARK"),
            ProofSystem::Groth16 => write!(f, "Groth16 (compressed)"),
            ProofSystem::Plonk => write!(f, "PLONK (compressed)"),
        }
    }
}

#[derive(Parser, Debug)]
#[command(
    author = "AGF / NeuroCluster",
    version,
    about = "AGF Feasibility Benchmark — SP1 zkVM Compliance Rule Proving"
)]
struct Args {
    /// Execute the program inside the zkVM (no proof generation)
    #[arg(long)]
    execute: bool,

    /// Generate a ZK proof of compliance rule evaluation
    #[arg(long)]
    prove: bool,

    /// Use Groth16 proof system for compressed, EVM-verifiable proofs (~250KB).
    /// Requires ~16GB RAM. First run downloads a ~2GB trusted setup.
    /// Only valid with --prove.
    #[arg(long)]
    groth16: bool,

    /// Use PLONK proof system for compressed, EVM-verifiable proofs (~400KB).
    /// Uses a universal (untrusted) setup. Only valid with --prove.
    #[arg(long)]
    plonk: bool,

    /// Number of rules to evaluate (for scaling benchmarks, Test B)
    /// Default: 10 (the sample FCA rules)
    #[arg(long, default_value = "10")]
    rules: u32,
}

fn main() {
    // Setup logging and environment
    sp1_sdk::utils::setup_logger();
    dotenv::dotenv().ok();

    let args = Args::parse();

    if args.execute == args.prove {
        eprintln!("Error: You must specify either --execute or --prove");
        std::process::exit(1);
    }

    if args.groth16 && args.plonk {
        eprintln!("Error: Cannot use both --groth16 and --plonk. Choose one.");
        std::process::exit(1);
    }

    if (args.groth16 || args.plonk) && !args.prove {
        eprintln!("Error: --groth16 and --plonk are only valid with --prove");
        std::process::exit(1);
    }

    let proof_system = if args.groth16 {
        ProofSystem::Groth16
    } else if args.plonk {
        ProofSystem::Plonk
    } else {
        ProofSystem::Core
    };

    // -----------------------------------------------------------------------
    // Prepare compliance rule inputs
    // -----------------------------------------------------------------------
    let batch = if args.rules <= 10 {
        // Use the built-in sample FCA rules
        sample_fca_rules()
    } else {
        // Generate synthetic rules for scaling test (OpenSpec §8.2, Test B)
        generate_scaling_batch(args.rules)
    };

    println!("╔═══════════════════════════════════════════════════════════════╗");
    println!("║         AGF Feasibility Benchmark — SP1 zkVM                 ║");
    println!("║   Reference: OpenSpec v1.0 §8.2 — Tests A & B               ║");
    println!("╚═══════════════════════════════════════════════════════════════╝");
    println!();
    println!("  Rules to evaluate: {}", batch.rules.len());
    if args.execute {
        println!("  Mode: EXECUTE");
    } else {
        println!("  Mode: PROVE ({})", proof_system);
    }
    println!();

    // -----------------------------------------------------------------------
    // Setup the SP1 prover client
    // -----------------------------------------------------------------------
    let setup_start = Instant::now();
    let client = ProverClient::from_env();
    let setup_time = setup_start.elapsed();
    println!("  Prover client initialized in {:?}", setup_time);

    // -----------------------------------------------------------------------
    // Prepare inputs for the zkVM
    // -----------------------------------------------------------------------
    let mut stdin = SP1Stdin::new();
    stdin.write(&batch);

    if args.execute {
        // -----------------------------------------------------------------
        // EXECUTE MODE — Run inside zkVM, no proof generation
        // -----------------------------------------------------------------
        println!("\n─── Executing inside SP1 zkVM ───────────────────────────────");

        let exec_start = Instant::now();
        let (output, report) = client.execute(AGF_ELF, stdin).run().unwrap();
        let exec_time = exec_start.elapsed();

        // Read the committed public values
        let mut reader = output.as_slice();
        let total_rules: u32 = read_value(&mut reader);
        let pass_count: u32 = read_value(&mut reader);
        let block_count: u32 = read_value(&mut reader);
        let all_compliant: bool = read_value(&mut reader);

        // Print results
        println!();
        println!("  ┌─────────────────────────────────────────────────────────┐");
        println!("  │                    COMPLIANCE RESULTS                   │");
        println!("  ├─────────────────────────────────────────────────────────┤");
        println!(
            "  │  Decision:     {}                              │",
            if all_compliant { "✅ PASS" } else { "🚫 BLOCK" }
        );
        println!("  │  Total Rules:  {:<42}│", total_rules);
        println!("  │  Passed:       {:<42}│", pass_count);
        println!("  │  Blocked:      {:<42}│", block_count);
        println!("  └─────────────────────────────────────────────────────────┘");

        // Print individual rule results
        println!();
        println!("  Individual Rule Results:");
        println!("  ┌────────┬───────────┬──────────┬───────────┬────────────┐");
        println!("  │ Rule   │ Decision  │ Value    │ Threshold │ Margin     │");
        println!("  ├────────┼───────────┼──────────┼───────────┼────────────┤");
        for _ in 0..total_rules {
            let rule_id: u32 = read_value(&mut reader);
            let compliant: bool = read_value(&mut reader);
            let actual: u64 = read_value(&mut reader);
            let threshold: u64 = read_value(&mut reader);
            let margin: i64 = read_value(&mut reader);
            println!(
                "  │ {:<6} │ {:<9} │ {:<8} │ {:<9} │ {:>+8} bp │",
                rule_id,
                if compliant { "✅ PASS" } else { "🚫 BLOCK" },
                actual,
                threshold,
                margin,
            );
        }
        println!("  └────────┴───────────┴──────────┴───────────┴────────────┘");

        // Print benchmark results
        let cycles = report.total_instruction_count();
        println!();
        println!("  ┌─────────────────────────────────────────────────────────┐");
        println!("  │                    BENCHMARK RESULTS                    │");
        println!("  │           (OpenSpec §8.2 — Test A & B)                  │");
        println!("  ├─────────────────────────────────────────────────────────┤");
        println!("  │  Execution Time:    {:<36}│", format!("{:?}", exec_time));
        println!("  │  Total Cycles:      {:<36}│", format!("{}", cycles));
        println!(
            "  │  Cycles per Rule:   {:<36}│",
            format!("{}", cycles / total_rules as u64)
        );
        println!("  │  Rules Evaluated:   {:<36}│", total_rules);
        println!("  └─────────────────────────────────────────────────────────┘");
    } else {
        // -----------------------------------------------------------------
        // PROVE MODE — Generate a ZK proof (Core STARK, Groth16, or PLONK)
        // -----------------------------------------------------------------
        println!(
            "\n─── Generating ZK Proof ({}) ───────────────────",
            proof_system
        );

        let setup_start = Instant::now();
        let pk = client.setup(AGF_ELF).expect("failed to setup ELF");
        let setup_time = setup_start.elapsed();
        println!("  Setup complete in {:?}", setup_time);

        let prove_start = Instant::now();
        let proof = match proof_system {
            ProofSystem::Core => {
                client
                    .prove(&pk, stdin)
                    .run()
                    .expect("failed to generate core proof")
            }
            ProofSystem::Groth16 => {
                println!("  ⚠️  Groth16 requires ~16GB RAM. First run downloads trusted setup (~2GB).");
                client
                    .prove(&pk, stdin)
                    .groth16()
                    .run()
                    .expect("failed to generate Groth16 proof")
            }
            ProofSystem::Plonk => {
                println!("  ⚠️  PLONK proving may take several minutes on CPU.");
                client
                    .prove(&pk, stdin)
                    .plonk()
                    .run()
                    .expect("failed to generate PLONK proof")
            }
        };
        let prove_time = prove_start.elapsed();

        let proof_bytes = serde_json::to_vec(&proof).unwrap();
        let proof_size = proof_bytes.len();
        let proof_size_display = if proof_size > 1_000_000 {
            format!("{:.2} MB", proof_size as f64 / 1_000_000.0)
        } else if proof_size > 1_000 {
            format!("{:.1} KB", proof_size as f64 / 1_000.0)
        } else {
            format!("{} bytes", proof_size)
        };

        println!("  ✅ Proof generated in {:?}", prove_time);
        println!("  Proof size: {} ({} bytes)", proof_size_display, proof_size);

        // Verify the proof
        let verify_start = Instant::now();
        client
            .verify(&proof, pk.verifying_key(), None)
            .expect("failed to verify proof");
        let verify_time = verify_start.elapsed();

        println!("  ✅ Proof verified in {:?}", verify_time);

        println!();
        println!("  ┌─────────────────────────────────────────────────────────┐");
        println!("  │                    PROVING BENCHMARK                    │");
        println!("  │           (OpenSpec §8.2 — Test A)                      │");
        println!("  ├─────────────────────────────────────────────────────────┤");
        println!(
            "  │  Proof System:      {:<36}│",
            format!("{}", proof_system)
        );
        println!(
            "  │  Setup Time:        {:<36}│",
            format!("{:?}", setup_time)
        );
        println!(
            "  │  Proving Time:      {:<36}│",
            format!("{:?}", prove_time)
        );
        println!(
            "  │  Verification Time: {:<36}│",
            format!("{:?}", verify_time)
        );
        println!(
            "  │  Proof Size:        {:<36}│",
            proof_size_display
        );
        println!("  │  Rules Evaluated:   {:<36}│", batch.rules.len());
        println!("  └─────────────────────────────────────────────────────────┘");

        // ── Comparison note for compressed proofs ────────────────────────────
        if proof_system != ProofSystem::Core {
            println!();
            println!("  ┌─────────────────────────────────────────────────────────┐");
            println!("  │  ℹ️  Compressed proof generated. Key properties:        │");
            println!("  │                                                         │");
            match proof_system {
                ProofSystem::Groth16 => {
                    println!("  │  • Proof type: Groth16 (circuit-specific setup)       │");
                    println!("  │  • EVM-verifiable: YES (cheapest on-chain gas cost)   │");
                    println!("  │  • Typical size: ~250KB (vs ~7.4MB Core STARK)        │");
                }
                ProofSystem::Plonk => {
                    println!("  │  • Proof type: PLONK (universal setup)                │");
                    println!("  │  • EVM-verifiable: YES (no circuit-specific setup)    │");
                    println!("  │  • Typical size: ~400KB (vs ~7.4MB Core STARK)        │");
                }
                _ => {}
            }
            println!("  │  • Can be verified on-chain (Ethereum, Base, etc.)     │");
            println!("  └─────────────────────────────────────────────────────────┘");
        }
    }
}

/// Generate a larger batch of synthetic rules for scaling benchmarks (Test B).
fn generate_scaling_batch(count: u32) -> ComplianceBatch {
    let mut rules = Vec::with_capacity(count as usize);
    for i in 0..count {
        rules.push(ComplianceInput {
            rule_id: i + 1,
            // Alternate between passing and near-threshold values
            actual_value: 800 + (i as u64 * 37) % 500,
            minimum_threshold: 800,
            maximum_threshold: 0,
            timestamp: 1709769600,
            entity_id: 1001 + (i % 10),
            condition_kind: ConditionKind::Minimum,
            set_members: vec![],
        });
    }
    ComplianceBatch { rules }
}

/// Helper to read a value from the public values byte slice.
fn read_value<T: serde::de::DeserializeOwned>(reader: &mut &[u8]) -> T {
    let size = std::mem::size_of::<T>();
    let (bytes, rest) = reader.split_at(size);
    *reader = rest;
    // Read as little-endian bytes
    unsafe { std::ptr::read_unaligned(bytes.as_ptr() as *const T) }
}
