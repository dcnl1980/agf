# Kernel Licensing Decision Record

Date: 2026-04-23  
Status: Approved for repository setup; legal confirmation required before public launch.

## Decision

AGF will publish the full `agf-sp1` kernel code under Apache-2.0 as part of the
public repository, while enterprise-only value is delivered in a separate private
repository through extension modules and proprietary packaging.

## Why this decision

- Public auditability of deterministic policy evaluation supports trust and adoption.
- Apache-2.0 is broadly acceptable for enterprise procurement and includes patent terms.
- A private extension layer allows closed-source enterprise features without mixing
  proprietary code into the public repository.

## Known tradeoff

Publishing `agf-sp1` under a permissive license means third parties can fork and
build the kernel from source. Competitive moat therefore relies on enterprise
distribution, support, integrations, operational quality, and brand.

## Counsel checkpoint (required)

Before public announcement, legal counsel must confirm:

1. Apache-2.0 suitability for the kernel and surrounding components.
2. Trademark usage boundaries for AGF branding.
3. Enterprise contract language for private add-ons and support terms.
4. Any patent/export considerations tied to cryptographic and zk-related components.
