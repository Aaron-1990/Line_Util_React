# Line Optimizer: Desktop to Enterprise Roadmap

## MVP-E (Minimum Viable Enterprise)

**Document Version:** 1.0
**Created:** 2026-01-25
**Author:** Aaron Zapata
**Status:** Planning

---

## Executive Summary

This document outlines the transformation of Line Optimizer from a single-user Electron desktop application to an enterprise-ready web platform capable of serving Tier 1 automotive suppliers globally.

### The Business Case

| Metric | Current (Excel) | Line Optimizer | Value |
|--------|-----------------|----------------|-------|
| Scenario calculation time | 2-3 weeks | 17 milliseconds | **100x faster** |
| Scenarios per month | 1-2 (capacity limited) | Unlimited | **Enables real planning** |
| Error rate | High (manual) | Zero (algorithmic) | **Data integrity** |
| Knowledge dependency | Individual IE | Codified logic | **Organizational resilience** |

### Market Validation

- Surveyed 20-30 global IEs (Poland, China, USA, Mexico, Europe)
- **Zero existing tools** identified - everyone uses Excel
- Problem exists at every Tier 1 automotive supplier globally

---

## Current State (v0.4.1)

### Architecture

```
┌─────────────────────────────────────┐
│ Electron Desktop App (Single User)  │
│ ├── React 18 Frontend               │
│ ├── SQLite (local file database)    │
│ ├── Zustand (state management)      │
│ ├── ReactFlow (canvas visualization)│
│ └── Python 3 (optimizer subprocess) │
└─────────────────────────────────────┘
```

### Capabilities

- Multi-sheet Excel import (Lines, Models, Compatibilities, Volumes)
- Interactive canvas visualization of production lines
- Python-based optimization algorithm (~17ms execution)
- Results panel with utilization by area, line, and model
- Per-area sequential processing (SMT → ICT → Conformal → Router → Final Assembly)

### Limitations for Enterprise

| Limitation | Business Impact |
|------------|-----------------|
| Single user | No collaboration between IEs |
| Local database | No data sharing across plants |
| No authentication | Cannot meet IT security requirements |
| No audit trail | Fails compliance audits |
| Desktop deployment | IT cannot manage/update centrally |
| No API | Cannot integrate with ERP/MES |

---

## Target State: MVP-E

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     LOAD BALANCER (AWS ALB / Azure AG)          │
├─────────────────────────────────────────────────────────────────┤
│  WEB TIER                          │  API TIER                  │
│  ├── React SPA (CDN hosted)        │  ├── Node.js REST API      │
│  └── SSO Login (Azure AD/Okta)     │  ├── Auth middleware       │
│                                     │  └── Rate limiting         │
├─────────────────────────────────────────────────────────────────┤
│  COMPUTE TIER                       │  DATA TIER                 │
│  ├── Python Optimizer (serverless)  │  ├── PostgreSQL (managed)  │
│  ├── Job queue (async operations)   │  ├── Redis (session cache) │
│  └── Background workers             │  └── Blob storage (exports)│
├─────────────────────────────────────────────────────────────────┤
│  OBSERVABILITY                      │  SECURITY                  │
│  ├── Application monitoring         │  ├── WAF (Web App Firewall)│
│  ├── Alerting                       │  ├── VPC isolation         │
│  └── Audit log storage              │  └── Encryption (TLS/AES)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Must-Have Features (Gate to Enterprise Sales)

Without these, IT and Procurement will reject the tool regardless of functionality.

### 1. Authentication & Access Control

| Feature | Priority | Description |
|---------|----------|-------------|
| SSO Integration | P0 | SAML 2.0 / OAuth 2.0 (Azure AD, Okta) |
| Role-Based Access Control | P0 | Granular permissions by role |
| Active Directory Sync | P0 | Automatic user provisioning |
| Session Management | P0 | Timeout, concurrent session limits |
| Multi-Factor Authentication | P1 | Required for cloud deployments |

**Role Definitions:**

```
Roles:
├── Admin (plant-level)
│   ├── Manage users and permissions
│   ├── Configure lines and areas
│   └── Full data access
│
├── Engineer
│   ├── Create/edit scenarios
│   ├── Run optimizations
│   ├── Export results
│   └── Cannot manage users
│
├── Planner
│   ├── View all results
│   ├── Compare scenarios
│   └── Read-only line configuration
│
└── Viewer
    ├── Dashboard access only
    └── No raw data export
```

### 2. Audit Trail & Compliance

| Feature | Priority | Description |
|---------|----------|-------------|
| Immutable Audit Log | P0 | WHO changed WHAT, WHEN |
| Data Change History | P0 | Track all modifications |
| Export Audit Reports | P0 | External auditor access |
| Retention Policies | P1 | 7-year retention (automotive standard) |

**Audit Log Schema:**

```sql
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL,
    user_id         UUID NOT NULL,
    user_email      VARCHAR(255) NOT NULL,
    action          VARCHAR(50) NOT NULL,  -- CREATE, UPDATE, DELETE, EXPORT, LOGIN, OPTIMIZE
    entity_type     VARCHAR(50) NOT NULL,  -- line, model, scenario, result
    entity_id       UUID,
    old_value       JSONB,
    new_value       JSONB,
    ip_address      INET,
    plant_id        UUID NOT NULL,

    INDEX idx_audit_timestamp (timestamp),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_entity (entity_type, entity_id)
);
```

### 3. Multi-Tenant / Multi-Plant Architecture

| Feature | Priority | Description |
|---------|----------|-------------|
| Plant-Level Data Isolation | P0 | Strict data boundaries |
| Cross-Plant Visibility | P1 | Authorized aggregated views |
| Plant-Specific Config | P0 | Shifts, holidays, targets |
| Global Master Data | P1 | Shared model/customer definitions |

**Data Hierarchy:**

```
Enterprise (e.g., BorgWarner Global)
├── Region (Americas)
│   ├── Plant (Ramos Arizpe, Mexico)
│   │   ├── Area (SMT)
│   │   │   └── Lines, Models, Scenarios
│   │   ├── Area (ICT)
│   │   └── Area (Final Assembly)
│   │
│   └── Plant (Seneca, USA)
│       └── ...
│
├── Region (EMEA)
│   └── Plant (Rzeszów, Poland)
│       └── ...
│
└── Region (APAC)
    └── Plant (Suzhou, China)
        └── ...
```

### 4. Data Backup & Recovery

| Feature | Priority | Specification |
|---------|----------|---------------|
| Automated Backups | P0 | Daily minimum, hourly for critical data |
| Point-in-Time Recovery | P0 | Restore to any point in last 30 days |
| Disaster Recovery | P0 | RPO < 1 hour, RTO < 4 hours |
| Export/Import | P1 | Migration between environments |

---

## Technical Migration Path

### Database: SQLite → PostgreSQL

| Aspect | SQLite (Current) | PostgreSQL (Target) |
|--------|------------------|---------------------|
| Concurrency | Single writer | Thousands concurrent |
| Size limit | ~100GB practical | Terabytes |
| Backup | Manual file copy | Automated snapshots |
| Replication | None | Read replicas available |
| Geo-distribution | No | Multi-region capable |

**Migration Strategy:**

1. Abstract database access behind repository pattern
2. Add PostgreSQL driver alongside SQLite
3. Create schema migration scripts
4. Build data migration tooling
5. Parallel run period for validation
6. Cutover with rollback capability

### API Design

**Core Endpoints:**

```yaml
# Authentication
POST   /api/v1/auth/login          # SSO callback
POST   /api/v1/auth/logout
GET    /api/v1/auth/me             # Current user info

# Plants & Configuration
GET    /api/v1/plants              # List authorized plants
GET    /api/v1/plants/{id}
GET    /api/v1/plants/{id}/lines
GET    /api/v1/plants/{id}/models
POST   /api/v1/plants/{id}/lines
PUT    /api/v1/plants/{id}/lines/{lineId}

# Scenarios
GET    /api/v1/plants/{id}/scenarios
POST   /api/v1/plants/{id}/scenarios
GET    /api/v1/scenarios/{id}
PUT    /api/v1/scenarios/{id}
DELETE /api/v1/scenarios/{id}
POST   /api/v1/scenarios/{id}/optimize    # Returns 202 Accepted
GET    /api/v1/scenarios/{id}/results

# Reporting
GET    /api/v1/plants/{id}/utilization
GET    /api/v1/plants/{id}/dashboard
GET    /api/v1/reports/export?format=pdf

# Audit
GET    /api/v1/audit/logs?plant={id}&from={date}&to={date}
```

**API Standards:**

- Authentication: OAuth 2.0 Bearer tokens
- Rate limiting: 1000 requests/hour per client
- Versioning: URL path (/api/v1/)
- Pagination: Cursor-based for large datasets
- Errors: RFC 7807 Problem Details format

### Deployment Options

| Option | Best For | Pros | Cons |
|--------|----------|------|------|
| **SaaS Multi-tenant** | SMB customers | Lower cost, quick start | Shared infrastructure |
| **Dedicated Cloud** | Enterprise | Isolation, compliance | Higher cost |
| **On-Premises** | Regulated industries | Full control | Customer manages infra |
| **Hybrid** | Migration period | Gradual transition | Complexity |

**Recommended Initial Offering:**
- Primary: Dedicated cloud (AWS or Azure) per customer
- Secondary: On-premises container deployment (Docker/K8s)
- Future: SaaS multi-tenant for smaller customers

---

## Compliance & Standards

### Automotive Industry Requirements

| Standard | Description | Relevance |
|----------|-------------|-----------|
| **IATF 16949** | Automotive quality management | Audit trail, document control |
| **TISAX** | Trusted Information Security Assessment | **Required for European OEMs** |
| **ISO 27001** | Information security management | Baseline IT approval |
| **SOC 2 Type II** | Service organization controls | Cloud provider requirement |

> **Critical:** German OEMs (Volkswagen, BMW, Mercedes) require TISAX certification for any supplier software handling production data. Budget 6+ months lead time.

### Data Privacy Regulations

| Regulation | Scope | Key Requirements |
|------------|-------|------------------|
| **GDPR** | EU operations | Data residency, right to deletion |
| **CCPA** | California | Disclosure, opt-out rights |
| **LFPDPPP** | Mexico | Consent, purpose limitation |

**Implementation Requirements:**
- Data residency options (EU data stays in EU)
- User data export/deletion capabilities
- Privacy policy and consent management
- Data Processing Agreements (DPA)

### IT Security Checklist

| Category | Requirements |
|----------|--------------|
| **Authentication** | SSO/SAML, MFA, session timeout |
| **Authorization** | RBAC, least privilege, separation of duties |
| **Encryption** | TLS 1.3 in transit, AES-256 at rest |
| **Network** | VPC isolation, private endpoints, WAF |
| **Logging** | Centralized logs, 1-year retention, tamper-proof |
| **Vulnerability** | Quarterly pen tests, SAST/DAST in CI/CD |
| **Incident Response** | Documented procedures, 72-hour notification SLA |
| **Business Continuity** | DR plan tested annually, RTO/RPO defined |

---

## Implementation Roadmap

### Phase 1: MVP-E Foundation (4-6 months)

**Goal:** Pass IT security review, enable pilot deployment

| Task | Duration | Dependencies |
|------|----------|--------------|
| PostgreSQL migration | 3 weeks | None |
| Repository pattern refactor | 2 weeks | None |
| REST API core endpoints | 4 weeks | PostgreSQL |
| SSO integration (Azure AD) | 3 weeks | API |
| RBAC implementation | 2 weeks | SSO |
| Audit logging system | 2 weeks | API |
| Web deployment (React SPA) | 2 weeks | API |
| Multi-plant data isolation | 2 weeks | PostgreSQL |
| Security documentation | 2 weeks | All above |
| Penetration testing | 2 weeks | All above |

**Deliverables:**
- [ ] Web application (no Electron dependency)
- [ ] SSO authentication (Azure AD)
- [ ] Three roles with appropriate permissions
- [ ] Complete audit trail
- [ ] Single-tenant cloud deployment
- [ ] API documentation
- [ ] Security architecture document

### Phase 2: Collaboration & Scenarios (3-4 months)

**Goal:** Enable team workflows, justify ROI vs Excel

| Task | Duration |
|------|----------|
| Scenario management (save/load/compare) | 4 weeks |
| Scenario versioning | 2 weeks |
| Comments and @mentions | 3 weeks |
| Email notifications | 2 weeks |
| Executive dashboard | 3 weeks |
| PDF/PowerPoint export | 2 weeks |

**Deliverables:**
- [ ] Named scenarios with metadata
- [ ] Side-by-side scenario comparison
- [ ] What-if analysis (clone + modify)
- [ ] Collaboration features
- [ ] Management-ready reports

### Phase 3: Integration & Scale (3-4 months)

**Goal:** Connect to enterprise systems, multi-plant rollout

| Task | Duration |
|------|----------|
| SAP integration (volume import) | 4 weeks |
| Power BI connector | 2 weeks |
| Webhook notifications | 2 weeks |
| Cross-plant reporting | 3 weeks |
| Performance optimization (100+ users) | 3 weeks |
| Load testing | 2 weeks |

**Deliverables:**
- [ ] ERP integration (SAP minimum)
- [ ] BI tool connectivity
- [ ] API webhooks for automation
- [ ] Regional rollup dashboards
- [ ] Proven scale to 100+ concurrent users

### Phase 4: Compliance & Global (3-4 months)

**Goal:** European market readiness, enterprise certifications

| Task | Duration |
|------|----------|
| EU data residency deployment | 3 weeks |
| TISAX assessment preparation | 6 weeks |
| GDPR compliance features | 3 weeks |
| On-premises deployment option | 4 weeks |
| Multi-language support | 3 weeks |

**Deliverables:**
- [ ] EU-hosted deployment option
- [ ] TISAX certification (or in progress)
- [ ] GDPR-compliant data handling
- [ ] Containerized on-prem deployment
- [ ] Spanish/English/German UI

---

## Pricing Model

### Proposed Tiers

| Tier | Target Customer | Features | Price |
|------|-----------------|----------|-------|
| **Starter** | Single plant, <20 users | Core optimization, basic reports | $1,500/month |
| **Professional** | Multi-plant, <100 users | Scenarios, collaboration, dashboards | $5,000/month |
| **Enterprise** | Global, unlimited users | SSO, integrations, SLA, on-prem | $15-50K/month |

### Enterprise Deal Structure

| Component | Range |
|-----------|-------|
| Annual subscription | $180K - $600K |
| Implementation services | $50K - $150K |
| Training | $10K - $25K |
| Custom development | T&M basis |

### ROI Justification

**Cost of Current State (per plant):**
- IE time: 40 hrs/month × $75/hr = $3,000/month
- Delayed decisions: Unquantified but significant
- Errors and rework: ~$5,000/month estimated
- **Total: ~$8,000+/month per plant**

**Cost of Line Optimizer:**
- Professional tier: $5,000/month (multi-plant)
- **ROI: Positive from month 1**

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SSO integration complexity | High | High | Start with Azure AD only |
| PostgreSQL migration bugs | Medium | High | Parallel run, extensive testing |
| Performance at scale | Medium | Medium | Load testing early, caching |
| API security vulnerabilities | Medium | High | Pen testing, security review |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Long sales cycles | High | Medium | Pilot programs, prove ROI first |
| IP ownership dispute | Medium | Critical | Legal review BEFORE investment |
| Feature creep | High | Medium | Strict MVP scope discipline |
| Big vendor copies solution | Medium | Medium | Move fast, build relationships |
| Support burden | Medium | Medium | Documentation, self-service |

### Compliance Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TISAX timeline | High | High | Engage consultants early |
| GDPR violation | Low | Critical | Privacy by design |
| Data breach | Low | Critical | Security-first architecture |

---

## Competitive Positioning

### Landscape

| Competitor | Strengths | Weaknesses |
|------------|-----------|------------|
| **Excel/Manual** | Free, familiar | No collaboration, error-prone, slow |
| **Siemens Opcenter** | Full MES suite | Expensive, complex, overkill |
| **Dassault DELMIA** | 3D simulation | Not focused on line utilization |
| **SAP IBP** | Enterprise scale | $500K+ implementation |
| **Custom solutions** | Tailored | Maintenance burden, no support |

### Our Positioning

> **"The fastest path from Excel to enterprise-grade line utilization optimization."**

**Key Differentiators:**
1. Purpose-built for line utilization (not generic)
2. 17ms optimization (vs hours/days)
3. Built by manufacturing IEs (domain expertise)
4. Affordable entry point (vs enterprise suite pricing)
5. Fast implementation (weeks, not months)

---

## Immediate Next Steps

### Week 1-2: Technical Validation

- [ ] Prototype PostgreSQL migration with sample data
- [ ] Test Azure AD SSO integration (dev environment)
- [ ] Benchmark API performance targets
- [ ] Evaluate cloud providers (AWS vs Azure)

### Week 1-2: Business Validation

- [ ] Review employment agreement (IP ownership)
- [ ] Interview 3-5 target customers (IT + IE stakeholders)
- [ ] Validate must-have feature list
- [ ] Understand procurement process and timelines

### Week 3: Decision Point

- [ ] Development cost estimate
- [ ] Go-to-market timeline
- [ ] Pricing validation
- [ ] Go/no-go decision on MVP-E investment

---

## Success Metrics

### MVP-E Launch Criteria

| Metric | Target |
|--------|--------|
| Pass IT security review | Yes |
| Concurrent users supported | 50+ |
| Optimization response time | <5 seconds |
| Uptime SLA | 99.5% |
| Audit log completeness | 100% of actions |

### 12-Month Goals

| Metric | Target |
|--------|--------|
| Pilot customers | 3-5 plants |
| Paying customers | 2+ enterprises |
| ARR | $200K+ |
| Customer satisfaction | >4.5/5 |

---

## Appendix A: Technology Stack Comparison

### Current Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | React 18, TypeScript | Keep |
| State | Zustand | Keep |
| Visualization | ReactFlow | Keep |
| Desktop | Electron 28 | Remove |
| Database | SQLite | Replace |
| Optimizer | Python 3 | Keep (containerize) |
| Build | Vite | Adapt for web |

### Target Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | React 18, TypeScript | Continuity |
| State | Zustand + React Query | Add server state |
| Auth | Auth0 or Azure AD B2C | Enterprise SSO |
| API | Node.js + Express/Fastify | Team familiarity |
| Database | PostgreSQL 15+ | Enterprise standard |
| Cache | Redis | Session, query cache |
| Queue | AWS SQS or Azure Service Bus | Async optimization |
| Optimizer | Python in Lambda/Container | Serverless scale |
| Hosting | AWS or Azure | Enterprise preference |
| CDN | CloudFront or Azure CDN | Global performance |
| Monitoring | DataDog or Azure Monitor | Observability |

---

## Appendix B: Database Schema Changes

### New Tables for Enterprise

```sql
-- Multi-tenancy
CREATE TABLE organizations (
    id              UUID PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE plants (
    id              UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    name            VARCHAR(255) NOT NULL,
    region          VARCHAR(100),
    timezone        VARCHAR(50),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Users and Permissions
CREATE TABLE users (
    id              UUID PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    name            VARCHAR(255),
    sso_provider_id VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    last_login      TIMESTAMPTZ
);

CREATE TABLE user_plant_roles (
    user_id         UUID REFERENCES users(id),
    plant_id        UUID REFERENCES plants(id),
    role            VARCHAR(50) NOT NULL,  -- admin, engineer, planner, viewer
    PRIMARY KEY (user_id, plant_id)
);

-- Scenarios
CREATE TABLE scenarios (
    id              UUID PRIMARY KEY,
    plant_id        UUID REFERENCES plants(id),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    status          VARCHAR(50) DEFAULT 'draft',  -- draft, submitted, approved, archived
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    approved_by     UUID REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    base_scenario_id UUID REFERENCES scenarios(id),
    parameters      JSONB
);

CREATE TABLE scenario_results (
    id              UUID PRIMARY KEY,
    scenario_id     UUID REFERENCES scenarios(id),
    area            VARCHAR(100),
    line_id         UUID,
    model_id        UUID,
    allocated_units INTEGER,
    utilization_pct DECIMAL(5,2),
    unfulfilled     INTEGER,
    computed_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Trail
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id         UUID REFERENCES users(id),
    user_email      VARCHAR(255) NOT NULL,
    action          VARCHAR(50) NOT NULL,
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       UUID,
    old_value       JSONB,
    new_value       JSONB,
    ip_address      INET,
    plant_id        UUID REFERENCES plants(id)
);

-- Indexes
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_plant ON audit_logs(plant_id, timestamp);
CREATE INDEX idx_scenarios_plant ON scenarios(plant_id, status);
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-25 | Aaron Zapata | Initial draft |

---

*This document is confidential and intended for internal planning purposes.*
