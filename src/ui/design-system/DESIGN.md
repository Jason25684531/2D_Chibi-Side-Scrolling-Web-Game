# ROG FUTURE GAMER

## Visual Identity
Target: cyberpunk industrial laboratory with anime chibi characters. Current integration preserves supplied full-proportion fantasy characters; chibi visual alignment remains partial. Dark navy dominates; red is reserved for primary actions and mission completion. Blue denotes system information, gold rewards and rank, purple special equipment. No global multicolor glow.

## Color & Semantic Tokens
`tokens.css` is the runtime authority. Background #060B1C, surface #111B32, panel #0B1428, action #FF284B, information #35B6FF, special #AD54FF, reward #FFC75A, text #F5F8FF, secondary #A7B7D1. Check rendered text contrast (4.5:1 normal) over its actual surface.

## Typography
Real text, never baked-in screenshots. Segoe UI / Microsoft JhengHei system stack; tabular numerals. 1920px design scale: body30, note26, action44, score48, timer96, headline64–80. Compact result rows may use26. Long names ellipsize with full text available through title; user text always escaped.

## Layout & Safe Area
Design1920×1080; x96–1824, y54–1026. Existing game960×540 remains unchanged. Uniform fit with letterboxing at16:10. Top HUD y54–214; three separated islands leave world visible. Combo left upper; power left lower. No scroll-dependent primary actions.

## Components
Existing `components.ts`: Button, Panel, Avatar, Badge, Stat Row, Progress, HUD. StationUI composes Character Card, Tutorial Prompt, Result Card, Ranking Row, Modal and Status. Reuse functions and CSS, no parallel component framework.

## Interaction States
Default dark surface; hover lighter border; keyboard focus strong red outline plus background; press translateY2; disabled muted surface without accent. Selected card uses red stripe and selected text; locked slot disabled. Loader uses native progress and error text. Modal traps Tab/directional focus and restores it on return. Name input owns keyboard/IME.

## Motion & Transitions
Quick80–160ms; HUD150–300ms; panels200–450ms; clear500–900ms. Animate transform/opacity only. Runtime values update immediately, never wait for animation. Reduced motion removes displacement and pulses. No continuous flashing.

## Accessibility & Responsiveness
Native buttons, labeled input, clear focused/disabled states, Chinese support, visible text for warnings. Gameplay overlay ignores pointer events except controls. Frozen menu pauses existing run. Viewport changes do not alter collisions. Avoid constant live-region announcements for timer ticks.

## Asset Usage Rules
Reuse supplied Aria/Kael/Riven and dog without recoloring/distorting. Fourth character locked. Source images and atlases stay intact. Independent placeholders must appear in manifest; no generated official logo, no full reference screenshot used as UI/world. UI iconography may use editable SVG geometry. Parallax belongs behind collidable terrain.

## Prototype and QA
HUD prototype must exercise normal/low-time/score/combo/Ally/Laptop/empty states without writing results. Compare seven references with captured screens. Build and real-browser interaction gates at each milestone. Native confirm_brief returned Transport closed; no native generation/refine/migration succeeded. This iteration used the authorized local workflow. See docs/rog-uiux-report.md for actual evidence.
