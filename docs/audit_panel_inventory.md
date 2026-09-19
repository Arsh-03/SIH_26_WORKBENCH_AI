# 🔬 Sovereign AI Engineering Workbench — Structural Panel & Layout Audit
**Document Code:** `docs/audit_panel_inventory.md`  
**Phase & Task:** Phase 1, Task 1 (`TSK-P1-01`)  
**System:** Sovereign On-Premise AI Engineering Workbench (SIH26117)  
**Target Facility:** Mangalore Refinery & Petrochemicals Limited (MRPL) / High-Hazard Refining Facilities  
**Compliance Standards:** OISD-156 (Process Safety Management), OSHA 1910.119 (PSM), ASME Section VIII Div 1 & 2  
**Design Aesthetic:** "Darkroom Editorial" (`#181410`, `#D97A3F`, Fraunces, General Sans/Söhne, JetBrains Mono)  
**Author:** Principal Product Designer & Lead UI/UX Systems Architect  

---

## 1. Visual Surfaces & Routing Inventory

This inventory catalogs every visual surface, view container, and modal overlay currently mounted across the frontend codebase. Each entry details the component file path, trigger mechanism, viewport allocation, and content density characteristics.

### 1.1 Routes & Top-Level Page Views

| Route | Component Path | Trigger / Navigation Mechanism | Target DOM Container & Viewport Allocation | Current Functionality & Content Density |
| :--- | :--- | :--- | :--- | :--- |
| **`/`**, **`/chat`**, **`/chat/:id`** | `frontend/src/routes/ChatPage.tsx` | Default app landing route; Sidebar navigation links; Command Palette search (`⌘K`). | Full flex workspace inside `AppLayout.tsx` (`<main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden bg-background">`). Allocates 100% width in Zero/Active state; splits to `splitPercent`% (default 46%) left chat, `100 - splitPercent`% (default 54%) right artifact pane. | **Very High Density**. Houses Welcome zero-state hero with 4 suggestion cards, active chat stream (`MessageBlock`), floating ChatGPT-style `PromptNavigator`, pinned bottom `InputBar`, `QueueBar`, and the 54% split right pane hosting `ArtifactPanel`. |
| **`/chats`** | `frontend/src/routes/ChatsPage.tsx` | Left Sidebar "Chats" link; URL navigation. | Main content area: `flex-1 w-full h-full overflow-y-auto px-6 md:px-10 lg:px-12 py-8`. | **Medium Density**. Table-of-contents editorial list of all historical chat sessions. Includes search query input, filter pills (`ALL`, `PINNED`, `RECENTS`), title, timestamp, message count, and pin/unpin action triggers. |
| **`/projects`** | `frontend/src/routes/ProjectsPage.tsx` | Left Sidebar "Projects" link; URL navigation. | Main content area: `flex-1 w-full h-full overflow-y-auto px-6 md:px-10 lg:px-12 py-8`. | **Medium-Low Density**. Grid of cards detailing configured refinery engineering workspaces (e.g., *Refinery Operations CDU-1*, *Cracking Unit Expansion*), file counters, artifact tallies, and last active timestamps. |
| **`/library`** | `frontend/src/routes/LibraryPage.tsx` | Left Sidebar "Library" link; URL navigation. | Main content area: `flex-1 w-full h-full overflow-y-auto px-6 md:px-10 lg:px-12 py-8`. | **Medium Density**. Catalog of reusable engineering artifacts, ASME calculation templates, standard schemas, and code components grouped by categories (`Components`, `Schemas`, `APIs`, `Migrations`). |
| **`/company-docs`** | `frontend/src/routes/CompanyDocsPage.tsx` | Left Sidebar "Company Docs" link; URL navigation. | Main content area: `flex-1 w-full h-full overflow-y-auto px-6 md:px-10 lg:px-12 py-8`. | **High Density**. Document ingestion and grounding management center. Manages ingested refinery Standard Operating Procedures (`SOP-401`), ASME standards, P&ID scans, classification selectors, upload dropzones, and in-place document markdown editors. |
| **`/dev-preview`** | `frontend/src/routes/DevPreviewPage.tsx` | Direct URL route; hidden developer trigger. | Main content area: `flex-1 w-full h-full overflow-y-auto p-6`. | **High Density**. Isolated sandbox for inspecting visual cards (`InteractiveChartCard`, `InteractivePhysicsCard`, `InteractivePidCanvas`, `InfographicsCard`) outside the chat loop. |
| **`/login`** | `frontend/src/routes/LoginPage.tsx` | Unauthenticated redirect from `ProtectedRoute` in `App.tsx`. | Standalone viewport wrapper (`min-h-screen w-full flex items-center justify-center bg-background`). | **Low-Medium Density**. Single card modal with sovereign badge, username/password credentials form, demo role quick-select chips (Lead Process Engineer, Safety Inspector, Operator), and air-gap enclave status indicator. |
| **`/settings`** | `frontend/src/routes/SettingsPage.tsx` | Sidebar footer "Settings"; Command Palette (`⌘,`); route redirect `SettingsRouteRedirect` in `App.tsx`. | Rendered as an elevated modal overlay over `AppLayout` when `isModal=true` (`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm`). | **Extremely High Density (140KB Component)**. Multi-tab configuration suite: Appearance & Theme, Keybindings override matrix, Model Routing & Context Quotas, Offline MCP Server Hub, Hardware Telemetry toggles, Audio & Chime parameters, and Local Data Clear triggers. |

---

### 1.2 Primary Shell Surfaces & Chat Elements

| Surface Component | Component Path | Mounting Location & Viewport Allocation | Current Functionality & Content Density |
| :--- | :--- | :--- | :--- |
| **Persistent Sidebar** | `frontend/src/components/layout/Sidebar.tsx` | Left viewport edge of `AppLayout.tsx`. Width animated with Framer Motion spring: `280px` expanded $\longleftrightarrow$ `56px` collapsed rail. | **Medium Density**. Top New Chat trigger with amber hover underline; Search trigger ("Search chats · ⌘K"); Navigation list (Chats, Projects, Library, Company Docs); Pinned Projects list; Pinned Chats list; Recents session list; Bottom user avatar card and Settings trigger. |
| **Chat Feed Container** | `frontend/src/routes/ChatPage.tsx` (Lines 438–498) | Left pane in Split View (`splitPercent`%, min 300px); full viewport in Active Chat without artifacts. | **High Density**. Houses virtual message blocks, dynamic thinking step indicators, math formulas, chart widgets, inline artifact triggers, and prompt minimap. |
| **Message Block** | `frontend/src/components/chat/MessageBlock.tsx` | Repeated row inside Chat Feed container. | **Extremely High Density (68KB Component)**. Polymorphic message renderer. User messages: right-aligned Elevation 1 cards. Assistant messages: thinking duration indicator, Söhne/General Sans body, KaTeX math blocks, markdown tables, inline artifact cards, interactive Chart.js cards, economics cards, physics simulation cards, P&ID canvas cards, audio listen button, and human-in-the-loop MCP approval cards. |
| **Universal Input Bar** | `frontend/src/components/chat/InputBar.tsx` | Bottom pinned tray in `ChatPage.tsx` (`border-t border-border/60 bg-background/95 px-6 py-3 shrink-0 backdrop-blur-sm`). | **Very High Density (44KB Component)**. Context scope indicator strip ("IN SCOPE: SOP-401.md"); slash-command autocomplete popup (`/explain`, `/refactor`, `/asme`, `/haop`, `/audit`); model capability selector pill; auto-expanding textarea; tool attachment popover; voice dictation trigger; send/stop action button. |
| **Message Queue Bar** | `frontend/src/components/chat/QueueBar.tsx` | Anchored directly above `InputBar.tsx` when prompts are queued during active streaming. | **Low Density**. Displays pills for pending user inquiries with cancel triggers. |
| **Thinking Indicator** | `frontend/src/components/chat/ThinkingIndicator.tsx` | Header of assistant `MessageBlock.tsx`. | **Medium Density**. Unsteady pulsing amber dot; caption timer ("Thought for 4.2s"); expandable accordion displaying step-by-step reasoning traces and intermediate subagent invocations. |
| **Prompt Minimap Navigator** | `frontend/src/components/chat/PromptNavigator.tsx` | Absolute positioned floating rail on right edge of chat feed container. | **Low Density**. Clickable vertical pip track allowing rapid jumping to previous user prompts in long sessions. |
| **Analog Film Grain Overlay** | `frontend/src/components/layout/FilmGrain.tsx` | Absolute fixed overlay across entire viewport (`fixed inset-0 pointer-events-none z-50`). | **Systemic Texture**. SVG `feTurbulence` filter with screen blend mode at 3.5% opacity. Load-bearing aesthetic requirement of the Darkroom Editorial system. |

---

### 1.3 Global Overlays & Modals

| Overlay Component | Component Path | Keyboard Shortcut & Trigger | Viewport & Layout Layer | Current Functionality & Content Density |
| :--- | :--- | :--- | :--- | :--- |
| **Command Palette** | `frontend/src/components/layout/CommandPalette.tsx` | `⌘K` / `Ctrl+K`; Sidebar Search trigger. | Centered modal dialog (`fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm`). Width: 640px. | **High Density**. Global quick switcher. Fuzzy search across Sessions, Projects, Navigation destinations, Model switches, and Layout reset actions. |
| **Keyboard Shortcuts Modal** | `frontend/src/components/layout/KeyboardShortcutsModal.tsx` | `⌘/` / `Ctrl+/`; Help trigger. | Centered modal dialog (`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm`). Width: 720px. | **Medium-High Density**. Categorized reference table for global shortcuts (`Navigation`, `Chat`, `Artifacts`, `Panels`) with in-place keybinding override recorder. |
| **Floating Audio Controller** | `frontend/src/components/chat/AudioController.tsx` | Triggered when playing TTS on any response block in `MessageBlock.tsx`. | Bottom-right floating pill (`fixed bottom-24 right-8 z-40`). | **Medium Density**. Mini timeline scrub bar, play/pause toggle, playback speed selector (`1.0x`, `1.25x`, `1.5x`, `2.0x`), volume, and animated Darkroom Amber waveform. |
| **Session Artifacts Bucket** | `frontend/src/routes/ChatPage.tsx` (Lines 370–435) | Header button "Artifacts (N)" in chat header bar. | Floating popover anchored to top-right of chat stream (`absolute right-6 top-1 mt-1 w-80 z-50`). | **Medium Density**. Quick-access drawer listing all artifacts generated in the active session with download and view buttons. |

---

## 2. Deep Dive: The 54% Split Contention (`ArtifactPanel.tsx`)

### 2.1 The Monolithic Right Pane
Currently, all dynamic artifacts, simulation tools, code inspections, and execution environments are compressed into a single component: `frontend/src/components/artifact/ArtifactPanel.tsx` (1,879 lines, 86 KB). 

`ArtifactPanel` allocates a fixed 3-tab switcher (`Preview`, `Code`, `Terminal`) at the top of the right pane:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📄 B-401_Creep_Analysis.py  [ASME-SEC-VIII]         ⬇ .DOCX  Export ▾   [×] │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ PREVIEW ]     [ CODE ]     [ TERMINAL ]              ( ) Dual Split      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CONTENT VIEWPORT (Exclusively displays ONLY ONE tab mode at a time)        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Visual Artifacts Competing for the Right Pane
The following heterogeneous industrial components are forced to contend for this single right pane:

1. **Interactive SVG P&ID Schematics & Simulation Sliders**:
   - `InteractivePidCanvas.tsx` (SVG pan/zoom, coordinate tagging, live equipment beacons).
   - `InteractivePhysicsCard.tsx` (Real-time temperature $300^\circ\text{C}-550^\circ\text{C}$ and pressure $10-35\text{ bar}$ sliders).
2. **ASME Section VIII Mathematical Proofs & KaTeX Equations**:
   - Rendered via `rehypeKatex` and `remarkMath` ($$t = \frac{P \cdot R}{S \cdot E - 0.6 \cdot P}$$), stress tensor tables, and Larson-Miller parameter graphs.
3. **Interactive Chart.js & Matplotlib/Seaborn Analytics**:
   - `InteractiveChartCard.tsx` and `InfographicsCard.tsx` (2D tube-bundle fouling heatmaps, multi-axis boiler stress radars, downtime financial stacked bars).
   - Matplotlib/Seaborn static image lightbox with raw data table flyouts.
4. **Multi-File Code Editors & Version Diff Viewers**:
   - Multi-file tab bar (`simulation.py`, `parameters.json`, `summary.md`).
   - Side-by-side and unified diff viewers comparing historical versions (`V.1 ⟷ V.3`).
5. **Sandbox Terminal Execution Logs**:
   - Subprocess execution runner displaying stdout, stderr, exit codes, and stdin prompt inputs (`handleRunInSandbox`).
6. **Publication Dossier Document Previews**:
   - Formatted Word/Markdown document sheet with pagination, headers, and export compilers (`.docx`, `.pdf`, `.latex`, `.html`).

### 2.3 Operational & Functional Failures Under Contention

In an industrial process plant, forcing these specialized views into an exclusive single-pane tab container leads to severe operational hazards:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CRITICAL OPERATIONAL FAILURE SCENARIOS UNDER 54% SPLIT CONTENTION           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Scenario A: P&ID Inspection vs. ASME Calculation Proof                      │
│ • Operator is reviewing an overpressure calculation for Relief Valve PRV-102│
│ • Problem: To view the KaTeX formula and allowable stress lookup table,     │
│   the operator must switch to "Preview" (Document mode).                    │
│ • Failure: The SVG P&ID schematic is hidden. The operator cannot visually   │
│   confirm whether PRV-102 is located upstream or downstream of bypass L-304.│
├─────────────────────────────────────────────────────────────────────────────┤
│ Scenario B: Simulation Parameter Adjustment vs. Subprocess Terminal Logs    │
│ • Engineer drags temperature slider from 380°C to 490°C to test creep limit.│
│ • Problem: The sandbox execution script crashes with a NumPy convergence     │
│   divergence error.                                                         │
│ • Failure: Because the user is on the "Preview" tab to drag the slider,     │
│   the "Terminal" tab is hidden. The engineer sees a frozen UI and has no    │
│   visibility into the Python traceback without clicking away from the model.│
├─────────────────────────────────────────────────────────────────────────────┤
│ Scenario C: Financial Impact Chart vs. Real-Time Equipment Telemetry        │
│ • Shift supervisor is evaluating a $240,000/hr crude unit downtime penalty  │
│   on a Chart.js stacked bar chart.                                          │
│ • Problem: A sudden high-high pressure alarm (`HH`) triggers on Boiler Drum │
│   B-401.                                                                    │
│ • Failure: The supervisor cannot view the telemetry curve and the financial │
│   cost curve simultaneously. The economic chart completely masks the DCS    │
│   alarm status, violating OISD-156 situational awareness protocols.         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Structural Deficiencies of the Binary 46%/54% Split

The legacy layout enforces a hardcoded binary flex container in `ChatPage.tsx`:
```tsx
// frontend/src/routes/ChatPage.tsx (Lines 168-182 and 557-575)
<motion.div animate={{ width: isArtifactOpen ? `${splitPercent}%` : "100%" }}>
  {/* Chat Stream Pane */}
</motion.div>

<div role="separator" onMouseDown={() => setIsDragging(true)} />

<motion.div animate={{ width: `${100 - splitPercent}%` }}>
  <ArtifactPanel artifact={activeArtifact} onClose={closeArtifact} />
</motion.div>
```

This structural architecture introduces four fundamental layout bottlenecks:

### 3.1 Display Resolution & Viewport Mismatch

```
1440px Laptop Baseline (Field Engineers)
┌───────────────────────────┬────────────────────────────┐
│ Chat Stream (662px)       │ Artifact Panel (778px)     │
│ • Input bar compressed    │ • P&ID SVG cut off         │
│ • Code lines wrap heavily │ • Heatmaps squished        │
└───────────────────────────┴────────────────────────────┘
❌ Severe horizontal cramping; both panes suffer from truncated content.

1920x1080 Control Room Console (Standard Industrial Workstation)
┌─────────────────────────────────┬──────────────────────────────────┐
│ Chat Stream (883px)             │ Artifact Panel (1037px)          │
│ • 45% empty margins in chat     │ • Adequate for single diagram;   │
│ • Excessive whitespace in feed  │   zero secondary panel support   │
└─────────────────────────────────┴──────────────────────────────────┘
❌ Inefficient space usage; vast unused margins while operators need 3+ panels.

2560x1440 / 3840x2160 Ultra-Wide DCS Consoles (Refinery Control Center)
┌───────────────────────────────────────┬────────────────────────────┐
│ Chat Stream (1177px - 1766px)         │ Artifact Panel (1383px+)   │
│ • Absurdly long message line-lengths  │ • Gigantic empty margins   │
│ • Eye strain traversing text lines    │ • Cannot split vertically  │
└───────────────────────────────────────┴────────────────────────────┘
❌ Catastrophic layout failure; unable to tile monitoring widgets across wide displays.
```

### 3.2 Lack of Nested Multi-Axis Splits
- **No Horizontal Splits**: The current architecture has zero capability to split the right pane horizontally (e.g., top 60% P&ID SVG diagram, bottom 40% Python terminal).
- **No Secondary Docking**: Users cannot dock a live telemetry monitor on the bottom while maintaining a side-by-side chat and code editor.
- **Tear-Off & Floating Windows**: Components cannot be popped out into floating windows or secondary monitor displays for dual-screen control rooms.

### 3.3 DOM Re-render & Layout Thrashing
- When dragging the splitter in `ChatPage.tsx`, the `splitPercent` state updates on every `mousemove` event at the root route level:
  ```tsx
  // ChatPage.tsx Line 72:
  const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
  setSplitPercent(clamped);
  ```
- This forces **the entire component tree**—including the chat stream (`MessageBlock` list, KaTeX renderers, markdown tables) and the right pane (`ArtifactPanel`, Monaco/Prism highlighters, Chart.js canvas)—to re-render synchronously on every mouse tick, causing noticeable frame drops below 30 FPS.

---

## 4. Design System Compliance Audit ("Darkroom Editorial")

An audit of current component styling against [`frontend/DESIGN.md`](file:///c:/Users/User/Desktop/SIH-26/SIH_26_WORKBENCH_AI/frontend/DESIGN.md) reveals several significant deviations that compromise the intended industrial aesthetic.

### 4.1 Color Palette & Token Drift

| Token Name | Prescribed Hex (`DESIGN.md`) | Current Implementation Status in Codebase | Compliance Rating | Required Corrective Action |
| :--- | :--- | :--- | :---: | :--- |
| **Background Deep** | `#181410` | Implemented in `tailwind.config.ts` as `background: '#181410'`. | ✅ **Compliant** | Preserve as baseline body background. |
| **Surface Elevation 1** | `#211B15` | Implemented as `surface-1: '#211B15'`. Used in cards and sidebars. | ✅ **Compliant** | Retain for docked panel backgrounds. |
| **Surface Elevation 2** | `#2A2219` | Implemented as `surface-2: '#2A2219'`. Used in input bars and modals. | ✅ **Compliant** | Retain for floating popovers and active inputs. |
| **Surface Elevation 3** | `#332A1F` | **Missing**. Not defined in `tailwind.config.ts`. Developers are using ad-hoc `bg-surface-2/60` or arbitrary hex `#0E0D0B`. | ❌ **Non-Compliant** | Formally add `surface-3: '#332A1F'` for active panel tab headers. |
| **Hairline Border** | `#3D3226` | Implemented as `border: '#3D3226'`. | ✅ **Compliant** | Ensure 1px border is strictly enforced without soft drop shadows. |
| **Darkroom Amber** | `#D97A3F` | Implemented as `accent-primary: '#D97A3F'`. | ⚠️ **Overused** | `DESIGN.md` mandates Amber stay under **5–10%** surface area. Currently used excessively on multiple buttons, borders, and badges simultaneously. |
| **Safelight Red** | `#B8443A` | Implemented as `accent-secondary: '#B8443A'`. | ⚠️ **Inconsistent** | Some components (e.g. `ArtifactPanel.tsx` line 1208) use Tailwind `text-[#E54D2E]` or `bg-red-500/10` instead of the tokenized Safelight Red. |
| **Safety Emerald** | `#10B981` | Mixed use: Tailwind `emerald-300`, `green-400`, `green-500/10` throughout `ArtifactPanel.tsx` and `StatusBar`. | ❌ **Non-Compliant** | Standardize all positive/verified states to tokenized Safety Emerald (`#10B981`). |
| **Cool Fluid / Air Cyan** | `#38BDF8` | Hardcoded `text-blue-400` in DOCX export buttons and fluid tags. | ❌ **Non-Compliant** | Replace generic blue with `accent-cyan: '#38BDF8'`. |

---

### 4.2 Typography Hierarchy Audit

```
Prescribed Hierarchy (frontend/DESIGN.md Section 3):
• Display / Headings: Fraunces (Warm serif, soft optical size)
• Body / UI Labels: General Sans or Söhne (High legibility, leading 1.65)
• Code / Monospace: JetBrains Mono (Strictly for code, numbers, and tags)
• Tabular Numerals: font-feature-settings: "tnum" across all telemetry and metrics
```

#### Identified Deviations in Codebase:
1. **Header Font Fallbacks**: Multiple components use generic sans-serif fonts (`font-semibold text-text-primary`) for panel headers instead of the editorial `font-display` (Fraunces).
2. **Missing Tabular Numerals**: Timers, token counts, and GPU telemetry in `ThinkingIndicator.tsx` and `StatusBar.tsx` lack `tabular-nums` / `font-feature-settings: "tnum"`, causing visual jitter during live streaming.
3. **Leading Inconsistency**: Chat message body text occasionally uses standard Tailwind `leading-normal` instead of the mandated `leading-[1.65]`, reducing legibility during lengthy technical explanations.

---

### 4.3 Visual Hygiene & Geometry Audit

1. **Unwanted Drop Shadows**:
   - `DESIGN.md` Section 1 strictly states: *"Panel headers sit on a hairline rule, not a shadow... sharp 4px radius, no soft drop shadows"*.
   - **Violation**: `ChatPage.tsx` line 373 uses `shadow-2xl`; `ArtifactPanel.tsx` line 698 uses `shadow-xl`. These must be replaced with crisp 1px hairline borders (`border border-border`) and hard 1px offset rules.
2. **Non-Conforming Border Radii**:
   - `DESIGN.md` Section 1 mandates: `4px` for cards/inputs; `2px` for buttons; `9999px` strictly for status pills.
   - **Violation**: Buttons throughout `ArtifactPanel.tsx` use `rounded-[3px]`, `rounded`, or `rounded-md`. These must be standardized to `rounded-[2px]`.
3. **Film Grain Penetration**:
   - In `ArtifactPanel.tsx` (lines 592–604), a secondary inline SVG noise filter (`#materialize-grain`) was added on top of the global `FilmGrain.tsx` component, resulting in double-grain artifacts and visual muddiness during panel opening animations.

---

## 5. Modularization Matrix (Input for Milestone M1)

To transition from the rigid split into an extensible, multi-pane command center, **100% of the monolithic visual widgets must be decoupled into independent docking panels**.

The following matrix establishes the formal panel registry, default docking zones, dimension constraints, and supported layout modes for **Milestone M1**:

| Widget Name | Current Component Location | Proposed Panel ID | Recommended Default Zone | Min Dimensions (W × H) | Supported Layout Modes |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Conversational Stream & Monologue** | `frontend/src/routes/ChatPage.tsx`, `frontend/src/components/chat/MessageBlock.tsx` | `panel:chat_stream` | **Primary Work Area** (Left/Center Zone B) | `360px × 400px` | Docked, Split Vertical, Fullscreen |
| **Universal Input & Slash Command Tray** | `frontend/src/components/chat/InputBar.tsx`, `QueueBar.tsx` | `panel:input_tray` | **Primary Work Area** (Pinned Bottom Zone B) | `360px × 80px` | Docked (Pinned to Chat Stream) |
| **Spatial P&ID Schematic Canvas** | `frontend/src/components/chat/InteractivePidCanvas.tsx` | `panel:pid_canvas` | **Modular Workspace** (Right/Center Zone C) | `480px × 360px` | Docked, Split Vertical, Split Horizontal, Fullscreen, Pop-out Window |
| **ASME Physics & Simulation Sliders** | `frontend/src/components/chat/InteractivePhysicsCard.tsx` | `panel:physics_simulation` | **Modular Workspace** (Right/Center Zone C) | `400px × 320px` | Docked, Split Horizontal, Floating Overlay |
| **Interactive Visual Analytics Engine** | `frontend/src/components/chat/InteractiveChartCard.tsx`, `InfographicsCard.tsx` | `panel:visual_analytics` | **Modular Workspace** (Right/Center Zone C) | `450px × 320px` | Docked, Split Vertical, Split Horizontal, Fullscreen |
| **Multi-File Code Editor & Diff Viewer** | `frontend/src/components/artifact/ArtifactPanel.tsx` (Code & Diff branches) | `panel:code_editor` | **Modular Workspace** (Right/Center Zone C) | `420px × 350px` | Docked, Split Vertical, Split Horizontal, Fullscreen |
| **Enclave Sandbox Terminal & Runner** | `frontend/src/components/artifact/ArtifactPanel.tsx` (Terminal branch) | `panel:sandbox_terminal` | **Collapsible Drawer** (Bottom Zone D) | `320px × 180px` | Docked, Split Horizontal, Drawer Bottom, Fullscreen |
| **Hardware & Token Telemetry Bar** | `frontend/src/components/chat/ThinkingIndicator.tsx` (Telemetry fields) | `panel:telemetry_bar` | **Activity Bar / Status Tray** (Bottom Zone D / Rail) | `240px × 32px` | Docked Status Strip, Drawer Bottom |
| **Human-In-The-Loop Approval Gateway** | `frontend/src/components/chat/MessageBlock.tsx` (McpApproval branch) | `panel:hitl_modal` | **Global Overlay** (Viewport Center) | `520px × 360px` | Floating Modal, Docked Alert Drawer |
| **Publication Dossier & Document Viewer** | `frontend/src/components/artifact/ArtifactPanel.tsx` (Document branch) | `panel:document_viewer` | **Modular Workspace** (Right/Center Zone C) | `440px × 400px` | Docked, Split Vertical, Fullscreen |
| **Ingested Knowledge & SOP Grounding Hub** | `frontend/src/routes/CompanyDocsPage.tsx` | `panel:knowledge_hub` | **Activity Bar / Drawer** (Secondary Drawer Zone A) | `380px × 400px` | Docked Side Drawer, Fullscreen Route |

---

## 6. Architectural Recommendations for Phase 1 Milestone M1

1. **Deprecate the Hardcoded 46%/54% Clamp**: Remove `splitPercent` state from `ChatPage.tsx` and replace the container with a multi-pane layout manager (e.g., `dockview` or custom virtualized flex splitter).
2. **Break Apart `ArtifactPanel.tsx`**: Decompose the 1,879-line monolith into dedicated panel implementations (`PIDCanvasPanel.tsx`, `VisualAnalyticsPanel.tsx`, `CodeEditorPanel.tsx`, `SandboxTerminalPanel.tsx`, `DocumentViewerPanel.tsx`) under `frontend/src/components/panels/`.
3. **Decouple Layout State from Chat State**: Move panel split percentages and active tab descriptors into a dedicated `PanelLayoutStore.ts` so splitter dragging does not trigger re-renders in `MessageBlock` or `InputBar`.
4. **Enforce Darkroom Editorial Tokens**: Clean up soft shadows, un-tokenized red/green colors, and non-conforming button radii to achieve 100% compliance with `frontend/DESIGN.md`.
