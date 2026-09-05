# Design System & UI Specification: AI Artifact Studio
## Aesthetic Direction: "Darkroom Editorial"

**Concept:** A photographer's darkroom crossed with a print magazine layout. Warm near-black instead of cold blue-black, film-grain texture instead of flat gradients, a rust/amber accent instead of the ubiquitous AI-product indigo, and a serif display face that gives the product a printed, authored feel rather than a generic SaaS one. Dense and technical where it needs to be (code, data), warm and editorial everywhere else.

**Differentiator:** The interface feels *made*, not templated — like reading a well-typeset technical journal that happens to be interactive. The grain overlay and warm blacks are the thing people remember.

---

## 1. Global Layout Dimensions
- **Viewport:** Desktop-first (1440px minimum target baseline).
- **Sidebar Width:** Fixed 280px (collapsible to 0px / hidden).
- **Workspace:** Flex 1.
- **Split-Screen Ratio:**
  - Chat Left Pane: 46% (min 480px).
  - Artifact Right Pane: 54% (collapsible via close button; asymmetric on purpose — the artifact is the star, not an afterthought).
- **Global Border Radius:**
  - Inputs & Cards: `4px` (sharp, editorial — not the soft `rounded-xl` default).
  - Buttons & Pills: `2px` for primary actions, `9999px` only for status/tag pills.
- **Grid discipline:** Content aligns to a visible 8px baseline rhythm; panel headers sit on a hairline rule, not a shadow.

## 2. Color Palette & Theming (Dark Mode Default)
- **Background Deep:** `#181410` (warm near-black, like underexposed film — not blue-black).
- **Surface Elevation 1 (Sidebar/Cards):** `#211B15`.
- **Surface Elevation 2 (Input bar / Modals):** `#2A2219`.
- **Border / Divider Lines:** `#3D3226` (warm brown-grey hairline, not cool grey).
- **Primary Accent — "Darkroom Amber":** `#D97A3F` (burnt rust/amber — used sparingly: active states, primary CTA, cursor, selection highlight; keep under ~5-10% of any screen).
- **Secondary Accent — "Safelight Red":** `#B8443A` (used only for destructive/alert states — evokes literal darkroom safelight).
- **Text Hierarchy:**
  - Primary Headings / Prompts: `#F5EFE6` (warm ivory, not pure white).
  - Body Text / Chat Stream: `#D8CDBC`.
  - Faded / Reasoning Text: `#9C8E78`.
  - Subtle Placeholders: `#6B5F4E`.
- **Texture:** A fixed, low-opacity (3–4%) film-grain noise overlay sits above the base background on every screen — this is load-bearing to the aesthetic, not decorative flourish. No gradient meshes; grain + warm flat color does the atmospheric work instead.

## 3. Typography
- **Display / Headings:** Fraunces (variable, "soft" optical size at large sizes). Never a grotesk sans for headings.
- **Body / UI Text:** Söhne or General Sans. Explicitly avoid Inter, Roboto, Arial, and system-ui.
- **Code / Monospace:** JetBrains Mono, strictly inside Code tabs and inline code.
- **Scale:**
  - Greetings / Hero: 34px, Fraunces Medium, slightly negative letter-spacing.
  - Panel Headers: 14px, uppercase, wide letter-spacing (0.08em), Söhne Medium.
  - Body / Messages: 15px, Line height 1.65.
  - Reasoning / Meta text: 12px, Söhne Regular, italic.

## 4. Component Inventory

### A. Left Sidebar
- Top: "New Chat" — text link with a small `+`, amber underline on hover, not a filled button. Deliberately not a filled/rounded button — that's the generic pattern every AI chat sidebar uses.
- **Search** — text-label trigger ("Search chats · ⌘K") opening the Command Palette (4F).
- **Navigation destinations** — table-of-contents-style list (thin rule under each entry, no icons): Chats, Projects, Library. Model selection lives in the input bar dropdown, not the sidebar.
- **Pinned Projects** — running head ("PINNED PROJECTS"), same row style as Projects.
- **Pinned Chats** — running head ("PINNED CHATS"), small amber pin glyph beside each entry.
- **Recents** — plain scrollable list of single-line truncated session titles under "RECENTS," no timestamps/serial numbers cluttering rows.
- Bottom: User avatar (small square, not circular), name, Settings as a text label.

### B. Universal Input Bar
- Floating container, Elevation 2 surface, hairline border, hard 1px offset shadow (no soft drop shadow).
- **Context indicator** strip above input: small caps ("IN SCOPE: file.tsx, +2 files"), amber dot per file, dismissible per-file.
- **Slash commands** (`/explain`, `/refactor`, `/test`, `/fix`) — `/` opens a compact TOC-style dropdown.
- Elements (L→R): Model dropdown as small-caps label ("PRO REASONING"); expanding text input with serif placeholder; paperclip icon (opens Tool & Attachment popover); mic icon; send button as solid amber square with arrow-up (becomes Stop square while streaming).
- **Tool & Attachment popover**: elevated card above input bar, Elevation 2, hairline border, small radius exception ok. Rows: "Add photos & files," tool toggles ("Web search," "Code," "Deep research" with amber checkmark when active), context sources ("Chat with Files," "MCP," "Projects" with right chevron). Hovered/active row = thin amber left rule, not filled highlight.

### C. Thinking / Reasoning Indicator
- Italic caption meta text — "Thought for 6 seconds" — single amber dot.
- Expandable: Elevation-1 panel, thin left amber rule, monospace reasoning text. Must show real intermediate steps, not placeholder text.

### D. Inline Artifact Card (in Chat Feed)
- Bordered card, sharp 4px radius, hairline border — contact-sheet frame styling.
- Monospace filename title; italic caption subtext ("Click to view preview").
- Inline diff preview when editing existing code: additions underlined amber, removals struck through in Safelight Red, expandable.
- Right action: amber text link "Open →."

### E. Artifact Side Panel (Split View)
- Top bar: Fraunces title + small amber-outlined badge; underline-style tab switcher (Preview | Code | Terminal); quiet italic "Explain" link; action tray (Copy/Download/Pop-out) as text labels; typographic `×` close button.
- Multi-file tabs below top bar when relevant (monospace filenames, active underlined amber), flat not nested.
- Main body: preview container on slightly lighter warm surface, 1px hairline border.
- Bottom bar: version tracker as small-caps labels (V.1 V.2 V.3), active underlined amber. Clicking a non-active version opens a diff against current.

### F. Command Palette (⌘K)
- Centered Elevation 2 modal over dimmed-but-grain-visible backdrop.
- Serif input ("Jump to a chat, project, or command…"), results grouped under small-caps heads (CHATS/PROJECTS/COMMANDS).
- Selected row: thin amber left rule.

---

## 5. Screen State Definitions

### Screen 1: Zero State (Welcome)
- Sidebar visible. Center: Fraunces header ("Welcome back, [Name]" or a conversational alternative, kept in serif/editorial voice — no mascot, orb, or icon anchor); italic caption subheader; 3–4 index-card suggestion cards in a slightly asymmetric row. Input anchored at bottom, grain visible behind it.

### Screen 2: Active Chat State
- Sidebar visible. User prompt = flat rectangle on Elevation 1, right-aligned, hairline top rule (not a chat bubble). Model response: caption-style thinking indicator, Söhne body text, generous leading. Inline Artifact Card per 4D. Input pinned to bottom.

### Screen 3: Artifact Split View State
- Sidebar auto-collapses. Left: narrower chat thread (46%). Right: full Artifact panel (54%) per 4E.

### Screen 4: Chats Overview
- Sidebar visible, "Chats" active. Fraunces header ("Chats"), italic subheader. Filter/search bar (small-caps, no filled box). TOC-style list: chat title (serif), one-line italic preview, small-caps metadata, hairline rules, pin glyph at row edge. Clicking opens Screen 2. Deeper/richer than sidebar Recents.

---

## 6. Interaction & Motion

**Governing principle:** One deliberate signature moment, everything else quick and precise. Default easing `ease-out`; avoid bouncy/elastic/spring-overshoot everywhere except the one noted exception.

### Signature Moment — Artifact Materialization
Trigger: artifact finishes generating, side panel opens/updates. Sequence (~550ms total): (1) panel border draws in left-to-right then top-to-bottom (~150ms); (2) panel surface fades in behind completed border (~150ms, overlapping tail of 1); (3) content fades up 8px with brief grain-opacity flicker (3.5%→~8% for two frames, settles back). This is the one place a multi-step animation is justified — don't reuse it elsewhere.

### Micro-interactions
- Send button: amber flash + scale to 0.94→1 (~120ms); morphs (not swaps) into Stop square when streaming.
- Thinking dot: pulses on uneven rhythm (±15% interval variance), not a perfect loop.
- Sidebar/text links: amber underline draws left-to-right on hover (~150ms), retracts on hover-out. Never color-only hover.
- Version pills/tabs: active underline slides to new selection (~180ms ease-out) — same motif for multi-file tabs and Preview/Code/Terminal switcher.
- Context indicator dots: fade + collapse width simultaneously on dismiss (~150ms).
- Command palette: modal scales 0.98→1 with opacity fade (~150ms); backdrop dims, grain stays visible.

### Screen-level transitions
- Zero State → Active Chat: suggestion cards collapse/fade, staggered last-to-first (~40ms stagger).
- Chat → Split View: gentle spring on width change (the one spring exception — overshoot under 2%).
- Inline Artifact Card → Open: brief outward "lift" (2px translateY, shadow increase) before panel animates in.

### Timing reference
- Standard UI transitions: 150–250ms, ease-out.
- Layout-weight transitions: 300–400ms, gentle spring, minimal overshoot.
- Signature artifact-materialization sequence: ~550ms total, choreographed in stages.

### What NOT to animate
- No fake-typewriter reveal unless genuine token streaming.
- No bouncy/elastic easing outside the one spring exception.
- No looping ambient animation — the grain texture is the product's ambient life.

---

## Implementation Notes
- Grain overlay: fixed, screen-blend-mode SVG noise at ~3.5% opacity across every screen — don't skip it, it's load-bearing.
- Icon-light throughout: typography (small caps labels, italic captions, serif headers) carries hierarchy, not icon decoration.
- Sharp edges + hairline borders + one hard offset shadow on the input bar is the visual signature — resist rounding corners or adding soft shadows by default.
- Amber (`#D97A3F`) is rare and intentional. If it's showing up on more than ~5-10% of any screen, pull it back.
- All sample/demo content must read as genuine general-purpose software development work (API refactors, React components, database schemas, data pipelines) — never photography/darkroom-literal content. The aesthetic is a skin; the product is a coding assistant.
- No invented decorative meta-text/status badges that don't correspond to a real feature (no "ONLINE · READY," archival jargon, fake catalog numbers, etc.).
