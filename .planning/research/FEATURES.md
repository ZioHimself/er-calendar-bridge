# Features Research

**Domain:** NGO calendar sync bridge (7 people, 4 schedulers)
**Researched:** 2026-09-11
**Confidence:** HIGH (requirements defined in IT strategy)

## Table Stakes

| Feature | Why table stakes |
|---------|------------------|
| One-way CalDAV → Google/Graph sync | Core product |
| Per-event `CATEGORIES` classification | Security model |
| Default untagged → busy-block | Fail-closed policy |
| Content washing (strip PII fields) | Data protection |
| Drop `ER-SENSITIVE` entirely | No leak, not even busy |
| Create / update / delete propagation | Correctness |
| Recurring series + exceptions | Highest real-world bug surface |
| UID-based idempotency | Restart safety |
| Read-only source | Requirement §6.1 |
| Per-member credential isolation | Blast-radius control |
| Pilot single-account mode | Requirement §7.1 |
| Offboarding teardown | HR-security policy |

## Differentiators (for our context)

| Feature | Value |
|---------|-------|
| Withhold notifications to event owner | Prompts correct tagging; audit trail |
| Operator observability (logs/health) | See sync health + withhold counts |
| Portable secrets adapter (sops → Vault) | Laptop → server without rewrite |
| Explicit restrict-only classifier | No code path to full disclosure without `ER-PUBLIC` |

## Anti-Features (deliberately NOT built)

| Feature | Reason |
|---------|--------|
| Two-way sync | Out of scope; mailbox.org stays source of truth |
| Write-back classification tags | Expands blast radius; human act only |
| CalDAV support for Google/Outlook clients | Use native CalDAV clients instead |
| Shared merged calendar | Concentrates everyone's events |
| Kubernetes | Disproportionate at this scale |
| Consumer NAS hosting | Security history (CVE-2025-30247) |
| Admin UI for tag management | Tags live in mailbox.org UI |
| Python implementation | Type safety requirement |

## v2 Candidates (defer)

| Feature | Defer reason |
|---------|--------------|
| Vault/OpenBao runtime (vs sops interim) | Phase 1 production, not pilot |
| Multi-member rollout automation | After pilot validates |
| CalDAV-native client onboarding guide | Documentation, not code |
| Metrics/Prometheus export | pino logs sufficient for pilot |
