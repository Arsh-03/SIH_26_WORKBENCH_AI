# Company Air-Gap Security & Zero-Egress Compliance Policy

## 1. Zero-Egress Enclave Mandate
All artificial intelligence workloads, data processing, and document retrieval must execute strictly on-premise within isolated physical hardware enclaves.

## 2. External Network Controls
- Outbound network requests to external public IP addresses are blocked by default via local packet interception.
- Telemetry logging must use internal cryptographic SHA-256 hashes (`AuditLog`).
- No proprietary industrial schematics, blueprints, or employee credentials shall ever leave the facility network boundary.

## 3. Vector Database & Storage Security
- Company blueprints and official SOPs are stored in the `company_shared` vector collection.
- User-specific private chat uploads are isolated into dedicated user vector spaces (`user_private`) and cannot be accessed across tenant boundaries.
