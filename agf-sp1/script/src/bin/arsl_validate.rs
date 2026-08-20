//! Parse + validate an ARSL file (no compile). Used by the control plane before publish.
use agf_lib::arsl;
use clap::Parser;
use std::fs;
use std::process;

#[derive(Parser, Debug)]
#[command(about = "Parse and validate a single .arsl.toml file; exit 0 on success")]
struct Args {
    /// Path to the .arsl.toml rule file
    #[arg(long, short)]
    file: String,
}

fn main() {
    let args = Args::parse();
    let toml = match fs::read_to_string(&args.file) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("arsl-validate: read {}: {e}", args.file);
            process::exit(1);
        }
    };
    let arsl = match arsl::parse_arsl(&toml) {
        Ok(a) => a,
        Err(e) => {
            eprintln!("arsl-validate: parse: {e}");
            process::exit(1);
        }
    };
    if let Err(errs) = arsl::validate(&arsl) {
        for e in &errs {
            eprintln!("arsl-validate: {e}");
        }
        process::exit(1);
    }
}
