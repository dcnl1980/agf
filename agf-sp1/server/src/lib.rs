//! AGF Compliance Engine — Library Re-exports
//!
//! This module exposes the server's core components for use by integration tests
//! and CLI binaries without duplicating the module graph.

pub mod api;
pub mod audit;
pub mod signing;
pub mod tee;

pub use audit::AuditLog;
pub use signing::AgfSigner;

use std::sync::{Arc, Mutex};

/// Shared application state threaded through all handlers.
#[derive(Clone)]
pub struct AppState {
    pub audit: Arc<Mutex<AuditLog>>,
    pub signer: Arc<AgfSigner>,
}
