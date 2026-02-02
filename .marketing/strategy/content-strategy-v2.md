# Line Optimizer Content Strategy v2

**Version:** 2.0
**Created:** 2026-02-01
**Author:** Content Marketing Specialist Agent
**Status:** Updated with Deep Product Knowledge

---

## Executive Summary

This content strategy is built on a deep understanding of Line Optimizer v0.6.5, its technical capabilities, and its roadmap through Phase 11. Unlike generic manufacturing content, every piece recommended here ties directly to specific product features and the real workflows of Industrial Engineers.

**Core Thesis:** Line Optimizer is not "capacity planning software" - it is the tool Aaron Zapata wished existed during 13 years at BorgWarner. Every content piece should reflect that practitioner origin.

---

## Product-Specific Content Foundations

### What Makes Line Optimizer Different (Content DNA)

| Capability | Technical Reality | Content Angle |
|------------|-------------------|---------------|
| **17ms analysis** | Pure Python algorithm, no pandas overhead | Speed enables behavioral change in planning |
| **Per-area processing** | Each area processes FULL demand independently | Correct bottleneck identification |
| **Three-tier changeover** | Global > Family > Line resolution | SMED prioritization with minimal data entry |
| **DAG routing** | Parallel process flows with cycle detection | Models real manufacturing complexity |
| **Demand-weighted changeover** | Demand concentration adjusts changeover count | Statistically sound heuristic |
| **Multi-year volumes** | Year-over-year planning built-in | Strategic horizon, not tactical scheduling |
| **Desktop-first** | Electron + SQLite, no cloud dependency | IT-friendly, secure, offline-capable |

### What Line Optimizer Is NOT (Critical for Positioning)

Content must never confuse Line Optimizer with:
- **MES systems** (Plex, Siemens Opcenter) - No real-time monitoring
- **ERP modules** (SAP PP/DS) - No transaction processing
- **Shop floor scheduling** - No daily/hourly operator views
- **Line balancing tools** - Different problem (cycle time equalization vs. capacity allocation)

---

## Part 1: Content Pillars (Product-Aligned)

### Pillar 1: The Capacity Planning Gap

**Product Connection:** Line Optimizer fills the gap between free Excel and $200K enterprise platforms.

**Audience:** IE Managers facing budget constraints

**Content Focus:**
- The mid-market is underserved (market research data: $10K-$100K gap)
- Why SAP/Siemens overkill creates the Excel default
- TCO comparison: DIY vs. Line Optimizer vs. enterprise
- "Capacity planning for the 99%"

**Specific Product Hooks:**
- $6K-$15K/year pricing vs. $100K+ enterprise
- Days to deploy vs. 6-18 month implementations
- Excel import means no data migration project
- Desktop = no cloud infrastructure to approve

**Content Examples:**
1. "The $100K Question: Why Mid-Market Plants Use Excel"
2. "Build vs. Buy: The Real Cost of DIY Capacity Planning" (with Line Optimizer as reference)
3. "What to Do When SAP Says No (A Practical Guide)"

---

### Pillar 2: Changeover as Capacity Constraint

**Product Connection:** Line Optimizer's Phase 5 changeover matrix is a genuine differentiator - few tools model changeover with this depth.

**Audience:** Industrial Engineers, CI Managers, SMED practitioners

**Content Focus:**
- Changeover is "hidden" capacity loss (5-15% typically)
- The three-tier resolution approach (enter 50 values, not 2,025)
- Demand concentration matters for accurate changeover estimation
- Changeover as capacity constraint, not just informational metric

**Specific Product Hooks:**
- Proprietary probability-weighted algorithm (more accurate than simple averages)
- Three calculation methods: Probability-Weighted, Simple Average, Worst Case
- Changeover toggle controls (global + per-line)
- Stacked bar visualization (production | changeover | available)

**Content Examples:**
1. "The Hidden 10%: How Changeover Eats Your Capacity"
2. "Three-Tier Changeover Modeling: Enter 50 Values, Cover 2,000 Combinations"
3. "Why Your Changeover Estimate Is Wrong (And How to Fix It)"
4. "The Statistics Behind Smart Changeover Estimation"

**Technical Blog (for Engineering Audience):**
```markdown
Title: "The Probability-Weighted Changeover Algorithm Explained"

Content outline:
1. The problem with simple averages
2. Demand proportions and transition probability
3. Why demand concentration matters
4. Effective model count concept
5. Practical bounds (lot size constraint, daily limit)
6. Worked example with real numbers

This is the kind of content IEs will bookmark and share.
```

---

### Pillar 3: DAG-Based Process Flows

**Product Connection:** Phase 6.5+ introduced DAG (Directed Acyclic Graph) routing, enabling parallel process flows.

**Audience:** Industrial Engineers, Simulation Analysts

**Content Focus:**
- Sequential vs. parallel manufacturing processes
- Why simple linear routing fails for real plants
- Graph theory for manufacturing (accessible explanation)
- Foundation for simulation export (Phase 11 roadmap)

**Specific Product Hooks:**
- `finish_to_start` dependency semantics
- Cycle detection using Kahn's algorithm
- Orphan detection (unreachable areas)
- Predecessor selection UI with real-time validation
- Expected yield and volume fraction fields (for future simulation)

**Content Examples:**
1. "Beyond Linear Routing: Modeling Parallel Processes in Manufacturing"
2. "What Graph Theory Taught Me About Production Flows"
3. "The SMT-ICT-Assembly Problem: When Products Split and Merge"
4. "Preparing Your Capacity Model for Simulation (A Foundation Guide)"

**Visual Content Opportunity:**
```
   SMT (start)
     |
     v
   /-----\
  ICT    Conformal  (parallel - both follow SMT)
   \-----/
     |
     v
 Assembly (end)
```

This visual is immediately recognizable to anyone in electronics manufacturing.

---

### Pillar 4: Multi-Year Strategic Planning

**Product Connection:** Line Optimizer's data model includes multi-year volumes and year navigation.

**Audience:** Plant Managers, Corporate Planning, VP Operations

**Content Focus:**
- Why annual planning is insufficient for automotive programs (5-7 year lifecycle)
- Volume ramps, program overlaps, and strategic horizons
- Investment justification with multi-year visibility
- Scenario analysis for program awards

**Specific Product Hooks:**
- `product_volumes` table with year dimension
- Year Navigator on canvas (`[<] 2025 [>]`)
- Scenario management (Phase 8 roadmap: project files + scenarios)
- Multi-year timeline visualization

**Content Examples:**
1. "The 5-Year Capacity Plan: Why Annual Planning Falls Short"
2. "Program Lifecycle Planning for Automotive Suppliers"
3. "Investment Justification: Using Multi-Year Capacity Data"
4. "What-If Analysis for Program Awards (Coming Soon)"

---

### Pillar 5: Founder Credibility (Aaron Zapata's Story)

**Product Connection:** Aaron's 13 years at BorgWarner as Supervisor of Industrial Engineering is the ultimate proof of practitioner origin.

**Audience:** All personas (trust-building)

**Content Focus:**
- The weekend that sparked Line Optimizer (origin story)
- "I built the tool I wished existed"
- 13 years of capacity planning pain, distilled into software
- Why an IE built this, not a software company

**Specific Authenticity Hooks:**
- BorgWarner tenure and title
- Real manufacturing context (automotive Tier 1)
- The transition from Excel to algorithm
- Survey of 20-30 global IEs confirming universal pain

**Content Examples:**
1. "Why I Built Line Optimizer (After 13 Years of Spreadsheets)"
2. "The Email That Changed Everything: How a Volume Request Became a Product"
3. "What 50 Plant Visits Taught Me About Capacity Planning"
4. LinkedIn series: "Manufacturing Confessions" (weekly authentic posts)

---

## Part 2: Content by Funnel Stage (Product-Specific)

### Awareness Stage

**Objective:** Attract IEs who don't know solutions exist

| Content Type | Topic | Product Hook |
|--------------|-------|--------------|
| Blog | "5 Signs Your Capacity Planning Process Is Broken" | Each sign maps to a Line Optimizer capability |
| LinkedIn | "The capacity plan that was obsolete by February" | Real story, relatable pain |
| Blog | "Why Every Tier 1 Automotive Supplier Uses Excel" | Market context, competitor framing |
| Infographic | "The True Cost of Manual Capacity Planning" | $62K/year IE time calculation |

### Consideration Stage

**Objective:** Educate on approaches, introduce Line Optimizer

| Content Type | Topic | Product Hook |
|--------------|-------|--------------|
| Whitepaper | "The Modern Capacity Planning Stack" | Position Line Optimizer in ecosystem |
| Webinar | "Changeover Modeling: From Matrix to Analysis" | Live demo of three-tier resolution |
| Blog | "Per-Area Processing: Why It Matters" | Technical explanation with Line Optimizer screenshots |
| Case Study | "From 4 Hours to 4 Minutes" | Time savings quantification |

### Decision Stage

**Objective:** Drive demo requests and trials

| Content Type | Topic | Product Hook |
|--------------|-------|--------------|
| ROI Calculator | Interactive tool | Based on actual formula: IE hours x rate x weeks |
| Comparison Guide | "Line Optimizer vs. Excel vs. SAP" | Feature matrix with honest positioning |
| Demo Video | "17-Millisecond Analysis Walkthrough" | Show the speed, explain the algorithm |
| FAQ | "Technical Questions Answered" | IPC security, SQLite, Python bridge |

---

## Part 3: Blog Post Deep Dives (10 Detailed Outlines)

### Blog 1: The Hidden Cost of Per-Area Ignorance

**Keyword:** "manufacturing capacity planning by area"
**Persona:** Industrial Engineer
**Word Count:** 1,500

**Product Hook:** Per-area processing is a CRITICAL feature - most spreadsheets get this wrong.

**Outline:**
```
HOOK
Your spreadsheet treats production lines as alternatives. The optimizer
picks the fastest one and leaves others at 0%. That is fundamentally wrong.

SECTION 1: The Sequential Reality
- Products flow through ALL areas (SMT -> ICT -> Conformal -> Assembly)
- Each area must process the FULL demand
- Your SMT line utilization has nothing to do with your ICT utilization

SECTION 2: The Spreadsheet Trap
- Typical setup: One column per line, allocate to "best" option
- Result: Fastest line at 100%, others at 0%
- Real-world: ALL lines running, different utilization per area

SECTION 3: The Per-Area Solution
- Group lines by area
- Each area starts with FULL demand
- Allocate within area, then move to next area
- Constraint could be in any area (not always Final Assembly)

SECTION 4: Data Modeling Implications
[CRITICAL CONTENT FROM CLAUDE.md]
WRONG: Area = SUBASSEMBLY, Lines = HVDC, HVAC, GDB, FSW
RIGHT: Area = SUB-HVDC (with HVDC 1, HVDC 2)
       Area = SUB-HVAC (with HVAC 1, HVAC 2)

SECTION 5: How Line Optimizer Handles This
- Automatic area grouping from data
- Per-area demand tracking
- Independent utilization per area
- System constraint identification

CTA: Download the Per-Area Capacity Planning Checklist
```

---

### Blog 2: Changeover Estimation Without Guessing

**Keyword:** "changeover time estimation manufacturing"
**Persona:** Industrial Engineer, CI Manager
**Word Count:** 1,800

**Product Hook:** The proprietary algorithm is academically grounded and practically superior.

**Outline:**
```
HOOK
"Estimate changeovers per day: N-1 where N is the number of models."
That heuristic is wrong, and here's why.

SECTION 1: The Naive Heuristic
- Common approach: num_models - 1
- Problem: Ignores demand concentration
- A line with 1 dominant model (80%) changes less than balanced mix

SECTION 2: Why Demand Concentration Matters
- Not all models are equal in the schedule
- High-volume models dominate the sequence
- Simple averages treat rare and frequent models the same (wrong)

SECTION 3: Effective Model Count
- Concept: How many "equal-sized" models does your mix behave like?
- Concentrated demand = fewer effective models
- Balanced demand = many effective models

SECTION 4: Practical Examples
| Scenario | Effective Models | Changeovers |
| Balanced (5x20%) | 5.0 | 4.0 |
| Dominated (70/10/10/5/5) | ~2 | 1.0 |
| High-mix (10x10%) | 10.0 | 9.0 |

SECTION 5: Bounds and Constraints
- Cannot exceed actual models - 1
- Lot size constraint (1 hour minimum)
- Practical daily limit (12 changeovers max)

SECTION 6: Implementation in Line Optimizer
- Automatic calculation from demand mix
- Three methods: Probability-Weighted, Simple Average, Worst Case
- Changeover as capacity constraint (not just informational)

CTA: Try the Changeover Impact Calculator
```

---

### Blog 3: Why 17 Milliseconds Changes Everything

**Keyword:** "fast capacity planning software"
**Persona:** All personas
**Word Count:** 1,200

**Product Hook:** The speed is not just convenience - it enables behavioral change.

**Outline:**
```
HOOK
The first time I saw the optimizer run in 17 milliseconds, I thought
it was broken. My spreadsheet took 4 hours for the same analysis.

SECTION 1: The Speed Reality
- 17ms execution time (measured)
- Pure Python algorithm without pandas overhead
- No Excel I/O bottleneck
- Run in a meeting, not overnight

SECTION 2: Why Speed Matters (Beyond Convenience)
- Scenario analysis becomes trivial
- "What if" questions answered in real-time
- More scenarios = better decisions
- Planning frequency can increase (monthly vs. annual)

SECTION 3: The Behavior Change
- Old: Plan is a project (40+ hours)
- New: Plan is a conversation ("click... here is the answer")
- Old: 2-3 scenarios per year
- New: Unlimited scenarios

SECTION 4: Technical Foundation
- SQLite for data (fast reads)
- Python for optimization (efficient algorithm)
- IPC bridge (Electron main process)
- No network latency

SECTION 5: What This Enables
- Live capacity analysis in customer meetings
- Immediate response to "can we take this business?"
- Continuous planning vs. annual planning

CTA: See the 17ms analysis in action
```

---

### Blog 4: The Three-Tier Changeover Matrix

**Keyword:** "changeover matrix manufacturing"
**Persona:** Industrial Engineer
**Word Count:** 1,600

**Product Hook:** The three-tier system is the key to practical data entry.

**Outline:**
```
HOOK
A line with 20 models has 400 changeover combinations. Nobody is
entering 400 values. Here is how to cover them all with 50 entries.

SECTION 1: The Scale Problem
- N x N matrix = N^2 cells
- 20 models = 400 cells
- 45 models = 2,025 cells
- Diagonal is always 0 (same model)

SECTION 2: Three-Tier Resolution
Tier 1 - Global Default (30 minutes)
- Fallback when nothing else matches
- 1 value covers everything

Tier 2 - Family Defaults
- Family-to-family baseline
- 5 families = 25 values covers 95%
- Leverages product family grouping

Tier 3 - Line Overrides (Sparse)
- Only for exceptions
- 20-50 values typically
- Specific model pairs on specific lines

SECTION 3: Resolution Logic (Pseudocode)
[USE EXACT PSEUDOCODE FROM phase-5-changeover-matrix.md]

SECTION 4: Excel Import Support
- "Changeover" sheet detection
- From Family, To Family, Changeover (min) columns
- Validation: valid families, reasonable values

SECTION 5: SMED Prioritization
- Export high-impact transitions
- Weighted contribution = P[i] x P[j] x Time[i,j]
- Focus improvement where it matters

CTA: Download the Changeover Matrix Template
```

---

### Blog 5: Constraint Identification Done Right

**Keyword:** "manufacturing constraint identification"
**Persona:** Industrial Engineer, Plant Manager
**Word Count:** 1,500

**Product Hook:** Line Optimizer automatically identifies system constraints with clear reasoning.

**Outline:**
```
HOOK
Your Plant Manager asks: "What is our bottleneck?" You open a
spreadsheet. 45 minutes later, you have an answer. Maybe.

SECTION 1: The Constraint Question
- Eli Goldratt's Theory of Constraints (brief)
- System output = constraint output
- Improving non-constraints is waste

SECTION 2: Two Types of Constraints
1. Unfulfilled Demand
   - Area cannot meet required volume
   - TRUE constraint

2. Highest Utilization
   - All demand met, but one area is closest to limit
   - POTENTIAL constraint

SECTION 3: Automatic Detection Logic
[FROM optimizer CHANGELOG]
IF any area has unfulfilled demand:
   Constraint = Area with highest unfulfilled
ELSE:
   Constraint = Area with highest utilization

SECTION 4: Output Structure
systemConstraint: {
  area: "Final Assembly",
  reason: "unfulfilled_demand",
  utilizationPercent: 100.0,
  unfulfilledUnitsDaily: 275.73
}

SECTION 5: Pareto Analysis
- Unfulfilled demand by model by area
- Focus on highest-impact gaps
- Constraint drill-down in UI

CTA: Try the Constraint Analysis Demo
```

---

### Blog 6: From Spreadsheets to Software: Migration Guide

**Keyword:** "capacity planning software migration"
**Persona:** IE Manager, IT Director
**Word Count:** 1,800

**Product Hook:** Excel import means transition is measured in hours, not months.

**Outline:**
```
HOOK
"We have 13 years of data in Excel. Migration would take forever."
Actually, it takes about 2 hours.

SECTION 1: The Migration Fear
- Data is the moat
- Years of accumulated work
- "Cannot throw that away"

SECTION 2: What You Actually Have
- Lines: Name, area, time available
- Models: Name, customer, family
- Compatibilities: Line + Model + cycle time
- Volumes: Model + year + quantity

SECTION 3: The Excel Import Reality
- Multi-sheet import wizard
- Sheets: Lines, Models, Compatibilities, Areas, Changeover
- Validation before import
- Errors shown, fixable, re-importable

SECTION 4: Migration Steps
1. Export your spreadsheet to standard format (30 min)
2. Run Line Optimizer import wizard (5 min)
3. Review validation errors (15 min)
4. Fix and re-import (30 min)
5. Run first analysis (17 ms)
6. Compare results to spreadsheet (30 min)
7. Done

SECTION 5: What NOT to Migrate
- Macro logic (replaced by optimizer)
- Scenario tabs (replaced by scenario feature)
- Charts (replaced by visualizations)

CTA: Download the Migration Checklist
```

---

### Blog 7: The IE's Algorithm (Technical Deep Dive)

**Keyword:** "capacity planning algorithm"
**Persona:** Industrial Engineer (technical)
**Word Count:** 2,000

**Product Hook:** The core formula is simple, but the implementation details matter.

**Outline:**
```
HOOK
The capacity formula is simple: Time / Cycle Time = Units.
But if it were that simple, you would not need a tool.

SECTION 1: The Core Formula
adjusted_cycle_time = cycle_time / (efficiency / 100)
max_units = available_time / adjusted_cycle_time
allocated_units = min(max_units, daily_demand)

SECTION 2: The Efficiency Factor
- OEE vs. efficiency in this context
- Why we use efficiency directly
- Adjusted cycle time accounts for losses

SECTION 3: Time Constraint (Not Piece Count)
- The constraint is TIME
- Multiple models with different cycle times
- Same time, different piece counts
- This is counterintuitive but critical

SECTION 4: Priority Distribution
- Priority 1 models distributed to ALL compatible lines first
- Then Priority 2 gets remaining capacity
- Area-wide priority, not per-line

SECTION 5: Changeover as Capacity Constraint
Phase 1: Initial allocation (full available time)
Phase 2: Calculate changeover
Phase 3: If over capacity, scale down production
Phase 4: Track additional unfulfilled demand

SECTION 6: Output Structure
- Per-line results
- Per-area summaries
- System constraint identification
- Unfulfilled demand tracking

CTA: Read the Full Algorithm Documentation
```

---

### Blog 8: Scenario Planning for Program Awards

**Keyword:** "automotive program capacity planning"
**Persona:** Plant Manager, Corporate Planning
**Word Count:** 1,500

**Product Hook:** Phase 8 scenario management (roadmap content).

**Outline:**
```
HOOK
"Can we take the Ford F-150 program?" Your answer determines
$50M in revenue. How confident are you in your capacity plan?

SECTION 1: The Program Award Question
- OEM sends RFQ with volume projections
- You have 48 hours to respond
- Your capacity plan is 6 months old
- Do you have the capacity or not?

SECTION 2: Scenario-Based Approach
- Base Case: Current forecast
- Win Scenario: Add program volumes
- Loss Scenario: Competitor takes share
- Compare and decide

SECTION 3: What Line Optimizer Enables
- Create scenario in seconds
- Modify volumes
- Run analysis (17ms)
- Compare side-by-side

SECTION 4: The Comparison View (Coming Soon)
[WIREFRAME FROM phase-8-project-management.md]
Metric | Base Case | Ford Win | Delta
Volume | 1,250,000 | 1,750,000 | +500,000
Utilization | 72.3% | 94.1% | +21.8%
Unfulfilled | 0 | 125,000 | +125,000

SECTION 5: Investment Decision Support
- If scenario shows constraint, what are options?
- Add line (lead time: 18 months)
- Add shift (faster but more cost)
- Outsource (strategic implications)

CTA: Join the Scenario Management Beta
```

---

### Blog 9: Desktop-First Architecture (For IT)

**Keyword:** "manufacturing software security"
**Persona:** IT Director
**Word Count:** 1,200

**Product Hook:** Desktop deployment addresses common IT objections.

**Outline:**
```
HOOK
"We need IT approval before deploying cloud software."
"This is a desktop app. No cloud infrastructure required."

SECTION 1: The IT Approval Challenge
- Cloud means security review
- Data residency questions
- Integration complexity
- 6-month approval cycles

SECTION 2: Desktop Architecture
- Electron 28 (Chromium + Node.js)
- SQLite (local database)
- Python (local optimization)
- No cloud dependency

SECTION 3: Security Model
- IPC handlers for all database access
- No direct renderer-to-database
- Soft deletes (audit trail)
- Local file storage (user controls data)

SECTION 4: Deployment Reality
- Single installer (macOS, Windows)
- No server infrastructure
- No cloud accounts
- Works offline

SECTION 5: Future Considerations
- Project files (.lineopt) are portable SQLite
- Can be shared via SharePoint, Teams, email
- No cloud sync required (but possible in future)

CTA: Download the IT Security FAQ
```

---

### Blog 10: Simulation Export: Bridging Planning and Simulation

**Keyword:** "manufacturing simulation data"
**Persona:** Simulation Analyst, Industrial Engineer
**Word Count:** 1,500

**Product Hook:** Phase 11 simulation export (roadmap content).

**Outline:**
```
HOOK
You built a capacity plan. Now you need a simulation model.
Do you really have to draw it all again in Visio?

SECTION 1: The Single Source of Truth Problem
- Capacity planning models process flows
- Simulation models process flows
- Why are these separate systems?

SECTION 2: What Line Optimizer Already Knows
- Process sequence (DAG routing)
- Cycle times (per model per area)
- Changeover times (matrix)
- Yield expectations

SECTION 3: What Simulation Needs (Additional)
- Distribution parameters (mean, std dev)
- MTBF/MTTR for reliability
- Resource requirements
- Buffer capacities
- Shift patterns

SECTION 4: Export Formats (Roadmap)
1. JSON (universal, API-friendly)
2. BPMN 2.0 (Simio, Camunda)
3. Visio (ProModel Process Simulator)
4. Arena (future)

SECTION 5: Business Value
- 60% time savings on simulation setup
- $1,350-$6,000 saved per study
- Single source of truth maintained

CTA: Sign Up for Simulation Export Preview
```

---

## Part 4: LinkedIn Content Strategy

### Posting Cadence

| Day | Content Type | Theme |
|-----|--------------|-------|
| Monday | Industry Insight | Manufacturing trends, IE challenges |
| Wednesday | Founder Story | Aaron's journey, authentic experiences |
| Friday | Educational | Quick tips, benchmarks, formulas |

### LinkedIn Post Templates

**Type 1: The Contrarian Insight**
```
Everyone says: [common belief]

Here is what actually happens:
[counterintuitive reality]

After 13 years in automotive manufacturing, I learned:
[insight]

The difference is [key distinction].

What has your experience been?
```

**Type 2: The Formula Post**
```
The capacity planning formula everyone uses:
[simple formula]

The formula that actually works:
[better formula]

Why the difference matters:
[1-2 sentence explanation]

Save this for the next time someone asks "why is our capacity plan wrong?"
```

**Type 3: The Behind-the-Scenes**
```
[Screenshot of code/UI/feature]

Just shipped: [feature name]

What it does: [one sentence]
Why it matters: [one sentence]
What's next: [one sentence]

Building in public because IEs deserve transparency.
```

### Sample LinkedIn Posts (Ready to Use)

**Post 1: Per-Area Processing**
```
The capacity planning mistake I see everywhere:

Treating production lines as alternatives.

Here is what happens:
- Model A can run on Line 1 or Line 2
- You allocate to the fastest line
- Line 1 shows 100%, Line 2 shows 0%

But wait - both lines are running.
Both are making the same products.
Both have utilization.

The problem: You are ignoring that products
flow through MULTIPLE areas.

SMT is not the same analysis as Final Assembly.
Each area has its own constraint.

When I fixed this in my optimizer, everything changed.

What capacity planning assumptions have you
had to unlearn?
```

**Post 2: Changeover Reality**
```
The changeover estimate that everyone uses:
(Number of models - 1) changeovers per day

The problem: It ignores demand concentration.

A line running 80% of one model does not
change over 10 times just because it has
11 models available.

The insight: Not all models are equal in
your production schedule.

Example:
- 5 models at 20% each: ~4 changeovers/day
- 5 models at 70/10/10/5/5: ~1 changeover/day

Same number of models. Very different
changeover reality.

This is why simple averages fail.

What is the changeover reality at your plant?
```

**Post 3: Origin Story Teaser**
```
The email that started everything:

"Aaron, can we handle 500K more units next year?"

It was 4pm on a Friday.
My capacity spreadsheet had 47 tabs.
The answer would take until Monday.

That weekend, I started building something different.

Not a spreadsheet with better formulas.
An algorithm that could answer in 17 milliseconds.

13 years at BorgWarner taught me the problem.
It took leaving to build the solution.

Line Optimizer exists because I got tired of
weekends lost to Excel.

What is the email that changed YOUR career direction?
```

---

## Part 5: Case Study Framework (Product-Specific)

### Metrics to Capture (Based on Line Optimizer Capabilities)

| Category | Before Metric | After Metric |
|----------|---------------|--------------|
| **Time** | Hours per capacity plan | Minutes per plan |
| **Scenarios** | Scenarios per year | Scenarios per month |
| **Speed** | Hours per scenario | Seconds per scenario |
| **Changeover** | Ignored or manual | Automated, three-tier |
| **Constraint ID** | Manual search | Automatic detection |
| **Multi-Year** | Separate spreadsheets | Integrated view |

### Case Study Angles by Persona

**For Industrial Engineers:**
- Time savings quantified
- Formula accuracy improvement
- Scenario analysis capability
- Changeover modeling depth

**For Plant Managers:**
- Decision confidence improvement
- Response time to business questions
- Investment justification support
- Risk visibility

**For Corporate Planning:**
- Multi-plant visibility
- Standardized methodology
- New business feasibility speed
- Scenario comparison capability

### Interview Questions (Product-Specific)

1. "Walk me through how you did capacity planning before Line Optimizer."
2. "What was the trigger that made you look for something different?"
3. "How long did your first capacity analysis take in Line Optimizer?"
4. "How has changeover modeling changed your capacity estimates?"
5. "Describe a scenario analysis you would not have done before."
6. "What was the business impact of faster constraint identification?"
7. "How has multi-year visibility changed your planning process?"

---

## Part 6: SEO Keyword Strategy (Product-Aligned)

### Primary Keywords

| Keyword | Search Intent | Line Optimizer Feature |
|---------|---------------|------------------------|
| capacity planning software | Commercial | Core product |
| manufacturing capacity calculation | Informational | Per-area processing |
| changeover time calculation | Informational | Three-tier matrix |
| production constraint analysis | Informational | System constraint detection |
| capacity utilization formula | Informational | Core algorithm |
| automotive capacity planning | Commercial | Industry focus |

### Long-Tail Keywords (Higher Intent)

| Keyword | Content Type |
|---------|--------------|
| "capacity planning for automotive tier 1" | Whitepaper |
| "changeover matrix template manufacturing" | Blog + download |
| "per area capacity planning" | Technical blog |
| "multi-year capacity planning automotive" | Blog |
| "capacity planning without SAP" | Comparison blog |
| "Excel alternative for capacity planning" | Landing page |

### Content Cluster Strategy

**Pillar Page:** "The Complete Guide to Manufacturing Capacity Planning"
- Link to: Algorithm blog, Changeover blog, Per-Area blog
- Link from: All supporting posts
- CTA: Demo request

**Supporting Clusters:**
1. Changeover (3-5 posts, lead magnet)
2. Constraint Analysis (2-3 posts)
3. Multi-Year Planning (2-3 posts)
4. Migration/Adoption (2-3 posts)

---

## Part 7: Content Calendar (4 Weeks)

### Week 1: Problem Awareness

| Day | Platform | Content | Product Hook |
|-----|----------|---------|--------------|
| Mon | LinkedIn | "The spreadsheet that was obsolete by February" | Speed advantage |
| Tue | Blog | "The Hidden Cost of Spreadsheet-Based Capacity Planning" | Time savings |
| Wed | LinkedIn | "5 signs your capacity plan is broken" (carousel) | Feature overview |
| Thu | Email | Newsletter: Featured blog + changeover teaser | Nurture sequence |
| Fri | LinkedIn | Poll: "How long does capacity planning take?" | Engagement |

### Week 2: Technical Education

| Day | Platform | Content | Product Hook |
|-----|----------|---------|--------------|
| Mon | LinkedIn | "The changeover estimate everyone gets wrong" | Proprietary algorithm |
| Tue | Blog | "Changeover Time: The Silent Capacity Killer" | Three-tier matrix |
| Wed | LinkedIn | Document: "Per-Area Processing Explained" | Algorithm |
| Thu | Email | Newsletter: Changeover deep dive | Feature education |
| Fri | LinkedIn | Behind-the-scenes: New feature screenshot | Transparency |

### Week 3: Credibility and Proof

| Day | Platform | Content | Product Hook |
|-----|----------|---------|--------------|
| Mon | LinkedIn | "What 13 years at BorgWarner taught me" | Founder story |
| Tue | Blog | Case study or "From 4 Hours to 4 Minutes" story | Time savings |
| Wed | LinkedIn | Carousel: "Capacity Planning Benchmarks" | Industry data |
| Thu | Email | Newsletter: Case study + ROI calculator | Decision support |
| Fri | LinkedIn | "The question that changed how I think" | Thought leadership |

### Week 4: Call to Action

| Day | Platform | Content | Product Hook |
|-----|----------|---------|--------------|
| Mon | LinkedIn | "What I learned showing 50 IEs my tool" | User feedback |
| Tue | Blog | "Is Your Plant Ready for Modern Capacity Planning?" | Self-assessment |
| Wed | LinkedIn | "Line Optimizer vs. alternatives" (comparison) | Competitive positioning |
| Thu | Email | Newsletter: Demo invitation + testimonial | Conversion |
| Fri | LinkedIn | "One question for your planning process" | Engagement |

---

## Part 8: Lead Magnets and Gated Content

### Lead Magnet 1: Changeover Impact Calculator

**Format:** Interactive spreadsheet or web calculator
**Fields:**
- Number of models
- Demand distribution (balanced vs. concentrated)
- Changeover time estimates
- Available time per day

**Output:**
- Estimated changeover impact (%)
- Effective model count
- Time lost per day
- Annual capacity impact

**CTA:** "See how Line Optimizer automates this calculation"

---

### Lead Magnet 2: Capacity Planning Maturity Assessment

**Format:** 10-question quiz
**Questions:**
1. How often do you update your capacity plan?
2. How long does a single scenario take?
3. Do you model changeover impact?
4. Can you identify your system constraint quickly?
5. Do you have multi-year visibility?
... etc.

**Output:**
- Maturity level (1-5)
- Gap analysis
- Recommended improvements
- Comparison to benchmarks

**CTA:** "See how Line Optimizer helps advance your maturity"

---

### Lead Magnet 3: Per-Area Capacity Planning Checklist

**Format:** PDF checklist
**Content:**
- Data requirements per area
- Line grouping guidelines
- Common mistakes to avoid
- Validation steps
- Formula reference

**CTA:** "This is exactly what Line Optimizer does automatically"

---

## Part 9: Metrics and Measurement

### Content KPIs

| Metric | Month 1 Target | Month 3 Target | Month 6 Target |
|--------|----------------|----------------|----------------|
| Blog posts published | 4 | 12 | 24 |
| LinkedIn posts | 12 | 36 | 72 |
| Email subscribers | 100 | 300 | 750 |
| Content downloads | 50 | 150 | 400 |
| Demo requests (content-attributed) | 5 | 15 | 40 |
| Organic traffic | Baseline | +50% | +150% |

### Attribution Model

**First Touch:** What content brought them in?
- Track via UTM parameters
- Credit awareness content

**Last Touch:** What content preceded demo request?
- Track conversion page referrer
- Credit decision content

**Engagement Score:** What content did they consume?
- Content downloads logged
- Blog views tracked (if cookied)
- Email engagement tracked

---

## Part 10: Competitive Content Positioning

### Against Excel

**Message:** "You are not replacing Excel, you are eliminating 20 hours per week."

**Content Approach:**
- Lead with time savings
- Show side-by-side demo
- Emphasize Excel import (no data loss)
- Position as evolution, not replacement

### Against SAP/Siemens

**Message:** "Why wait 18 months when you need answers this quarter?"

**Content Approach:**
- Lead with speed to value
- TCO comparison
- "80% of the value at 10% of the cost"
- Complement, not compete (different use case)

### Against Do Nothing

**Message:** "The cost of one bad capacity decision exceeds 10 years of Line Optimizer."

**Content Approach:**
- Quantify bad decision costs
- Industry examples
- Risk framing
- ROI that pays for itself in month 1

---

## Appendix A: Technical Content Reference

### Formulas to Include in Content

**Core Capacity Formula:**
```python
adjusted_cycle_time = cycle_time / (efficiency / 100)
max_units = available_time / adjusted_cycle_time
allocated_units = min(max_units, daily_demand)
```

**Changeover Estimation:**
- Line Optimizer uses a proprietary probability-weighted algorithm
- Accounts for demand concentration (not simple averages)
- Calculates effective model count based on demand mix
- Bounds changeovers by practical constraints (lot size, daily limits)

### Visuals to Create

1. **Per-Area Flow Diagram**
   - SMT -> ICT -> Conformal -> Assembly
   - Each area with utilization bar

2. **Three-Tier Resolution Pyramid**
   - Line Override (top, highest priority)
   - Family Default (middle)
   - Global Default (bottom, fallback)

3. **Stacked Bar Visualization**
   - Production (blue) | Changeover (amber) | Available (gray)

4. **DAG Routing Example**
   - Parallel paths from SMT
   - Convergence at Assembly

---

## Appendix B: Content Tone Guidelines

### Do

- Use industry terminology (IEs know OEE, takt time, changeover)
- Include specific numbers ("17ms" not "very fast")
- Acknowledge manufacturing complexity
- Share genuine insights from practitioner experience
- Write in active voice

### Do Not

- Use corporate buzzwords ("leverage," "synergy")
- Oversimplify for technical audience
- Make unsubstantiated claims
- Sound like generic software marketing
- Add unnecessary filler

### Voice Examples

**Too Corporate:**
"Leveraging our innovative capacity optimization platform enables manufacturing excellence through synergistic digital transformation."

**Just Right:**
"Line Optimizer calculates capacity scenarios in 17 milliseconds. That speed changes how you approach planning - instead of running three scenarios per year, you can run three per meeting."

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-01 | Content Marketing Specialist | Initial strategy |
| 2.0 | 2026-02-01 | Content Marketing Specialist | Deep product integration based on CLAUDE.md, Phase 5, Phase 6.5+, Phase 8, Phase 11 documentation |

---

**Next Steps:**
1. Review with Aaron Zapata for founder voice accuracy
2. Prioritize first 4 blog posts for publication
3. Set up LinkedIn posting schedule
4. Create lead magnet #1 (Changeover Calculator)
5. Build content calendar in project management tool

---

*This strategy is designed to be executed iteratively. Start with highest-impact content (technical blogs that showcase product depth) and expand as resources allow. Every piece should demonstrate that Line Optimizer was built by someone who lived the problem.*
