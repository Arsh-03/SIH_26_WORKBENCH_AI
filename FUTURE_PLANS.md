# Sovereign AI Engineering Workbench — Enterprise Industrial Roadmap
**Target Facility**: Mangalore Refinery & Petrochemicals Limited (MRPL) / High-Hazard Process Industries  
**Compliance Standards**: Zero-Egress Air-Gap, ASME Section VIII, OISD-156, OSHA 1910.119  
**Document Status**: Active Strategic Implementation Blueprint  

---

## 1. Vision: Beyond the "Chatbot" to an Industrial Command Center

Generic chat interfaces (ChatGPT, Claude, Gemini) fail in industrial plants because engineers and refinery leaders don't need general conversation. Refineries deal with **complex physics, multi-variable thermodynamics, heavy operational economics, and strict regulatory safety clearances**.

An enterprise sovereign workbench must function as an **Active Industrial Command Center**:
- **Visual Analytics**: Interactive dynamic charts (bar, stacked, pie, heatmaps, radar) instead of walls of raw numbers.
- **Specialized Multi-Agent Swarm**: Dedicated sub-agents for **Physics/Math Simulation**, **Refinery Financial Analytics**, **Safety Compliance**, and **Shift Handover**.
- **Interactive Engineering Canvas**: Interactive P&ID schematics, Mermaid process flow diagrams (PFDs), and live parameter sliders where adjusting a variable (e.g. temperature or pressure) updates the simulation curves and financial impact in real time.
- **Air-Gapped Agency**: Local on-premise MCP actions (internal email dispatch, SMS/pager alerts, SCADA historian queries) with zero internet egress.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                    SOVEREIGN REFINERY ENGINEERING COMMAND CENTER ARCHITECTURE                       │
├─────────────────────────┬──────────────────────────┬─────────────────────────────────────────────────┤
│ 1. OPERATIONS           │ 2. PROCESS SAFETY        │ 3. VISUAL ANALYTICS & BI                        │
│    • Shift Handover     │    • Management of Change│    • Interactive Charts (Bar/Pie/Heatmap)       │
│    • Logbook Synthesis  │      (MOC) Dossier       │    • Refinery Economics / OPEX Agent            │
│    • Alarm Prioritizer  │    • HAZOP Risk Matrix   │    • Dynamic Yield & Throughput Dashboards      │
├─────────────────────────┼──────────────────────────┼─────────────────────────────────────────────────┤
│ 4. ADVANCED PHYSICS     │ 5. INTERACTIVE TWIN      │ 6. AIR-GAP DISPATCH                             │
│    • Mathematical Agent │    • Interactive P&ID    │    • Local On-Premise SMTP Mail (MCP)           │
│    • ASME Stress Tensor │    • Mermaid Process Flow│    • Plant GSM Pager / Alert System (MCP)       │
│    • Thermal Curves     │    • Live Sliders & Twin │    • SCADA Influx/SQLite Historian (MCP)        │
└─────────────────────────┴──────────────────────────┴─────────────────────────────────────────────────┘
```

---

## 2. Detailed Modular Implementation Roadmap

### 📊 Phase 1: Interactive Visual Analytics & Business Intelligence Engine
*Target Users: Refinery Operations Managers, Financial Planners, Yield Engineers*

#### Problem Statement
Refinery engineers and executives make multi-million dollar decisions based on yield metrics, energy consumption, and unit throughput. Currently, LLMs output markdown tables or static numbers, requiring engineers to manually copy data into Excel to generate charts.

#### Feature Specifications
1. **Interactive Charting Engine (Frontend & Backend)**:
   - Native integration of interactive charts (**Chart.js / Recharts**):
     - **Bar & Stacked Bar Charts**: Unit throughput vs. target capacity, steam consumption by unit.
     - **Pie & Doughnut Charts**: Energy consumption split (fuel gas vs. electricity vs. steam), crude blend distribution.
     - **Heatmaps & Matrix Visuals**: Heat exchanger tube-bundle fouling intensity, unit alarm density over 24 hours.
     - **Time-Series Area Curves**: Historical pressure/temperature degradation over operating hours.
2. **Dedicated `AnalyticsAgent`**:
   - Ingests structured telemetry or tabular data.
   - Detects visualizable dimensions and outputs structured JSON chart specifications (`chartType`, `labels`, `datasets`, `palette`, `unit`).
   - Renders directly inside the chat stream and in the right-hand **Visual Canvas** with hover tooltips, zoom, and SVG/PNG export.
3. **Refinery Financial & Tactical Business Agent (`FinanceAgent`)**:
   - Calculates operational economics:
     - **Cost of Steam Generation**: Fuel cost per ton of high-pressure steam at operating temperature.
     - **Downtime / Turnaround Delay Penalty**: Estimated revenue loss per hour of unplanned boiler shutdown.
     - **Energy Efficiency Optimization**: Cost savings from lowering superheater temperature by 15°C vs. creep degradation risk.

---

### ⚛️ Phase 2: Advanced Physics & Mathematical Simulation Engine
*Target Users: Process Specialists, Mechanical Integrity Engineers, Plant Designers*

#### Problem Statement
Petroleum refining is governed by complex mathematical physics: Navier-Stokes fluid mechanics, Peng-Robinson equations of state, and ASME Section VIII stress tensor calculations. Standard LLM text models struggle with multi-step numerical precision.

#### Feature Specifications
1. **Dedicated `PhysicsMathAgent`**:
   - Routes mathematical and thermodynamic queries to a specialized calculation pipeline using Python `scipy`, `numpy`, and `sympy` in the isolated execution sandbox.
   - Emits step-by-step mathematical proofs with KaTeX math rendering ($$\sigma = \frac{P \cdot r}{t}$$).
2. **ASME Section VIII Design & Creep Calculation**:
   - Solves minimum required wall thickness ($t$), maximum allowable working pressure ($MAWP$), and temperature-dependent allowable stress ($S$).
   - Calculates Larson-Miller parameter for high-temperature creep rupture life.
3. **Interactive Simulation Sliders**:
   - On the visual canvas, engineers can drag a temperature slider from $350^\circ\text{C}$ to $520^\circ\text{C}$ and dynamically observe the calculated $MAWP$ and stress curves recompute in real time.

---

### 🗺️ Phase 3: Interactive P&ID (Piping & Instrumentation) & Process Canvas
*Target Users: Field Operators, Technical Services, Commissioning Engineers*

#### Problem Statement
Engineers visualize chemical plants through **P&IDs (flow schematics)** with equipment tags (`B-401 Boiler`, `PRV-102 Relief Valve`, `CDU-101 Column`), not text-heavy chat threads.

#### Feature Specifications
1. **Interactive SVG & Mermaid Schematic Canvas**:
   - Dedicated **Plant Canvas** tab rendering interactive Piping & Instrumentation Diagrams and Mermaid Process Flow Diagrams (PFDs).
   - Equipment tags are clickable interactive nodes.
2. **Node Deep-Dive Flyout**:
   - Clicking on `B-401 Steam Boiler` instantly displays:
     - Live operating parameters vs. ASME MAWP design limits.
     - Linked Standard Operating Procedures (SOP-401).
     - Recent maintenance logs and ultrasonic wall thickness measurements.
     - One-click action: `[ Run Thermal Degradation Simulation ]`.
3. **Bi-Directional Canvas Interaction**:
   - The engineer can either click and modify parameters on the diagram manually, or ask the AI: *"Highlight all relief valves on the superheated steam line that require calibration above 480°C."*
   - The workbench highlights the target valves in amber/red on the canvas.

---

### 📋 Phase 4: Shift Handover Intelligence & Logbook Synthesis
*Target Users: Shift In-Charge (SIC), Panel Operators, Field Engineers*

#### Problem Statement
Refinery units run 24/7 in 8-hour or 12-hour shifts. Critical safety incidents historically occur during shift handovers due to missed verbal communications, unread SCADA alarm logs, and unstructured paper logbooks.

#### Feature Specifications
1. **Multi-Source Shift Parser**:
   - Ingests raw DCS/SCADA alarm dumps (Yokogawa / Honeywell / Emerson formats) and operator text notes for the last shift.
   - Filters out nuisance alarms and isolates critical unacknowledged trips (`HH` high-high pressure alarms, temperature deviations).
2. **Automated Handover Dossier Generation**:
   - Synthesizes an executive **Shift Relief Memorandum** containing:
     - Active Unit Throughput vs. Target Capacity.
     - Standing Alarms & Bypassed Interlocks (Safety Critical).
     - Running Equipment Status & Maintenance In-Progress.
     - Urgent Action Directives for the incoming Shift In-Charge.
3. **Formal Digital Sign-Off**:
   - Incoming and outgoing shift engineers cryptographically sign off via the workbench ledger before custody transfer is marked complete.

---

### 🛡️ Phase 5: Automated Management of Change (MOC) & HAZOP Dossier Builder
*Target Users: Technical Services, Process Engineers, Safety Officers*

#### Problem Statement
Under OISD-156 and OSHA PSM regulations, any operational change—such as raising superheated steam temperature from 450°C to 480°C or swapping a relief valve—requires a multi-disciplinary **Management of Change (MOC)** and HAZOP review. Compiling this package takes weeks of manual standard lookups.

#### Feature Specifications
1. **Intelligent Change Intake**:
   - Engineer inputs change proposal: *"Increase crude distillation unit reboiler steam temperature to 485°C using Valve V-204."*
2. **Automated Safety & Standard Cross-Check**:
   - Cross-checks proposal against ingested SOPs (`SOP-401`), ASME Section VIII Div 1 pressure limitations, and metallurgic creep curves.
   - Detects mandatory prerequisites (e.g., *"SOP-401 requires reset of PRV calibration to 120 bar above 480°C"*).
3. **HAZOP Risk Matrix Synthesis**:
   - Generates a pre-filled HAZOP table (Parameter: Temperature | Guide Word: MORE | Consequence: Thermal degradation of shell | Safeguard: High-temperature trip).
4. **Exportable Clearance Dossier**:
   - Auto-compiles a formal `.docx` / `.pdf` MOC Approval Packet ready for signature by the Chief Refinery Engineer.

---

### 🔌 Phase 6: Air-Gapped Local MCP (Model Context Protocol) Action Hub
*Target Users: Maintenance Dispatchers, Automation & Instrumentation Teams*

#### Problem Statement
Engineers need the agent to perform real-world actions (send emails, dispatch alarms, log tickets), but refinery security strictly forbids internet egress or cloud AI APIs.

#### Feature Specifications
1. **100% Offline MCP Servers**:
   - **Local On-Premise SMTP MCP (`smtp_mcp`)**: Connects to the internal refinery mail server (`smtp.internal.mrpl.in` or local Postfix) over standard I/O to send shift reports and maintenance advisories without internet access.
   - **Plant Alert Pager MCP (`alert_mcp`)**: Connects to local serial GSM modems or industrial sounder gateways to dispatch SMS/radio alerts to field operators on duty.
   - **SCADA Historian MCP (`historian_mcp`)**: Reads historical telemetry series (SQLite / InfluxDB / Parquet time-series) directly from local storage.
2. **Human-In-The-Loop (HITL) Gateways**:
   - No outbound email or alarm can be dispatched without an explicit interactive modal:  
     `[ Preview Email ]` -> `[ Approve & Send ]` / `[ Reject ]`.

---

## 3. Recommended Phased Implementation Matrix

| Phase | Milestone | Key Deliverables | Impact |
|:---:|:---|:---|:---|
| **P1** | **Visual Analytics & BI Charts** | Chart.js / Recharts integration, `AnalyticsAgent`, Bar/Pie/Heatmap UI cards | Replaces raw numbers with high-contrast visual charts |
| **P2** | **Refinery Economics & Finance Agent** | `FinanceAgent`, OPEX calculator, Steam cost / Turnaround delay models | Quantifiable business value for management |
| **P3** | **Advanced Physics & Math Simulation** | `PhysicsMathAgent`, ASME Section VIII solver, creep rupture calculations | Scientific rigor & engineering precision |
| **P4** | **Interactive P&ID / Mermaid Canvas** | Interactive SVG schematic, Equipment tag flyout, parameter sliders | Highest visual impact & digital twin capability |
| **P5** | **Shift Handover Intelligence** | DCS alarm parser, standing interlock detector, handover memo generator | Solves the #1 daily operational bottleneck in 24/7 plants |
| **P6** | **Automated MOC & HAZOP Dossier** | OISD-156 validation, HAZOP risk table, clearance pack export | Eliminates weeks of manual compliance paperwork |
| **P7** | **Local Air-Gapped MCP Dispatcher** | Offline SMTP emailer, SMS/Pager bridge, HITL approval cards | True autonomous agency with 100% air-gap compliance |

---

## 4. Next Step Discussion
We can begin immediately with **Phase 1: Visual Analytics & BI Charts** (integrating Chart.js/Recharts + creating the `AnalyticsAgent` so prompts like *"Compare steam boiler efficiency and fuel gas consumption across CDU units"* generate live interactive charts).

Would you like to start with **Phase 1 (Visual Analytics & Charts)** or **Phase 2/3 (Refinery Economics / Physics & Math Agents)**?
