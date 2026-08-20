# AGF Compliance Engine — Dockerfile
#
# Multi-stage hardened build.
# Stage 1: compile the release binary (Rust toolchain)
# Stage 2: distroless runtime — no shell, no package manager, no wget, no curl
#
# Security properties:
#   - Non-root user (65532:65532 = nonroot in distroless)
#   - No shell accessible in the running container
#   - No setuid binaries
#   - Minimal attack surface (distroless/cc contains only glibc + ca-certs)

# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM rust:1.85-slim AS builder

WORKDIR /build

# Cache dependencies separately for faster rebuilds
COPY agf-sp1/Cargo.toml agf-sp1/Cargo.lock ./
COPY agf-sp1/lib ./lib
COPY agf-sp1/program ./program
COPY agf-sp1/server ./server
COPY agf-sp1/script ./script

# Build only the server binary
RUN cargo build --release --package agf-server --bin agf-server

# ─── Stage 2: Runtime (distroless) ────────────────────────────────────────────
FROM gcr.io/distroless/cc-debian12:nonroot

WORKDIR /app

# Copy the compiled binary
COPY --from=builder /build/target/release/agf-server /app/agf-server

# Copy the ARSL rule files (needed at runtime for /evaluate)
COPY agf-sp1/rules ./rules

# Metadata
LABEL org.opencontainers.image.title="AGF Compliance Engine"
LABEL org.opencontainers.image.description="Agentic Governance Framework — SP1 zkVM Rule Engine"
LABEL org.opencontainers.image.version="0.1.0"
LABEL org.opencontainers.image.source="https://github.com/neurocluster/agf"

EXPOSE 3000

# Run as nonroot (uid 65532 in distroless)
USER nonroot:nonroot

ENTRYPOINT ["/app/agf-server"]
