# BrandPilot — Enterprise AI Branding Platform
## Implementation Plan & Technical Blueprint

| | |
|---|---|
| **Document** | IMPLEMENTATION_PLAN.md |
| **Product** | BrandPilot |
| **Version** | 1.0 (Greenfield Baseline) |
| **Status** | Draft for Engineering Sign-off |
| **Date** | 2026-07-30 |
| **Architecture Pillars** | Scalability · Security · Maintainability · Configurability · Performance · Extensibility |
| **Key Decisions** | Multi-tenant from day one · First-class Capacitor mobile parity · Hostinger VPS + Docker |

> **How to read this document.** This is the single source of truth for BrandPilot's design. It is written so that a new engineer can go from zero to a running mental model of every subsystem, and so that architecture reviewers can trace every requirement to a design decision. Diagrams are expressed in Mermaid so they render in GitHub/GitLab and can be version-controlled alongside code. The Prisma schema, API contracts, and configuration keys in this document are intended to be copied more-or-less verbatim into the codebase.

## Implementation Delta (2026-07-30)

This section captures production-facing implementation changes completed during the current delivery session for dynamic frame export behavior.

### Completed

- Frame detail API now returns `templateLayers` in addition to `dynamicFields`, `thumbnailUrl`, and `renderSize` to support layer-aware rendering paths in clients.
- Web export pipeline was upgraded from a basic thumbnail overlay approach to a hybrid renderer:
  - thumbnail-authoritative base render for visual parity,
  - deterministic dynamic text/image replacement in placeholder slots,
  - geometry-based image slot matching hardening to avoid full-canvas logo replacement,
  - duplicate text suppression via semantic grouping (`name`, `mobile`, `website`, `email`, `address`) and overlap checks,
  - stronger default-text erase pass before writing user-entered values,
  - per-field style override support for sensitive templates (font size, color, line height, padding).
- Export output resolution was verified as full-size PNG (`1280x720`) in browser runtime checks.

### Current Limitation

- Imported legacy templates can still carry inconsistent layer naming and repeated text blocks. Even with semantic dedupe, exact pixel parity may vary by template if layer metadata is incomplete or noisy.

### Next Hardening Steps

- Add optional admin-managed explicit field-to-layer mapping (slot lock) per frame version to guarantee deterministic replacement for problematic templates.
- Add a template quality validator at publish time to reject frames with ambiguous duplicate text layers unless an explicit slot map is provided.
- Add screenshot-based golden tests for representative frames to catch visual regressions in export rendering.

---

## Table of Contents

**Part 1 — Foundations**
1. [Executive Summary](#1-executive-summary)
2. [Functional Requirements](#2-functional-requirements)
3. [Non-Functional Requirements](#3-non-functional-requirements)
4. [System Architecture (C4)](#4-system-architecture-c4)

**Part 2 — Data & API**
5. [Database Design (ER + Prisma Schema)](#5-database-design)
6. [API Specifications (OpenAPI/Swagger)](#6-api-specifications)

**Part 3 — Core Domains**
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Wallet & Razorpay Architecture](#8-wallet--razorpay-architecture)
9. [AI Service Integration (OpenAI + Runway)](#9-ai-service-integration)
10. [Dynamic Frame Engine](#10-dynamic-frame-engine)
11. [File Storage Strategy (Hostinger)](#11-file-storage-strategy)

**Part 4 — Apps & Platform**
12. [Admin Panel Modules](#12-admin-panel-modules)
13. [User Dashboard Modules](#13-user-dashboard-modules)
14. [Background Jobs & Queue Design](#14-background-jobs--queue-design)
15. [Configuration Management System](#15-configuration-management-system)
16. [Error Handling & Recovery](#16-error-handling--recovery)
17. [Security Strategy](#17-security-strategy)
18. [Performance & Scalability](#18-performance--scalability)
19. [Logging, Monitoring & Audit](#19-logging-monitoring--audit)

**Part 5 — Delivery & Risk**
20. [Testing Strategy](#20-testing-strategy)
21. [Deployment & CI/CD](#21-deployment--cicd)
22. [Backup & Disaster Recovery](#22-backup--disaster-recovery)
23. [Risk Assessment & Mitigation](#23-risk-assessment--mitigation)
24. [Complete Edge-Case Catalogue](#24-complete-edge-case-catalogue)
25. [Future Roadmap](#25-future-roadmap)

[Appendix A — Glossary](#appendix-a--glossary) · [Appendix B — Environment Variables](#appendix-b--environment-variables) · [Appendix C — Configuration Key Registry](#appendix-c--configuration-key-registry)

---
---

# Part 1 — Foundations

## 1. Executive Summary

### 1.1 What BrandPilot Is

BrandPilot is a multi-tenant, AI-powered branding platform that lets end-users generate branded marketing assets — images and short videos — by combining a **dynamic frame** (a designer-authored template with typed placeholders) with **AI generation** (OpenAI Images for stills, Runway for video) and their own brand data (logo, name, company, contact details, colors). Usage is metered through a **credit wallet** funded via **Razorpay**. Everything that governs the product — pricing, AI provider keys, credit costs, frame catalogue, feature flags, branding of the app itself — is configurable at runtime through an **Admin Panel** with **zero code changes**.

The platform ships as three coordinated surfaces on a shared backend:

- a **NestJS REST API** (the system of record and orchestration layer),
- a **React admin panel** (operator control plane), and
- a **React + Capacitor** end-user application that runs identically as a web app and as native Android/iOS builds.

### 1.2 Problem Statement

Small businesses, creators, and enterprise marketing teams need on-brand visual content quickly but lack design resources. Generic AI image tools produce content that is off-brand, inconsistent, and hard to templatize. BrandPilot closes that gap: designers (or admins) publish **frames** with placeholders like `{{logo}}`, `{{company}}`, `{{tagline}}`; users fill in their brand once; and the system produces consistent, on-brand assets at scale, billed transparently by credits.

### 1.3 Goals & Non-Goals

**Goals**

- A production-ready, enterprise-grade platform, not a prototype.
- Fully configurable operation: no business constant hardcoded in the app tier.
- Multi-tenant isolation so the same deployment can serve many organizations (agencies, resellers, enterprises) with per-tenant branding, pricing, and data separation.
- Reliable metered billing with strict financial correctness (no double-charge, no lost credit, full auditability).
- Resilient AI orchestration: long-running, failure-prone provider calls handled asynchronously with retries, idempotency, and graceful degradation.
- True mobile parity through Capacitor: offline drafts, resumable uploads, and push notifications on Android/iOS.

**Non-Goals (v1)**

- No in-house model training or hosting; BrandPilot orchestrates third-party providers behind an abstraction.
- No full design editor (Canva-style freeform canvas); v1 is template-driven via frames. A richer editor is a roadmap item.
- No marketplace/monetization for third-party frame authors in v1 (roadmap).

### 1.4 Target Users & Personas

| Persona | Surface | Needs |
|---|---|---|
| **End User (Creator/SMB)** | Mobile + Web app | Pick a frame, enter brand data, generate, download, manage wallet & history. |
| **Tenant Admin (Agency/Org owner)** | Admin panel (tenant scope) | Manage their org's users, frames, pricing plans, branding, view analytics. |
| **Platform Super-Admin (BrandPilot operator)** | Admin panel (global scope) | Manage tenants, global AI keys/limits, platform config, maintenance mode, global analytics. |
| **Support/Ops** | Admin panel (scoped role) | Refunds, manual wallet adjustments, investigating failed jobs, reading logs/audit. |
| **Finance** | Admin panel (scoped role) | Revenue, reconciliation with Razorpay, AI cost reporting. |

### 1.5 Solution Overview (One Paragraph)

A React/Capacitor client authenticates against the NestJS API (JWT access + rotating refresh tokens, RBAC scoped by tenant). The user selects a frame; the API resolves the frame's placeholder schema and returns a render preview. On "Generate," the API performs a **transactional credit hold**, enqueues an AI job to a Redis/BullMQ queue, and returns immediately. Workers call the provider adapter (OpenAI/Runway), poll or receive webhooks for completion, store the result in Hostinger file storage under a deterministic path, write an immutable `AiAsset` record with full metadata and cost, and **settle** the credit hold (deduct on success, release on failure). Razorpay funds the wallet through a webhook-verified, idempotent recharge flow. Admins configure every knob — prices, costs, limits, keys, frames, branding — through the admin panel, persisted in a versioned configuration store and hot-reloaded by the app.

### 1.6 Key Architectural Decisions (ADR Summary)

| # | Decision | Rationale | Alternatives Rejected |
|---|---|---|---|
| ADR-01 | **Multi-tenant, shared-schema with `tenantId` scoping** | Cost-efficient, simplest ops on a single Hostinger VPS; enables per-tenant config/branding now. | Schema-per-tenant (ops overhead), DB-per-tenant (cost, migration pain). Kept as roadmap for large enterprise isolation. |
| ADR-02 | **Async AI via BullMQ on Redis** | AI calls are slow and flaky; queue gives retries, rate control, idempotency, backpressure. | Synchronous requests (poor UX, timeouts), cloud queue (extra infra vs. Hostinger VPS goal). |
| ADR-03 | **Credit "hold → settle" ledger model** | Guarantees financial correctness under concurrency and failures; no negative balances, no double-charge. | Deduct-on-request (loses credits on failure), deduct-on-complete (allows overspend via concurrency). |
| ADR-04 | **Runtime configuration store with versioning + cache** | "Nothing hardcoded" requirement; safe rollbacks; hot reload. | `.env`-only config (requires redeploys), hardcoded constants (violates requirement). |
| ADR-05 | **Provider abstraction (`ImageProvider`, `VideoProvider` interfaces)** | Swap/add AI providers without touching business logic; future multi-provider routing. | Direct SDK calls in services (tight coupling). |
| ADR-06 | **Capacitor single codebase for web + native** | Mobile parity requirement with one React codebase; native plugins for camera, filesystem, push. | Separate native apps (duplicate effort), PWA-only (weaker native uploads/push). |
| ADR-07 | **Prisma ORM on Hostinger MySQL** | Type-safe schema, migrations, transactions; matches stack requirement. | Raw SQL/knex (less safety), TypeORM (heavier, migration friction). |
| ADR-08 | **Idempotency keys on all mutating financial/AI endpoints** | Eliminates duplicate charges/generations from retries, double-taps, webhook replays. | Best-effort dedup (unreliable). |
| ADR-09 | **Outbox pattern for webhooks/notifications** | Reliable event delivery despite crashes; exactly-once-ish semantics. | Fire-and-forget (lost events). |
| ADR-10 | **Structured JSON logging + correlation IDs, split log streams** | Observability requirement; traceable requests across API→queue→worker→provider. | Plaintext logs (hard to query). |

### 1.7 High-Level Scope Map

```mermaid
mindmap
  root((BrandPilot))
    Identity
      Auth JWT + Refresh
      RBAC + Tenants
      Sessions/Devices
    Billing
      Wallet Ledger
      Razorpay Recharge
      Plans/Promos/Bonus
      Refunds/Adjustments
    Generation
      Dynamic Frames
      Image OpenAI
      Video Runway
      Job Queue
    Content
      Assets + Metadata
      Projects/Favourites
      Hostinger Storage
    Control Plane
      Admin Panel
      Runtime Config
      Feature Flags
      Analytics
    Platform
      Notifications
      Logging/Audit
      Security
      CI/CD + DR
```

### 1.8 Delivery Phasing (Executive View)

| Phase | Theme | Exit Criteria |
|---|---|---|
| **P0 — Skeleton** | Monorepo, CI, auth, tenants, config store, DB migrations | A user can register/login within a tenant; config is DB-driven. |
| **P1 — Wallet** | Razorpay recharge, ledger, plans | A user can recharge and see an accurate balance & transactions. |
| **P2 — Generation** | Frame engine, image gen, queue, storage, asset history | A user can generate & download a framed AI image; credits settle correctly. |
| **P3 — Video + Admin** | Runway video, full admin panel, analytics | Admin configures everything; video generation works end-to-end. |
| **P4 — Mobile & Hardening** | Capacitor native builds, offline/resume, push, security review, load test | Native apps in stores (internal track); SLOs met under load test. |

See [Section 21](#21-deployment--cicd) for the engineering-level phase/task breakdown.

---

## 2. Functional Requirements

Requirements use IDs `FR-<domain>-<n>`. Each is testable. Priority: **M**=Must (v1), **S**=Should (v1 if time), **C**=Could (later), **W**=Won't (v1, roadmap).

### 2.1 Identity, Tenancy & Accounts

| ID | Requirement | Pri |
|---|---|---|
| FR-AUTH-1 | Users register with email + password; email verification required before generation. | M |
| FR-AUTH-2 | Users log in and receive a short-lived JWT access token and a rotating refresh token. | M |
| FR-AUTH-3 | Refresh tokens rotate on use; reuse of a rotated token revokes the session family (theft detection). | M |
| FR-AUTH-4 | Users can be logged in on multiple devices; each device is a tracked session revocable individually or all-at-once. | M |
| FR-AUTH-5 | Password reset via emailed, single-use, expiring token. | M |
| FR-AUTH-6 | Every user, resource, and request is scoped to exactly one `tenantId`; cross-tenant access is impossible via API. | M |
| FR-AUTH-7 | Optional social login (Google/Apple) — Apple required for iOS store compliance if other social login exists. | S |
| FR-AUTH-8 | Optional MFA (TOTP) for admin roles. | S |
| FR-AUTH-9 | Account soft-delete with retention window and hard-delete job (GDPR erasure). | M |

### 2.2 Roles & Permissions (RBAC)

| ID | Requirement | Pri |
|---|---|---|
| FR-RBAC-1 | Roles: `SUPER_ADMIN` (global), `TENANT_ADMIN`, `SUPPORT`, `FINANCE`, `USER`. Permissions are granular and role→permission mappings are configurable. | M |
| FR-RBAC-2 | Every endpoint declares required permission(s); missing permission → 403. | M |
| FR-RBAC-3 | `SUPER_ADMIN` can impersonate a tenant/user for support, with full audit trail and a visible banner. | S |
| FR-RBAC-4 | Admins can create custom roles by composing permissions (config-driven, no code change). | S |

### 2.3 Wallet & Payments

| ID | Requirement | Pri |
|---|---|---|
| FR-WALLET-1 | Each user has a wallet with an integer credit balance; balance is always derivable from an append-only ledger. | M |
| FR-WALLET-2 | Users recharge via configurable plans (amount → credits, optional bonus). | M |
| FR-WALLET-3 | Razorpay order creation, client checkout, and server-side webhook verification (signature-checked). | M |
| FR-WALLET-4 | Recharge is idempotent: duplicate callbacks/webhooks credit exactly once. | M |
| FR-WALLET-5 | Credits may have expiry; expired credits are swept and ledgered. | S |
| FR-WALLET-6 | Promotional/bonus credits grantable by admin (bulk or targeted), with expiry and reason. | M |
| FR-WALLET-7 | Admin can issue refunds (to Razorpay and/or as credits) and manual adjustments, each audited with reason. | M |
| FR-WALLET-8 | Balance can never go negative; concurrent spends are serialized safely. | M |
| FR-WALLET-9 | Low-balance notification when balance crosses a configurable threshold. | S |
| FR-WALLET-10 | Full transaction history with filters (type, date, status) and export. | M |

### 2.4 AI Generation

| ID | Requirement | Pri |
|---|---|---|
| FR-GEN-1 | Users generate images via OpenAI Images with prompt, optional negative prompt, size, and selected frame. | M |
| FR-GEN-2 | Users generate short videos via Runway with prompt and parameters. | M |
| FR-GEN-3 | Generation is asynchronous: request returns a `job` immediately; client observes status via polling and/or push. | M |
| FR-GEN-4 | Credit cost is computed from configurable per-provider/per-model/per-size pricing at request time. | M |
| FR-GEN-5 | On success, the asset is stored, an immutable `AiAsset` record is written with full metadata (see §2.6), and credits are settled. | M |
| FR-GEN-6 | On failure/cancellation/timeout, held credits are released; user sees a clear reason. | M |
| FR-GEN-7 | Per-user and per-tenant concurrency limits and daily/monthly generation limits are enforced (configurable). | M |
| FR-GEN-8 | Generation requests are idempotent via client idempotency key. | M |
| FR-GEN-9 | Content moderation hook: prompts/outputs can be screened before storage/display (configurable). | S |
| FR-GEN-10 | Regenerate/variation from a prior asset, reusing its parameters. | S |

### 2.5 Dynamic Frame System

| ID | Requirement | Pri |
|---|---|---|
| FR-FRAME-1 | Admin uploads a frame with a template definition (layout + typed placeholders) and assets (background, overlays, fonts). | M |
| FR-FRAME-2 | Placeholders are typed and validated: `text`, `email`, `phone`, `url`, `image/logo`, `multiline`, `color`, `list` (e.g., social links). | M |
| FR-FRAME-3 | Admin can define **custom placeholders** with type, validation, default, and required flag — no frontend code change. | M |
| FR-FRAME-4 | Frontend fetches the frame's placeholder schema dynamically and renders the correct input controls. | M |
| FR-FRAME-5 | Server renders a **preview** with placeholders substituted before AI generation. | M |
| FR-FRAME-6 | Frames support versioning; editing publishes a new version while preserving historical assets' provenance. | M |
| FR-FRAME-7 | Frames belong to categories/subcategories with ranking, display order, featured/trending/premium/free, active/hidden. | M |
| FR-FRAME-8 | Missing/broken placeholder mappings and invalid template JSON are detected at publish time and blocked with clear errors. | M |
| FR-FRAME-9 | Premium frames require entitlement (plan/role/credit gate) to use. | S |
| FR-FRAME-10 | Users can favourite frames; favourites are per-user. | M |

### 2.6 Assets, Projects & History

| ID | Requirement | Pri |
|---|---|---|
| FR-ASSET-1 | Every generated asset stores: user, tenant, prompt, negative prompt, frame + frame version, model, provider, credits used, generation time, status, monetary cost, image/video URL, thumbnail URL, and a metadata JSON blob. | M |
| FR-ASSET-2 | Users can list, filter, download, favourite, and (soft-)delete their assets. | M |
| FR-ASSET-3 | Users can save **projects**: a saved combination of frame + placeholder values + generation params, re-runnable. | M |
| FR-ASSET-4 | Thumbnails are generated for every asset. | M |
| FR-ASSET-5 | Download provides a time-limited signed URL. | M |

### 2.7 Admin & Configuration

| ID | Requirement | Pri |
|---|---|---|
| FR-ADMIN-1 | Admin manages users (create/search/filter/suspend/soft-delete/restore). | M |
| FR-ADMIN-2 | Admin manages frames, categories, ranking, tags, featured/premium flags, versions, and previews. | M |
| FR-ADMIN-3 | Admin manages wallet operations: view transactions, manual recharge, refund, bonus, adjustment. | M |
| FR-ADMIN-4 | Admin configures AI: provider API keys (encrypted), timeouts, retries, queue size, credit costs, per-user/tenant limits. | M |
| FR-ADMIN-5 | Admin configures app branding (name, logo, theme/colors), payment plans, maintenance mode, upload limits, allowed file types, storage paths, feature flags, daily/monthly limits. | M |
| FR-ADMIN-6 | Admin views analytics (see §2.8). | M |
| FR-ADMIN-7 | All admin mutations are audited (who, what, before/after, when, IP). | M |
| FR-ADMIN-8 | Configuration changes are versioned and rollback-able. | M |

### 2.8 Analytics

| ID | Requirement | Pri |
|---|---|---|
| FR-ANALYTICS-1 | Dashboards for: active users, revenue, AI requests, credits used, wallet recharges, storage usage, top frames, failed jobs, AI provider cost, API usage. | M |
| FR-ANALYTICS-2 | Filter by date range and tenant (super-admin) / self (tenant-admin). | M |
| FR-ANALYTICS-3 | Exportable reports (CSV). | S |

### 2.9 Notifications

| ID | Requirement | Pri |
|---|---|---|
| FR-NOTIF-1 | Channels: Email, Push (mobile), In-App. | M |
| FR-NOTIF-2 | Events: recharge success, recharge failed, AI completed, AI failed, wallet low balance. | M |
| FR-NOTIF-3 | Per-user notification preferences per channel/event. | S |
| FR-NOTIF-4 | Templated, localizable messages; templates are admin-editable (config-driven). | S |

### 2.10 Mobile-Specific (Capacitor)

| ID | Requirement | Pri |
|---|---|---|
| FR-MOB-1 | The React app runs as native Android and iOS via Capacitor from one codebase. | M |
| FR-MOB-2 | Offline mode: browse cached frames and prior assets; queue drafts created offline. | M |
| FR-MOB-3 | Resumable, interrupt-tolerant uploads for logos/images over slow/flaky networks. | M |
| FR-MOB-4 | Push notifications via FCM (Android) and APNs (iOS). | M |
| FR-MOB-5 | Native camera/gallery access for logo/photo upload. | S |
| FR-MOB-6 | Graceful behavior on app background/kill during upload or generation. | M |

---

## 3. Non-Functional Requirements

### 3.1 Performance & Latency (SLOs)

| Metric | Target |
|---|---|
| API read p95 (cached/simple) | ≤ 200 ms |
| API write p95 (excluding AI provider time) | ≤ 400 ms |
| Generation request acknowledgement (enqueue) p95 | ≤ 500 ms |
| Preview render p95 | ≤ 1.5 s |
| Image generation end-to-end p50 / p95 | ≤ 15 s / ≤ 45 s (provider-bound) |
| Video generation | provider-bound; UX designed for minutes with progress |
| Frontend Largest Contentful Paint (web, mid-tier mobile) | ≤ 2.5 s |
| Availability (API) | 99.9% monthly |

### 3.2 Scalability

- Horizontally scalable stateless API instances behind Nginx; sessions/state in Redis/MySQL, never in-process.
- Workers scale independently of API by queue depth.
- Design targets (v1 on single beefy Hostinger VPS, vertical headroom first): 50k registered users/tenant, 500 req/s aggregate API, 5k AI jobs/day, with a documented path to multi-node (see [§18](#18-performance--scalability)).
- Data model and queries designed to remain performant at 10M+ `AiAsset` rows via indexing and partition-ready keys.

### 3.3 Reliability & Availability

- No single generation or payment may be lost or double-applied (exactly-once financial effects via ledger + idempotency + outbox).
- Graceful degradation: if an AI provider is down, requests queue/backoff and users are informed; the rest of the app stays up.
- Maintenance mode gates writes while keeping read/status available where possible.
- RPO ≤ 15 min, RTO ≤ 2 h (see [§22](#22-backup--disaster-recovery)).

### 3.4 Security & Privacy

- OWASP ASVS L2 as the baseline target. Details in [§17](#17-security-strategy).
- Encryption in transit (TLS 1.2+), encryption at rest for secrets (provider keys) and backups.
- PII minimization; per-tenant data isolation; GDPR/DPDP (India) erasure & export.
- Payment handling is PCI-DSS SAQ-A: card data never touches BrandPilot servers (Razorpay hosted/checkout).

### 3.5 Maintainability

- TypeScript everywhere; strict mode; shared types package between API and clients.
- Modular NestJS (feature modules), clear domain boundaries, dependency inversion for providers.
- ≥ 80% unit coverage on domain/business logic; contract tests on provider adapters.
- Conventional commits, ADRs for significant decisions, automated lint/format.

### 3.6 Configurability

- Every business constant (prices, costs, limits, keys, timeouts, paths, flags, branding) lives in the runtime config store and is changeable via admin without redeploy. See [§15](#15-configuration-management-system) and [Appendix C](#appendix-c--configuration-key-registry).

### 3.7 Observability

- Structured JSON logs with correlation/trace IDs across API→queue→worker→provider.
- Metrics (RED/USE), health/readiness endpoints, dashboards, and alerting.
- Distinct log streams: application, API access, wallet, AI, payment, error, audit.

### 3.8 Accessibility & i18n

- WCAG 2.1 AA for web/admin; localizable strings (v1 English, architecture ready for multi-language).
- RTL-ready layout primitives (roadmap languages).

### 3.9 Compliance & Legal

- Terms/Privacy acceptance tracked with versioning and timestamp.
- Content ownership/licensing: generated assets' rights follow provider terms; surfaced to users.
- Data residency configurable per tenant (roadmap for non-Hostinger regions).

### 3.10 Constraints & Assumptions

- Primary DB is Hostinger MySQL; primary blob storage is Hostinger file storage (SFTP/S3-compatible where available). Redis runs on the VPS (Docker) for cache/queue.
- Third-party providers (OpenAI, Runway, Razorpay) are external dependencies with their own SLAs, rate limits, and outage risk — the architecture must tolerate their failure.
- Single-region v1; multi-region is roadmap.

---

## 4. System Architecture (C4)

The architecture is described using the **C4 model**: Context → Containers → Components → (key) Code. Diagrams are Mermaid.

### 4.1 C1 — System Context

```mermaid
graph TB
    subgraph Users
      EU[End User<br/>web + Android/iOS]
      AD[Admin / Ops / Finance]
    end

    BP[BrandPilot Platform]

    OAI[OpenAI Images API]
    RW[Runway API]
    RZP[Razorpay]
    HS[Hostinger MySQL + File Storage]
    EMAIL[Email Provider SMTP/API]
    PUSH[FCM / APNs]

    EU -->|HTTPS REST| BP
    AD -->|HTTPS REST| BP
    BP -->|image gen| OAI
    BP -->|video gen| RW
    BP -->|orders, webhooks| RZP
    BP -->|data + blobs| HS
    BP -->|transactional email| EMAIL
    BP -->|device push| PUSH
    RZP -->|payment webhooks| BP
    RW -->|job webhooks/polling| BP
```

**Actors & externals.** End users and administrators interact only through BrandPilot's REST API. BrandPilot depends on OpenAI (images), Runway (video), Razorpay (payments), Hostinger (persistence + blobs), an email provider, and mobile push gateways. External providers call back via webhooks; BrandPilot verifies every inbound webhook.

### 4.2 C2 — Container Diagram

```mermaid
graph TB
    subgraph Client Tier
      WEB[Web App<br/>React + Vite]
      MOB[Mobile App<br/>React + Capacitor<br/>Android/iOS]
      ADMIN[Admin Panel<br/>React + Vite]
    end

    subgraph Edge
      NGX[Nginx<br/>TLS, reverse proxy,<br/>rate limit, static]
    end

    subgraph App Tier - Docker on Hostinger VPS
      API[NestJS API<br/>stateless, N instances]
      WRK[Worker(s)<br/>BullMQ consumers]
      SCH[Scheduler<br/>cron: expiry, sweeps, reconcile]
    end

    subgraph Data Tier
      MYSQL[(Hostinger MySQL<br/>Prisma)]
      REDIS[(Redis<br/>cache + queues + rate limit)]
      BLOB[(Hostinger File Storage<br/>frames/users/generated/thumbnails)]
    end

    subgraph External
      OAI[OpenAI]
      RW[Runway]
      RZP[Razorpay]
      EMAIL[Email]
      PUSH[FCM/APNs]
    end

    WEB --> NGX
    MOB --> NGX
    ADMIN --> NGX
    NGX --> API
    API --> MYSQL
    API --> REDIS
    API --> BLOB
    API -->|enqueue| REDIS
    WRK -->|consume| REDIS
    WRK --> MYSQL
    WRK --> BLOB
    WRK --> OAI
    WRK --> RW
    API --> RZP
    RZP -->|webhook| NGX
    RW -->|webhook| NGX
    WRK --> EMAIL
    WRK --> PUSH
    SCH --> MYSQL
    SCH --> REDIS
```

**Containers.**

- **Web App / Mobile App / Admin Panel** — three React front-ends. The user-facing web and mobile apps share the majority of their code (Capacitor wraps the same React app; platform differences behind an abstraction layer). The admin panel is a separate React app for security and bundle isolation.
- **Nginx (edge)** — TLS termination, reverse proxy to API, serves static SPA bundles, coarse rate limiting/IP throttling, request size caps, and routes webhook paths.
- **NestJS API** — stateless request/response, auth, RBAC, tenant scoping, validation, transactional writes, enqueues jobs. Runs as N identical Docker containers.
- **Worker(s)** — BullMQ consumers executing AI generation, thumbnailing, notifications, webhooks/outbox, and heavy IO. Scaled by queue depth, isolated from request latency.
- **Scheduler** — cron-style jobs: credit expiry sweeps, payment reconciliation, stuck-job reaper, audit retention, backup triggers, analytics rollups.
- **MySQL** — system of record (Prisma). **Redis** — cache, BullMQ queues, rate-limit counters, distributed locks, idempotency store. **Hostinger File Storage** — binary assets.

### 4.3 C3 — Component Diagram (NestJS API)

```mermaid
graph TB
    subgraph NestJS Application
      subgraph Cross-Cutting
        GUARD[Auth Guard + JWT]
        RBAC[RBAC/Permission Guard]
        TEN[Tenant Context Middleware]
        IDEMP[Idempotency Interceptor]
        VAL[Validation Pipe]
        LOGI[Logging/Correlation Interceptor]
        EXC[Global Exception Filter]
      end

      AUTHM[Auth Module]
      USERM[Users Module]
      TENANTM[Tenants Module]
      WALLETM[Wallet Module]
      PAYM[Payments Module - Razorpay]
      GENM[Generation Module]
      FRAMEM[Frames Module]
      ASSETM[Assets Module]
      PROJM[Projects Module]
      STORAGEM[Storage Module]
      CONFIGM[Config Module]
      NOTIFM[Notifications Module]
      ANALYTM[Analytics Module]
      AUDITM[Audit Module]
      ADMINM[Admin Module facade]
      HEALTHM[Health Module]
    end

    PROV[Provider Adapters<br/>ImageProvider/VideoProvider/PaymentProvider/StorageProvider]

    GENM --> PROV
    PAYM --> PROV
    STORAGEM --> PROV
    GENM --> WALLETM
    GENM --> FRAMEM
    GENM --> ASSETM
    WALLETM --> PAYM
    ADMINM --> USERM
    ADMINM --> FRAMEM
    ADMINM --> WALLETM
    ADMINM --> CONFIGM
    ADMINM --> ANALYTM
    CONFIGM -.hot reload.-> GENM
    CONFIGM -.hot reload.-> WALLETM
    AUDITM -.observes.-> ADMINM
```

**Component notes.** Cross-cutting concerns are implemented as Nest guards/interceptors/pipes/filters applied globally: JWT auth → tenant context resolution → RBAC permission check → idempotency → validation → business handler, with logging/correlation and a global exception filter wrapping everything. Feature modules own their domain and expose services; the **Generation** module orchestrates Frames + Wallet + Assets + Provider adapters. The **Config** module publishes change events that other modules subscribe to for hot reload. The **Provider Adapters** package hides every third-party SDK behind BrandPilot-owned interfaces (ADR-05).

### 4.4 C4 — Key Code: Generation Orchestration (sequence)

```mermaid
sequenceDiagram
    participant C as Client
    participant API as NestJS API
    participant DB as MySQL
    participant Q as Redis/BullMQ
    participant W as Worker
    participant P as AI Provider
    participant S as Hostinger Storage

    C->>API: POST /generations (frameId, prompt, values, Idempotency-Key)
    API->>API: Auth + tenant + RBAC + validate
    API->>DB: BEGIN TX
    API->>DB: check idempotency key
    API->>DB: resolve frame + cost from config
    API->>DB: create Generation(status=QUEUED)
    API->>DB: wallet HOLD credits (ledger entry)
    API->>DB: COMMIT
    API->>Q: enqueue generation job (jobId=generationId)
    API-->>C: 202 { generationId, status: QUEUED }

    W->>Q: reserve job
    W->>DB: mark RUNNING
    W->>P: submit generation (with retries/timeouts)
    P-->>W: result (or async job id)
    alt success
      W->>S: upload asset + thumbnail (deterministic path)
      W->>DB: create AiAsset(metadata,cost) + SETTLE hold (deduct)
      W->>DB: mark SUCCEEDED
      W->>Q: enqueue notification(AI completed)
    else failure/timeout/cancel
      W->>DB: RELEASE hold (refund credits) + mark FAILED(reason)
      W->>Q: enqueue notification(AI failed)
    end

    C->>API: GET /generations/{id} (poll) or receives push
    API->>DB: read status
    API-->>C: status + asset (if ready)
```

### 4.5 Deployment View (Hostinger VPS + Docker)

```mermaid
graph TB
    subgraph Internet
      CDN[Optional CDN/Cloudflare<br/>TLS, WAF, static/image cache]
    end

    subgraph Hostinger VPS
      subgraph Docker Compose
        NGX[nginx]
        API1[api-1]
        API2[api-2]
        WRK1[worker-1]
        WRK2[worker-2]
        SCH[scheduler]
        REDIS[(redis)]
      end
      VOL[(local volumes:<br/>redis data, tmp uploads)]
    end

    subgraph Hostinger Managed
      MYSQL[(MySQL)]
      FILES[(File Storage)]
    end

    CDN --> NGX
    NGX --> API1
    NGX --> API2
    API1 --> MYSQL
    API2 --> MYSQL
    API1 --> REDIS
    WRK1 --> REDIS
    WRK1 --> FILES
    WRK1 --> MYSQL
    SCH --> REDIS
```

**Deployment notes.** A single Hostinger VPS runs the full stack under Docker Compose: Nginx, 2+ API containers, 2+ workers, a scheduler, and Redis (with a persisted volume). MySQL and File Storage are Hostinger-managed services reached over the network. An optional CDN/Cloudflare layer fronts TLS/WAF and caches static bundles and public asset thumbnails. This satisfies the "Hostinger VPS + Docker" decision while leaving a clean vertical-then-horizontal scaling path (add API/worker replicas; later move Redis and workers to a second node). Full topology, scaling triggers, and the multi-node evolution are in [§18](#18-performance--scalability) and [§21](#21-deployment--cicd).

### 4.6 Multi-Tenancy Model (cross-cutting)

BrandPilot is **multi-tenant, shared-schema** (ADR-01). Every tenant-owned table carries a non-null `tenantId` foreign key. Isolation is enforced in layers so a single missed check cannot leak data:

1. **Request scoping.** A `TenantContextMiddleware` resolves the active tenant from the authenticated principal (a user belongs to exactly one tenant; super-admins may assume a tenant explicitly). The resolved `tenantId` is stored in a request-scoped context (`AsyncLocalStorage`).
2. **Query scoping.** A Prisma middleware/extension automatically injects `where: { tenantId }` on all reads and sets `tenantId` on all writes for tenant-scoped models, so application code cannot forget it.
3. **Config scoping.** Configuration resolves in a hierarchy: **tenant override → platform default → hardcoded safe fallback** (see [§15](#15-configuration-management-system)). Branding, pricing, limits, and even feature flags can differ per tenant.
4. **Storage scoping.** Blob paths are namespaced by tenant (`t_<tenantId>/users/<userId>/...`), and signed-URL generation validates tenant ownership.
5. **Auth scoping.** JWT claims include `tid` (tenant id); tokens are only valid within their tenant. Cross-tenant tokens are rejected.

```mermaid
graph LR
    REQ[Request + JWT] --> M1[Tenant Context Middleware]
    M1 --> ALS[AsyncLocalStorage: tenantId, userId, roles]
    ALS --> PMW[Prisma tenant-scoping middleware]
    ALS --> CFG[Config resolver: tenant→platform→default]
    ALS --> STO[Storage path + signed URL guard]
    PMW --> DB[(MySQL: every row has tenantId)]
```

**Why shared-schema now.** It is the most cost- and ops-efficient fit for a single Hostinger VPS, delivers per-tenant configurability immediately, and keeps migrations single-track. For enterprise customers demanding physical isolation, the roadmap ([§25](#25-future-roadmap)) defines a migration path to schema-per-tenant or DB-per-tenant behind the same `tenantId` abstraction — application code need not change because scoping is already centralized.

---
---

# Part 2 — Data & API

## 5. Database Design

### 5.1 Design Principles

The schema is fully normalized (3NF) with deliberate, documented denormalizations for read performance (e.g., cached wallet balance validated against the ledger). Every design choice traces to a requirement:

- **Foreign keys** enforce referential integrity; `onDelete` is `Restrict` for financial/audit links and `Cascade` only for owned child rows that are safe to remove.
- **Soft delete** via `deletedAt DATETIME NULL` on user-facing entities; hard delete reserved for compliance jobs. A Prisma extension filters `deletedAt: null` by default.
- **Audit logs** in a dedicated append-only table capturing actor, action, entity, before/after JSON, IP, and correlation id.
- **Version history** for mutable, high-value entities (frames, configuration) via explicit version tables; financial correctness comes from the append-only ledger rather than row mutation.
- **Money & credits** are stored as integers (credits as whole credits; money in the smallest currency unit, e.g., paise) to avoid floating-point error.
- **Time** is UTC `DATETIME`; the app layer localizes.
- **IDs** are ULIDs (lexicographically sortable, index-friendly, collision-resistant) stored as `CHAR(26)`; exposed to clients as opaque strings.
- **Multi-tenancy**: every tenant-scoped table has `tenantId CHAR(26) NOT NULL` with a composite index leading on `tenantId`.
- **Indexes** target the actual query patterns listed in §5.4; every foreign key is indexed; hot list queries get composite covering indexes.
- **Concurrency**: financial mutations use `SELECT ... FOR UPDATE` on the wallet row plus the append-only ledger; idempotency keys prevent duplicates.

### 5.2 Entity-Relationship Diagram

```mermaid
erDiagram
    TENANT ||--o{ USER : has
    TENANT ||--o{ FRAME : owns
    TENANT ||--o{ CONFIG_ENTRY : overrides
    TENANT ||--o{ RECHARGE_PLAN : offers
    USER ||--|| WALLET : has
    USER ||--o{ SESSION : has
    USER ||--o{ USER_ROLE : assigned
    ROLE ||--o{ USER_ROLE : maps
    ROLE ||--o{ ROLE_PERMISSION : grants
    PERMISSION ||--o{ ROLE_PERMISSION : in
    WALLET ||--o{ WALLET_LEDGER : records
    WALLET ||--o{ CREDIT_LOT : holds
    USER ||--o{ PAYMENT : makes
    PAYMENT ||--o{ WALLET_LEDGER : produces
    RECHARGE_PLAN ||--o{ PAYMENT : purchased_as
    USER ||--o{ GENERATION : requests
    GENERATION ||--o| AI_ASSET : produces
    GENERATION }o--|| FRAME_VERSION : uses
    FRAME ||--o{ FRAME_VERSION : versions
    FRAME }o--|| CATEGORY : in
    CATEGORY ||--o{ CATEGORY : subcategory
    FRAME ||--o{ FRAME_PLACEHOLDER : defines
    USER ||--o{ FAVOURITE_FRAME : favourites
    FRAME ||--o{ FAVOURITE_FRAME : favourited
    USER ||--o{ PROJECT : saves
    PROJECT }o--|| FRAME_VERSION : based_on
    AI_ASSET ||--o{ ASSET_FILE : stored_as
    USER ||--o{ NOTIFICATION : receives
    TENANT ||--o{ AUDIT_LOG : scoped
    GENERATION ||--o{ JOB_EVENT : logs
    CONFIG_ENTRY ||--o{ CONFIG_VERSION : historized
    USER ||--o{ IDEMPOTENCY_KEY : issues
    PAYMENT ||--o{ WEBHOOK_EVENT : reconciled_by
```

### 5.3 Prisma Schema

The following is the canonical schema. It is split by domain in comments but lives in `prisma/schema.prisma` (or split with Prisma's multi-file preview). Enums are used for closed sets; JSON columns hold open/extensible metadata.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ---------- Tenancy & Identity ----------

model Tenant {
  id         String   @id @default(cuid()) @db.Char(26)
  name       String
  slug       String   @unique
  status     TenantStatus @default(ACTIVE)
  // Branding/config live in ConfigEntry with tenantId; a few hot fields cached here:
  displayName String?
  logoUrl     String?
  primaryColor String? @db.VarChar(9)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  deletedAt  DateTime?

  users        User[]
  frames       Frame[]
  configs      ConfigEntry[]
  rechargePlans RechargePlan[]
  auditLogs    AuditLog[]

  @@index([status])
}

enum TenantStatus { ACTIVE SUSPENDED }

model User {
  id             String   @id @default(cuid()) @db.Char(26)
  tenantId       String   @db.Char(26)
  email          String
  emailVerifiedAt DateTime?
  passwordHash   String
  displayName    String?
  status         UserStatus @default(ACTIVE)
  mfaSecret      String?    // encrypted at rest
  lastLoginAt    DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?

  tenant     Tenant  @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  wallet     Wallet?
  sessions   Session[]
  roles      UserRole[]
  payments   Payment[]
  generations Generation[]
  assets     AiAsset[]
  projects   Project[]
  favourites FavouriteFrame[]
  notifications Notification[]

  @@unique([tenantId, email])          // email unique per tenant
  @@index([tenantId, status])
  @@index([tenantId, createdAt])
}

enum UserStatus { ACTIVE SUSPENDED PENDING_VERIFICATION }

model Session {
  id            String   @id @default(cuid()) @db.Char(26)
  userId        String   @db.Char(26)
  tenantId      String   @db.Char(26)
  familyId      String   @db.Char(26)      // refresh-token rotation family
  refreshHash   String                     // hash of current refresh token
  deviceInfo    Json?                      // ua, platform, model
  ip            String?  @db.VarChar(45)
  expiresAt     DateTime
  revokedAt     DateTime?
  replacedById  String?  @db.Char(26)      // rotation chain
  createdAt     DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([familyId])
  @@index([refreshHash])
}

model Role {
  id          String @id @default(cuid()) @db.Char(26)
  tenantId    String? @db.Char(26)          // null = platform/global role
  key         String                        // SUPER_ADMIN, TENANT_ADMIN, ...
  name        String
  isSystem    Boolean @default(false)
  createdAt   DateTime @default(now())

  users       UserRole[]
  permissions RolePermission[]

  @@unique([tenantId, key])
}

model Permission {
  id    String @id @default(cuid()) @db.Char(26)
  key   String @unique                       // e.g. "wallet.refund", "frame.publish"
  group String                               // "wallet", "frame", ...
  roles RolePermission[]
}

model RolePermission {
  roleId       String @db.Char(26)
  permissionId String @db.Char(26)
  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  @@id([roleId, permissionId])
}

model UserRole {
  userId String @db.Char(26)
  roleId String @db.Char(26)
  user Role? @relation("noop", fields: [], references: [])   // placeholder omitted in real schema
  @@id([userId, roleId])
}

// ---------- Wallet & Payments ----------

model Wallet {
  id           String @id @default(cuid()) @db.Char(26)
  userId       String @unique @db.Char(26)
  tenantId     String @db.Char(26)
  balance      Int    @default(0)      // cached; == sum(active ledger) invariant
  heldBalance  Int    @default(0)      // credits reserved by in-flight generations
  version      Int    @default(0)      // optimistic-lock counter
  updatedAt    DateTime @updatedAt

  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  ledger WalletLedger[]
  lots   CreditLot[]

  @@index([tenantId])
}

model WalletLedger {
  id           String @id @default(cuid()) @db.Char(26)
  walletId     String @db.Char(26)
  tenantId     String @db.Char(26)
  type         LedgerType
  amount       Int                     // signed: +credit, -debit
  balanceAfter Int                     // running balance snapshot for audit
  refType      String?                 // "PAYMENT","GENERATION","REFUND","ADJUSTMENT","EXPIRY","BONUS"
  refId        String? @db.Char(26)
  reason       String?
  actorUserId  String? @db.Char(26)    // admin who performed manual op
  createdAt    DateTime @default(now())

  wallet Wallet @relation(fields: [walletId], references: [id], onDelete: Restrict)

  @@index([walletId, createdAt])
  @@index([tenantId, type, createdAt])
  @@index([refType, refId])
}

enum LedgerType { HOLD RELEASE DEBIT CREDIT BONUS REFUND ADJUSTMENT EXPIRY }

model CreditLot {
  id          String @id @default(cuid()) @db.Char(26)
  walletId    String @db.Char(26)
  tenantId    String @db.Char(26)
  source      String                 // "PURCHASE","BONUS","PROMO","REFUND","ADJUSTMENT"
  amount      Int                    // original credits in lot
  remaining   Int                    // credits left (FIFO consumption)
  expiresAt   DateTime?
  createdAt   DateTime @default(now())

  wallet Wallet @relation(fields: [walletId], references: [id], onDelete: Restrict)

  @@index([walletId, expiresAt])
  @@index([walletId, remaining])
}

model RechargePlan {
  id            String @id @default(cuid()) @db.Char(26)
  tenantId      String @db.Char(26)
  name          String
  amountMinor   Int                  // price in paise
  currency      String @default("INR")
  credits       Int
  bonusCredits  Int    @default(0)
  creditExpiryDays Int?
  isActive      Boolean @default(true)
  displayOrder  Int     @default(0)
  createdAt     DateTime @default(now())
  deletedAt     DateTime?

  tenant   Tenant @relation(fields: [tenantId], references: [id])
  payments Payment[]

  @@index([tenantId, isActive, displayOrder])
}

model Payment {
  id                String @id @default(cuid()) @db.Char(26)
  tenantId          String @db.Char(26)
  userId            String @db.Char(26)
  planId            String? @db.Char(26)
  provider          String  @default("razorpay")
  providerOrderId   String  @unique          // razorpay order id
  providerPaymentId String? @unique          // razorpay payment id (on capture)
  amountMinor       Int
  currency          String @default("INR")
  creditsToGrant    Int
  bonusToGrant      Int    @default(0)
  status            PaymentStatus @default(CREATED)
  failureReason     String?
  idempotencyKey    String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Restrict)
  plan RechargePlan? @relation(fields: [planId], references: [id], onDelete: SetNull)
  webhookEvents WebhookEvent[]

  @@index([tenantId, userId, createdAt])
  @@index([status])
}

enum PaymentStatus { CREATED PENDING AUTHORIZED CAPTURED FAILED REFUNDED PARTIALLY_REFUNDED }

model WebhookEvent {
  id            String @id @default(cuid()) @db.Char(26)
  provider      String                        // "razorpay","runway"
  eventId       String                        // provider's event id
  eventType     String
  paymentId     String? @db.Char(26)
  payloadHash   String
  signatureValid Boolean
  status        WebhookStatus @default(RECEIVED)
  processedAt   DateTime?
  createdAt     DateTime @default(now())

  payment Payment? @relation(fields: [paymentId], references: [id], onDelete: SetNull)

  @@unique([provider, eventId])   // idempotent webhook processing
  @@index([status])
}

enum WebhookStatus { RECEIVED PROCESSED IGNORED FAILED }

// ---------- Frames ----------

model Category {
  id           String @id @default(cuid()) @db.Char(26)
  tenantId     String @db.Char(26)
  parentId     String? @db.Char(26)
  name         String
  slug         String
  displayOrder Int    @default(0)
  isFeatured   Boolean @default(false)
  isActive     Boolean @default(true)
  isHidden     Boolean @default(false)
  createdAt    DateTime @default(now())
  deletedAt    DateTime?

  parent   Category?  @relation("Sub", fields: [parentId], references: [id], onDelete: SetNull)
  children Category[] @relation("Sub")
  frames   Frame[]

  @@unique([tenantId, slug])
  @@index([tenantId, parentId, displayOrder])
}

model Frame {
  id            String @id @default(cuid()) @db.Char(26)
  tenantId      String @db.Char(26)
  categoryId    String? @db.Char(26)
  name          String
  description   String? @db.Text
  tags          Json?                       // string[]
  tier          FrameTier @default(FREE)    // FREE / PREMIUM
  ranking       Int    @default(0)
  displayOrder  Int    @default(0)
  isFeatured    Boolean @default(false)
  isTrending    Boolean @default(false)
  isActive      Boolean @default(true)
  isHidden      Boolean @default(false)
  currentVersionId String? @db.Char(26)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?

  tenant     Tenant @relation(fields: [tenantId], references: [id])
  category   Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  versions   FrameVersion[]
  placeholders FramePlaceholder[]
  favourites FavouriteFrame[]

  @@index([tenantId, isActive, isHidden, ranking])
  @@index([tenantId, categoryId, displayOrder])
  @@index([tenantId, isFeatured])
  @@index([tenantId, isTrending])
}

enum FrameTier { FREE PREMIUM }

model FrameVersion {
  id           String @id @default(cuid()) @db.Char(26)
  frameId      String @db.Char(26)
  tenantId     String @db.Char(26)
  version      Int
  template     Json                     // layout + placeholder bindings (validated at publish)
  assetManifest Json                    // background/overlay/font file refs in storage
  thumbnailUrl String?
  status       FrameVersionStatus @default(DRAFT)
  publishedAt  DateTime?
  createdBy    String? @db.Char(26)
  createdAt    DateTime @default(now())

  frame       Frame @relation(fields: [frameId], references: [id], onDelete: Cascade)
  generations Generation[]
  projects    Project[]

  @@unique([frameId, version])
  @@index([tenantId, status])
}

enum FrameVersionStatus { DRAFT PUBLISHED ARCHIVED }

model FramePlaceholder {
  id           String @id @default(cuid()) @db.Char(26)
  frameId      String @db.Char(26)
  tenantId     String @db.Char(26)
  key          String                    // e.g. "company", "logo", "social_links"
  label        String
  type         PlaceholderType
  isRequired   Boolean @default(false)
  defaultValue Json?
  validation   Json?                     // regex, min/max, allowed enum, image constraints
  displayOrder Int    @default(0)

  frame Frame @relation(fields: [frameId], references: [id], onDelete: Cascade)

  @@unique([frameId, key])
  @@index([tenantId])
}

enum PlaceholderType { TEXT MULTILINE EMAIL PHONE URL IMAGE LOGO COLOR LIST SELECT DATE NUMBER }

model FavouriteFrame {
  userId    String @db.Char(26)
  frameId   String @db.Char(26)
  tenantId  String @db.Char(26)
  createdAt DateTime @default(now())
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  frame Frame @relation(fields: [frameId], references: [id], onDelete: Cascade)
  @@id([userId, frameId])
  @@index([tenantId])
}

// ---------- Generation & Assets ----------

model Generation {
  id             String @id @default(cuid()) @db.Char(26)
  tenantId       String @db.Char(26)
  userId         String @db.Char(26)
  frameVersionId String? @db.Char(26)
  kind           GenerationKind
  provider       String                    // "openai","runway"
  model          String
  prompt         String  @db.Text
  negativePrompt String? @db.Text
  inputValues    Json                      // placeholder values submitted
  params         Json?                     // size, aspect, seed, duration...
  status         GenerationStatus @default(QUEUED)
  failureCode    String?
  failureReason  String?
  creditsCost    Int
  creditsHeld    Int      @default(0)
  moneyCostMinor Int?                       // provider cost estimate for analytics
  idempotencyKey String?
  queuedAt       DateTime @default(now())
  startedAt      DateTime?
  finishedAt     DateTime?
  durationMs     Int?
  providerJobId  String?

  user        User @relation(fields: [userId], references: [id], onDelete: Restrict)
  frameVersion FrameVersion? @relation(fields: [frameVersionId], references: [id], onDelete: SetNull)
  asset       AiAsset?
  events      JobEvent[]

  @@unique([tenantId, userId, idempotencyKey])
  @@index([tenantId, userId, status, queuedAt])
  @@index([tenantId, status])
  @@index([provider, status])
}

enum GenerationKind { IMAGE VIDEO }
enum GenerationStatus { QUEUED RUNNING SUCCEEDED FAILED CANCELLED TIMED_OUT }

model AiAsset {
  id            String @id @default(cuid()) @db.Char(26)
  tenantId      String @db.Char(26)
  userId        String @db.Char(26)
  generationId  String @unique @db.Char(26)
  kind          GenerationKind
  provider      String
  model         String
  frameVersionId String? @db.Char(26)
  url           String                     // storage key / signed base
  thumbnailUrl  String?
  mimeType      String?
  widthPx       Int?
  heightPx      Int?
  durationSec   Int?
  bytes         BigInt?
  creditsUsed   Int
  moneyCostMinor Int?
  generationMs  Int?
  metadata      Json?                      // provider response, seed, safety flags
  isFavourite   Boolean @default(false)
  createdAt     DateTime @default(now())
  deletedAt     DateTime?

  user       User @relation(fields: [userId], references: [id], onDelete: Restrict)
  generation Generation @relation(fields: [generationId], references: [id], onDelete: Restrict)
  files      AssetFile[]

  @@index([tenantId, userId, createdAt])
  @@index([tenantId, kind, createdAt])
  @@index([tenantId, frameVersionId])
}

model AssetFile {
  id        String @id @default(cuid()) @db.Char(26)
  assetId   String @db.Char(26)
  tenantId  String @db.Char(26)
  role      String                    // "original","thumbnail","watermarked"
  storageKey String
  bytes     BigInt?
  checksum  String?
  createdAt DateTime @default(now())
  asset AiAsset @relation(fields: [assetId], references: [id], onDelete: Cascade)
  @@index([assetId])
}

model Project {
  id             String @id @default(cuid()) @db.Char(26)
  tenantId       String @db.Char(26)
  userId         String @db.Char(26)
  frameVersionId String? @db.Char(26)
  name           String
  values         Json                     // saved placeholder values
  params         Json?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?

  user        User @relation(fields: [userId], references: [id], onDelete: Cascade)
  frameVersion FrameVersion? @relation(fields: [frameVersionId], references: [id], onDelete: SetNull)

  @@index([tenantId, userId, updatedAt])
}

model JobEvent {
  id           String @id @default(cuid()) @db.Char(26)
  generationId String @db.Char(26)
  tenantId     String @db.Char(26)
  status       String
  detail       Json?
  createdAt    DateTime @default(now())
  generation Generation @relation(fields: [generationId], references: [id], onDelete: Cascade)
  @@index([generationId, createdAt])
}

// ---------- Config, Notifications, Audit, Idempotency ----------

model ConfigEntry {
  id          String @id @default(cuid()) @db.Char(26)
  tenantId    String? @db.Char(26)         // null = platform default
  namespace   String                       // "billing","ai","storage","branding","limits","flags"
  key         String
  valueJson   Json
  valueType   String                       // "string","int","bool","json","secret"
  isSecret    Boolean @default(false)      // encrypted at rest
  updatedBy   String? @db.Char(26)
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())

  tenant   Tenant? @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  versions ConfigVersion[]

  @@unique([tenantId, namespace, key])
  @@index([namespace])
}

model ConfigVersion {
  id         String @id @default(cuid()) @db.Char(26)
  configId   String @db.Char(26)
  valueJson  Json
  changedBy  String? @db.Char(26)
  reason     String?
  createdAt  DateTime @default(now())
  config ConfigEntry @relation(fields: [configId], references: [id], onDelete: Cascade)
  @@index([configId, createdAt])
}

model Notification {
  id         String @id @default(cuid()) @db.Char(26)
  tenantId   String @db.Char(26)
  userId     String @db.Char(26)
  event      String                        // "RECHARGE_SUCCESS", "AI_FAILED", ...
  channel    String                        // "EMAIL","PUSH","IN_APP"
  title      String
  body       String  @db.Text
  data       Json?
  status     String  @default("PENDING")   // PENDING/SENT/FAILED/READ
  readAt     DateTime?
  sentAt     DateTime?
  createdAt  DateTime @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([tenantId, userId, status, createdAt])
}

model AuditLog {
  id            String @id @default(cuid()) @db.Char(26)
  tenantId      String? @db.Char(26)
  actorUserId   String? @db.Char(26)
  actorRole     String?
  action        String                     // "wallet.refund","frame.publish","config.update"
  entityType    String
  entityId      String? @db.Char(26)
  before        Json?
  after         Json?
  ip            String? @db.VarChar(45)
  correlationId String? @db.Char(36)
  createdAt     DateTime @default(now())

  tenant Tenant? @relation(fields: [tenantId], references: [id], onDelete: SetNull)

  @@index([tenantId, createdAt])
  @@index([actorUserId, createdAt])
  @@index([entityType, entityId])
}

model IdempotencyKey {
  id          String @id @default(cuid()) @db.Char(26)
  tenantId    String @db.Char(26)
  userId      String? @db.Char(26)
  scope       String                       // "generation","payment"
  key         String
  requestHash String
  responseJson Json?
  status      String @default("IN_PROGRESS") // IN_PROGRESS/COMPLETED
  createdAt   DateTime @default(now())
  expiresAt   DateTime

  @@unique([tenantId, scope, key])
  @@index([expiresAt])
}
```

> **Schema notes.** (1) A couple of relation lines above (e.g., `UserRole`) are shown illustratively; in the real file each relation is fully specified on both sides — the intent (composite PK join tables, FK indexes) is what matters here. (2) `@default(cuid())` is shown for brevity; the implementation uses a ULID default via a Prisma extension to get sortable IDs stored as `Char(26)`. (3) `WalletLedger` is the source of truth; `Wallet.balance`/`heldBalance` are caches guarded by `version` and reconciled by a scheduled job.

### 5.4 Indexing & Query Patterns

| Query | Index used |
|---|---|
| List active, visible frames by ranking for a tenant | `Frame(tenantId, isActive, isHidden, ranking)` |
| Frames in a category ordered for display | `Frame(tenantId, categoryId, displayOrder)` |
| User's generations by status, newest first | `Generation(tenantId, userId, status, queuedAt)` |
| Worker picks provider jobs to reconcile | `Generation(provider, status)` |
| User asset gallery paging | `AiAsset(tenantId, userId, createdAt)` |
| Wallet ledger statement | `WalletLedger(walletId, createdAt)` |
| Revenue by period (analytics) | `WalletLedger(tenantId, type, createdAt)` |
| Idempotent generation dedupe | unique `Generation(tenantId, userId, idempotencyKey)` |
| Idempotent webhook | unique `WebhookEvent(provider, eventId)` |
| Credit expiry sweep (FIFO) | `CreditLot(walletId, expiresAt)` |

Pagination uses **keyset (cursor) pagination** on `(createdAt, id)` for large lists rather than `OFFSET`, keeping deep pages fast. Analytics aggregates are precomputed by the scheduler into rollup tables (added in P3) to avoid scanning ledger/asset tables on every dashboard load.

### 5.5 Transactions, Locking & Concurrency

Financial and generation-critical operations run inside Prisma interactive transactions with the correct isolation:

- **Credit hold** (`POST /generations`): `SELECT ... FOR UPDATE` the wallet row, verify `balance - heldBalance >= cost`, increment `heldBalance`, insert `HOLD` ledger row, bump `version`. Serializes concurrent spends so balance can never go negative (FR-WALLET-8).
- **Settle/Release**: worker, in one transaction, moves the hold to a `DEBIT` (success) consuming `CreditLot`s FIFO, or reverses it via `RELEASE` (failure). Idempotent by `generationId`.
- **Recharge credit** (webhook): guarded by unique `WebhookEvent(provider,eventId)` and `Payment.providerPaymentId`; the actual credit is a single transaction that flips `Payment.status` and appends a `CREDIT` ledger row + `CreditLot`. Replays are no-ops.
- **Isolation**: `READ COMMITTED` default; wallet mutations use explicit row locks. Deadlocks are retried with backoff (see [§16](#16-error-handling--recovery)).

### 5.6 Soft Delete, Audit & Versioning

A Prisma client extension (a) rewrites deletes to set `deletedAt`, (b) filters `deletedAt: null` on reads unless `withDeleted` is explicitly requested (admin), and (c) emits an `AuditLog` for every create/update/delete on audited models with `before`/`after` diffs and the request's correlation id and actor. Frame edits create a new `FrameVersion` (immutable once `PUBLISHED`); config edits append a `ConfigVersion`. This gives complete version history and reversibility without mutating historical financial or provenance data.

### 5.7 Data Retention & PII

| Data | Retention | Notes |
|---|---|---|
| Audit logs | 24 months, then archived to cold storage | Compliance/forensics |
| API/access logs | 90 days hot, 12 months cold | |
| Soft-deleted users | 30-day grace, then hard-delete job | GDPR/DPDP erasure |
| Generated assets | User-controlled; deleted on account erasure | Storage + DB rows purged |
| Idempotency keys | 24–72 h (config) then purged | |
| Webhook events | 12 months | Reconciliation |

---

## 6. API Specifications

### 6.1 Conventions

- **Base URL**: `https://api.brandpilot.app/v1`. Versioned by URI prefix; breaking changes bump the prefix.
- **Format**: JSON only; `Content-Type: application/json` (except multipart upload endpoints).
- **Auth**: `Authorization: Bearer <accessJWT>` on all non-public endpoints.
- **Tenant**: derived from the JWT (`tid`); no client-supplied tenant header is trusted. Super-admin cross-tenant calls use an explicit, audited `X-Act-As-Tenant` honored only for that role.
- **Idempotency**: mutating financial/generation endpoints require an `Idempotency-Key` header (UU/ULID). Server stores key→response for 24–72h and replays the stored response on repeat.
- **Pagination**: cursor-based — `?limit=&cursor=`; responses include `nextCursor`.
- **Filtering/sorting**: explicit query params per endpoint; no arbitrary query injection.
- **Errors**: RFC-9457 Problem Details:

```json
{
  "type": "https://errors.brandpilot.app/wallet/insufficient-credits",
  "title": "Insufficient credits",
  "status": 402,
  "code": "WALLET_INSUFFICIENT_CREDITS",
  "detail": "Required 12 credits, available 7.",
  "correlationId": "3f1c...",
  "meta": { "required": 12, "available": 7 }
}
```

- **Rate limiting**: `429` with `Retry-After`; limits are per-user, per-IP, and per-tenant and are config-driven.
- **Timestamps**: ISO-8601 UTC. **Money**: minor units + `currency`. **Credits**: integers.
- **Docs**: OpenAPI 3.1 auto-generated by Nest Swagger at `/docs` (gated in prod); the spec is the contract for client codegen and contract tests.

### 6.2 Standard Response Envelope

Successful list responses: `{ "data": [...], "nextCursor": "…", "meta": {...} }`. Single-resource: the resource object directly. All 4xx/5xx use the Problem Details shape above.

### 6.3 Endpoint Catalogue

Auth & session:

| Method | Path | Purpose | AuthZ |
|---|---|---|---|
| POST | `/auth/register` | Create account (tenant-scoped) | public |
| POST | `/auth/verify-email` | Confirm email token | public |
| POST | `/auth/login` | Issue access + refresh | public |
| POST | `/auth/refresh` | Rotate refresh, new access | public (refresh cookie/body) |
| POST | `/auth/logout` | Revoke current session | user |
| POST | `/auth/logout-all` | Revoke all sessions | user |
| POST | `/auth/forgot-password` | Email reset token | public |
| POST | `/auth/reset-password` | Set new password | public (token) |
| GET | `/auth/sessions` | List active devices | user |
| DELETE | `/auth/sessions/{id}` | Revoke a device | user |
| POST | `/auth/mfa/enroll` / `/verify` | TOTP setup | user/admin |

Profile, wallet & payments:

| Method | Path | Purpose | AuthZ |
|---|---|---|---|
| GET/PATCH | `/me` | Read/update profile | user |
| GET | `/me/wallet` | Balance + held | user |
| GET | `/me/wallet/ledger` | Transaction history (filter/paginate) | user |
| GET | `/plans` | List active recharge plans | user |
| POST | `/payments/orders` | Create Razorpay order (Idempotency-Key) | user |
| POST | `/payments/verify` | Client-side capture verify (fallback) | user |
| POST | `/webhooks/razorpay` | Razorpay webhook (signature-verified) | public+HMAC |

Frames & catalogue:

| Method | Path | Purpose | AuthZ |
|---|---|---|---|
| GET | `/categories` | Category tree | user |
| GET | `/frames` | List frames (category, featured, trending, tier, search, cursor) | user |
| GET | `/frames/{id}` | Frame detail + current version | user |
| GET | `/frames/{id}/placeholders` | Dynamic placeholder schema | user |
| POST | `/frames/{id}/preview` | Server-render preview with values | user |
| POST/DELETE | `/frames/{id}/favourite` | Toggle favourite | user |

Generation, assets & projects:

| Method | Path | Purpose | AuthZ |
|---|---|---|---|
| POST | `/generations` | Start image/video generation (Idempotency-Key) | user |
| GET | `/generations/{id}` | Status + result | user |
| GET | `/generations` | List own generations (filter/paginate) | user |
| POST | `/generations/{id}/cancel` | Best-effort cancel | user |
| POST | `/generations/{id}/regenerate` | New generation from prior params | user |
| GET | `/assets` | Gallery (kind, frame, date, favourite, cursor) | user |
| GET | `/assets/{id}` | Asset detail | user |
| GET | `/assets/{id}/download` | Signed, time-limited URL | user |
| POST/DELETE | `/assets/{id}/favourite` | Toggle | user |
| DELETE | `/assets/{id}` | Soft-delete | user |
| GET/POST | `/projects` | List/save projects | user |
| GET/PATCH/DELETE | `/projects/{id}` | Manage a project | user |

Uploads (mobile-friendly, resumable):

| Method | Path | Purpose | AuthZ |
|---|---|---|---|
| POST | `/uploads/init` | Begin resumable upload → uploadId + chunk plan | user |
| PUT | `/uploads/{id}/chunk/{n}` | Upload a chunk (idempotent by index) | user |
| POST | `/uploads/{id}/complete` | Finalize, validate, virus/type scan | user |
| GET | `/uploads/{id}` | Upload status (for resume) | user |

Admin (all under `/admin`, permission-gated):

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET/POST/PATCH | `/admin/users` | Manage users, suspend, restore | `user.manage` |
| GET/POST | `/admin/frames`, `/admin/frames/{id}/versions`, `/admin/frames/{id}/publish` | Frame authoring/versioning/publish | `frame.manage`,`frame.publish` |
| GET/POST/PATCH | `/admin/categories` | Category management | `category.manage` |
| POST | `/admin/wallet/{userId}/adjust` `/refund` `/bonus` | Wallet ops (Idempotency-Key) | `wallet.adjust`,`wallet.refund` |
| GET | `/admin/payments`, `/admin/payments/{id}` | Payment inspection/reconciliation | `payment.read` |
| GET/PUT | `/admin/config/{namespace}` | Read/update config (versioned) | `config.manage` |
| GET | `/admin/config/{namespace}/{key}/versions` + POST `/rollback` | Config history/rollback | `config.manage` |
| GET | `/admin/analytics/*` | Dashboards + CSV export | `analytics.read` |
| GET | `/admin/audit` | Audit log query | `audit.read` |
| GET | `/admin/jobs` + POST `/admin/jobs/{id}/retry` | Failed job inspection/retry | `jobs.manage` |
| POST | `/admin/tenants` … | Tenant management | `SUPER_ADMIN` |

Platform:

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` / `/ready` | Liveness/readiness (DB, Redis, storage, providers) |
| GET | `/config/public` | Client bootstrap config (branding, flags, plans, feature toggles) |
| POST | `/webhooks/runway` | Runway job callbacks (signature-verified) |
| POST | `/notifications/devices` | Register FCM/APNs device token |
| GET | `/notifications` + PATCH read | In-app notifications |

### 6.4 Representative Contract — Start a Generation

Request:

```http
POST /v1/generations
Authorization: Bearer <jwt>
Idempotency-Key: 01J9Z8...ULID
Content-Type: application/json

{
  "kind": "IMAGE",
  "frameId": "01J...",
  "prompt": "modern minimal product banner, studio lighting",
  "negativePrompt": "text artifacts, watermark",
  "values": {
    "company": "Acme Co",
    "tagline": "Build faster",
    "logo": "upload_01J...",
    "primary_color": "#0A66C2"
  },
  "params": { "size": "1024x1024", "n": 1, "seed": null }
}
```

Responses:

- `202 Accepted` → `{ "generationId": "01J...", "status": "QUEUED", "estimatedCredits": 12, "poll": "/v1/generations/01J..." }`
- `402` `WALLET_INSUFFICIENT_CREDITS`
- `422` `FRAME_VALIDATION_FAILED` with per-placeholder errors
- `429` `RATE_LIMITED` (per-user concurrency/daily limit)
- `409` returns the original `202` body if `Idempotency-Key` was already used (replay)
- `503` `AI_PROVIDER_UNAVAILABLE` (only if enqueue itself is impossible; normally still `202` and handled async)

### 6.5 Representative Contract — Create Payment Order

```http
POST /v1/payments/orders
Idempotency-Key: <ULID>
{ "planId": "01J..." }
```

`201` → `{ "paymentId": "...", "razorpayOrderId": "order_...", "amountMinor": 49900, "currency": "INR", "keyId": "rzp_live_..." }`. The client opens Razorpay Checkout with these; final crediting happens **only** via the verified webhook (see [§8](#8-wallet--razorpay-architecture)). `/payments/verify` is a client-signature fallback that never credits alone — it only marks intent; the webhook is authoritative.

### 6.6 Validation & DTOs

Every endpoint has a `class-validator` DTO enforced by a global `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true, transform: true`) — unknown fields are rejected, types coerced, and bounds enforced. Frame placeholder values are validated dynamically against the frame's `FramePlaceholder` schema (type + `validation` JSON), not a static DTO, which is how new admin-defined placeholders work without code changes ([§10](#10-dynamic-frame-engine)).

### 6.7 Versioning & Deprecation Policy

URI-versioned (`/v1`). Additive changes (new optional fields/endpoints) ship within a version. Breaking changes introduce `/v2` and the previous version is supported for a published deprecation window (min 6 months), with `Deprecation` and `Sunset` response headers and admin-visible usage metrics to track client migration.

---
---

# Part 3 — Core Domains

## 7. Authentication & Authorization

### 7.1 Token Model

BrandPilot uses a **dual-token** scheme:

- **Access token** — JWT, short-lived (config default 15 min), signed with a rotating RS256 key pair (asymmetric so workers/services can verify without the signing secret). Claims: `sub` (userId), `tid` (tenantId), `roles`, `perms` (compact permission bitset or short keys), `sid` (sessionId), `jti`, `iat`, `exp`. Stateless verification on every request.
- **Refresh token** — opaque high-entropy random string (not a JWT), long-lived (config default 30 days), stored **only as a hash** in `Session.refreshHash`. Delivered to web via `HttpOnly; Secure; SameSite=Strict` cookie; to mobile via secure storage (Keychain/Keystore through a Capacitor secure-storage plugin).

### 7.2 Refresh Rotation & Theft Detection

Each refresh belongs to a **family** (`Session.familyId`). On `/auth/refresh`:

1. Look up the presented token's hash. If not found or expired/revoked → 401.
2. If found but already **rotated** (i.e., a `replacedById` exists and the presented token is an old one) → **token reuse detected**: revoke the entire family (all sessions in it) and force re-login. This defeats stolen-refresh replay.
3. Otherwise, issue a new access + new refresh, set `replacedById`, persist the new hash, return.

```mermaid
sequenceDiagram
    participant C as Client
    participant API
    participant DB
    C->>API: POST /auth/refresh (refresh R1)
    API->>DB: find session by hash(R1)
    alt R1 current
      API->>DB: rotate -> R2, R1.replacedById=R2
      API-->>C: access + R2
    else R1 already rotated (reuse)
      API->>DB: revoke entire familyId
      API-->>C: 401 (re-login required)
    end
```

### 7.3 Sessions & Multi-Device

Every login creates a `Session` row capturing device info, IP, and a family. Users see and revoke devices (`GET/DELETE /auth/sessions`, `POST /auth/logout-all`). Access tokens carry `sid`; a lightweight **revocation check** consults a Redis set of revoked session ids (populated on logout/suspend) so that revoking a session invalidates its still-valid access token within seconds without a DB hit per request. Suspending or deleting a user revokes all sessions immediately.

### 7.4 Password & Credential Security

- Hashing with **Argon2id** (memory-hard; parameters config-tunable), never MD5/SHA alone.
- Password policy configurable (length, breach-list check against k-anonymity HIBP range API optional).
- Reset tokens are single-use, hashed at rest, expiring (config default 30 min); using or expiring one invalidates the rest.
- Login throttling: exponential backoff + account lockout after configurable failures, tracked per (email, IP) in Redis; generic error messages avoid user enumeration.
- Email verification gates generation (FR-AUTH-1); unverified users can browse but not spend.
- Optional TOTP MFA for privileged roles; secret encrypted at rest; recovery codes issued once.

### 7.5 RBAC Model

Permissions are fine-grained keys grouped by domain (`wallet.refund`, `frame.publish`, `config.manage`, `user.manage`, `analytics.read`, `audit.read`, `jobs.manage`, …). Roles map to permission sets (`RolePermission`). Users hold one or more roles per tenant (`UserRole`). System roles (`SUPER_ADMIN`, `TENANT_ADMIN`, `SUPPORT`, `FINANCE`, `USER`) ship seeded; tenant admins may compose **custom roles** from existing permissions (FR-RBAC-4) — config-driven, no code change.

Enforcement: a global `PermissionsGuard` reads a `@RequirePermissions('wallet.refund')` decorator on each handler and checks the principal's effective permissions (resolved from roles, cached per session in Redis). Tenant scope is enforced separately by the tenant middleware + Prisma scoping ([§4.6](#46-multi-tenancy-model-cross-cutting)), so even a permission-holding actor cannot touch another tenant's rows.

```mermaid
graph LR
    U[User] --> UR[UserRole]
    UR --> R[Role]
    R --> RP[RolePermission]
    RP --> P[Permission]
    REQ[Request handler @RequirePermissions] --> G[PermissionsGuard]
    G -->|effective perms from cache| DECISION{allowed?}
    DECISION -->|no| F403[403]
    DECISION -->|yes| H[Handler]
```

### 7.6 Impersonation (Support)

`SUPER_ADMIN`/`SUPPORT` (permission `user.impersonate`) can mint a scoped, short-lived impersonation token for a target user. Every impersonated request is tagged (`act` claim = real actor) and audited; the client shows a persistent banner; impersonation cannot perform certain protected actions (e.g., changing the target's password or MFA) unless separately permitted.

### 7.7 Edge Cases (Auth)

Expired JWT → 401 with `TOKEN_EXPIRED`, client silently refreshes. Invalid/rotated refresh → family revoke ([§7.2](#72-refresh-rotation--theft-detection)). Concurrent refresh from two devices with the same token → first wins, second triggers reuse detection unless within a small grace window (config) for legitimate race; grace window uses a short Redis lock keyed by token hash. Clock skew tolerated via `clockTolerance`. Session expiry mid-request → request completes (already authorized) but next refresh fails. See full list in [§24](#24-complete-edge-case-catalogue).

---

## 8. Wallet & Razorpay Architecture

### 8.1 Ledger-First Design

The wallet is an **append-only ledger** (`WalletLedger`) with a cached `Wallet.balance`/`heldBalance`. The ledger is the source of truth; the cache exists for fast reads and is continuously reconcilable (`balance == Σ settled ledger amounts`; `heldBalance == Σ open holds`). Credits are consumed from `CreditLot`s **FIFO by expiry** so soon-to-expire and promotional credits are used first. This model gives exact auditability and makes every edge case (double deduction, refund failure, concurrent spend) tractable.

### 8.2 States & Flows

```mermaid
stateDiagram-v2
    [*] --> CREATED: create order
    CREATED --> PENDING: checkout opened
    PENDING --> AUTHORIZED: payment authorized
    AUTHORIZED --> CAPTURED: webhook captured -> credits granted
    PENDING --> FAILED: failure/timeout
    CAPTURED --> REFUNDED: admin refund
    CAPTURED --> PARTIALLY_REFUNDED: partial refund
```

Credit hold lifecycle for a generation:

```mermaid
stateDiagram-v2
    [*] --> HELD: POST /generations (reserve)
    HELD --> DEBITED: generation SUCCEEDED (settle)
    HELD --> RELEASED: FAILED/CANCELLED/TIMEOUT (refund hold)
```

### 8.3 Recharge Flow (Authoritative = Webhook)

```mermaid
sequenceDiagram
    participant C as Client
    participant API
    participant RZP as Razorpay
    participant DB
    C->>API: POST /payments/orders {planId} (Idempotency-Key)
    API->>DB: create Payment(status=CREATED, order pending)
    API->>RZP: orders.create(amount, receipt=paymentId)
    RZP-->>API: order_id
    API->>DB: save providerOrderId
    API-->>C: {razorpayOrderId, keyId, amount}
    C->>RZP: Checkout (card/UPI/etc.)
    RZP-->>C: payment_id, signature
    par client fallback
      C->>API: POST /payments/verify {order,payment,signature}
      API->>API: verify HMAC (mark PENDING/AUTHORIZED, no credit)
    and authoritative
      RZP->>API: POST /webhooks/razorpay (payment.captured)
      API->>API: verify X-Razorpay-Signature (HMAC-SHA256)
      API->>DB: upsert WebhookEvent(provider,eventId) [unique]
      alt first time & valid
        API->>DB: TX: Payment->CAPTURED, +CreditLot, +CREDIT ledger, bump balance
        API->>API: enqueue notification RECHARGE_SUCCESS
      else duplicate/replay
        API->>DB: no-op (idempotent)
      end
    end
```

Crediting happens **only** inside the webhook transaction, gated by (a) unique `WebhookEvent(provider,eventId)` — replay-safe, and (b) unique `Payment.providerPaymentId` — capture-safe. The client `/verify` call never credits; it only improves UX by marking intent while the webhook lands. If the webhook is delayed, the scheduler's **reconciliation job** polls Razorpay for `CREATED/PENDING` payments older than N minutes and credits any that Razorpay reports captured (still idempotent).

### 8.4 Spending Flow

Covered by the generation sequence ([§4.4](#44-c4--key-code-generation-orchestration-sequence)): a hold is placed transactionally at request time; the worker settles (debit, consuming lots FIFO) on success or releases on failure. Because the hold is taken before enqueue, a user cannot start more concurrent generations than their balance supports.

### 8.5 Refunds & Adjustments

- **Refund to source**: admin triggers Razorpay refund (full/partial); BrandPilot records intent, then confirms via `refund.processed` webhook, writing a `REFUND` ledger entry and optionally clawing back unspent credits (config: refund-as-money vs. refund-as-credits). Refund failures are retried and surfaced in an ops queue.
- **Manual adjustment / bonus / promo**: `POST /admin/wallet/{userId}/adjust|bonus` writes `ADJUSTMENT`/`BONUS` ledger entries and `CreditLot`s with reason + actor, fully audited. Bulk promo grants are a batched job.

### 8.6 Credit Expiry

`CreditLot.expiresAt` drives a nightly scheduler sweep: expire remaining credits past their date, write `EXPIRY` ledger entries, decrement balance, and notify users ahead of expiry (config lead time). FIFO consumption ensures expiring credits are spent first, minimizing surprise expiry.

### 8.7 Financial Edge Cases (summary; full list §24)

Double deduction (prevented: single hold per generation, idempotency key, settle keyed by generationId). Duplicate payment/webhook (unique constraints + WebhookEvent dedupe). Refund failure (retry queue + ops alert, ledger only on confirmed processed). Negative balance (impossible: `FOR UPDATE` check before hold). Concurrent transactions (row lock serializes). Partial capture / amount mismatch (verify captured amount == order amount before crediting; mismatch → quarantine + alert, no credit). Webhook signature invalid (reject, log, alert). Currency mismatch (reject). Chargeback webhook (freeze wallet, alert finance).

### 8.8 Reconciliation & Reporting

A daily reconciliation compares BrandPilot `Payment`/ledger records against Razorpay settlement reports; discrepancies raise finance alerts. Revenue, AI cost, and margin dashboards ([§19](#19-logging-monitoring--audit), [§12](#12-admin-panel-modules)) read from ledger + generation cost data.

---

## 9. AI Service Integration

### 9.1 Provider Abstraction (ADR-05)

All AI access is behind BrandPilot-owned interfaces so providers can be swapped, added, or routed without touching business logic:

```typescript
interface ImageProvider {
  readonly key: string;              // "openai"
  supports(model: string): boolean;
  estimateCost(req: ImageGenRequest): CostEstimate;   // credits + money
  generate(req: ImageGenRequest, ctx: ProviderCtx): Promise<ProviderResult>;
}

interface VideoProvider {
  readonly key: string;              // "runway"
  supports(model: string): boolean;
  estimateCost(req: VideoGenRequest): CostEstimate;
  submit(req: VideoGenRequest, ctx: ProviderCtx): Promise<{ providerJobId: string }>;
  poll(providerJobId: string, ctx: ProviderCtx): Promise<ProviderResult>;   // for async
  cancel?(providerJobId: string): Promise<void>;
}
```

A `ProviderRegistry` resolves the concrete adapter by config (`ai.image.defaultProvider`, per-model overrides). Adapters translate BrandPilot requests to SDK calls, normalize responses/errors into a common taxonomy, and are covered by **contract tests** against recorded fixtures plus a live smoke test in staging.

### 9.2 Image Generation (OpenAI)

Synchronous-ish from the provider but always run inside a worker job. The adapter maps size/quality/`n`, applies the resolved prompt (frame-composited — see [§10](#10-dynamic-frame-engine)), enforces timeout, and returns image bytes/URL. Cost estimate reads config `ai.image.cost` matrix (per model × size). Results are downloaded to Hostinger storage immediately (never hotlink provider URLs, which expire).

### 9.3 Video Generation (Runway)

Runway generation is long-running. The adapter `submit()`s and stores `providerJobId`; completion arrives via **webhook** (`/webhooks/runway`, signature-verified) or, as a fallback, the scheduler **polls** `poll()` on a backoff. On completion the worker downloads and stores the video + generates a thumbnail (first-frame/poster). The UX is designed for minutes-long waits with progress events (`JobEvent`) and a push/in-app notification on completion.

```mermaid
sequenceDiagram
    participant W as Worker
    participant RW as Runway
    participant API
    participant DB
    W->>RW: submit(job)
    RW-->>W: providerJobId
    W->>DB: Generation.providerJobId, status=RUNNING
    alt webhook path
      RW->>API: POST /webhooks/runway (done)
      API->>DB: verify + enqueue finalize job
    else polling fallback
      loop backoff until done/timeout
        W->>RW: poll(providerJobId)
      end
    end
    W->>W: finalize: download, thumbnail, store, settle credits
```

### 9.4 Reliability Controls

- **Timeouts** per provider/operation (config `ai.<p>.timeoutMs`).
- **Retries** with exponential backoff + jitter on transient errors (5xx, network, rate limit with `Retry-After`); **no retry** on deterministic failures (invalid key, content policy) — those fail fast and release credits.
- **Circuit breaker** per provider: consecutive failures open the breaker, new jobs queue/backoff instead of hammering; half-open probes restore service. Breaker state is visible in admin.
- **Rate limiting** to respect provider quotas: a Redis token-bucket per provider caps concurrent/enqueue rates (config `ai.<p>.queueSize`, `maxConcurrent`).
- **Idempotency**: generation job id == `generationId`; re-delivery of a job is detected (status check) so a provider call never runs twice for one generation.
- **Content moderation** hook (config-toggle): screen prompt pre-submit and output post-generation; blocked content fails with a clear reason and releases credits.

### 9.5 Cost & Key Management

Provider API keys live in the encrypted config store (`isSecret`), never in code or plain `.env` in production ([§15](#15-configuration-management-system), [§17](#17-security-strategy)). Keys are resolvable per-tenant (a tenant may bring its own key) or fall back to the platform key. Every generation records `creditsUsed` and an estimated `moneyCostMinor` so admin analytics can show real provider spend vs. credit revenue (margin).

### 9.6 AI Edge Cases (summary; full list §24)

Rate limit (backoff + breaker, job re-queued). Invalid key (fail fast, alert admin, release credits, don't retry). Timeout (mark `TIMED_OUT`, release, allow user retry). Network failure (retry with backoff). Model failure/refusal (map to `FAILED` with reason, release). Runway long processing (async + notify; hard cap via config, then timeout). Cancelled job (best-effort provider cancel + release). Partial/no output (treat as failure). Provider returns expiring URL (always download-and-store). Duplicate webhook (idempotent via `WebhookEvent`).

---

## 10. Dynamic Frame Engine

### 10.1 Concept

A **frame** is a designer/admin-authored template that composes a background, overlays, fonts, and **typed placeholders**. Users fill placeholder values; the engine substitutes them, renders a preview, and feeds the composed input to the AI provider. Admins can add entirely new placeholder types of data and new frames **without any frontend/back-end code change** — the frontend renders inputs from the frame's placeholder schema, and the renderer is data-driven.

### 10.2 Frame Definition (template JSON)

A `FrameVersion.template` is validated JSON describing a canvas and layers:

```json
{
  "canvas": { "width": 1080, "height": 1080, "bg": "asset:background.png" },
  "layers": [
    { "type": "image", "src": "placeholder:logo", "x": 60, "y": 60, "w": 200, "h": 200, "fit": "contain" },
    { "type": "text", "value": "placeholder:company", "x": 60, "y": 300,
      "font": "asset:Inter-Bold.ttf", "size": 64, "color": "placeholder:primary_color", "maxWidth": 900 },
    { "type": "text", "value": "placeholder:tagline", "x": 60, "y": 380, "size": 32, "color": "#444" },
    { "type": "ai-region", "prompt": "placeholder:prompt", "x": 0, "y": 500, "w": 1080, "h": 580 }
  ],
  "aiComposition": {
    "mode": "background-then-overlay",
    "promptTemplate": "{{prompt}}, brand color {{primary_color}}, style clean"
  }
}
```

`placeholder:<key>` bindings reference `FramePlaceholder` rows. `asset:<name>` references files in the version's `assetManifest` (stored in Hostinger). The `aiComposition` block controls how AI output and template layers combine (e.g., AI fills a region, then text/logo overlays are drawn on top server-side).

### 10.3 Placeholder Types & Validation

`FramePlaceholder.type` ∈ `{TEXT, MULTILINE, EMAIL, PHONE, URL, IMAGE, LOGO, COLOR, LIST, SELECT, DATE, NUMBER}`. `validation` JSON per type: e.g. text `{minLen,maxLen,regex}`, image `{maxBytes, mime[], minW, minH, aspect}`, select `{options[]}`, list `{itemType, maxItems}`, color `{format:"hex"}`. The admin creating a **custom placeholder** simply adds a row with a type + validation; the API validates submitted values against it dynamically and the client renders the matching control (text field, color picker, image uploader, repeater for lists, dropdown for select). This is the mechanism behind FR-FRAME-3/4.

Example admin-defined placeholders (all supported out of the box): `{{name}} {{company}} {{designation}} {{logo}} {{email}} {{phone}} {{website}} {{address}} {{description}} {{profile}} {{social_links}}` — plus any new one an admin invents.

### 10.4 Rendering Pipeline

```mermaid
graph LR
    A[User selects frame] --> B[GET placeholders schema]
    B --> C[Client renders dynamic form]
    C --> D[User submits values]
    D --> E[Validate values vs schema]
    E --> F[Resolve prompt template + values]
    F --> G[POST /frames/id/preview - server render]
    G --> H{Approve?}
    H -->|yes| I[POST /generations]
    I --> J[Worker: AI gen for ai-region]
    J --> K[Composite overlays text/logo]
    K --> L[Store asset + thumbnail]
```

Server-side rendering uses a headless canvas/`sharp`-based compositor for deterministic text/logo overlay, so the final asset matches the preview. The AI region is generated by the provider; non-AI layers are drawn by the engine. Fonts and brand colors come from placeholders/config.

### 10.5 Publish-Time Validation (FR-FRAME-8)

Before a `FrameVersion` can move `DRAFT → PUBLISHED`, the engine validates: template JSON parses against a schema; every `placeholder:<key>` binding resolves to a defined `FramePlaceholder`; every `asset:<name>` exists in the manifest and in storage; a thumbnail exists; required fonts load; and a **test render** with placeholder defaults/samples succeeds. Failures block publish with precise, per-issue errors. This prevents broken JSON, missing placeholders, missing thumbnails, and invalid mappings from ever reaching users.

### 10.6 Categories, Ranking & Merchandising

Frames belong to a `Category` tree with `displayOrder`, `isFeatured`, `isActive`, `isHidden`; frames carry `ranking`, `isFeatured`, `isTrending`, `tier` (FREE/PREMIUM), tags. The catalogue API sorts and filters by these (indexed per §5.4). Deleting a category is a soft action that reassigns or orphan-guards frames (frames get `categoryId=null`, never lost). Premium frames require entitlement (plan/role/credit gate) checked at generation time.

### 10.7 Frame Edge Cases (summary; full list §24)

Missing placeholder value (required → 422 with field error; optional → default). Broken template JSON (blocked at publish; existing published versions immutable). Missing thumbnail (blocked at publish; catalogue falls back to a generated placeholder thumb). Deleted category (frames reassigned, not deleted). Invalid mapping (publish validation). Version drift (historical assets reference the exact `frameVersionId` used, so old assets remain reproducible even after the frame changes).

---

## 11. File Storage Strategy

### 11.1 Layout

Hostinger File Storage is organized exactly as required, namespaced by tenant for isolation:

```
t_<tenantId>/
  users/
    <userId>/
      images/
      videos/
      uploads/          # user-supplied logos/photos
      projects/
frames/
  <categoryId>/
    <frameId>/
      v<version>/       # background, overlays, fonts, thumbnail
generated/
  <yyyy>/<mm>/<dd>/<generationId>/    # AI outputs
thumbnails/
  <same key as source>.jpg
```

Keys are deterministic and derivable from IDs, so storage and DB never diverge. Tenant prefixing means a signed-URL bug cannot cross tenants without also passing the DB ownership check.

### 11.2 Access Pattern & Storage Adapter

All storage goes through a `StorageProvider` interface (`put`, `getSignedUrl`, `delete`, `stat`, `multipartInit/putPart/complete`) with a Hostinger implementation (S3-compatible where available, else SFTP/HTTP). Public-ish assets (frame thumbnails, catalogue images) can be fronted by the CDN with long cache TTLs; private assets (user uploads, generated results) are served via **short-lived signed URLs** minted only after a DB ownership + tenant check. The app never returns raw provider URLs.

### 11.3 Uploads — Resumable & Mobile-Tolerant (FR-MOB-3)

Uploads use an init → chunk → complete protocol so mobile clients survive interruptions:

```mermaid
sequenceDiagram
    participant M as Mobile Client
    participant API
    participant S as Storage
    M->>API: POST /uploads/init {mime,bytes,checksum}
    API->>API: validate type/size vs config; create Upload(id, chunkSize)
    API-->>M: {uploadId, chunkSize, parts}
    loop each chunk (resumable)
      M->>API: PUT /uploads/{id}/chunk/{n} (idempotent by n)
      API->>S: store part n
    end
    M->>API: POST /uploads/{id}/complete {checksum}
    API->>S: assemble/finalize
    API->>API: verify checksum, scan type, (AV/heuristic), generate thumb
    API-->>M: {fileRef}
    Note over M,API: On reconnect: GET /uploads/{id} returns received parts to resume
```

Chunk PUTs are idempotent by index (re-uploading a part is safe), and `GET /uploads/{id}` returns which parts landed so a client resumes exactly where it dropped. Uploads have a TTL; abandoned uploads are garbage-collected by the scheduler.

### 11.4 Validation, Safety & Integrity

Every upload is validated against config: allowed MIME types (`storage.allowedMime`), max size (`storage.maxUploadBytes`), and **real content sniffing** (magic-byte check, not just extension) to reject spoofed files. Images are re-encoded/normalized (strip EXIF/GPS for privacy, cap dimensions) via `sharp`. A checksum guards against corrupted uploads; a duplicate-detection hash can dedupe identical files. Optional AV scanning hook. Thumbnails are generated for all stored images/videos.

### 11.5 Storage Edge Cases (summary; full list §24)

Upload failure/interruption (resume protocol). Disk/quota full (pre-flight quota check via config `storage.tenantQuotaBytes`; graceful 507 + alert; oldest soft-deleted assets purged first by GC). Invalid/corrupted file (rejected at complete via checksum + sniff). Duplicate asset (hash dedupe optional). Orphaned blobs (a reconciliation job deletes storage keys with no DB row and flags DB rows with no blob). Signed-URL leakage (short TTL + tenant/ownership check + no directory listing).

### 11.6 Storage Cost & Lifecycle

Per-tenant quota and usage metrics feed admin analytics. Lifecycle rules (config): move rarely accessed generated assets to cheaper cold storage after N days; hard-delete soft-deleted assets after the retention grace; keep frame version assets as long as any asset references that version.

---
---

# Part 4 — Apps & Platform

## 12. Admin Panel Modules

### 12.1 Overview

The Admin Panel is a separate React + Vite + TypeScript SPA (isolated from the user app for security and bundle size), using the same shared API client, TanStack Query for server state, Zustand for UI state, React Hook Form for forms, and TailwindCSS. It is permission-gated end to end: the UI only renders modules the principal's permissions allow, and every action is also enforced server-side (UI hiding is never the only guard). Super-admins operate globally and can scope to a tenant; tenant-admins are confined to their tenant.

### 12.2 Module Map

```mermaid
graph TB
    subgraph Admin Panel
      DASH[Dashboard / Analytics]
      USERS[User Management]
      FRAMES[Frame Studio + Versions]
      CATS[Categories]
      WALLET[Wallet & Payments Ops]
      PLANS[Recharge Plans]
      AICFG[AI Configuration]
      CONFIG[System Config + Feature Flags]
      BRAND[Branding / Theme]
      NOTIF[Notification Templates]
      JOBS[Jobs & Queues Monitor]
      AUDIT[Audit Log Viewer]
      TENANTS[Tenant Management - super only]
    end
```

### 12.3 Module Detail

**User Management** — searchable/filterable user table (status, role, date, spend); create user, suspend/restore, soft-delete, reset password, force-logout, view a user's wallet/ledger/assets/generations; impersonate (permissioned, audited).

**Frame Studio** — upload/author frames: template JSON editor with live validation + live preview, placeholder builder (add typed custom placeholders with validation, defaults, required), asset manifest uploader (background/overlays/fonts), category assignment, tags, tier (free/premium), ranking, featured/trending toggles, thumbnail. Version management: create draft from current, publish (runs publish-time validation §10.5), archive, rollback (publishes a prior version). Preview any version with sample data.

**Categories** — manage the category/subcategory tree, display order, featured, active/hidden; safe delete (reassign frames).

**Wallet & Payments Ops** — global/tenant transaction browser with filters; per-user manual recharge, refund (full/partial to source or as credits), bonus/promo grants (single or bulk), manual adjustments — each requiring a reason and producing audit + ledger entries. Payment inspector shows Razorpay order/payment/webhook trail and reconciliation status; retry stuck refunds.

**Recharge Plans** — CRUD plans (amount, credits, bonus, expiry days, currency, active, display order); changes are versioned and reflected instantly to clients via `/config/public`.

**AI Configuration** — per-provider settings: API keys (write-only, encrypted, masked on read), default provider/model, timeouts, retry counts, queue size, max concurrency, credit cost matrix (provider × model × size/duration), per-user and per-tenant daily/monthly limits, moderation toggle, circuit-breaker status (read + manual reset). Test-connection button runs a staging smoke call.

**System Config + Feature Flags** — the generic config editor over the config namespaces (billing, ai, storage, limits, flags, branding). Typed editors per key, inline validation, secret masking, version history with diff and one-click rollback ([§15](#15-configuration-management-system)). Maintenance-mode toggle with scheduled window and banner message.

**Branding / Theme** — app name, logo, favicon, color palette/theme tokens, email header/footer, legal links — per tenant. Live preview; published to clients via `/config/public`.

**Notification Templates** — edit templated messages per event/channel/locale with variable placeholders and preview/test-send.

**Jobs & Queues Monitor** — live queue depths, throughput, failure rates per queue; drill into failed jobs with error + payload; retry/cancel; provider breaker state; stuck-job reaper status.

**Audit Log Viewer** — filter by actor, action, entity, date, tenant; view before/after diffs; export.

**Tenant Management (super-admin)** — create/suspend tenants, set tenant-level plan/quota, seed default config/branding, view per-tenant usage and billing.

### 12.4 Admin UX & Safety

Destructive actions require typed confirmation and a reason; bulk operations preview affected counts before applying; every mutation shows an optimistic UI backed by TanStack Query with rollback on error. All admin state changes are audited server-side regardless of UI.

---

## 13. User Dashboard Modules

### 13.1 Overview

The end-user app (React + Vite + Capacitor) is the same codebase for web and native. It emphasizes a fast "pick frame → fill → generate → download" loop, transparent credits, and offline resilience.

### 13.2 Module Map & Navigation

```mermaid
graph TB
    HOME[Home / Featured & Trending Frames] --> BROWSE[Browse by Category / Search]
    BROWSE --> FRAME[Frame Detail + Dynamic Form]
    FRAME --> PREVIEW[Preview]
    PREVIEW --> GEN[Generate -> Job Progress]
    GEN --> RESULT[Result -> Download/Save/Favourite]
    HOME --> WALLET[Wallet & Recharge]
    HOME --> HISTORY[AI History / Gallery]
    HISTORY --> ASSET[Asset Detail]
    HOME --> PROJECTS[Saved Projects]
    HOME --> PROFILE[Profile & Settings]
    WALLET --> TXN[Transactions]
```

### 13.3 Module Detail

**Profile & Settings** — edit display name, email (re-verify), password, MFA (optional), notification preferences per channel/event, connected devices/sessions (revoke), language, delete account (starts erasure).

**Wallet** — balance + held credits, recharge plans, Razorpay checkout, low-balance indicator; **Transactions** — filterable ledger (recharge, spend, refund, bonus, expiry) with export.

**Generation flow** — frame selection (featured/trending/category/search/favourites), dynamic placeholder form (rendered from schema), logo/image upload (resumable), prompt + negative prompt + params, live cost estimate, preview, generate. Job progress screen shows queued/running/done with the ability to leave and get notified.

**AI History / Gallery** — grid of generated images/videos with filters (kind, frame, date, favourite), asset detail (metadata, prompt, frame version, credits, cost, download signed URL), favourite, delete, regenerate/variation.

**Saved Projects** — save a frame+values+params combination; re-open and re-run.

**Favourites** — favourited frames for quick access.

### 13.4 Client State & Data

TanStack Query owns all server state (caching, background refetch, optimistic mutations, retry). Zustand holds ephemeral UI/session state (wizard progress, draft form values, offline queue). React Hook Form drives the dynamic placeholder forms with schema-driven validation mirrored from the server rules. A shared, generated TypeScript API client (from the OpenAPI spec) keeps client/server contracts in lockstep.

### 13.5 Mobile Parity (Capacitor) — First-Class

The mobile requirement is treated as a core design constraint, not a wrapper afterthought:

- **One codebase**, platform differences behind a `platform` abstraction (`@capacitor/core` + custom service). Web uses browser APIs; native uses Capacitor plugins.
- **Offline mode (FR-MOB-2)** — TanStack Query persistence + a local cache (Capacitor Preferences/SQLite) let users browse cached frames and prior assets offline; generation drafts created offline are queued and auto-submitted when connectivity returns (with credit check at submit time).
- **Resumable uploads (FR-MOB-3)** — the chunked upload protocol (§11.3) plus a background-capable upload service; on reconnect the client queries received parts and continues.
- **Push (FR-MOB-4)** — `@capacitor/push-notifications` with FCM (Android) and APNs (iOS); device tokens registered via `/notifications/devices`; generation-complete and recharge events delivered as push.
- **Native camera/gallery (FR-MOB-5)** — `@capacitor/camera` for logo/photo capture.
- **Lifecycle robustness (FR-MOB-6)** — uploads/generations survive backgrounding; on resume the app reconciles job status from the server (server is source of truth).
- **Secure token storage** — refresh token in Keychain/Keystore via secure-storage plugin, never in localStorage on native.
- **Build/release** — Capacitor Android (AAB) and iOS (IPA) builds in CI; store metadata; Apple sign-in included if any social login is offered (App Store rule).

### 13.6 Accessibility & Performance

WCAG 2.1 AA (focus management, labels, contrast, keyboard nav on web), code-splitting per route, image lazy-loading, skeleton loaders, and optimistic UI to keep the core loop feeling instant even on mid-tier devices and slow networks.

---

## 14. Background Jobs & Queue Design

### 14.1 Queue Topology (BullMQ on Redis)

```mermaid
graph LR
    API[API] -->|enqueue| Q1[generation.image]
    API -->|enqueue| Q2[generation.video]
    API --> Q3[thumbnail]
    API --> Q4[notification]
    API --> Q5[webhook.outbox]
    SCH[Scheduler] --> Q6[maintenance: expiry, reconcile, gc, reaper]
    Q1 --> W[Image Workers]
    Q2 --> WV[Video Workers]
    Q3 --> WT[Thumb Workers]
    Q4 --> WN[Notification Workers]
    Q5 --> WO[Outbox Workers]
    Q6 --> WM[Maintenance Workers]
```

Separate queues let each workload scale and fail independently and get its own concurrency/rate policy (e.g., image vs. video have different provider limits). Video uses a dedicated queue because jobs are long and should not head-of-line-block image jobs.

### 14.2 Job Semantics

- **Idempotent** — every job carries a stable id (`generationId`, `paymentId`, `notificationId`); handlers check current state before acting so redelivery is safe.
- **Retries** — per-queue backoff (exponential + jitter), max attempts from config; deterministic failures skip retry.
- **Dead-letter** — exhausted jobs land in a DLQ, visible in the admin Jobs monitor for inspection/retry.
- **Rate/concurrency** — per-queue `concurrency` and a Redis token-bucket for provider quotas (config-driven).
- **Priority** — premium tenants/users can get higher priority (config).
- **Stuck-job reaper** — the scheduler detects `RUNNING` jobs exceeding max duration and either re-queues (if provider job still pending) or fails+releases credits.

### 14.3 Scheduled (Cron) Jobs

| Job | Cadence (config) | Purpose |
|---|---|---|
| Credit expiry sweep | daily | Expire lots, ledger `EXPIRY`, notify |
| Payment reconciliation | every 15 min | Credit captured-but-unwebhooked payments; flag discrepancies |
| Stuck-job reaper | every 2 min | Recover hung generations |
| Upload GC | hourly | Delete abandoned uploads |
| Orphan blob/DB reconcile | daily | Detect storage/DB drift |
| Analytics rollups | hourly/daily | Precompute dashboard aggregates |
| Audit retention/archive | daily | Move old logs to cold storage |
| Backup trigger/verify | daily | DB + storage backup + restore test cadence |

### 14.4 Reliability — Outbox Pattern

External side effects (webhooks we send, push/email, provider notifications) are written as rows in an **outbox** within the same DB transaction as the state change, then delivered by an outbox worker with retries. This guarantees that a crash between "state changed" and "notification sent" cannot lose the event — it's still in the outbox to be retried (ADR-09). Inbound webhooks are made idempotent via the `WebhookEvent` unique constraint.

---

## 15. Configuration Management System

### 15.1 Principle: Nothing Hardcoded

Every business constant is a **config key** resolved at runtime from the `ConfigEntry` store, never a literal in code. Code ships only *defaults of last resort* for safety. The resolution order is:

```mermaid
graph LR
    REQ[Resolve key] --> T{tenant override exists?}
    T -->|yes| TV[use tenant value]
    T -->|no| P{platform default exists?}
    P -->|yes| PV[use platform value]
    P -->|no| C[hardcoded safe fallback]
```

### 15.2 Namespaces

`billing` (credit price, plans, expiry, currency), `ai` (keys*, providers, models, cost matrix, timeouts, retries, queue size, concurrency, limits, moderation), `storage` (paths, quotas, max size, allowed MIME, lifecycle), `limits` (daily/monthly per user/tenant, rate limits, concurrency), `flags` (feature toggles, maintenance mode), `branding` (name, logo, theme, emails), `auth` (token TTLs, password policy, lockout), `notifications` (templates, channels). (*secrets stored encrypted.)

### 15.3 Delivery & Hot Reload

Config is cached in Redis and in-process (short TTL). On admin update, the API writes `ConfigEntry` + `ConfigVersion`, then publishes an invalidation over a Redis pub/sub channel; all API/worker instances refresh their local cache within seconds — **no redeploy** (ADR-04). Client-relevant, non-secret config (branding, plans, flags) is exposed via `GET /config/public` and cached by clients with an ETag.

### 15.4 Versioning, Rollback & Safety

Every change appends a `ConfigVersion` (value, actor, reason, timestamp). Admin can view the diff history and **roll back** any key to a prior version (which itself creates a new version). Changes to sensitive keys (AI keys, cost, limits) require elevated permission and are audited. Type/range validation runs before a value is accepted (e.g., cost ≥ 0, timeout within bounds), preventing a bad config from taking down generation. Secrets are encrypted at rest and write-only in the UI (masked on read).

### 15.5 Environment vs. Runtime Config

Only true bootstrap secrets/topology live in environment variables (DB URL, Redis URL, master encryption key, base app key) — see [Appendix B](#appendix-b--environment-variables). Everything operational and business-facing lives in the runtime store — see [Appendix C](#appendix-c--configuration-key-registry).

---

## 16. Error Handling & Recovery

### 16.1 Error Taxonomy

A single error taxonomy maps every failure to a stable `code`, HTTP status, ret/safe-retry flag, and user-facing message. Categories: `VALIDATION` (422), `AUTH` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT`/idempotency (409), `PAYMENT` (402/409), `RATE_LIMIT` (429), `PROVIDER` (502/503/504), `STORAGE` (507/5xx), `INTERNAL` (500). Domain codes (`WALLET_INSUFFICIENT_CREDITS`, `FRAME_VALIDATION_FAILED`, `AI_PROVIDER_UNAVAILABLE`, …) live under these.

### 16.2 Global Handling

A NestJS **global exception filter** converts every thrown error into the RFC-9457 Problem Details shape (§6.1), attaches the correlation id, logs at the right level, and never leaks stack traces or internals to clients in production. A **timeout/retry interceptor** and provider adapters classify errors as transient (retry with backoff) vs. deterministic (fail fast). Unhandled promise rejections and worker crashes are caught, logged, and the process is restarted by the container orchestrator; in-flight jobs are re-queued (idempotency makes this safe).

### 16.3 Recovery Playbooks

| Failure | Automatic recovery |
|---|---|
| AI provider transient error/rate limit | Backoff retry; circuit breaker; job stays queued; credits stay held until resolved or timeout |
| AI provider hard failure | Fail generation, release held credits, notify user, alert admin |
| Payment webhook missed | Reconciliation job credits from provider poll (idempotent) |
| DB deadlock | Detect (error 1213), retry transaction with backoff (bounded) |
| Transaction rollback | Atomic — no partial state; ledger/hold either fully applied or not at all |
| Worker crash mid-job | Job re-queued; state check prevents double effect |
| Storage upload failure | Client resume; worker retries store step; on repeated failure, release credits |
| Redis unavailable | API degrades: reject new generations (503) but keep read paths; reconnect with backoff |
| Config store unreachable | Serve last-known-good cached config; alert |

### 16.4 User-Facing Failure UX

Failures are always explained in plain language with the correct remedy (e.g., "Generation failed — your 12 credits were returned. Try again or adjust your prompt."). No silent credit loss, ever. Clients auto-retry idempotent reads and surface a retry button for user-initiated actions.

---

## 17. Security Strategy

### 17.1 Baseline

Target **OWASP ASVS L2** and defend the **OWASP Top 10**. Security is layered (edge → app → data) so no single control is a single point of failure.

### 17.2 Controls by Layer

| Layer | Controls |
|---|---|
| **Edge (Nginx/CDN)** | TLS 1.2+ only, HSTS, request size caps, IP rate limiting, optional WAF, security headers (CSP, X-Content-Type-Options, X-Frame-Options/`frame-ancestors`, Referrer-Policy, Permissions-Policy) |
| **Auth** | Argon2id hashing, short JWT + rotating refresh with reuse detection, session revocation, login throttling/lockout, optional MFA, email verification, generic auth errors (no enumeration) |
| **AuthZ** | RBAC permission guards on every endpoint; tenant scoping in middleware + Prisma; deny-by-default |
| **Input** | Global `ValidationPipe` (whitelist + forbid unknown + transform), dynamic frame-value validation, content-type sniffing on uploads, size/type limits |
| **Injection** | Prisma parameterized queries (no string SQL); no raw query with user input; output encoding to prevent XSS; JSON-only APIs |
| **CSRF** | For cookie-based web refresh: `SameSite=Strict` + CSRF token on state-changing cookie-authed routes; native uses bearer tokens (not cookies), immune to CSRF |
| **Secrets** | Provider keys encrypted at rest (AES-256-GCM) with a master key from env/secret manager; write-only in admin; never logged |
| **Webhooks** | HMAC signature verification (Razorpay/Runway), replay protection via unique event id + timestamp window |
| **Rate limiting** | Per-user/IP/tenant, config-driven, on auth, payment, generation, and upload endpoints |
| **Files** | Signed short-TTL URLs, tenant/ownership checks, EXIF stripping, re-encoding, quota enforcement, optional AV scan |
| **Data** | TLS to DB, encrypted backups, PII minimization, soft-delete + erasure jobs, audit logging |
| **Dependencies** | `npm audit`/Snyk in CI, pinned versions, SBOM, regular patching |

### 17.3 Payment & PCI Scope

BrandPilot is **PCI-DSS SAQ-A**: card data is entered into Razorpay's hosted checkout and never touches BrandPilot servers, logs, or storage. Only tokens/order ids are handled. Webhooks are signature-verified and idempotent.

### 17.4 Tenant Isolation as Security

Cross-tenant access is treated as a critical security boundary: JWT `tid`, tenant middleware, Prisma auto-scoping, and storage prefixing each independently prevent leakage; automated tests assert that a token from tenant A cannot read/write any tenant B resource across every endpoint.

### 17.5 Secure SDLC

Threat modeling per major feature; mandatory code review; SAST + dependency scanning + secret scanning in CI; pre-prod security review (there is a `security-review` capability for pending changes); periodic pen-test before GA; least-privilege infra credentials; rotation policy for keys/tokens; incident response runbook with defined severities and disclosure process.

### 17.6 Privacy & Compliance

GDPR/India-DPDP: consented data collection, export (`/me` data export), erasure (soft-delete → hard-delete job with storage purge), documented retention (§5.7), Terms/Privacy versioned acceptance, and data-processing records for sub-processors (OpenAI, Runway, Razorpay, Hostinger).

---

## 18. Performance & Scalability

### 18.1 Strategy: Vertical First, Then Horizontal

Given the Hostinger VPS + Docker target, v1 scales **vertically** (bigger VPS) with a **horizontal-ready** architecture so no rewrite is needed later. Statelessness (API), externalized state (Redis/MySQL/blob), and queue-decoupled workers make horizontal scaling a config/ops change.

### 18.2 Techniques

- **Caching** — Redis cache for config, catalogue (frames/categories), public config, and hot reads; HTTP caching (ETag/Cache-Control) for `/config/public` and catalogue; CDN for static bundles and public thumbnails.
- **DB** — targeted indexes (§5.4), keyset pagination, connection pooling (PgBouncer-equivalent / Prisma pool sizing), read-heavy analytics served from precomputed rollups, slow-query logging, and a documented path to a **read replica** for analytics/reporting.
- **Async everything slow** — AI, thumbnailing, notifications, exports run in workers; API stays fast.
- **Backpressure** — queue size limits + provider token buckets prevent overload; excess generation requests get a clear "high demand, queued" state rather than failures.
- **Payload discipline** — pagination, field selection, compressed responses (gzip/br), image size caps.
- **Frontend** — route code-splitting, lazy assets, prefetch, skeletons, optimistic UI; Lighthouse budgets enforced in CI.

### 18.3 Scaling Triggers & Path

```mermaid
graph LR
    A[Single VPS: nginx+api+workers+redis] -->|CPU/latency high| B[Add API & worker replicas on same VPS]
    B -->|VPS saturated| C[Second VPS: move workers + Redis]
    C -->|DB bound| D[MySQL read replica + rollups]
    D -->|Enterprise isolation / global| E[Roadmap: multi-node K8s / schema-per-tenant / multi-region]
```

Concrete triggers (config-monitored): API p95 > SLO for 10 min → add API replica; queue wait > threshold → add workers; Redis memory > 70% → dedicate a Redis node; DB CPU > 70% sustained → add read replica. Capacity planning targets in §3.2.

### 18.4 Load & Capacity Testing

k6/Artillery scenarios model realistic mixes (browse-heavy, generate-heavy, recharge spikes) run in CI/staging before releases; results validated against SLOs; the queue and breaker behavior is tested under provider-slowness injection.

---

## 19. Logging, Monitoring & Audit

### 19.1 Structured Logging & Correlation

All logs are structured JSON with a **correlation id** generated at the edge and propagated through API → queue job → worker → provider call, so a single user action is traceable end to end. Log levels are environment-configured; no PII or secrets in logs (a redaction layer scrubs tokens, keys, card-adjacent fields, emails where not needed).

### 19.2 Split Log Streams (as required)

Distinct, independently queryable/retained streams: **application**, **API access**, **wallet**, **AI**, **payment**, **error**, **audit**. Each has its own retention (§5.7). Wallet/payment/AI logs capture enough to reconstruct any financial or generation event without exposing secrets.

### 19.3 Metrics & Health

- **RED** (Rate, Errors, Duration) per endpoint and per queue; **USE** (Utilization, Saturation, Errors) for CPU/memory/Redis/DB/queue depth.
- Business metrics: signups, active users, generations by status, revenue, credits used, provider cost/margin, storage usage, top frames, failed jobs.
- **Health/readiness** endpoints check DB, Redis, storage, and provider reachability; used by Nginx/orchestrator and status dashboards.
- Stack: Prometheus-compatible metrics + Grafana dashboards (self-hosted on the VPS or a lightweight hosted option); logs shipped to a searchable store (Loki/ELK-lite) sized for the VPS.

### 19.4 Alerting

Alerts on: API error rate/latency SLO breach, queue backlog/DLQ growth, provider breaker open, payment reconciliation discrepancy, low disk/quota, backup failure, auth anomaly spikes (possible attack), and margin anomalies (AI cost spike). Alerts route to the ops channel with severity and a linked runbook.

### 19.5 Audit Trail

Every privileged/mutating action (admin ops, config changes, wallet adjustments, impersonation, frame publish, user suspension) writes an immutable `AuditLog` with actor, role, before/after, IP, and correlation id. The audit stream is tamper-evident (append-only; optional periodic hash-chaining) and queryable in the admin panel.

---
---

# Part 5 — Delivery & Risk

## 20. Testing Strategy

### 20.1 Test Pyramid

```mermaid
graph TB
    E2E[E2E / UI: few, critical journeys] 
    INT[Integration / Contract: moderate]
    UNIT[Unit: many, fast]
    UNIT --> INT --> E2E
```

Emphasis on a broad unit base (fast, deterministic), a solid integration/contract middle (real DB/Redis via containers, provider adapters against fixtures + a sandbox smoke), and a small set of high-value E2E journeys.

### 20.2 Layers & Tooling

| Layer | Scope | Tools |
|---|---|---|
| **Unit** | Domain/business logic: wallet math, credit hold/settle, frame validation, RBAC resolution, cost calc, config resolution | Jest, ≥80% coverage on domain |
| **Integration** | Modules against real MySQL + Redis in Docker (Testcontainers); transactions, locking, idempotency, Prisma scoping | Jest + Testcontainers |
| **Contract** | Provider adapters (OpenAI/Runway/Razorpay) against recorded fixtures; API↔client via OpenAPI schema | Pact-style / nock / OpenAPI validator |
| **E2E (API)** | Full flows: register→recharge→generate→download; webhook idempotency; refund | Supertest / Playwright API |
| **E2E (UI)** | Web + mobile critical journeys | Playwright (web), Appium/Maestro (Capacitor native) |
| **Load** | SLO validation, backpressure, breaker | k6 / Artillery |
| **Security** | SAST, dependency, secret scan, authZ/tenant-isolation tests, ZAP baseline | Snyk/CodeQL, custom authz suite, OWASP ZAP |

### 20.3 Critical Test Scenarios (must-have)

Financial correctness: concurrent generations cannot overdraw; webhook replay credits once; refund/adjust produce correct ledger; expiry sweep is exact. Idempotency: duplicate `Idempotency-Key` returns original result and performs no second effect for both generation and payment. Failure paths: provider timeout/rate-limit/hard-fail all release held credits and notify. Tenant isolation: token A cannot access tenant B on **every** endpoint (generated matrix test). Frame publish validation blocks broken templates. Resumable upload survives simulated disconnect. Auth refresh reuse revokes the family.

### 20.4 Test Data & Environments

Seed scripts create tenants, roles, plans, sample frames, and users for local/CI/staging. Providers run in sandbox/mock in CI; a nightly staging job runs live smoke against real provider sandboxes. A dedicated **staging** mirrors prod topology (VPS + Docker) for E2E, load, and security runs before release.

### 20.5 Quality Gates

CI blocks merge on: lint/format, typecheck, unit+integration green, coverage threshold, OpenAPI contract validity, security scan (no high/critical), and (on release branches) E2E + load smoke. Flaky tests are quarantined and fixed, not ignored.

---

## 21. Deployment & CI/CD

### 21.1 Repository & Build

A **monorepo** (pnpm/Turborepo) with packages: `api` (NestJS), `web` (user app), `admin` (admin app), `mobile` (Capacitor shell over `web`), `shared` (types, API client, validation, config keys), `infra` (Docker, compose, Nginx, migrations). Shared types keep API and clients in lockstep; a single `shared` change surfaces breakages at compile time.

### 21.2 Pipeline

```mermaid
graph LR
    PR[PR] --> CI[Lint+Typecheck+Unit+Integration+Contract+Security]
    CI --> BUILD[Build images: api, worker, web, admin]
    BUILD --> STG[Deploy to Staging - VPS/Docker]
    STG --> E2E[E2E + Load + ZAP smoke]
    E2E --> APPROVE[Manual approval]
    APPROVE --> PROD[Deploy to Prod - blue/green]
    PROD --> POST[Smoke + health + rollback watch]
    subgraph Mobile
      BUILD --> ANDROID[Android AAB -> Play internal]
      BUILD --> IOS[iOS IPA -> TestFlight]
    end
```

### 21.3 Deploy Mechanics (Hostinger VPS + Docker)

Docker images are built in CI and pushed to a registry. On the VPS, `docker compose` (or Swarm for rolling updates) runs Nginx, API replicas, workers, scheduler, and Redis. Deploys are **blue/green**: bring up the new stack alongside the old, run health checks and DB migrations (expand/contract, backward-compatible), switch Nginx upstream, then retire the old. **Zero-downtime migrations** follow the expand → migrate → contract pattern (add columns/tables first, deploy code that tolerates both, backfill, then remove old) so a deploy never breaks the running version. Rollback = switch Nginx back + roll images; migrations are always backward-compatible within a release.

### 21.4 Config & Secrets in Deploy

Bootstrap secrets (DB/Redis URLs, master encryption key) injected via environment/secret store at container start (never baked into images). All operational config lives in the DB config store and needs no redeploy to change (§15).

### 21.5 Mobile Release

CI builds signed Android AAB and iOS IPA from the Capacitor project, publishes to Play internal testing and TestFlight, and promotes to production tracks on approval. Over-the-air web-asset updates (Capacitor live-update, optional) allow shipping non-native changes without a store review, gated by version compatibility checks.

### 21.6 Engineering Phase Plan (maps to §1.8)

| Phase | Key deliverables |
|---|---|
| **P0** | Monorepo, CI, Docker/compose, Nginx, Prisma schema + migrations, config store, tenants, auth (JWT+refresh+RBAC), health, seed. |
| **P1** | Wallet ledger, plans, Razorpay order+webhook+reconcile, transactions UI. |
| **P2** | Frame engine + admin frame studio (image), preview/compositor, generation queue + OpenAI adapter, storage + resumable upload, asset gallery. |
| **P3** | Runway video, full admin panel + analytics rollups, notifications (email/in-app/push backend). |
| **P4** | Capacitor native builds, offline/resume/push, load + security hardening, DR drills, GA. |

### 21.7 Environments

`local` (compose + Testcontainers), `ci` (ephemeral), `staging` (prod-mirror), `production`. Each has isolated DB, Redis, storage bucket/prefix, and provider sandbox/live keys. Promotion is image-based (same artifact staging→prod).

---

## 22. Backup & Disaster Recovery

### 22.1 Objectives

**RPO ≤ 15 min, RTO ≤ 2 h** (§3.3). Backups cover MySQL, the config/secret store (encrypted), and file storage; Redis is treated as rebuildable cache/queue (durable state is in MySQL), though BullMQ persistence + AOF reduces in-flight job loss.

### 22.2 Backup Regime

| Asset | Method | Frequency | Retention |
|---|---|---|---|
| MySQL | Full dump + binlog/PITR | Full daily, binlog continuous | 30 days + monthly archive |
| File storage | Incremental sync to secondary bucket/region | Hourly/continuous | 30 days |
| Config/secrets | Encrypted export | On change + daily | 90 days |
| Redis (best-effort) | AOF snapshot | Periodic | 7 days |

Backups are **encrypted at rest**, integrity-checked, stored off the primary VPS (secondary Hostinger location / off-site), and **restore-tested** on a schedule (a restore that has never been tested is not a backup).

### 22.3 DR Runbooks

Scenarios with documented, rehearsed procedures: VPS loss (provision new VPS, `docker compose up` from images, restore DB from latest full+binlog, re-point storage, rotate any exposed secrets); DB corruption (PITR to just before corruption); storage loss (restore from secondary sync); Redis loss (rebuild cache, re-enqueue from DB state — idempotent handlers make reprocessing safe); provider/key compromise (rotate keys via config store, revoke sessions). Each runbook lists owner, steps, validation checks, and comms plan. DR drills run at least quarterly and the RPO/RTO are measured, not assumed.

### 22.4 Business Continuity

Maintenance mode and read-only degradation keep the product partially available during incidents. A public status page and in-app banner (config-driven) communicate outages. Financial integrity is protected because every credit/payment effect is reconstructable from the append-only ledger + provider records.

---

## 23. Risk Assessment & Mitigation

### 23.1 Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | AI provider outage/rate limits degrade core feature | High | High | Circuit breaker, backoff, queueing, clear UX, provider abstraction for future multi-provider failover |
| R2 | Payment/webhook edge cases cause revenue loss or double charge | Med | High | Ledger + idempotency + webhook dedupe + reconciliation + finance alerts |
| R3 | Cross-tenant data leak | Low | Critical | Layered isolation (JWT/middleware/Prisma/storage) + automated isolation tests |
| R4 | Cost overrun (AI spend > credit revenue) | Med | High | Per-request cost tracking, margin dashboards/alerts, config cost matrix, per-user/tenant limits |
| R5 | Single-VPS single point of failure | Med | High | Horizontal-ready design, backups + tested DR, documented scale-out path |
| R6 | Provider ToS / content-policy violations | Med | Med | Moderation hook, ToS surfaced, prompt/output screening config |
| R7 | Secret leakage (provider/API keys) | Low | Critical | Encrypted store, write-only UI, no secrets in logs/images, rotation, scanning |
| R8 | Prompt-injection / abusive generation | Med | Med | Input validation, moderation, rate limits, abuse detection, audit |
| R9 | Mobile store rejection / native regressions | Med | Med | Early store setup, Apple sign-in rule, device-farm E2E, staged rollout |
| R10 | Scope creep delaying GA | High | Med | Phased delivery (§1.8/§21.6), MoSCoW prioritization, ADRs |
| R11 | Hostinger storage/DB limits (quota, throughput) | Med | Med | Quotas + monitoring, CDN offload, lifecycle/cold storage, scale-out path |
| R12 | Data-loss on deploy migration | Low | High | Expand/contract zero-downtime migrations, backups pre-migrate, blue/green rollback |
| R13 | Chargebacks/fraud | Med | Med | Razorpay risk tools, velocity limits, KYC-lite for high spend (roadmap), audit |
| R14 | Vendor lock-in (Hostinger/providers) | Med | Low | Adapters (storage/AI/payment) behind interfaces; S3-compatible layer |

### 23.2 Assumptions & Open Questions

Confirmed decisions: multi-tenant from day one, Capacitor mobile parity, Hostinger VPS + Docker, Markdown plan only (code follows on approval). Open items to confirm before/early in P0: expected tenant/user scale and peak concurrency (sizes the VPS); which OpenAI image models/sizes and Runway models are in scope for the initial cost matrix; whether tenants bring their own provider keys in v1 or use the platform key only; primary currency/regions (affects Razorpay + tax); and whether Hostinger exposes an S3-compatible API vs. SFTP-only (affects the storage adapter and multipart/resumable design).

---

## 24. Complete Edge-Case Catalogue

Each row: **Case → Handling**. This is the master list; individual sections reference back here.

### 24.1 Authentication & Session

- Expired JWT → 401 `TOKEN_EXPIRED`; client refreshes silently.
- Invalid/tampered JWT → 401; log; possible attack signal.
- Invalid refresh token → 401; no rotation.
- Rotated (reused) refresh token → revoke entire session family; force re-login.
- Concurrent refresh race (same token, two tabs/devices) → short Redis lock + grace window; first rotates, others get the new token or a benign retry.
- Multiple-device login → each is a tracked session; individually/all revocable.
- Session expiry mid-request → current request completes; next refresh fails.
- Password reset token reuse/expiry → single-use, expiring; invalid after use.
- Login brute force → throttle + lockout per (email, IP); generic errors.
- Unverified email attempting generation → 403 `EMAIL_NOT_VERIFIED`.
- Clock skew → `clockTolerance` on verify.
- Suspended/deleted user with live access token → Redis revocation set blocks within seconds.

### 24.2 Wallet & Credits

- Double deduction → single hold per generation + idempotency + settle keyed by generationId.
- Negative balance attempt → `FOR UPDATE` check before hold; impossible.
- Concurrent spends → row lock serializes; each checks available (balance − held).
- Refund failure → retry queue + ops alert; ledger only on confirmed `refund.processed`.
- Partial refund → `PARTIALLY_REFUNDED`; exact ledger amount.
- Expired credits during in-flight generation → hold taken from valid lots at request time; expiry can't strand a running job.
- Bonus/promo with expiry → dated `CreditLot`; FIFO consumption; sweep on expiry.
- Manual adjustment errors → require reason + permission; fully audited; reversible via compensating entry.

### 24.3 Razorpay / Payments

- Webhook retry / duplicate callback → unique `WebhookEvent(provider,eventId)`; idempotent no-op on replay.
- Duplicate payment → unique `providerPaymentId`; credited once.
- Failed payment → `FAILED`; no credit; user notified.
- Timeout / abandoned checkout → order stays `CREATED`; reconciliation resolves or expires it.
- Partial success / amount mismatch → verify captured amount == order amount; mismatch quarantined + alert, no credit.
- Signature invalid → reject, log, alert; never credit.
- Out-of-order webhooks (captured before authorized) → state machine tolerates; final state derived from event types.
- Missed webhook → reconciliation job polls Razorpay and credits (idempotent).
- Chargeback/dispute webhook → freeze wallet, alert finance, ledger adjustment.
- Currency mismatch → reject.

### 24.4 OpenAI (Image)

- Rate limit (429) → backoff + `Retry-After`; breaker; job re-queued; credits stay held until resolved or timeout.
- Invalid/expired key → fail fast, release credits, alert admin, don't retry.
- Timeout → `TIMED_OUT`, release, allow retry.
- Network failure → retry with backoff/jitter.
- Model failure/refusal/content policy → `FAILED` with reason, release.
- Provider returns expiring URL → download-and-store immediately.
- Unexpected/empty output → treat as failure, release.

### 24.5 Runway (Video)

- Long processing → async + progress events + notify; hard cap via config → timeout+release.
- Cancelled job (user) → best-effort provider cancel; release held credits.
- Failed generation → `FAILED` + reason; release.
- Retry queue for transient errors → bounded attempts, then DLQ.
- Webhook + polling both fire → idempotent finalize keyed by generationId.
- Partial/corrupt output → checksum/validate on download; failure if invalid.

### 24.6 Storage / Uploads

- Upload failure/interruption → resumable chunk protocol; resume from received parts.
- Disk/quota full → pre-flight quota check; 507 + alert; GC purges soft-deleted first.
- Invalid file (type/size) → rejected at init/complete via config limits + magic-byte sniff.
- Corrupted upload → checksum mismatch → reject.
- Duplicate asset → optional content-hash dedupe.
- Orphaned blob or dangling DB row → daily reconcile job.
- Signed-URL leakage → short TTL + tenant/ownership check; no listing.
- Background/kill during upload (mobile) → resume on relaunch; server reconciles.

### 24.7 Frames

- Missing required placeholder value → 422 with per-field error; optional uses default.
- Broken template JSON → blocked at publish; published versions immutable.
- Missing thumbnail → blocked at publish; catalogue fallback thumb.
- Deleted category → frames reassigned (`categoryId=null`), never lost.
- Invalid placeholder mapping → publish-time validation blocks.
- Frame edited after assets exist → assets pin `frameVersionId`; remain reproducible.
- Premium frame without entitlement → 403 at generation.
- Admin-defined new placeholder type → validated dynamically; client renders matching control; no code change.

### 24.8 API

- Rate limiting → 429 + `Retry-After`; per user/IP/tenant.
- Large payload → size cap at Nginx + app; 413.
- Invalid request → 422 with field detail (whitelist validation).
- Duplicate submission (double-tap) → `Idempotency-Key` replays original response.
- Idempotency key reuse with different body → 409 conflict.
- Unknown fields → rejected (`forbidNonWhitelisted`).
- Version deprecation → `Deprecation`/`Sunset` headers.

### 24.9 Database

- Deadlock (1213) → detect + bounded retry with backoff.
- Transaction rollback → atomic; no partial financial state.
- Duplicate record → unique constraints (`email/tenant`, `providerPaymentId`, `WebhookEvent`, idempotency).
- Foreign-key failure → `Restrict` on financial/audit links prevents orphaning; clear error.
- Connection pool exhaustion → pool limits + queue + timeout; readiness fails → shed load.
- Migration failure → blue/green + backward-compatible migrations + pre-migrate backup + rollback.

### 24.10 Mobile

- Offline mode → cached browse + queued drafts; submit on reconnect with fresh credit check.
- Interrupted upload → resumable protocol.
- Resume upload → `GET /uploads/{id}` returns received parts.
- Slow network → chunked uploads, timeouts, optimistic UI, retry.
- App backgrounded/killed during generation → server is source of truth; reconcile on resume; push on completion.
- Push token rotation → re-register token; stale tokens pruned on send failure.
- OS permission denied (camera/push) → graceful fallback + guidance.

### 24.11 Config & Platform

- Bad config value → type/range validation rejects before save.
- Config store unreachable → serve last-known-good cache + alert.
- Maintenance mode → writes gated with banner; reads/status where possible.
- Feature flag mid-session change → clients re-fetch `/config/public` (ETag); server enforces regardless.
- Secret rotation → new key via config; old sessions/keys revoked; zero downtime.

### 24.12 Concurrency & Jobs

- Job redelivery → idempotent handlers + state check.
- Worker crash mid-job → re-queue; no double effect.
- Stuck/hung job → reaper re-queues or fails+releases.
- DLQ growth → alert + admin retry.
- Provider breaker open → new jobs queue/backoff; users see "high demand".

---

## 25. Future Roadmap

### 25.1 Themes

```mermaid
timeline
    title BrandPilot Evolution
    Post-GA (Q1) : Multi-language (i18n/RTL) : Subscription plans alongside credits : Notification preferences depth
    Growth (Q2) : Multi-provider AI routing & failover : Advanced analytics & cohort/retention : Referral & promo engine
    Enterprise (Q3) : Hard tenant isolation (schema/DB-per-tenant) : SSO/SAML/SCIM : Audit export & compliance packs
    Platform (Q4) : Plugin architecture (custom providers/frames) : Frame marketplace : Freeform editor : Multi-region/data residency
```

### 25.2 Detail

**Multi-language & localization** — the config-driven notification templates and client string tables are already i18n-ready; roadmap adds full locale packs, RTL layouts, and per-tenant default locale.

**Subscriptions** — in addition to prepaid credits, recurring plans (Razorpay Subscriptions) granting monthly credit allotments and premium-frame entitlement; the ledger model already supports periodic `CREDIT` grants and expiry.

**AI provider abstraction → multi-provider routing** — the `ImageProvider`/`VideoProvider` interfaces (ADR-05) enable cost/quality/latency-based routing and automatic failover across providers, plus adding new providers (e.g., alternative image/video models) as drop-in adapters.

**Multi-tenant hardening** — offer enterprise tenants schema-per-tenant or DB-per-tenant behind the existing `tenantId` abstraction (no app rewrite because scoping is centralized), plus SSO (SAML/OIDC), SCIM provisioning, and per-tenant data residency.

**Plugin architecture** — a marketplace of installable capabilities (custom providers, frame packs, post-processors), sandboxed and permissioned, mirroring the platform's own extensibility model.

**Frame marketplace & freeform editor** — third-party designers publish/sell frames; a richer canvas editor beyond templates.

**Advanced analytics & growth** — cohort/retention, funnel analysis, referral and promo engines, and finance-grade reconciliation/export.

---

## Appendix A — Glossary

**Tenant** — an isolated organization/account boundary; every row is scoped to one. **Credit** — the internal unit of AI usage; integer. **Hold** — reserved credits for an in-flight generation, later settled or released. **Ledger** — append-only record of all credit movements; source of truth. **Lot (CreditLot)** — a batch of credits with a source and optional expiry, consumed FIFO. **Frame** — a template with typed placeholders. **Placeholder** — a typed, validated input slot in a frame. **FrameVersion** — an immutable published snapshot of a frame. **Generation** — a request to produce an asset. **AiAsset** — the stored output + full metadata. **Idempotency key** — client token ensuring an operation runs at most once. **Outbox** — durable table of pending outbound side effects. **Circuit breaker** — a guard that stops calling a failing provider temporarily. **RPO/RTO** — max acceptable data loss / recovery time.

## Appendix B — Environment Variables (bootstrap only)

Only topology/secrets needed to boot live here; everything else is in the runtime config store.

```
NODE_ENV=production
APP_BASE_URL=https://api.brandpilot.app
DATABASE_URL=mysql://user:pass@hostinger-host:3306/brandpilot
REDIS_URL=redis://redis:6379
MASTER_ENCRYPTION_KEY=<32-byte base64>        # decrypts config secrets
JWT_PRIVATE_KEY / JWT_PUBLIC_KEY=<RS256 PEM>   # rotated
COOKIE_SECRET=<random>
STORAGE_ENDPOINT / STORAGE_KEY / STORAGE_SECRET / STORAGE_BUCKET   # Hostinger storage
# NOTE: provider (OpenAI/Runway/Razorpay) keys are NOT here in prod — they live encrypted in the config store.
```

## Appendix C — Configuration Key Registry (representative)

| Namespace | Key | Type | Example | Notes |
|---|---|---|---|---|
| billing | `plans` | json | [{amount,credits,bonus,expiryDays}] | Recharge plans (also normalized in DB) |
| billing | `currency` | string | INR | |
| billing | `creditExpiryDefaultDays` | int | 365 | |
| billing | `lowBalanceThreshold` | int | 20 | Triggers notification |
| ai | `image.defaultProvider` | string | openai | |
| ai | `image.cost` | json | {"openai":{"gpt-image-1":{"1024x1024":10}}} | Cost matrix (credits) |
| ai | `video.defaultProvider` | string | runway | |
| ai | `video.cost` | json | {"runway":{"gen-x":{"perSec":8}}} | |
| ai | `<provider>.apiKey` | secret | *** | Encrypted; per-tenant override allowed |
| ai | `<provider>.timeoutMs` | int | 60000 | |
| ai | `<provider>.retries` | int | 3 | |
| ai | `<provider>.queueSize` | int | 500 | |
| ai | `<provider>.maxConcurrent` | int | 10 | |
| ai | `moderation.enabled` | bool | true | |
| storage | `paths` | json | {users,frames,generated,thumbnails} | |
| storage | `maxUploadBytes` | int | 10485760 | |
| storage | `allowedMime` | json | ["image/png","image/jpeg"] | |
| storage | `tenantQuotaBytes` | int | 53687091200 | Per-tenant, override per tenant |
| limits | `gen.perUser.daily` | int | 100 | |
| limits | `gen.perUser.concurrent` | int | 3 | |
| limits | `gen.perTenant.monthly` | int | 100000 | |
| limits | `rate.api.perMin` | int | 120 | |
| auth | `access.ttlSec` | int | 900 | |
| auth | `refresh.ttlDays` | int | 30 | |
| auth | `password.minLen` | int | 10 | |
| auth | `lockout.maxAttempts` | int | 5 | |
| flags | `maintenanceMode` | bool | false | |
| flags | `videoEnabled` | bool | true | Feature toggle |
| flags | `offlineDrafts` | bool | true | |
| branding | `appName` | string | BrandPilot | Per-tenant |
| branding | `logoUrl` | string | ... | Per-tenant |
| branding | `theme` | json | {primary,secondary,mode} | Per-tenant |
| notifications | `templates` | json | {event:{channel:{locale:{...}}}} | Editable |

> This registry is representative, not exhaustive. The governing rule stands: **no business constant is hardcoded** — if it affects behavior, pricing, limits, branding, or providers, it lives here and is admin-editable with versioning and rollback.

---

---
---

## 26. Subscription & Premium Frame Access

> **Added in v1.1.** Subscriptions are now an **in-scope v1 feature**, not a roadmap item. A user can buy a recurring plan (e.g., a **1-month subscription**) that unlocks access to **premium frames**. This section supersedes the "Subscriptions" bullet in §25 (which is now delivered, not future). Credits and subscriptions coexist: **credits meter AI generation cost; a subscription gates entitlement to premium frames.** A premium frame therefore requires *both* an active subscription (to use it at all) *and* enough credits (to pay for the generation), unless configured otherwise.

### 26.1 Concept & Rules

- A **subscription plan** is a recurring product (billing period: `MONTHLY` for the one-month plan; `QUARTERLY`/`YEARLY` supported by the same model) that grants one or more **entitlements** — primarily `premium_frames` access, and optionally bonus monthly credits.
- **Entitlement to premium frames** = the user has a subscription in status `ACTIVE` (or `IN_GRACE`) whose plan grants `premium_frames` and whose period has not ended.
- **Free frames** are always usable with credits and no subscription.
- **Premium frames** (`Frame.tier = PREMIUM`) require an active premium entitlement at generation time; without it → `403 SUBSCRIPTION_REQUIRED` with an upsell payload.
- Everything is **configurable** (plans, price, period, entitlements, grace period, optional monthly credit grant, whether premium frames also cost credits) — nothing hardcoded (§15).

### 26.2 Data Model Additions (Prisma)

New models added to the schema in §5.3; premium gating reuses the existing `Frame.tier` field.

```prisma
model SubscriptionPlan {
  id            String @id @default(cuid()) @db.Char(26)
  tenantId      String @db.Char(26)
  name          String                       // "Premium Monthly"
  amountMinor   Int                          // price in paise
  currency      String @default("INR")
  period        SubPeriod @default(MONTHLY)  // MONTHLY / QUARTERLY / YEARLY
  entitlements  Json                         // ["premium_frames", ...]
  monthlyCredits Int    @default(0)          // optional credits granted each cycle
  trialDays     Int?                         // optional free trial
  graceDays     Int    @default(3)           // access retained after failed renewal
  razorpayPlanId String?                     // provider plan id
  isActive      Boolean @default(true)
  displayOrder  Int     @default(0)
  createdAt     DateTime @default(now())
  deletedAt     DateTime?

  subscriptions Subscription[]

  @@index([tenantId, isActive, displayOrder])
}

enum SubPeriod { MONTHLY QUARTERLY YEARLY }

model Subscription {
  id                   String @id @default(cuid()) @db.Char(26)
  tenantId             String @db.Char(26)
  userId               String @db.Char(26)
  planId               String @db.Char(26)
  status               SubStatus @default(PENDING)
  currentPeriodStart   DateTime?
  currentPeriodEnd     DateTime?             // entitlement valid until this (+ grace)
  cancelAtPeriodEnd    Boolean @default(false)
  provider             String  @default("razorpay")
  providerSubId        String? @unique       // razorpay subscription id
  lastPaymentId        String? @db.Char(26)
  createdAt            DateTime @default(now())
  updatedAt           DateTime @updatedAt

  plan   SubscriptionPlan @relation(fields: [planId], references: [id])
  events SubscriptionEvent[]

  @@unique([tenantId, userId, status])        // at most one active/pending per user (partial-enforced in app)
  @@index([tenantId, userId, status])
  @@index([status, currentPeriodEnd])         // renewal/expiry sweeps
}

enum SubStatus { PENDING ACTIVE IN_GRACE PAST_DUE CANCELLED EXPIRED }

model SubscriptionEvent {
  id             String @id @default(cuid()) @db.Char(26)
  subscriptionId String @db.Char(26)
  tenantId       String @db.Char(26)
  type           String                       // "activated","renewed","payment_failed","cancelled","expired"
  detail         Json?
  createdAt      DateTime @default(now())
  subscription Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  @@index([subscriptionId, createdAt])
}
```

### 26.3 Purchase & Lifecycle Flow

Recurring billing uses **Razorpay Subscriptions** (subscription-level webhooks), reusing the same idempotent, webhook-authoritative pattern as one-time recharges (§8.3): entitlement is only granted/renewed inside a signature-verified, deduped webhook transaction.

```mermaid
stateDiagram-v2
    [*] --> PENDING: subscribe (create razorpay subscription)
    PENDING --> ACTIVE: charged.authenticated / activated (webhook)
    ACTIVE --> ACTIVE: renewal charged (period extended)
    ACTIVE --> PAST_DUE: renewal payment failed
    PAST_DUE --> IN_GRACE: within graceDays (access retained)
    IN_GRACE --> ACTIVE: retry succeeds
    IN_GRACE --> EXPIRED: grace elapsed (access revoked)
    ACTIVE --> CANCELLED: user cancels (cancelAtPeriodEnd)
    CANCELLED --> EXPIRED: period ends
```

```mermaid
sequenceDiagram
    participant C as Client
    participant API
    participant RZP as Razorpay
    participant DB
    C->>API: POST /subscriptions {planId} (Idempotency-Key)
    API->>RZP: subscriptions.create(planId)
    RZP-->>API: providerSubId + short_url/checkout
    API->>DB: Subscription(status=PENDING, providerSubId)
    API-->>C: {subscriptionId, checkout}
    C->>RZP: authorize (mandate/first charge)
    RZP->>API: webhook subscription.activated / charged (verified, deduped)
    API->>DB: TX: status=ACTIVE, set period start/end, grant monthlyCredits (if any), log event
    API->>API: enqueue notification SUBSCRIPTION_ACTIVATED
    Note over RZP,API: each cycle: subscription.charged -> extend period; payment.failed -> PAST_DUE/IN_GRACE
```

### 26.4 Entitlement Check (premium frame gating)

A single `EntitlementService.hasPremiumAccess(userId)` is the authority, consulted at both **preview** and **generation** for any `PREMIUM` frame (and reflected in the catalogue so the UI can badge/lock premium frames and show an upsell):

```mermaid
graph LR
    G[POST /generations on PREMIUM frame] --> E{active premium entitlement?}
    E -->|ACTIVE or IN_GRACE and not expired| CR{enough credits?}
    E -->|no| U[403 SUBSCRIPTION_REQUIRED + upsell]
    CR -->|yes| OK[proceed: hold credits, enqueue]
    CR -->|no| P402[402 WALLET_INSUFFICIENT_CREDITS]
```

The check reads the user's current subscription (cached in Redis with a short TTL, invalidated on any subscription webhook/status change) so it adds no meaningful latency to the generation path.

### 26.5 API Additions

| Method | Path | Purpose | AuthZ |
|---|---|---|---|
| GET | `/subscription-plans` | List active subscription plans (price, period, entitlements) | user |
| GET | `/me/subscription` | Current subscription + status + period end | user |
| POST | `/subscriptions` | Start/subscribe (Idempotency-Key) → Razorpay checkout | user |
| POST | `/subscriptions/cancel` | Cancel at period end (or immediate, config) | user |
| POST | `/subscriptions/resume` | Undo a scheduled cancel before period end | user |
| POST | `/webhooks/razorpay` | (extended) also handles `subscription.*` events | public+HMAC |
| GET/POST | `/admin/subscription-plans` | Admin CRUD of plans + entitlements (versioned, audited) | `subscription.manage` |
| GET | `/admin/subscriptions` | Inspect/search subscriptions, manual grant/revoke | `subscription.manage` |

`GET /config/public` and `GET /frames` responses gain an `isLocked`/`requiresSubscription` flag per premium frame so clients can render the lock/upsell without extra calls. Admin analytics (§12.3, §19) add subscription MRR, active subscribers, churn, and trial conversion.

### 26.6 Config Keys (added to Appendix C)

| Namespace | Key | Type | Example | Notes |
|---|---|---|---|---|
| billing | `subscription.plans` | json | [{name,amountMinor,period,entitlements,monthlyCredits,trialDays,graceDays}] | Also normalized in `SubscriptionPlan` |
| billing | `subscription.graceDaysDefault` | int | 3 | Access retained after failed renewal |
| billing | `subscription.premiumAlsoCostsCredits` | bool | true | If false, premium frames are free-to-generate for subscribers |
| flags | `subscriptionsEnabled` | bool | true | Master feature toggle |

### 26.7 Edge Cases (added to §24)

- **Renewal payment fails** → `PAST_DUE` → `IN_GRACE` for `graceDays` (access retained), retries via Razorpay dunning; on success → `ACTIVE`, on grace elapse → `EXPIRED` (premium access revoked, premium frames re-lock).
- **User cancels mid-period** → `cancelAtPeriodEnd=true`; access continues until `currentPeriodEnd`, then `EXPIRED`. Resume allowed before period end.
- **Duplicate subscribe / webhook replay** → unique `providerSubId` + `WebhookEvent` dedupe; entitlement granted once (idempotent, §8.3).
- **Subscription active but out of credits** on a premium frame → allowed to select, but generation returns `402` until recharged (unless `premiumAlsoCostsCredits=false`).
- **Premium frame used, then subscription expires mid-generation** → entitlement is checked at request time and the job already holds credits; the in-flight job completes. New requests after expiry are blocked.
- **Downgrade/expiry with saved projects on premium frames** → projects are preserved; re-running one re-checks entitlement at run time.
- **Plan changed by admin** (price/entitlements) → existing subscriptions keep their purchased terms until renewal; changes are versioned/audited; new subscribers get new terms.
- **Refund/chargeback on a subscription charge** → revoke or shorten entitlement per policy, ledger/adjustment as in §8, finance alert.
- **Trial abuse** (repeat trials) → one trial per user (and optionally per payment instrument) enforced; tracked and audited.
- **Timezone/expiry boundary** → all periods computed in UTC; the expiry sweep (`Subscription(status,currentPeriodEnd)` index) runs frequently enough to revoke promptly.

### 26.8 Scheduler Additions (§14.3)

A **subscription lifecycle sweep** (every 15 min, config) transitions `IN_GRACE → EXPIRED` when grace elapses, grants each cycle's `monthlyCredits` on renewal, invalidates the entitlement cache, and emits renewal/expiry notifications (`SUBSCRIPTION_RENEWED`, `SUBSCRIPTION_EXPIRING`, `SUBSCRIPTION_EXPIRED`).

---

*End of IMPLEMENTATION_PLAN.md — v1.1. Adds §26 Subscription & Premium Frame Access as an in-scope v1 feature. Code development begins against this blueprint on approval, following the phase plan in §1.8 / §21.6 (subscriptions slot into P1 alongside the wallet, with premium gating enforced once the frame engine lands in P2).*
