# Line Optimizer - Investor Pitch Deck v2

> **Format:** Slide content for PowerPoint/Keynote
> **Based on:** Deep analysis of CLAUDE.md and phase specifications
> **Product Version:** 0.6.5 (DAG-Based Routing)

---

## SLIDE 1: Title

**LINE OPTIMIZER**

*Strategic Capacity Planning for Manufacturing*
*Built by an IE, for IEs*

Aaron Zapata
Founder & CEO
13 Years at BorgWarner

February 2026

---

## SLIDE 2: The Problem

### Every Manufacturing Plant Has This Problem

**Industrial Engineers spend 20+ hours/week in Excel doing capacity planning**

The result:
- Answers take **days**, not minutes
- **Changeover time** is ignored or guessed
- Only **one person** understands the spreadsheet
- When they leave, the plant scrambles

> "By the time we have an answer, the decision has already been made on gut feel."

**60%+ of mid-market manufacturers still use Excel for capacity planning.**

---

## SLIDE 3: The Cost of Status Quo

### Quantified Pain

| Impact | Annual Cost |
|--------|-------------|
| IE labor (20 hrs/week × $50/hr × 50 weeks) | $50,000 |
| Wrong capacity commitments (expedited freight) | $50-200K |
| Lost bids (couldn't quote fast enough) | $100K-1M+ |
| Wrong capital investments | $500K-5M |

**A single bad capacity decision can cost more than years of software.**

---

## SLIDE 4: The Solution

### Line Optimizer - Capacity Answers in Minutes, Not Days

| Capability | Technical Implementation |
|------------|-------------------------|
| **17ms execution** | Pure Python optimizer (not 17 seconds—17 milliseconds) |
| **Changeover as constraint** | Probability-weighted formula reduces available capacity |
| **Three-tier changeover** | Global → Family → Line resolution |
| **DAG-based routing** | Parallel process flows (validated: covers 90%+ of real flows) |
| **Multi-year navigation** | See when constraints emerge across 4+ year horizon |

**Desktop application - data never leaves the plant.**

---

## SLIDE 5: The Technical Moat

### Not Just Another Planning Tool

**1. Proprietary Probability-Weighted Changeover Algorithm**
- Weights changeover probability by actual demand mix
- Simple averages get this wrong
- An 80/10/10 demand split ≠ 33/33/33

**2. Changeover as Capacity Constraint**
- Most tools show changeover as a metric
- Line Optimizer **reduces available capacity**
- "You're not at 85% utilization—you're at 108% with changeover"

**3. DAG-Based Routing**
```
SMT → [ICT || Conformal] → Assembly
```
- Parallel process flows, not just linear sequences
- Uses Kahn's algorithm for topological sort

---

## SLIDE 6: Demo - The Magic Moments

### What Wins Deals

**Moment 1: Speed**
> "Watch this... [clicks Run Analysis]... That was 17 milliseconds."

**Moment 2: Changeover Toggle**
> "This line looks healthy at 85%. Now watch when I turn on changeover... 108%."

**Moment 3: Constraint Detection**
> "It's not just saying 'over capacity'—it's telling you this is a dedicated line bottleneck vs. shared capacity constraint."

**Moment 4: Year Navigation**
> "Click 2026... fine. Click 2028... there's your constraint."

---

## SLIDE 7: Market Opportunity

### $2.4B TAM with a Strategic White Space

```
ENTERPRISE ($100K+)              THE GAP ($10-50K)           DIY ($0)
────────────────────             ─────────────────           ────────────
SAP, Siemens, Kinaxis            LINE OPTIMIZER              Excel
12-18 month implementation       Days to value               Infinite maintenance
Requires consultants             Self-service                Key-person risk
```

| Metric | Value |
|--------|-------|
| **TAM** | $2.4B (global capacity planning) |
| **SAM** | $173M (mid-market discrete manufacturing) |
| **SOM (5-Year)** | $864K ARR (conservative bootstrap) |
| **Bottom-Up** | 1,230 target companies = $10.8M addressable |

**Primary competitor is Excel, not enterprise software.**

---

## SLIDE 8: Beachhead Market

### Mexico/US Border Automotive Tier 1

| Criterion | Target | Rationale |
|-----------|--------|-----------|
| Industry | Automotive Tier 1 | Clear capacity pain |
| Size | $100M-$5B revenue | Fast decisions, real pain |
| Geography | Mexico/US border | Nearshoring boom (30%+ growth) |
| Current Tool | Excel | Our true competitor |
| Decision Maker | Plant Manager | $15-50K authority |

**Why now:** Mexico manufacturing growing 30%+. New plants need capacity planning from scratch.

**Founder advantage:** 13 years at BorgWarner, deep network in this ecosystem.

---

## SLIDE 9: Business Model

### SaaS Pricing (Annual)

| Tier | Scope | Price | Per-Line |
|------|-------|-------|----------|
| Starter | Up to 10 lines | $15,000 | $1,500 |
| Professional | Up to 25 lines | $30,000 | $1,200 |
| Enterprise | Up to 50 lines | $50,000 | $1,000 |

**Unit Economics Target:**
- Gross margin: 85%+
- CAC: <$10K
- LTV:CAC: >5:1
- Payback: <6 months

**Pilot:** $5,000 for 60 days (100% credited to purchase)

---

## SLIDE 10: Go-to-Market

### Land & Expand in Automotive

```
LAND: Single plant, one area (Final Assembly)
      ↓ Prove value in 60 days
EXPAND: Additional areas within plant
      ↓ Show network potential
EXPAND: Additional plants
      ↓ Enterprise agreement
EXPAND: Corporate standardization + Phase 11 simulation export
```

**Sales motion:**
1. IE finds us (LinkedIn, referral, search)
2. Technical demo → validation
3. 60-day paid pilot ($5K)
4. Pilot success → full license
5. Expand to additional plants

---

## SLIDE 11: Traction & Credibility

### Validation

**Product:** v0.6.5 complete with:
- [x] Multi-sheet Excel import
- [x] Three-tier changeover matrix
- [x] Changeover as capacity constraint
- [x] DAG-based routing
- [x] Multi-year analysis
- [x] Constraint drill-down

**Algorithm:** Validated by IE Agent: "Theoretical soundness - Excellent"

**Founder:**
- 13 years at BorgWarner
- Supervisor, Industrial Engineering
- Built the tool he wished existed

---

## SLIDE 12: Roadmap

### Strategic Feature Sequence

| Phase | Feature | Business Value |
|-------|---------|----------------|
| **Current** | Core capacity planning | Product-market fit |
| **Phase 8** | Scenario Management | "Compare Base Case vs Ford Win" - killer demo |
| **Phase 9** | Reports & Export | Executive PDF, SMED priority report |
| **Phase 11** | Simulation Export | BPMN/Visio for ProModel/Arena - partnership opportunity |

**Phase 8 is the priority** - scenario comparison is #1 customer request.

---

## SLIDE 13: The Ask

### Seed Round: $[X]

**Use of Funds:**

| Category | Allocation |
|----------|------------|
| Sales & Marketing | 50% |
| Product Development (Phase 8, 11) | 30% |
| Operations | 20% |

**18-Month Milestones:**
- 50 paying customers
- $500K ARR
- 3 enterprise accounts
- Phase 8 + Phase 11 shipped
- Series A ready

---

## SLIDE 14: Why Now, Why Us

### The Timing is Right

1. **Nearshoring boom** - Mexico manufacturing +30%, new plants need tools
2. **Post-COVID awareness** - Capacity planning is now boardroom topic
3. **AI hype backlash** - "Proven IE algorithms, not AI theater"
4. **Skill gap** - Retiring IEs, need to codify expertise

### Why Aaron

- **13 years living this problem** at BorgWarner
- **Built for himself first** - not a software company learning manufacturing
- **Deep network** in target market
- **Technical + domain expertise** - rare combination

---

## SLIDE 15: Summary

### Investment Thesis

| Factor | Evidence |
|--------|----------|
| **Real Problem** | 60%+ use Excel, 20+ hrs/week wasted |
| **Technical Moat** | Proprietary changeover algorithm, DAG routing, 17ms execution |
| **Right Founder** | 13 years at BorgWarner, domain expert |
| **Right Market** | $2.4B TAM, white space in mid-market |
| **Right Timing** | Nearshoring, supply chain awareness |

**Contact:**
Aaron Zapata
aaron@lineoptimizer.com
[Phone]

---

## APPENDIX

### A1: Technical Architecture

```
Electron 28 + React 18 + TypeScript
├── SQLite (local database - data stays on machine)
├── Python optimizer (17ms, pure Python)
├── ReactFlow (canvas visualization)
└── No cloud dependency
```

### A2: Competitive Detail

| Capability | Excel | Line Optimizer | Siemens | SAP |
|------------|-------|----------------|---------|-----|
| Changeover modeling | Manual | Probability-weighted | Add-on | Add-on |
| Implementation | N/A | Days | 6-12 mo | 12-18 mo |
| Cost (Year 1) | "Free" | $15-50K | $200K+ | $300K+ |
| Parallel routing | No | DAG | Complex | Complex |
| Data location | Local | Local | Cloud/On-prem | Cloud |

### A3: Phase 8 - The Killer Feature

**Scenario Management** enables:
- Save/Open `.lineopt` project files
- Multiple scenarios per project
- Side-by-side comparison
- "Base Case vs Ford Win vs Add Line 5"

**ROI from spec:** "10-20 hours saved per capacity study"

### A4: Phase 11 - Partnership Opportunity

**Simulation Export** enables:
- Export DAG routing to JSON/BPMN/Visio
- Pre-populate ProModel/Arena models
- "60% reduction in simulation setup time"

**Strategic value:** No other capacity tool does this. Partnership opportunity with simulation vendors.
