# Frontend Developer & UI/UX Designer Action Plan
**Target Facility**: Mangalore Refinery & Petrochemicals Limited (MRPL) / High-Hazard Sovereign AI Workbench  
**Aesthetic Direction**: *Darkroom Editorial* (`#181410`, `#D97A3F`, Fraunces & General Sans / Söhne, JetBrains Mono)  
**Document Status**: Active Implementation Blueprint & Phase-by-Phase Prompt Kit  

---

## 1. Executive Summary & Design System Foundations

As the Frontend Developer and UI/UX Designer, your mission is to transform the Sovereign AI Engineering Workbench into an **Active Industrial Command Center**. While the backend team delivers multi-agent reasoning, physics solvers, and the new Infographics API, the frontend must render complex technical data with clarity, instant tactile responsiveness, and aesthetic excellence.

### "Darkroom Editorial" Design System Specification
All components built across these phases must strictly adhere to the project's design guidelines in `frontend/DESIGN.md`:
* **Background Deep**: `#181410` (Warm near-black, like underexposed film)
* **Surface Elevation 1 (Sidebar / Cards)**: `#211B15`
* **Surface Elevation 2 (Input Bar / Modals / Popovers)**: `#2A2219`
* **Border / Divider Hairline**: `#3D3226` (1px warm brown-grey rule, avoid soft drop shadows)
* **Primary Accent ("Darkroom Amber")**: `#D97A3F` (Used sparingly: active states, primary CTA, cursor, underlines)
* **Secondary Alert ("Safelight Red")**: `#B8443A` (Critical limits, ASME boundary breaches, deletions)
* **Safety / Verified Accent ("Safety Emerald")**: `#10B981` (Nominal thresholds, verified standard compliance)
* **Cool Fluid / Air Accent ("Sky Cyan")**: `#38BDF8` (Water/steam cooling, gas flows)
* **Typography Hierarchy**:
  - Headings / Display: **Fraunces** (Warm serif, soft optical size)
  - Body / UI Labels: **General Sans** or **Söhne** (High legibility, line-height 1.65)
  - Code & Telemetry: **JetBrains Mono** (Strictly for code, numbers, and tags)
* **Geometry**: Sharp `4px` corner radii for cards/inputs; `2px` for buttons; `9999px` strictly for status pills.

---

## 2. Phase-by-Phase Action Plan

---

### Phase 1: Infographics, Report Analysis & Chart.js Visualizer
*Target: Integration with Friend 1's backend Infographics API, document analysis reports, and dynamic interactive charting.*

#### Objectives & Deliverables
1. **Chart.js & React-Chartjs-2 Native Integration**:
   - Install and configure `chart.js` and `react-chartjs-2` with the darkroom color palette.
   - Augment `InteractiveChartCard.tsx` with support for:
     - **2D Heatmaps & Matrix Visuals**: Heat exchanger tube-bundle fouling intensity, unit alarm density over 24 hours.
     - **Multi-Axis & Radar Charts**: Multi-variable boiler stress comparisons and crude blend distributions.
     - **Bar / Line / Area / Doughnut**: High-performance canvas rendering.
2. **Executive & Operational KPI Stat Banners**:
   - Create reusable KPI card components:
     - Target vs. Actual throughput (MT/day)
     - Unit yield variance with color-coded delta indicators (`+2.4%` in `#10B981`, `-5.1%` in `#B8443A`)
     - Operational boundary indicators with sparklines.
3. **Dual-Mode Rendering Engine (Raw Data vs. Pyplot/Seaborn Output)**:
   - **Interactive Chart.js Mode**: Rendered when backend returns JSON `chart_spec` or `infographic_spec`.
   - **Static Figure Mode (Pyplot / Seaborn)**: Rendered when backend sends generated figure images (base64 or artifact URL). Features a zoomable lightbox, darkroom film border, high-resolution PNG/SVG download, and a collapsible raw data table flyout.
4. **Document Analysis Trigger in Chat & Input Bar**:
   - In `InputBar.tsx`, when a user drops or attaches a document (`.pdf`, `.csv`, `.xlsx`, `.docx`), render an interactive **"Analyze & Generate Infographics"** quick-action chip.
   - Stepped extraction loading indicator in `MessageBlock.tsx`: *"Extracting telemetry tables → Computing statistical variances → Generating charts"*.

#### 📋 Prompt to Execute Phase 1
```text
Implement Phase 1 of the Frontend UI/UX Action Plan: Infographics, Report Analysis & Chart.js Visualizer.

Requirements:
1. Install and integrate `chart.js` and `react-chartjs-2` into `frontend/`.
2. Extend `InteractiveChartCard.tsx` (or create a dedicated `InfographicsCard.tsx`) to support:
   - 2D Heatmaps / Matrix visualizer (e.g. for heat exchanger fouling or 24hr alarm distribution).
   - Executive KPI Stat Cards (metric value, delta indicator, baseline vs target, and mini sparkline).
   - Multi-axis and radar charts alongside existing line/bar/pie/area charts.
3. Support Dual Backend Outputs:
   - Interactive mode: Parse incoming dynamic `chart_spec` JSON and render interactive Chart.js canvas.
   - Static/Seaborn mode: When backend outputs base64 images or image URLs from matplotlib/seaborn, render a Darkroom Editorial styled image lightbox with zoom, pan, full-screen popout, PNG download, and collapsible data-table view.
4. Document Analysis Quick-Action:
   - Update `InputBar.tsx` so when documents/reports are attached, an "Analyze & Generate Infographics" quick-action chip is offered.
   - Add a stepped progress indicator for document report analysis in `MessageBlock.tsx`.
5. Strictly adhere to the Darkroom Editorial design system (#181410 background, #D97A3F amber accents, 4px radii, Fraunces/General Sans typography).
```

---

### Phase 2: Simulation UI Optimization (P&ID & Physics Digital Twin)
*Target: Optimizing the existing simulation feature, eliminating slider lag, and adding real-time digital twin interaction.*

#### Objectives & Deliverables
1. **Debounced Real-Time Sliders**:
   - In `InteractivePidCanvas.tsx` and `InteractivePhysicsCard.tsx`, optimize slider parameter updates using `requestAnimationFrame` or `useDeferredValue` to prevent re-render stutter during continuous dragging.
2. **ASME Section VIII Operating Envelope Visualization**:
   - Overlay a dynamic curve showing the safe operating boundary vs. current operating point.
   - Dynamically highlight margin-of-safety violations in Safelight Red (`#B8443A`) with animated alert pulse rings.
3. **Bi-Directional P&ID Equipment Synchronization**:
   - Clicking an equipment glyph on the P&ID SVG canvas (e.g., `B-401 Boiler`, `PRV-102 Relief Valve`) updates the parameter control tray with that unit's exact design limits and operating values.
   - Adjusting sliders updates status rings on the schematic in real time (Green = Nominal, Amber = Warning, Red = Exceeds MAWP).
4. **Preset Scenario Selector**:
   - Quick-load industrial operating scenarios: *"Normal Operations (350°C / 25 bar)"*, *"High-Throughput Surge (420°C / 32 bar)"*, *"Overpressure Emergency (490°C / 45 bar)"*.

#### 📋 Prompt to Execute Phase 2
```text
Implement Phase 2 of the Frontend UI/UX Action Plan: Simulation UI Optimization & Digital Twin Interaction.

Requirements:
1. Optimize parameter sliders in `InteractivePidCanvas.tsx` and `InteractivePhysicsCard.tsx` using `useDeferredValue` / `requestAnimationFrame` for buttery-smooth 60fps interaction without UI re-render lag.
2. Add a dynamic Operating Envelope Chart to the simulation panel showing the ASME Section VIII MAWP boundary line vs. current operating state (Temp vs. Pressure).
3. Connect bi-directional P&ID node selection:
   - Clicking any equipment tag (e.g., B-401 Boiler or PRV-102) binds the slider controls directly to that equipment's operating thresholds.
   - Dynamically update the equipment node status rings (nominal emerald, warning amber, critical safelight red) as parameters change.
4. Add industrial preset scenario buttons: "Nominal Baseline", "Superheater High-Load", and "Emergency Overpressure Trip".
5. Preserve the Darkroom Editorial design language with high-contrast tactical engineering visuals.
```

---

### Phase 3: Text-to-Speech (TTS) Voice Engine & Audio UI
*Target: Enabling full voice communication for plant operators who prefer audio interaction over text.*

#### Objectives & Deliverables
1. **Audio Response Player Component**:
   - Add a subtle speaker/listen button next to the copy action button on every AI response block in `MessageBlock.tsx`.
   - On click, synthesize and play audio using either a backend TTS API (`/api/v1/audio/synthesize`) or local browser `window.speechSynthesis` as an offline fallback.
2. **Floating Audio Control Pill**:
   - Dockable bottom floating controller:
     - Play / Pause toggle
     - Scrub bar with current timestamp and duration
     - Speed multiplier pill (`1.0x`, `1.25x`, `1.5x`, `2.0x`)
     - Animated amber audio frequency wave visualizer
     - Stop / Dismiss button
3. **Continuous Hands-Free Conversational Voice Loop**:
   - Voice mode toggle on the microphone icon in `InputBar.tsx`.
   - Hands-free loop: Operator speaks → Speech-to-Text transcribes → Stream response renders → TTS automatically vocalizes response → Ready for next voice query.

#### 📋 Prompt to Execute Phase 3
```text
Implement Phase 3 of the Frontend UI/UX Action Plan: Text-to-Speech (TTS) Voice Engine & Audio UI.

Requirements:
1. Build an Audio Playback system for AI responses:
   - Add a listen/speaker action button beside the copy button on AI messages in `MessageBlock.tsx`.
   - Implement audio playback connecting to backend TTS endpoint with graceful offline fallback to `window.speechSynthesis`.
2. Build a Floating Audio Controller bar:
   - Include Play/Pause, scrub timeline, duration, playback speed selector (1.0x, 1.25x, 1.5x), and an animated mini waveform in Darkroom Amber (#D97A3F).
3. Create a Hands-Free Voice Mode toggle in `InputBar.tsx`:
   - Allows seamless push-to-talk or continuous conversation (Speak -> Whisper transcribe -> Agent stream -> Auto-play TTS audio response).
4. Include voice status pills ("Listening...", "Transcribing...", "Synthesizing audio...") matching the warm industrial palette.
```

---

### Phase 4: Multi-File Generation, Tabbed Editing & Diffing
*Target: Transforming the Artifact Panel into a multi-file IDE with editing, saving, and diffing capabilities.*

#### Objectives & Deliverables
1. **Interactive In-Place Code Editor**:
   - Upgrade `ArtifactPanel.tsx` from read-only syntax viewing to an editable code editor with line numbers, code folding, and auto-indentation.
2. **Multi-File Project Tab Strip**:
   - Multi-file tabs below the top header (e.g., `simulation.py`, `parameters.json`, `summary.md`).
   - Dirty-state tracking: Display an amber dot or `*` on modified tabs with unsaved changes.
   - Quick action: **"Add File"** and **"Delete File"** within the artifact package.
3. **Side-by-Side & Inline Diff Viewer**:
   - Compare proposed agent modifications against original file versions (V.1 vs V.2 vs Current).
   - Highlight additions in Darkroom Amber (`#D97A3F`) and removals in Safelight Red (`#B8443A`).
4. **"Save & Run in Sandbox" Action**:
   - Primary action button executing edited code directly in the backend Python sandbox, with live execution logs updating in the Terminal tab.

#### 📋 Prompt to Execute Phase 4
```text
Implement Phase 4 of the Frontend UI/UX Action Plan: Multi-File Generation, Tabbed Editing & Diffing.

Requirements:
1. Upgrade `ArtifactPanel.tsx` to support in-place code editing (editable editor replacing read-only tokens).
2. Implement a multi-file tab bar for multi-file artifacts:
   - Tab switching between files (e.g. simulation.py, config.json, report.md).
   - Dirty-state tracking with unsaved change indicators (amber dot / asterisks).
   - Ability to add new files and rename existing files.
3. Build a Visual Code Diff Viewer:
   - Split and unified diff view comparing historical versions or agent-suggested edits.
   - Color styling: additions in Darkroom Amber (#D97A3F), deletions struck-through in Safelight Red (#B8443A).
4. Add a "Save & Run in Sandbox" action button in the artifact header tray that sends updated code to the Python sandbox and streams output to the Terminal tab.
```

---

### Phase 5: Offline MCP (Model Context Protocol) Action Hub & HITL Modals
*Target: Visual management of local air-gapped MCP tools and Human-In-The-Loop approval gateways.*

#### Objectives & Deliverables
1. **Active Offline MCP Server Dashboard**:
   - Replace the static mock ping in `SettingsPage.tsx` with a live status panel for local on-premise MCP servers:
     - `smtp_mcp` (Local on-premise mail dispatcher)
     - `alert_mcp` (Serial GSM modem / plant pager dispatcher)
     - `historian_mcp` (SCADA SQLite/InfluxDB telemetry reader)
2. **Human-In-The-Loop (HITL) Action Confirmation Cards**:
   - When the agent attempts an air-gapped real-world action (e.g., dispatching an alarm or sending a shift report), render an interactive approval card in `MessageBlock.tsx`:
     ```
     ┌─────────────────────────────────────────────────────────────┐
     │ ⚠️ MCP ACTION APPROVAL REQUIRED                             │
     │ Tool: alert_mcp · Dispatch SMS to Duty Engineer            │
     │ Target: +91-98450-XXXXX (Shift In-Charge, CDU-2)           │
     │ Message: "P-401 High-High Pressure Alarm bypass activated." │
     ├─────────────────────────────────────────────────────────────┤
     │ [ Preview Raw Payload ]    [ Reject ]   [ Approve & Send ] │
     └─────────────────────────────────────────────────────────────┘
     ```
3. **Zero-Egress Security Badge**:
   - Persistent tactile indicator in the header bar confirming 100% offline air-gap enforcement with zero external network egress.

#### 📋 Prompt to Execute Phase 5
```text
Implement Phase 5 of the Frontend UI/UX Action Plan: Offline MCP Action Hub & HITL Approval Gateways.

Requirements:
1. Update `SettingsPage.tsx` and create an MCP status drawer for offline MCP servers (`smtp_mcp`, `alert_mcp`, `historian_mcp`) with live connection states and tool catalogs.
2. Implement interactive Human-In-The-Loop (HITL) Action Cards in `MessageBlock.tsx`:
   - Intercept MCP dispatch calls (e.g., sending emails, paging field operators, querying SCADA historian).
   - Display a preview card with raw parameters, action description, and security level.
   - Interactive buttons: "Approve & Execute" (amber) and "Reject & Cancel" (safelight red) which send user decisions back over WebSocket.
3. Add a "Zero-Egress Air-Gap" security indicator badge in the top navigation bar.
4. Ensure styling conforms to the Darkroom Editorial aesthetic.
```

---

## 3. Recommended Implementation Roadmap & Dependencies

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND EXECUTION TIMELINE                          │
├────────────────────────────────────────┬───────────────────────────────────────┤
│ Phase 1: Infographics & Chart.js       │ In parallel with Friend 1's backend   │
│          Visual Analytics Engine       │ infographics API endpoint             │
├────────────────────────────────────────┼───────────────────────────────────────┤
│ Phase 2: Simulation UI Optimization    │ Direct follow-up to optimize existing │
│          & Dynamic Digital Twin        │ P&ID and physics cards                │
├────────────────────────────────────────┼───────────────────────────────────────┤
│ Phase 3: TTS Voice Engine &            │ Voice synthesis and floating audio    │
│          Conversational Audio UI       │ player for operators                  │
├────────────────────────────────────────┼───────────────────────────────────────┤
│ Phase 4: Multi-File Generation,        │ Upgrade ArtifactPanel to full editor  │
│          Editing & Version Diffing     │ with multi-file workspace             │
├────────────────────────────────────────┼───────────────────────────────────────┤
│ Phase 5: Offline MCP Action Hub        │ Real-world air-gap dispatch and       │
│          & HITL Approval Cards         │ Human-In-The-Loop security governance │
└────────────────────────────────────────┴───────────────────────────────────────┘
```

Whenever you are ready to begin any phase, paste its prompt from this document directly into the chat.
