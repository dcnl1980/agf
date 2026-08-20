//! AGF Compliance Engine — REST Server (Phase 4)
//!
//! Endpoints:
//!   GET  /health           — liveness
//!   POST /evaluate         — evaluate single ARSL rule file
//!   POST /evaluate-entity  — evaluate entity across multiple verticals
//!   GET  /audit-log        — full Blake3 hash-chained audit trail
//!   GET  /public-key       — Ed25519 public key for result verification
//!
//! Reference: AGF OpenSpec v2.0 §9

use axum::{Router, routing::{get, post}};
use std::sync::{Arc, Mutex};
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use agf_server::{api, AgfSigner, AppState, AuditLog};


#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "agf_server=info,tower_http=debug".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    dotenv::dotenv().ok();

    if std::env::var("AGF_TEE_MODE").ok().as_deref() == Some("require-hardware") {
        panic!("AGF_TEE_MODE=require-hardware is not supported by the current mock attestation implementation");
    }

    let signer = AgfSigner::from_env_or_generate();
    tracing::info!("Server public key: {}", signer.public_key_hex());

    let state = AppState {
        audit: Arc::new(Mutex::new(AuditLog::new())),
        signer: Arc::new(signer),
    };

    let app = Router::new()
        .route("/health",     get(api::health))
        .route("/evaluate",        post(api::evaluate))
        .route("/evaluate-entity", post(api::evaluate_entity))
        .route("/audit-log",       get(api::get_audit_log))
        .route("/public-key", get(api::get_public_key))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = "0.0.0.0:3000";
    tracing::info!("AGF Compliance Server listening on {}", addr);

    let listener = TcpListener::bind(addr).await.expect("Failed to bind to port 3000");
    axum::serve(listener, app).await.expect("Server crashed");
}
