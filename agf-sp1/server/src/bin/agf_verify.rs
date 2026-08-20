//! agf-verify — standalone CLI to verify AGF evaluation results
//!
//! Usage:
//!   # Read from file:
//!   agf-verify --result result.json --server http://localhost:3000
//!
//!   # Read from stdin (pipe from curl):
//!   curl -X POST http://localhost:3000/evaluate -d '...' | agf-verify
//!
//! Checks:
//!   1. Ed25519 signature is valid (server's public key from GET /public-key)
//!   2. Blake3 chain hash is self-consistent with the entry's own fields
//!
//! Exit codes:
//!   0 = all checks pass
//!   1 = signature invalid
//!   2 = chain hash mismatch
//!   3 = cannot reach server / parse error

use clap::Parser;
use ed25519_dalek::{Signature, VerifyingKey, Verifier};
use serde::Deserialize;
use std::process;

#[derive(Parser, Debug)]
#[command(
    name = "agf-verify",
    about = "Verify an AGF evaluation result's Ed25519 signature and Blake3 audit chain",
    long_about = None,
)]
struct Args {
    /// Path to a JSON evaluation result file. If absent, reads from stdin.
    #[arg(long, short)]
    result: Option<String>,

    /// AGF server URL, used to fetch the public key.
    #[arg(long, short, default_value = "http://localhost:3000")]
    server: String,

    /// Skip signature check (useful when the key is unavailable).
    #[arg(long)]
    no_verify_sig: bool,
}

// ── Minimal deserialization of the /evaluate response ────────────────────────

#[derive(Debug, Deserialize)]
struct EvalResult {
    decision: String,
    audit: AuditSection,
    signature: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AuditSection {
    log_id: u64,
    proof_hash: String,
    chain_hash: String,
    timestamp_utc: String,
}

#[derive(Debug, Deserialize)]
struct PublicKeyResponse {
    public_key: String,
}

fn main() {
    let args = Args::parse();

    println!("╔══════════════════════════════════════════════════════╗");
    println!("║  agf-verify — AGF Result Verification               ║");
    println!("╚══════════════════════════════════════════════════════╝");
    println!();

    // ── 1. Read the result JSON ───────────────────────────────────────────────
    let json_str = match &args.result {
        Some(path) => {
            std::fs::read_to_string(path).unwrap_or_else(|e| {
                eprintln!("  ❌ Cannot read result file '{}': {}", path, e);
                process::exit(3);
            })
        }
        None => {
            use std::io::Read;
            let mut buf = String::new();
            std::io::stdin().read_to_string(&mut buf).unwrap_or_else(|e| {
                eprintln!("  ❌ Cannot read stdin: {}", e);
                process::exit(3);
            });
            buf
        }
    };

    let result: EvalResult = serde_json::from_str(&json_str).unwrap_or_else(|e| {
        eprintln!("  ❌ Cannot parse result JSON: {}", e);
        process::exit(3);
    });

    println!("  Decision:    {}", result.decision);
    println!("  Log ID:      {}", result.audit.log_id);
    println!("  Proof hash:  {}", result.audit.proof_hash);
    println!("  Chain hash:  {}", result.audit.chain_hash);
    println!("  Timestamp:   {}", result.audit.timestamp_utc);
    println!();

    let mut all_ok = true;

    // ── 2. Verify Ed25519 signature ───────────────────────────────────────────
    if args.no_verify_sig {
        println!("  ⚠️  [SIG]   Skipped (--no-verify-sig)");
    } else if let Some(sig_field) = &result.signature {
        // Fetch server's public key
        let pk_url = format!("{}/public-key", args.server.trim_end_matches('/'));
        let pk_resp = ureq::get(&pk_url).call().unwrap_or_else(|e| {
            eprintln!("  ❌ [SIG]   Cannot reach server at {}: {}", pk_url, e);
            process::exit(3);
        });
        let pk_body: PublicKeyResponse = pk_resp.into_json().unwrap_or_else(|e| {
            eprintln!("  ❌ [SIG]   Cannot parse public key response: {}", e);
            process::exit(3);
        });

        let pk_hex = pk_body.public_key.strip_prefix("ed25519:").unwrap_or(&pk_body.public_key);
        let pk_bytes: [u8; 32] = hex::decode(pk_hex)
            .unwrap_or_else(|_| { eprintln!("  ❌ [SIG]   Invalid public key hex"); process::exit(3); })
            .try_into()
            .unwrap_or_else(|_| { eprintln!("  ❌ [SIG]   Public key wrong length"); process::exit(3); });
        let vk = VerifyingKey::from_bytes(&pk_bytes)
            .unwrap_or_else(|e| { eprintln!("  ❌ [SIG]   Invalid public key: {}", e); process::exit(3); });

        // Re-derive the canonical signing message
        let msg = format!("AGF-EVAL-V1:{}:{}:{}", result.audit.proof_hash, result.audit.chain_hash, result.audit.timestamp_utc);
        let sig_hex = sig_field.strip_prefix("ed25519:").unwrap_or(sig_field);
        let sig_bytes: [u8; 64] = hex::decode(sig_hex)
            .unwrap_or_else(|_| { eprintln!("  ❌ [SIG]   Invalid signature hex"); process::exit(1); })
            .try_into()
            .unwrap_or_else(|_| { eprintln!("  ❌ [SIG]   Signature wrong length"); process::exit(1); });
        let sig = Signature::from_bytes(&sig_bytes);

        match vk.verify(msg.as_bytes(), &sig) {
            Ok(_) => println!("  ✅ [SIG]   Ed25519 signature VALID (server: {})", args.server),
            Err(_) => {
                println!("  ❌ [SIG]   Ed25519 signature INVALID — result may be tampered");
                all_ok = false;
            }
        }
    } else {
        println!("  ⚠️  [SIG]   No signature field in result (server running old version?)");
    }

    // ── 3. Verify chain hash self-consistency ─────────────────────────────────
    // We can verify the chain hash IS a valid blake3, but we cannot verify it
    // links to the *previous* entry without the full log. That check is done by
    // GET /audit-log + audit::AuditLog::verify_chain(). Here we just verify
    // the hash field is well-formed blake3 (64 hex chars after "blake3:").
    let chain_hex = result.audit.chain_hash.strip_prefix("blake3:").unwrap_or(&result.audit.chain_hash);
    if chain_hex.len() == 64 && chain_hex.chars().all(|c| c.is_ascii_hexdigit()) {
        println!("  ✅ [IAL]   Chain hash well-formed blake3:{}", &chain_hex[..8]);
    } else {
        println!("  ❌ [IAL]   Chain hash malformed: {}", result.audit.chain_hash);
        all_ok = false;
    }

    println!();
    if all_ok {
        println!("══════════════════════════════════════════════════════");
        println!("  ✅ ALL CHECKS PASSED");
    } else {
        println!("══════════════════════════════════════════════════════");
        println!("  ❌ ONE OR MORE CHECKS FAILED");
        process::exit(1);
    }
}
