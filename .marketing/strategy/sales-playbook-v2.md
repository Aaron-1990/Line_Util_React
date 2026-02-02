# Line Optimizer Sales Playbook v2

**Version:** 2.0
**Last Updated:** 2026-02-01
**Author:** B2B Sales Strategist Agent
**Product Version:** 0.6.5 (DAG-Based Routing)

---

## Table of Contents

1. [Product Deep Dive](#product-deep-dive)
2. [Ideal Customer Profile](#ideal-customer-profile)
3. [Buyer Personas & Buying Committee](#buyer-personas--buying-committee)
4. [MEDDIC Qualification Framework](#meddic-qualification-framework)
5. [Discovery Questions](#discovery-questions)
6. [Demo Script](#demo-script)
7. [Technical Differentiation](#technical-differentiation)
8. [Objection Handling](#objection-handling)
9. [Competitive Positioning](#competitive-positioning)
10. [Pilot Program Structure](#pilot-program-structure)
11. [Pricing Strategy](#pricing-strategy)
12. [Deal Stages & Actions](#deal-stages--actions)
13. [Sales Collateral Checklist](#sales-collateral-checklist)

---

## Product Deep Dive

### What Line Optimizer Actually Does

Line Optimizer is a **strategic capacity planning tool** that helps manufacturing engineers answer the question: **"Can we meet demand with our current lines, and if not, where is the constraint?"**

**Core Workflow:**
```
1. Import plant data (lines, models, volumes, compatibilities) via Excel
2. Visualize production lines on an interactive canvas
3. Run optimization algorithm (17ms execution)
4. See utilization results by area, line, and model
5. Identify bottlenecks with constraint drill-down
6. Toggle changeover impact on/off for realistic vs. theoretical capacity
7. Navigate through multi-year forecasts to see when constraints emerge
8. (Future) Compare scenarios side-by-side
```

### Key Technical Capabilities

| Feature | What It Does | Business Value |
|---------|--------------|----------------|
| **17ms Execution** | Analysis completes instantly | No waiting, iterate quickly |
| **Multi-Sheet Excel Import** | Lines, Models, Volumes, Compatibilities, Changeover all in one file | Easy adoption, no re-entry |
| **Three-Tier Changeover Matrix** | Global > Family > Line resolution | Realistic capacity with minimal data entry |
| **Changeover Toggle Controls** | Global + per-line toggles | Compare theoretical vs. realistic capacity |
| **DAG-Based Routing** | Parallel process flows (SMT + ICT in parallel, then Assembly) | Models real manufacturing complexity |
| **Multi-Year Analysis** | Navigate 2024-2028 on canvas | See when constraints emerge |
| **Constraint Drill-Down** | Dedicated vs. shared line bottleneck detection | Know exactly what to fix |
| **Desktop Application** | Runs locally, no cloud | Data security, IT-friendly |

### What Line Optimizer is NOT

| Not This | Why |
|----------|-----|
| Real-time MES | This is for planning, not shop floor execution |
| Scheduling system | Yearly/monthly capacity, not daily sequencing |
| ERP replacement | Complements ERP/MES, not replaces |
| Simulation tool | Deterministic capacity math, not stochastic simulation |

### Target Audience (from CLAUDE.md)

**Primary Users:**
- Industrial Engineers (IEs) doing capacity planning
- Plant Managers making investment decisions
- Corporate/Regional teams doing multi-plant planning

**NOT for:**
- Shop floor operators
- Production supervisors (real-time)
- Quality engineers

---

## Ideal Customer Profile

### Company Profile

| Attribute | Ideal | Acceptable | Disqualify |
|-----------|-------|------------|------------|
| **Industry** | Automotive (OEM, Tier 1) | Discrete manufacturing | Process/continuous |
| **Size** | $100M-$5B revenue | $50M-$10B | <$50M (no capacity pain) |
| **Plants** | 1-5 plants in region | Up to 10 | 50+ (needs enterprise system) |
| **Production Type** | High-mix, multi-line | Mixed | Pure flow shop |
| **Current Tool** | Excel | Basic tools | Already using Siemens/SAP |
| **Geography** | North America, Mexico | Europe | Asia (support challenge) |

### Situational Triggers (When to Reach Out)

| Trigger | Signal | Opportunity |
|---------|--------|-------------|
| **New business award** | Press release, supplier award | "Can we fit 500K more units?" |
| **Capacity study RFP** | LinkedIn post, industry network | "We need to justify capex" |
| **Plant Manager change** | New leader announcement | Fresh eyes, new initiatives |
| **Volume ramp** | Customer program launch | "Our Excel can't keep up" |
| **Acquisition integration** | M&A activity | "We inherited 3 plants" |
| **SMED initiative** | Lean/CI announcements | Changeover matrix is perfect |

### Negative Indicators (Walk Away)

| Red Flag | Why |
|----------|-----|
| "We need real-time shop floor" | Wrong product |
| "Our IT requires cloud-only" | Desktop app won't work |
| "We have 200 plants globally" | Need enterprise solution |
| "Budget is <$5K" | Can't justify sales effort |
| "Decision in 6+ months" | Low urgency, deprioritize |

---

## Buyer Personas & Buying Committee

### Primary Persona: Industrial Engineer (Champion)

**Demographics:**
- Title: Industrial Engineer, Senior IE, Manufacturing Engineer
- Age: 28-45
- Education: Engineering degree (IE, ME, or equivalent)
- Reports to: Plant Manager or VP Manufacturing

**Pain Points:**
- "I spend 20+ hours/week in Excel doing capacity planning"
- "My plant manager asks questions I can't answer quickly"
- "When a new program comes in, I scramble to figure out if we can do it"
- "My Excel models are fragile and nobody else can use them"
- "I know changeover matters but I can't quantify it"

**Goals:**
- Look competent when answering capacity questions
- Reduce time spent on manual analysis
- Have defensible data for investment requests
- Get promoted to senior role or plant manager

**Objections:**
- "I've tried other tools before and they were too complex"
- "My data isn't clean enough"
- "What if my Excel models are actually fine?"

**Champion Indicators:**
- Asks detailed questions about the algorithm
- Wants to see how changeover works
- Shares current Excel templates
- Offers to introduce to plant manager
- Says "I wish I had this when we did the Ford quote"

### Secondary Persona: Plant Manager (Economic Buyer)

**Demographics:**
- Title: Plant Manager, Site Director, VP Operations
- Age: 40-55
- Reports to: VP Manufacturing or COO

**Pain Points:**
- "I can't justify capex without better capacity data"
- "We lost a bid because we couldn't commit capacity fast enough"
- "My IE's analysis takes too long when we need quick answers"
- "I need to show corporate we're using our assets efficiently"

**Goals:**
- Meet production targets
- Control costs
- Justify investments
- Look good to corporate

**Objections:**
- "What's the ROI?"
- "How long to implement?"
- "What if my IE leaves?"

### Tertiary Persona: VP Manufacturing (Executive Sponsor)

**Role in Deal:**
- Signs off on enterprise purchase
- Mandates adoption across plants
- Cares about strategic capability

**What They Care About:**
- Multi-plant visibility
- Investment prioritization
- Competitive differentiation

### Buying Committee Map (Typical)

```
                    +-----------------------+
                    |    VP Manufacturing   |  <- Executive Sponsor
                    |    (Signs contracts)  |
                    +-----------+-----------+
                                |
            +-------------------+-------------------+
            |                                       |
+-----------+-----------+               +-----------+-----------+
|    Plant Manager      |               |    IT Manager         |
|   (Economic Buyer)    |               |   (Technical Eval)    |
+-----------+-----------+               +-----------+-----------+
            |                                       |
+-----------+-----------+               +-----------+-----------+
|  Industrial Engineer  |               |   Procurement         |
|     (Champion)        |               |   (Price negotiator)  |
+-----------------------+               +-----------------------+
```

---

## MEDDIC Qualification Framework

### M - Metrics (Line Optimizer Specific)

**Discovery Questions:**
- "How many hours per week does your IE spend on capacity planning?"
- "What's the accuracy of your capacity commitments to customers?"
- "How much did your last expedited freight cost from a capacity miss?"
- "What percentage of available time is lost to changeover?"

**Target Metrics:**
| Metric | Before | After | Value |
|--------|--------|-------|-------|
| IE hours on capacity planning | 20+ hrs/week | 5 hrs/week | $40K/year labor |
| Capacity commitment accuracy | 70% | 95% | Avoids expedite costs |
| New quote turnaround | 2-3 weeks | 2-3 days | Win more business |
| Changeover visibility | None | Full matrix | SMED prioritization |

### E - Economic Buyer

**Who Signs:**
- Single plant: Plant Manager ($25K-$50K authority)
- Multi-plant: VP Operations/Manufacturing ($100K+ authority)

**Questions to Identify:**
- "Who has the authority to approve a $50K software purchase?"
- "If you recommended this and it came in under $30K, could you move forward?"
- "Who else needs to be involved in the final decision?"

### D - Decision Criteria

**Technical Criteria:**
- Import existing Excel data (critical - they have Excel models)
- Fast execution (<5 seconds)
- Support for changeover time
- Multi-year analysis
- Visual representation of lines

**Business Criteria:**
- Quick implementation (<30 days)
- Low training burden
- ROI in first year
- Data stays on-premise (security)

**Personal Criteria (Hidden):**
- "Will this make me look competent?"
- "Is this safe for my career?"
- "Will my team actually use it?"

### D - Decision Process

**Typical Steps:**
1. IE discovers tool (web search, LinkedIn, referral)
2. Initial demo with IE (technical validation)
3. Second demo with Plant Manager (business validation)
4. IT security review (if needed)
5. Pilot proposal (60-90 days)
6. Pilot execution (prove value)
7. Business case development
8. Procurement negotiation
9. Contract signature

**Timeline:** 3-6 months (can compress to 6-8 weeks with urgency)

### I - Identify Pain

**Surface vs. Root Pain:**

| Surface Pain | Root Pain |
|--------------|-----------|
| "Excel takes too long" | "I can't answer my plant manager fast enough" |
| "Capacity plans are inaccurate" | "We're losing bids because we can't commit" |
| "Changeover eats our capacity" | "We don't know which changeovers to reduce" |
| "Nobody else can use my spreadsheet" | "If I leave, the plant is in trouble" |

**Pain Amplification Questions:**
- "What happens when you can't answer a capacity question quickly?"
- "How does that affect your relationship with the customer?"
- "What did it cost last time a capacity commitment was wrong?"

### C - Champion Development

**Champion Criteria:**
- Has personal stake in success (wants to look good)
- Will share internal information
- Will advocate when you're not in the room
- Can get you access to economic buyer

**Champion Testing:**
- "Would you be willing to introduce me to your plant manager?"
- "Can you share your current Excel capacity model?"
- "What objections do you expect from [skeptic]?"
- "If I'm not in the room, would you advocate for this?"

---

## Discovery Questions

### Opening (Establish Context)

1. "Tell me about your role. What does a typical capacity planning exercise look like?"
2. "How many production lines do you manage? How many models run across them?"
3. "What tools do you currently use for capacity planning?"
4. "How often do you run capacity analysis - quarterly, monthly, ad hoc?"

### Problem Discovery (Uncover Pain)

5. "What's the biggest challenge with capacity planning today?"
6. "When a new program comes in, how long does it take to determine if you can fit it?"
7. "How accurate are your capacity commitments? What happens when they're wrong?"
8. "Do you account for changeover time in your capacity? How?"
9. "What happens if you leave or go on vacation - can someone else do the analysis?"

### Implication Questions (Amplify Pain)

10. "You mentioned it takes 2 weeks to answer capacity questions. What does that cost you?"
11. "When the capacity commitment was wrong, what was the impact?"
12. "If changeover is eating 10% of your capacity, what does that mean in lost production?"

### Need-Payoff Questions (Envision Solution)

13. "What if you could answer those questions in minutes instead of days?"
14. "How would it help if you could see exactly where your bottleneck is?"
15. "What would it mean to your team if they could run scenarios without rebuilding Excel?"

### Qualification Questions

16. "What's driving you to look at this now? Is there a specific event or deadline?"
17. "Who else would need to be involved in a decision like this?"
18. "What's your budget cycle - annual planning or project-based?"
19. "Have you evaluated other capacity planning tools before?"

---

## Demo Script

### Pre-Demo Preparation

**Before the call:**
- Get their current Excel template (if possible)
- Understand their line count, model count, area structure
- Know their industry vertical (automotive, discrete mfg)
- Prepare sample data similar to their setup

### Demo Structure (45 minutes)

#### 1. Problem Recap (5 minutes)

*Start with their pain, not your features.*

> "Before I show you Line Optimizer, let me make sure I understand your situation. You mentioned that capacity planning takes your team about 20 hours per week in Excel, and when a new program quote comes in, it takes 2-3 weeks to get a confident answer. Is that still accurate?"

*Wait for confirmation. Add any pain points they mentioned.*

> "And you said changeover time is a blind spot - you know it matters but you don't have good data on it. Did I capture that right?"

#### 2. Data Import (5 minutes)

*Show how easy it is to get started.*

> "The first thing I want to show you is how simple it is to get your data into Line Optimizer. Most of our customers start with their existing Excel data."

**Demo Steps:**
1. Open Line Optimizer
2. Click Import from Excel
3. Show the multi-sheet template structure
4. Import sample data (similar to their setup)
5. Show the import wizard validating data

> "Notice we're importing Lines, Models, Volumes, Compatibilities, and Changeover data all from one Excel file. Your IE doesn't have to re-enter anything - we work with your existing data structure."

#### 3. Canvas Visualization (5 minutes)

*Make it visual and tangible.*

> "Now let me show you what this looks like visually."

**Demo Steps:**
1. Show the canvas with production lines laid out
2. Demonstrate drag-and-drop to arrange by area
3. Show how lines are grouped (SMT, ICT, Assembly, etc.)
4. Point out the utilization bars (before analysis)

> "This is your plant layout. Each box is a production line. You can arrange them however makes sense for your mental model - by area, by building, however you think about it."

#### 4. Run Analysis - The Magic Moment (10 minutes)

*This is where you win or lose the deal.*

> "Now watch this. I'm going to run the full capacity analysis."

**Demo Steps:**
1. Click "Run Analysis" button
2. Watch the 17ms execution
3. Show the results panel appearing
4. Point out utilization percentages on each node
5. Show the color-coded bottleneck indicators

> "That took 17 milliseconds. Not 17 seconds - 17 milliseconds. Your team can run this 100 times a day without waiting."

**Key Talking Points:**
- Point to the bottleneck area (red indicator)
- Show the constraint drill-down
- Explain "dedicated line bottleneck" vs "shared capacity constraint"
- Show unfulfilled demand by model

> "See this red indicator? This is telling you that Final Assembly is your system constraint. And it's not just saying 'you're out of capacity' - it's telling you exactly which lines are constrained and which models are causing the problem."

#### 5. Changeover Impact - The Differentiator (10 minutes)

*This is your competitive moat.*

> "Now let me show you something most capacity tools can't do. Watch what happens when I turn on changeover."

**Demo Steps:**
1. Show the current utilization (changeover OFF)
2. Click "Changeover: All ON"
3. Watch utilization bars expand (amber = changeover time)
4. Point out the stacked bar (blue = production, amber = changeover)
5. Show a line that goes from 85% to 98% with changeover

> "With changeover OFF, this line looks healthy at 85% utilization. But when we account for the 15 minutes between each product changeover, it's actually at 98%. That's the difference between 'we can take more work' and 'we're maxed out.'"

**Three-Tier Resolution:**
> "And here's the smart part - you don't have to enter every single changeover time. We use a three-tier system: global default, family-to-family defaults, and line-specific overrides. Most customers enter maybe 50 values to cover thousands of model combinations."

#### 6. Multi-Year Navigation (5 minutes)

*Show strategic value.*

> "Now let me show you how this helps with planning horizons."

**Demo Steps:**
1. Show the year navigator (2024, 2025, 2026, 2027)
2. Click through years
3. Watch utilization bars change
4. Point out when a constraint emerges (e.g., 2026)

> "In 2024 you're fine - 72% average utilization. But watch what happens as volumes ramp. By 2026, Final Assembly hits 98%. That's two years of warning to either add capacity or negotiate the volume curve."

#### 7. Routings View (5 minutes)

*Show sophistication for complex manufacturing.*

> "For models with complex process flows, let me show you the Routings view."

**Demo Steps:**
1. Navigate to Routings page
2. Show a model with parallel processes (SMT -> [ICT + Conformal] -> Assembly)
3. Explain DAG-based routing
4. Show predecessor relationships

> "This model goes through SMT first, then ICT and Conformal Coating run in parallel, and Assembly waits for both. Line Optimizer understands this and calculates capacity correctly."

#### 8. Close - Vision of Success (5 minutes)

*Paint the picture of them succeeding.*

> "So let me bring this back to your situation. You told me capacity planning takes 20 hours a week. With Line Optimizer, your IE imports the Excel data once, runs analysis in 17 milliseconds, and can answer any capacity question in minutes.

> When the next new program quote comes in, instead of 2-3 weeks of scrambling, you can run 5 different scenarios in an hour and walk into that meeting with a confident answer.

> And because changeover is built in, you're not promising capacity you don't have.

> Does this look like something that would help your team?"

---

## Technical Differentiation

### vs. Excel (Current State)

| Aspect | Excel | Line Optimizer | Impact |
|--------|-------|----------------|--------|
| **Calculation Speed** | Minutes per scenario | 17 milliseconds | Run 100 scenarios/hour |
| **Changeover** | Manual, often ignored | Built-in 3-tier matrix | Realistic capacity |
| **Multi-Year** | Multiple tabs, manual | Navigate years instantly | Strategic planning |
| **Bottleneck ID** | Manual analysis | Automatic constraint detection | Know what to fix |
| **Maintainability** | "If I leave, it breaks" | Structured data model | Knowledge preservation |
| **Visualization** | Static charts | Interactive canvas | Better presentations |

### vs. Enterprise Systems (SAP, Siemens, DELMIA)

| Aspect | Enterprise Systems | Line Optimizer | Impact |
|--------|-------------------|----------------|--------|
| **Implementation** | 6-18 months | Days | Time to value |
| **Cost** | $200K-$1M+ | 10-20x less | Budget accessible |
| **Complexity** | Requires consultants | Self-service | No ongoing fees |
| **Focus** | Broad functionality | Capacity planning | Does one thing well |
| **Desktop** | Usually cloud | Local | Data security |
| **Changeover** | Often an add-on | Core feature | Out of the box |

### Unique Technical Capabilities

1. **Proprietary Probability-Weighted Changeover Algorithm**
   - Not just average changeover time
   - Weights transitions by actual demand mix
   - More accurate than naive averages

2. **DAG-Based Routing**
   - Parallel process flows (not just linear)
   - Proper predecessor relationships
   - Covers 90%+ of real manufacturing flows

3. **Three-Tier Changeover Resolution**
   - Global default (30 min fallback)
   - Family-to-family defaults (25-50 values)
   - Line-specific overrides (exceptions only)
   - Result: Minimal data entry, maximum accuracy

4. **Constraint Type Detection**
   - Distinguishes "dedicated line bottleneck" from "shared capacity constraint"
   - Tells you what kind of problem you have
   - Different solutions for different constraint types

---

## Objection Handling

### Price Objections

**"It's too expensive."**

> "I understand budget is always a concern. Let me ask - too expensive compared to what?
>
> You mentioned your IE spends 20 hours a week on capacity planning. At fully-loaded cost, that's roughly $50K per year in labor alone. Line Optimizer pays for itself in the first year just in time savings - not counting the cost of bad capacity decisions.
>
> What was the cost of the last expedited freight shipment from a capacity miss?"

**"We don't have budget."**

> "I hear that a lot at this time of year. Let me ask - if you could show your plant manager that this would save $100K in the first year, would budget appear?
>
> [If yes]: Let's build that business case together. I can help you quantify the ROI.
> [If no]: When does your budget cycle reset? Let's plan for Q4 planning."

### Competition Objections

**"We're looking at [Siemens/SAP/Delmia]."**

> "That makes sense - they're established players. Can I ask what's driving you to consider them?
>
> [Listen]
>
> Here's what I've seen from customers who evaluated both: The enterprise systems are powerful, but they require 6-18 months of implementation and a consulting team. By the time you're live, you've spent more on implementation than the software.
>
> We're not trying to replace your ERP. We're solving a specific problem - capacity planning - faster and simpler. Many of our customers use Line Optimizer alongside their ERP/MES systems.
>
> Would it help if I showed you how one automotive Tier 1 compared us to a Siemens implementation?"

**"We're going to build it ourselves."**

> "I respect the DIY approach. Can I share what usually happens?
>
> An IE builds something in Excel or Python. It works for their needs. Then they get promoted or leave. Now you have a tool nobody understands.
>
> We've put 3 years into this algorithm. It handles edge cases your team hasn't encountered yet - like probability-weighted changeover calculations and dedicated line bottleneck detection. And you get updates and support.
>
> What would you estimate the cost of building and maintaining this internally?"

### Risk Objections

**"What if it doesn't work for our plant?"**

> "That's exactly the right question. Here's how we de-risk this:
>
> 1. We start with a pilot - 60 days, one area, minimal investment
> 2. We define success criteria upfront - you tell me what 'working' means
> 3. If we don't hit those criteria, you walk away
>
> But let me ask: What's the risk of doing nothing? You're spending 20 hours a week in Excel with questionable accuracy. That's not going away."

**"What if Line Optimizer goes out of business?"**

> "Fair concern for any software. Here's our situation: [Share relevant details - customer base, growth, founder background]
>
> But more importantly - Line Optimizer runs on your desktop. Your data stays on your machine in a standard SQLite database. If we disappeared tomorrow, you'd still have a working tool. You're not locked into a cloud service."

### Timing Objections

**"We're not ready right now."**

> "I understand. Can you help me understand what 'ready' looks like?
>
> [Listen]
>
> So if [X happens], you'd be ready to move forward?
>
> Let's stay in touch. In the meantime, would it be helpful if I shared a whitepaper on how other plants approach capacity planning? That way when you are ready, you'll have a head start."

**"Come back next quarter."**

> "Happy to. Before we reschedule, can I ask - what will be different next quarter that makes this a better time?
>
> [If no real answer]: Sometimes 'next quarter' means 'no' and that's okay. Is there something about the tool or the price that's not working?"

### Technical Objections

**"My data isn't clean enough."**

> "I hear that from almost every customer at first. Here's the reality: if your Excel model is working today, your data is good enough for Line Optimizer. We use the same data structure.
>
> Start with what you have. You can refine changeover times and routing data over time. The tool will work on day one."

**"We need real-time integration with our MES."**

> "That's a different use case. Line Optimizer is for strategic capacity planning - yearly and monthly horizons. For real-time shop floor, you're right to look at MES integration.
>
> But here's the question: Is anyone doing strategic capacity planning well today? Most of our customers use Line Optimizer for the planning exercise (once a month or quarter) and their MES for daily execution."

---

## Competitive Positioning

### Positioning Statement

> "Line Optimizer is the capacity planning tool built specifically for automotive and discrete manufacturing engineers who need to answer 'can we meet demand?' quickly and accurately - without spending months on enterprise implementations or hours rebuilding Excel models."

### Three-Sentence Pitch

> "Most capacity planning is done in Excel - it works but it's slow, fragile, and ignores changeover time. Line Optimizer takes your existing Excel data and gives you instant analysis with built-in changeover impact. Your IE can answer any capacity question in minutes instead of days."

### Competitive Matrix

| Capability | Excel | Line Optimizer | Siemens PS | SAP IBP |
|------------|-------|----------------|------------|---------|
| Implementation Time | Ongoing | Days | 6-12 months | 12-18 months |
| Cost (TCO Year 1) | "Free" + labor | $25K-$50K | $200K-$500K | $300K-$1M |
| Changeover Matrix | Manual | Built-in 3-tier | Add-on | Add-on |
| Learning Curve | High (build yourself) | Hours | Months | Months |
| Data Security | Local | Local desktop | Cloud/On-prem | Cloud |
| Execution Speed | Minutes | 17ms | Seconds | Seconds |
| Maintenance | You maintain | We maintain | Consultant | Consultant |

### Competitive Landmines

**Against enterprise systems:**
- "How long was the implementation for your ERP/MES? How much of that was consulting?"
- "When was the last time you actually used the capacity planning module?"
- "What's the learning curve for a new IE to use your current system?"

**Against Excel:**
- "What happens to your capacity model when the IE who built it leaves?"
- "How do you handle changeover time in your Excel model?"
- "How long does it take to run a what-if scenario?"

---

## Pilot Program Structure

### Pilot Objectives

A successful pilot proves:
1. Data import works with their actual Excel data
2. Analysis results match their intuition / validate known constraints
3. Changeover impact is realistic and actionable
4. Time savings are significant (hours saved per week)
5. Champion becomes an advocate

### Pilot Scope

| Element | Recommendation | Rationale |
|---------|----------------|-----------|
| **Duration** | 60 days | Long enough to prove value, short enough to maintain urgency |
| **Scope** | One area (e.g., Final Assembly) | Small enough to control, big enough to matter |
| **Lines** | 5-15 lines | Meaningful but manageable |
| **Models** | 10-30 models | Real complexity |
| **Users** | 1-2 IEs | Champion + backup |

### Pilot Success Criteria (Define Upfront!)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Data import success | 100% of Excel data imported | First week |
| Analysis accuracy | Results match known constraints | Week 2 validation |
| Time savings | 50% reduction in analysis time | User survey |
| User satisfaction | "Would recommend" score 8+ | End of pilot survey |
| Champion advocacy | Champion requests full license | Unprompted |

### Pilot Timeline

```
Week 1: Onboarding
├── Data import assistance
├── Training session (2 hours)
├── First analysis run
└── Checkpoint call

Weeks 2-4: Daily Use
├── Weekly check-in calls
├── Issue resolution
├── Feature questions
└── Data refinement (changeover times)

Weeks 5-6: Business Case
├── Document time savings
├── Capture success stories
├── Build ROI model
└── Prepare expansion proposal

Weeks 7-8: Decision
├── Review pilot results
├── Present to economic buyer
├── Proposal for full license
└── Negotiation
```

### Pilot Pricing

| Model | Price | Terms |
|-------|-------|-------|
| **Free Pilot** | $0 | For strategic accounts, strong champion, clear path to purchase |
| **Paid Pilot** | $5K | Covers support time, applies to full license |
| **POC Engagement** | $15K | More hand-holding, includes consulting |

**Always get something in return:**
- Commitment to present to plant manager
- Case study rights if successful
- Defined success criteria in writing
- Timeline for purchase decision

---

## Pricing Strategy

### Pricing Philosophy

- Value-based, not cost-based
- Simple structure (no complexity traps)
- Lower barrier to entry, expand with success
- Never free (they won't value it)

### Recommended Pricing Tiers

| Tier | Lines | Annual Price | Per-Line Implied |
|------|-------|--------------|------------------|
| **Starter** | Up to 10 lines | $15,000 | $1,500/line |
| **Professional** | Up to 25 lines | $30,000 | $1,200/line |
| **Enterprise** | Up to 50 lines | $50,000 | $1,000/line |
| **Multi-Plant** | 100+ lines | Custom | Negotiated |

### Discount Guidelines

| Discount Level | Approval | What You Get |
|----------------|----------|--------------|
| 0-10% | Sales rep | Standard negotiation |
| 10-20% | Sales manager | Multi-year commit OR case study rights |
| 20-30% | VP | Strategic account + 3-year commit + reference |
| 30%+ | Founder | First 5 customers only |

**Never discount without getting:**
- Multi-year commitment
- Case study / reference rights
- Expanded scope (more plants)
- Faster timeline

### ROI Justification

| Value Driver | Calculation | Annual Value |
|--------------|-------------|--------------|
| IE time savings | 15 hrs/week x $50/hr x 50 weeks | $37,500 |
| Faster quote response | 1 won bid/year x $500K margin | $500,000 |
| Avoid expedite costs | 2 misses/year x $25K each | $50,000 |
| SMED prioritization | 5% changeover reduction | $100K+ |

**Conservative ROI: 3-5x in Year 1**

---

## Deal Stages & Actions

### Stage 1: Discovery (0-25%)

**Goal:** Qualify opportunity, identify champion, understand pain

**Entry Criteria:**
- Inbound lead or targeted outreach response
- Manufacturing company with lines + models

**Actions:**
- [ ] Discovery call (30-45 min)
- [ ] Complete MEDDIC qualification
- [ ] Identify champion (IE who feels the pain)
- [ ] Understand current state (Excel, other tools)
- [ ] Document 3+ specific pain points
- [ ] Qualify budget and timeline

**Exit Criteria:**
- Champion identified and engaged
- Pain quantified (hours spent, cost of errors)
- Next meeting scheduled (demo)
- MEDDIC score > 60%

### Stage 2: Demo / Technical Validation (25-50%)

**Goal:** Prove the tool solves their problem

**Entry Criteria:**
- Qualified opportunity from Stage 1
- Demo scheduled with right audience

**Actions:**
- [ ] Prepare demo with their data (if available)
- [ ] Deliver tailored demo (see Demo Script)
- [ ] Get technical validation from IE
- [ ] Identify objections early
- [ ] Introduce ROI framework
- [ ] Discuss pilot or purchase path

**Exit Criteria:**
- Technical buy-in from IE
- Plant Manager meeting scheduled
- Pilot scope discussed
- Timeline for decision established

### Stage 3: Business Case / Pilot (50-75%)

**Goal:** Prove value, get economic buyer buy-in

**Entry Criteria:**
- Technical validation complete
- Path to economic buyer

**Actions:**
- [ ] Define pilot success criteria (written!)
- [ ] Set pilot timeline (60 days)
- [ ] Assign resources (both sides)
- [ ] Weekly check-ins during pilot
- [ ] Document wins along the way
- [ ] Build ROI model with their numbers
- [ ] Present to economic buyer

**Exit Criteria:**
- Pilot success criteria met
- Economic buyer sees value
- Proposal requested
- Budget confirmed available

### Stage 4: Negotiation (75-90%)

**Goal:** Finalize terms, get verbal yes

**Entry Criteria:**
- Pilot successful OR demo convinced
- Budget available
- Economic buyer engaged

**Actions:**
- [ ] Submit proposal
- [ ] Handle pricing objections
- [ ] Navigate procurement / legal
- [ ] Final security review (if needed)
- [ ] Secure verbal commitment
- [ ] Agree on implementation timeline

**Exit Criteria:**
- Verbal yes from economic buyer
- Contract in legal review
- Implementation date set

### Stage 5: Closed Won (90-100%)

**Goal:** Signature, successful implementation, reference

**Entry Criteria:**
- Verbal yes secured
- Contract redlines minimal

**Actions:**
- [ ] Finalize contract
- [ ] Get signature
- [ ] Schedule kickoff
- [ ] Complete implementation
- [ ] 30-day check-in
- [ ] Request reference / case study

**Exit Criteria:**
- Contract signed
- Customer live and using product
- Reference potential identified

---

## Sales Collateral Checklist

### Must-Have (Before First Deals)

- [ ] One-page product overview (PDF)
- [ ] Demo video (5 min, self-guided)
- [ ] Excel import template (sample data)
- [ ] ROI calculator (Excel or web)
- [ ] Pilot proposal template

### Should-Have (Scale Phase)

- [ ] Case study (first customer)
- [ ] Competitive comparison sheet
- [ ] Technical FAQ document
- [ ] Implementation guide
- [ ] Training curriculum

### Nice-to-Have (Growth Phase)

- [ ] Whitepaper: "Hidden Cost of Changeover"
- [ ] Webinar recording: capacity planning best practices
- [ ] Industry report: automotive capacity challenges
- [ ] Customer video testimonial
- [ ] Partner program materials

---

## Appendix: Key Product Metrics

### Algorithm Performance

| Metric | Value | Significance |
|--------|-------|--------------|
| Execution time | 17ms | Instant feedback |
| Lines supported | 100+ | Enterprise scale |
| Models supported | 500+ | High-mix production |
| Years analyzed | 5+ | Strategic planning |

### Changeover Calculation

| Method | Description | Use Case |
|--------|-------------|----------|
| Probability-Weighted | Proprietary algorithm weights by demand mix | Default, most accurate |
| Simple Average | Arithmetic mean | Fallback if demand unknown |
| Worst Case | Maximum changeover time | Conservative planning |

### Data Model

| Entity | Purpose |
|--------|---------|
| Production Lines | Physical assets with time available |
| Product Models | What gets built (with family grouping) |
| Compatibilities | Which models run on which lines |
| Volumes | Multi-year demand forecast |
| Changeover Matrix | Time to switch between models |
| Routings | Process flow (DAG) for each model |

---

*"In enterprise sales, you're not selling software - you're selling a future state. The buyer needs to see themselves succeeding with your solution, and they need to trust that you'll be there when things go wrong. Price is never the real objection; it's always risk."*

---

**Document Version:** 2.0
**Created:** 2026-02-01
**Next Review:** 2026-04-01
