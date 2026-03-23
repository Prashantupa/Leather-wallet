# Leather-wallet
Vibe coded with Claude
---

# Skeuomorphic Leather Wallet — UI Prompt

**UI COMPONENT PROMPT DOCUMENT**
**INTERACTIVE · SKEUOMORPHIC · PREMIUM**

---

## LEATHER WALLET — Interactive Card Selector

**Tech:** React · Vanilla JS Drag · CSS Spring Physics · Skeuomorphic Design
**Stack:** React 18 · Native drag events · CSS cubic-bezier animations · 3 bank cards

**Interaction hint:** HOLD & DRAG CARD UP ↑

---

# DESIGN REQUIREMENTS

## 01 — BACKGROUND

* Dark chocolate radial-gradient background
* Subtle warm radial lighting centered behind the wallet
* Minimal, premium fintech feel — no distracting UI chrome
* Color:
  `radial-gradient(ellipse 78% 68% at 50% 44%, #2c1608 → #0b0503)`

---

## 02 — WALLET BODY

* Centered on screen
* Size: **320px width × 355px height**
* Multi-stop leather gradient:
  `#6a3316 → #3b1c08 → #6a3316`
* Heavy drop shadow:
  `0 52px 120px rgba(0,0,0,0.88)`
* Rounded corners: **28px border-radius**
* Inner shadow at top opening to simulate depth
* Dashed stitching border:
  `1.5px dashed rgba(192,124,46,0.30)` inset 9px
* SVG **feTurbulence noise overlay** (4% opacity) for leather texture

---

## 03 — CARD STACK (3 CARDS)

| Position | Bank       | Color         | Z-Index | Visible Strip |
| -------- | ---------- | ------------- | ------- | ------------- |
| Front    | ICICI BANK | Red gradient  | z:25    | 70px          |
| Middle   | AXIS BANK  | Navy gradient | z:15    | 22px          |
| Back     | HDFC BANK  | Blue gradient | z:8     | 22px          |

Stack offsets:

* Back: y = −44px
* Middle: y = −22px
* Front: y = 0

Scale cascade:

* Front: 1.000
* Middle: 0.962
* Back: 0.924

Brightness decreases with depth.

---

## 04 — CARD FACE ELEMENTS

* EMV chip (top-left): gold gradient chip with circuit grid
* Bank name (top-right): Courier New, 11.5px, letterSpacing 2.3
* Card number (center): masked format
  Example: `4291 8830 1174 4291`
* Card holder + expiry (bottom): labels in 8px uppercase
* Network logo (bottom-right): VISA or Mastercard
* Gloss sheen overlay for realistic plastic card look
* Diagonal shimmer stripe (−11°)
* Contactless symbol in top-right

---

## 05 — PAY BUTTON

* Position: bottom inside wallet pocket
* Style:

  * Dark leather gradient
  * 1.5px gold border
  * 50px pill-shape radius
* Shadow:

  * Inner pressed shadow
  * Outer amber glow
* States:

  * PAY NOW
  * PROCESSING…
  * ✓ PAYMENT SENT
* Hover: scale 1.06
* Active: scale 0.94
* Transition: 0.44s ease

---

# INTERACTION & TECHNICAL SPEC

## 06 — CARD CLIPPING PHYSICS

Cards are **not clipped using overflow:hidden**.
Instead, z-index layering creates the wallet illusion.

* Cards docked → below pocket overlay
* Dragging card → moves above pocket overlay
* Breakout threshold: drag above −75px → card pops out

---

## 07 — DRAG MECHANICS

* Works with mouse + touch
* Leather resistance when card is inside wallet
* Free movement after breakout
* 3D tilt based on drag velocity
* Card slightly scales when picked up
* Shadow deepens during drag

---

## 08 — CARD REORDER LOGIC

If user drags:

* Up > 105px
* Sideways > 160px
* Fast flick upward
* Fast flick sideways

→ Card moves to the back and stack reorders.

---

## 09 — ANIMATION SYSTEM

* Entry animation: wallet scales in
* Spring snap-back animation using cubic-bezier
* Cards slide smoothly when reordered
* Hint bounce animation
* Dot indicators animate width + opacity

---

## 10 — TECH STACK

* React 18 (CDN)
* Babel standalone
* No animation libraries
* Custom drag hook (~80 lines)
* CSS keyframes + cubic-bezier animations
* SVG noise for leather texture
