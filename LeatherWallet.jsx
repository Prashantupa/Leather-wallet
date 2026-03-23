/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  LEATHER WALLET  —  Interactive Card Selector                ║
 * ║  React + Framer Motion                                       ║
 * ╠═══════════════════════════════════════════════════════════════╣
 * ║                                                               ║
 * ║  CLIPPING PHYSICS (how cards appear tucked inside wallet):    ║
 * ║  ─────────────────────────────────────────────────────────── ║
 * ║  Cards are absolutely positioned within the wallet body.     ║
 * ║  Their tops are visible; their bottoms extend downward.      ║
 * ║                                                               ║
 * ║  A "pocket overlay" div sits at z:30 (above all cards).      ║
 * ║  This overlay starts at y=94px and fills the wallet bottom.  ║
 * ║  It visually COVERS the lower ~65% of every card.            ║
 * ║                                                               ║
 * ║  Visible zone (above pocket):  y = 0  → y = 94px             ║
 * ║  Hidden zone  (below pocket):  y = 94px → wallet bottom      ║
 * ║                                                               ║
 * ║  At rest, each card shows only its top strip:                ║
 * ║    Back   card top at y=14 → 80px visible (but covered by ↓) ║
 * ║    Middle card top at y=24 → 70px visible (but covered by ↓) ║
 * ║    Front  card top at y=34 → 60px visible  ← user sees this  ║
 * ║                                                               ║
 * ║  DRAG REVEAL (gradual):                                      ║
 * ║  As front card moves up by X pixels:                         ║
 * ║    Visible height = 60 + X                                   ║
 * ║    Full reveal at X = 112px  (card bottom clears pocket)     ║
 * ║                                                               ║
 * ║  POINTER EVENTS:                                             ║
 * ║  Pocket overlay → pointer-events: none                       ║
 * ║  PayButton inside it → pointer-events: auto  (re-enabled)    ║
 * ║                                                               ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useVelocity,
  animate,
  AnimatePresence,
} from "framer-motion";

// ─── Layout constants ──────────────────────────────────────────────────────────
const WALLET_W      = 320;   // wallet total width
const WALLET_H      = 272;   // wallet total height  
const CARD_PAD_H    = 16;    // horizontal inset for cards inside wallet
const CARD_BASE_TOP = 34;    // CSS top (px from wallet top) shared by ALL cards
const POCKET_Y      = 94;    // y from wallet top where pocket overlay begins
                              // → front card shows: 94 - 34 = 60px above pocket

// Stack y-offsets applied via transform (from CARD_BASE_TOP):
//   front  (pos 0): y= 0   → card top in wallet = 34px
//   middle (pos 1): y=-10  → card top in wallet = 24px (10px higher, peeks above front)
//   back   (pos 2): y=-20  → card top in wallet = 14px (20px higher, peeks above middle)
const STACK_Y       = [0, -10, -20];
const STACK_Z       = [25, 15, 8];       // z-index per stack position
const STACK_SCALE   = [1.00, 0.965, 0.930];
const STACK_BRIGHT  = [1.00, 0.800, 0.620];

// Shuffle threshold: drag front card UP by this much → reorder
// Full reveal = (CARD_BASE_TOP + CARD_H) - POCKET_Y = (34 + 172) - 94 = 112px
// We shuffle slightly before full reveal for snappier UX
const SHUFFLE_DRAG_UP   = 100;
const SHUFFLE_DRAG_SIDE = 155;
const SHUFFLE_VEL_UP    = -580;
const SHUFFLE_VEL_SIDE  = 780;

// ─── Card data ─────────────────────────────────────────────────────────────────
const CARDS = [
  {
    id: "icici",
    bank: "ICICI BANK",
    number: "4291  8830  1174  4291",
    holder: "ARYAN MEHTA",
    expiry: "08 / 27",
    network: "VISA",
    // Warm orange-red matching reference image
    gradient: "linear-gradient(140deg, #ad2e08 0%, #c93d10 20%, #e05520 50%, #ec6820 75%, #d94510 100%)",
    gloss:    "rgba(255, 145, 80, 0.14)",
    chipGlow: "#fed87a",
    textDim:  "rgba(255, 195, 150, 0.60)",
  },
  {
    id: "axis",
    bank: "AXIS BANK",
    number: "7803  4421  9902  7803",
    holder: "ARYAN MEHTA",
    expiry: "03 / 26",
    network: "MC",
    // Deep navy blue
    gradient: "linear-gradient(140deg, #0c1525 0%, #172240 25%, #1c3565 55%, #1d3d78 100%)",
    gloss:    "rgba(70, 125, 255, 0.11)",
    chipGlow: "#90c2ff",
    textDim:  "rgba(148, 192, 255, 0.55)",
  },
  {
    id: "hdfc",
    bank: "HDFC BANK",
    number: "5514  2209  6671  5514",
    holder: "ARYAN MEHTA",
    expiry: "11 / 28",
    network: "VISA",
    // Royal blue
    gradient: "linear-gradient(140deg, #1545b0 0%, #1c58cc 25%, #2d70e8 55%, #3e88ff 100%)",
    gloss:    "rgba(70, 155, 255, 0.14)",
    chipGlow: "#b8d8ff",
    textDim:  "rgba(148, 205, 255, 0.58)",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EMV CHIP
// ─────────────────────────────────────────────────────────────────────────────
function Chip() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 46,
        height: 35,
        borderRadius: 7,
        flexShrink: 0,
        background:
          "linear-gradient(135deg, #fef08a 0%, #ca8a04 26%, #fde047 50%, #a16207 74%, #fefce8 100%)",
        boxShadow:
          "inset 0 1.5px 3px rgba(255,255,255,0.55), inset 0 -1px 2px rgba(0,0,0,0.32), 0 3px 8px rgba(0,0,0,0.5)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Horizontal circuit traces */}
      {[28, 52, 76].map((t) => (
        <div
          key={t}
          style={{
            position: "absolute",
            top: `${t}%`,
            left: 0,
            right: 0,
            height: 1,
            background: "rgba(70, 44, 0, 0.22)",
          }}
        />
      ))}
      {/* Vertical dividers */}
      {[36, 64].map((l) => (
        <div
          key={l}
          style={{
            position: "absolute",
            left: `${l}%`,
            top: 0,
            bottom: 0,
            width: 1,
            background: "rgba(70, 44, 0, 0.18)",
          }}
        />
      ))}
      {/* Centre contact pad */}
      <div
        style={{
          position: "absolute",
          inset: "24% 18%",
          borderRadius: 3,
          background: "rgba(145, 90, 0, 0.12)",
          border: "0.5px solid rgba(110, 72, 0, 0.18)",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NETWORK LOGO  (VISA or Mastercard)
// ─────────────────────────────────────────────────────────────────────────────
function NetworkLogo({ type }) {
  if (type === "VISA") {
    return (
      <span
        style={{
          fontFamily: "'Times New Roman', Times, serif",
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: 23,
          letterSpacing: -0.5,
          color: "rgba(255,255,255,0.84)",
          textShadow: "0 1px 5px rgba(0,0,0,0.5)",
          userSelect: "none",
        }}
      >
        VISA
      </span>
    );
  }
  // Mastercard
  return (
    <div style={{ display: "flex", alignItems: "center", position: "relative", width: 40, height: 26 }}>
      <div style={{ width: 25, height: 25, borderRadius: "50%", background: "#eb001b", opacity: 0.87, position: "absolute", left: 0 }} />
      <div style={{ width: 25, height: 25, borderRadius: "50%", background: "#f79e1b", opacity: 0.87, position: "absolute", left: 15 }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD FACE
// ─────────────────────────────────────────────────────────────────────────────
function CardFace({ card, raised }) {
  return (
    <div
      style={{
        width: "100%",
        height: 172,
        borderRadius: 20,
        background: card.gradient,
        padding: "17px 20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
        WebkitUserSelect: "none",
        // Shadow deepens when card is lifted
        boxShadow: raised
          ? "0 28px 65px rgba(0,0,0,0.68), 0 10px 26px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.20)"
          : "0 6px 20px rgba(0,0,0,0.44), inset 0 1px 0 rgba(255,255,255,0.12)",
        transition: "box-shadow 0.22s ease",
      }}
    >
      {/* Top gloss sheen */}
      <div
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: "52%",
          background: `linear-gradient(180deg, ${card.gloss} 0%, rgba(255,255,255,0.02) 68%, transparent 100%)`,
          borderRadius: "20px 20px 55% 55% / 20px 20px 26px 26px",
          pointerEvents: "none",
        }}
      />
      {/* Diagonal shimmer streak */}
      <div
        style={{
          position: "absolute",
          top: "34%", left: -28, right: -28,
          height: 30,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.065) 38%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.065) 62%, transparent 100%)",
          transform: "rotate(-11deg)",
          pointerEvents: "none",
        }}
      />
      {/* Contactless waves (top-right corner) */}
      <div
        style={{
          position: "absolute",
          top: 15, right: 50,
          color: card.chipGlow,
          fontSize: 14,
          letterSpacing: -4,
          opacity: 0.48,
          transform: "rotate(90deg)",
          pointerEvents: "none",
        }}
      >
        )))
      </div>

      {/* ── ROW 1: Chip + Bank Name ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, zIndex: 1 }}>
        <Chip />
        <div style={{ flex: 1 }} />
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 800,
            letterSpacing: 2.3,
            color: "rgba(255,255,255,0.90)",
            fontFamily: "'Courier New', Courier, monospace",
            textShadow: "0 1px 5px rgba(0,0,0,0.58)",
          }}
        >
          {card.bank}
        </div>
      </div>

      {/* ── ROW 2: Card Number ── */}
      <div
        style={{
          fontSize: 14.5,
          fontFamily: "'Courier New', Courier, monospace",
          color: "rgba(255,255,255,0.84)",
          letterSpacing: 3.5,
          textShadow: "0 1px 6px rgba(0,0,0,0.54)",
          zIndex: 1,
        }}
      >
        {card.number}
      </div>

      {/* ── ROW 3: Holder / Expiry / Network ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", zIndex: 1 }}>
        <div>
          <div
            style={{
              fontSize: 8,
              color: card.textDim,
              letterSpacing: 1.8,
              marginBottom: 3,
              fontFamily: "'Courier New', Courier, monospace",
            }}
          >
            CARD HOLDER
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.9,
              color: "rgba(255,255,255,0.90)",
              fontFamily: "'Courier New', Courier, monospace",
            }}
          >
            {card.holder}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 8,
              color: card.textDim,
              letterSpacing: 1.8,
              marginBottom: 3,
              fontFamily: "'Courier New', Courier, monospace",
            }}
          >
            EXPIRES
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "rgba(255,255,255,0.92)",
              fontFamily: "'Courier New', Courier, monospace",
            }}
          >
            {card.expiry}
          </div>
        </div>
        <NetworkLogo type={card.network} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEATHER NOISE TEXTURE  (SVG feTurbulence — pure grain)
// ─────────────────────────────────────────────────────────────────────────────
function Grain({ id, opacity = 0.042 }) {
  return (
    <svg
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity,
        pointerEvents: "none",
        borderRadius: "inherit",
      }}
    >
      <filter id={id}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.74"
          numOctaves="4"
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STITCHING BORDER
// ─────────────────────────────────────────────────────────────────────────────
function Stitching({ inset = 10, color = "rgba(188,124,46,0.34)", br = 19 }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: inset, left: inset, right: inset, bottom: inset,
        borderRadius: br,
        border: `1.5px dashed ${color}`,
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAY BUTTON  (3-phase: idle → processing → done)
// ─────────────────────────────────────────────────────────────────────────────
function PayButton() {
  const [phase, setPhase] = useState("idle");

  const handlePress = () => {
    if (phase !== "idle") return;
    setPhase("processing");
    setTimeout(() => setPhase("done"), 1850);
    setTimeout(() => setPhase("idle"), 3900);
  };

  const PHASE_STYLE = {
    idle: {
      bg:     "linear-gradient(180deg, rgba(72,40,13,0.96) 0%, rgba(46,24,6,0.98) 100%)",
      border: "rgba(195,130,48,0.42)",
      color:  "rgba(224,165,72,0.95)",
      glow:   "rgba(195,130,48,0.18)",
    },
    processing: {
      bg:     "linear-gradient(180deg, rgba(54,36,8,0.96) 0%, rgba(36,20,4,0.98) 100%)",
      border: "rgba(215,158,56,0.50)",
      color:  "rgba(238,182,76,0.92)",
      glow:   "rgba(205,150,48,0.22)",
    },
    done: {
      bg:     "linear-gradient(180deg, rgba(7,56,28,0.96) 0%, rgba(4,36,16,0.98) 100%)",
      border: "rgba(44,186,98,0.50)",
      color:  "rgba(88,228,142,0.95)",
      glow:   "rgba(44,186,98,0.22)",
    },
  };

  const s = PHASE_STYLE[phase];
  const LABELS = { idle: "PAY NOW", processing: "PROCESSING…", done: "✓  PAYMENT SENT" };

  return (
    <motion.button
      onClick={handlePress}
      whileHover={{ scale: phase === "idle" ? 1.06 : 1 }}
      whileTap={{ scale: phase === "idle" ? 0.94 : 1 }}
      style={{
        background:  s.bg,
        border:      `1.5px solid ${s.border}`,
        borderRadius: 50,
        padding:     "12px 46px",
        color:       s.color,
        fontSize:    12,
        fontWeight:  800,
        letterSpacing: 3.8,
        fontFamily:  "'Courier New', Courier, monospace",
        cursor:      phase === "idle" ? "pointer" : "default",
        outline:     "none",
        minWidth:    185,
        boxShadow:   `inset 0 2px 5px rgba(0,0,0,0.55), inset 0 -1px 0 rgba(255,255,255,0.06), 0 0 22px ${s.glow}, 0 5px 14px rgba(0,0,0,0.52)`,
        transition:  "background 0.44s, border-color 0.44s, color 0.32s, box-shadow 0.44s",
        // Important: re-enable pointer events (parent has pointer-events:none)
        pointerEvents: "auto",
        touchAction: "manipulation",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={phase}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.2 }}
          style={{ display: "block" }}
        >
          {LABELS[phase]}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STACKED CARD  (handles both draggable-front and static-middle/back)
//
// DRAG PHYSICS:
//   - dragX, dragY: raw Framer Motion motion values (x/y offset from resting pos)
//   - velX, velY:   velocity of those values (for 3D tilt)
//   - rotateX/Y:    mapped from velocity → physical tilt sensation
//   - dragElastic:  0.08 while card is inside pocket (leather resistance)
//                   0.88 once card has pulled up above pocket (free movement)
//
// GRADUAL REVEAL (the magic):
//   The pocket overlay (z:30) sits ABOVE this card (z:25) when docked.
//   As the user drags upward, more of the card appears above the pocket top edge.
//   No clipping or masking needed — the pocket div IS the mask.
// ─────────────────────────────────────────────────────────────────────────────
function StackedCard({ card, stackPos, onShuffle }) {
  const isFront = stackPos === 0;

  // Motion values for drag
  const dragX    = useMotionValue(0);
  const dragY    = useMotionValue(0);
  const velX     = useVelocity(dragX);
  const velY     = useVelocity(dragY);

  // 3D tilt: the faster you drag, the more the card tilts
  const rotateY  = useTransform(velX, [-2400, 2400], [-26, 26]);
  const rotateX  = useTransform(velY, [-2400, 2400], [20, -20]);

  // Whether card has been pulled above the pocket top edge (free zone)
  const [broken, setBroken]   = useState(false);
  const [dragging, setDragging] = useState(false);

  // When card moves from front to non-front: reset its drag position with spring
  useEffect(() => {
    if (!isFront) {
      animate(dragX, 0, { type: "spring", stiffness: 440, damping: 34 });
      animate(dragY, 0, { type: "spring", stiffness: 440, damping: 34 });
      setBroken(false);
      setDragging(false);
    }
  }, [isFront]); // eslint-disable-line

  // Called every frame during drag — checks if card has cleared the pocket
  const onDragUpdate = useCallback(() => {
    // dragY is negative when dragged upward (Framer Motion convention)
    // Card clears pocket when: CARD_BASE_TOP + dragY + CARD_H ≤ POCKET_Y
    // → dragY ≤ POCKET_Y - CARD_BASE_TOP - CARD_H = 94 - 34 - 172 = -112
    // We set broken a bit earlier (at -80) for smooth z-index transition
    setBroken(dragY.get() < -80);
  }, [dragY]);

  const onDragEnd = useCallback(
    (_, info) => {
      setDragging(false);
      setBroken(false);
      const { offset, velocity } = info;

      // Shuffle if dragged far enough or thrown fast enough
      const doShuffle =
        offset.y < -SHUFFLE_DRAG_UP ||
        Math.abs(offset.x) > SHUFFLE_DRAG_SIDE ||
        velocity.y < SHUFFLE_VEL_UP ||
        Math.abs(velocity.x) > SHUFFLE_VEL_SIDE;

      if (doShuffle) {
        // Shuffle the order, then snap back
        onShuffle();
      }

      // Always spring back to resting position
      animate(dragX, 0, { type: "spring", stiffness: 580, damping: 42 });
      animate(dragY, 0, { type: "spring", stiffness: 580, damping: 42 });
    },
    [dragX, dragY, onShuffle]
  );

  return (
    <motion.div
      // ── Gestures ──────────────────────────────────────────────
      drag={isFront}
      dragMomentum={false}
      // Leather resistance while inside pocket; free once popped out
      dragElastic={broken ? 0.88 : 0.07}

      // ── Transform ─────────────────────────────────────────────
      style={{
        // Base position — all cards share the same CSS `top`
        // The differentiation comes purely from the `y` transform
        position:   "absolute",
        top:        CARD_BASE_TOP,
        left:       CARD_PAD_H,
        right:      CARD_PAD_H,

        // Live motion values
        x:          isFront ? dragX : 0,
        y:          isFront ? dragY : 0,
        rotateX:    isFront ? rotateX : 0,
        rotateY:    isFront ? rotateY : 0,
        transformStyle: "preserve-3d",

        // ── Z-INDEX LOGIC ──────────────────────────────────────
        // The pocket overlay is at z:30.
        // Card z must be:  < 30 when docked (so pocket covers card bottom)
        //                  > 30 when dragging out (so card flies above pocket)
        //
        // When broken=true (dragged past -80px), jump to z:42 so the card
        // that's now above the pocket edge is visually above it too.
        zIndex:     isFront ? (broken ? 42 : STACK_Z[0]) : STACK_Z[stackPos],

        cursor:     isFront ? (dragging ? "grabbing" : "grab") : "default",
        willChange: "transform",
      }}

      // ── Stack position animation ───────────────────────────────
      // Each card animates to its stack y-offset when order changes
      animate={{
        y:      isFront ? undefined : STACK_Y[stackPos],  // front card y is controlled by drag
        scale:  STACK_SCALE[stackPos],
        filter: `brightness(${STACK_BRIGHT[stackPos]})`,
      }}
      transition={{
        y:      { type: "spring", stiffness: 330, damping: 28 },
        scale:  { type: "spring", stiffness: 330, damping: 28 },
        filter: { duration: 0.30 },
      }}

      onDragStart={() => setDragging(true)}
      onDrag={onDragUpdate}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: STACK_SCALE[0] * 1.042 }}
    >
      <CardFace card={card} raised={isFront && (dragging || broken)} />
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT WALLET COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function LeatherWallet() {
  /**
   * `order` = [frontCardIndex, middleCardIndex, backCardIndex]
   * Maps to indices in CARDS array.
   * Shuffle: front → back, rest shift forward.
   */
  const [order, setOrder] = useState([0, 1, 2]);

  const shuffle = useCallback(() => {
    setOrder((prev) => {
      const next = [...prev];
      next.push(next.shift()); // rotate: [0,1,2] → [1,2,0]
      return next;
    });
  }, []);

  const activeCard = CARDS[order[0]];

  return (
    <div
      style={{
        minHeight: "100vh",
        // Rich dark chocolate radial glow — matches reference image exactly
        background:
          "radial-gradient(ellipse 78% 68% at 50% 44%, #2c1608 0%, #190d04 46%, #0b0503 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        // Perspective for 3D card tilt to project correctly
        perspective: "1100px",
        overscrollBehavior: "none",
        touchAction: "none",
      }}
    >
      {/* ── ENTRANCE ANIMATION WRAPPER ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.80, y: 40 }}
        animate={{ opacity: 1, scale: 1.00, y: 0 }}
        transition={{ type: "spring", stiffness: 210, damping: 22, delay: 0.12 }}
        style={{ position: "relative", width: WALLET_W }}
      >

        {/* ════════════════════════════════════════════════════════
            THE WALLET BODY
            One leather container. Cards and pocket live inside it.
            ════════════════════════════════════════════════════════ */}
        <div
          style={{
            width: WALLET_W,
            height: WALLET_H,
            borderRadius: 28,
            position: "relative",
            overflow: "visible", // cards must be able to fly out upward
            // Multi-stop leather gradient — darker at centre, lighter at edges
            background:
              "linear-gradient(158deg, #6a3316 0%, #4c2410 20%, #3b1c08 48%, #532b10 74%, #6a3316 100%)",
            boxShadow:
              "0 52px 120px rgba(0,0,0,0.88), 0 20px 52px rgba(0,0,0,0.62), inset 0 2px 0 rgba(255,255,255,0.08), inset 0 -4px 14px rgba(0,0,0,0.50)",
          }}
        >
          <Grain id="wg1" opacity={0.04} />
          {/* Outer stitching border */}
          <Stitching inset={9} color="rgba(192,124,46,0.30)" br={22} />

          {/* Top-of-wallet inner shadow (depth at mouth opening) */}
          <div
            style={{
              position: "absolute",
              top: 0, left: 0, right: 0,
              height: 56,
              borderRadius: "28px 28px 0 0",
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.40) 0%, transparent 100%)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />

          {/* ── CARDS ─────────────────────────────────────────────
              Rendered back→middle→front (ascending z-index).
              All share CARD_BASE_TOP=34px as CSS top.
              Each uses STACK_Y[stackPos] transform to create the peek stagger.
              ─────────────────────────────────────────────────────── */}
          {[2, 1, 0].map((stackPos) => (
            <StackedCard
              key={order[stackPos]}         // keyed by CARD index — stable identity
              card={CARDS[order[stackPos]]}
              stackPos={stackPos}
              onShuffle={shuffle}
            />
          ))}

          {/* ════════════════════════════════════════════════════════
              POCKET OVERLAY  (The "mask" for cards)
              ────────────────────────────────────────────────────────
              Position: absolute, top = POCKET_Y (94px from wallet top)
              Z-index:  30  →  above all docked cards (z ≤ 25)
                              below dragged card when broken out (z = 42)

              pointer-events: none  →  click/touch passes through to cards
              PayButton inside: pointer-events: auto  (re-enabled)

              Visual anatomy:
              ┌─────────────────────────────────────────┐
              │  curved SVG arc (pocket mouth)           │  ← top 36px
              │  inner shadow (depth illusion)           │
              │  leather texture (Grain component)       │
              │  stitching border                        │
              │                                          │
              │           [ PAY NOW ]                    │  ← vertically centred
              │                                          │
              └─────────────────────────────────────────┘
              ════════════════════════════════════════════════════════ */}
          <div
            style={{
              position:    "absolute",
              top:         POCKET_Y,
              left:        0,
              right:       0,
              bottom:      0,
              zIndex:      30,
              borderRadius: "0 0 26px 26px",
              overflow:    "hidden",
              // Transparent at very top (where card edge is) → opaque below
              background:
                "linear-gradient(175deg, rgba(68,33,10,0) 0%, rgba(62,30,8,0.82) 18%, #462210 38%, #3a1c08 60%, #502810 82%, #462210 100%)",
              // CRITICAL: pointer-events:none allows clicks to pass through to cards
              // PayButton inside re-enables pointer-events for itself only
              pointerEvents: "none",
            }}
          >
            <Grain id="wg2" opacity={0.048} />

            {/* Pocket mouth — curved SVG stitching arc */}
            <svg
              viewBox="0 0 320 38"
              style={{
                position:    "absolute",
                top:         18,
                left:        0,
                width:       "100%",
                pointerEvents: "none",
                overflow:    "visible",
              }}
            >
              <path
                d="M 4 30 Q 160 5 316 30"
                fill="none"
                stroke="rgba(192,124,46,0.38)"
                strokeWidth="1.5"
                strokeDasharray="5.5 4.2"
              />
            </svg>

            {/* Pocket interior top shadow (depth) */}
            <div
              style={{
                position: "absolute",
                top: 0, left: 0, right: 0,
                height: 48,
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.44) 0%, transparent 100%)",
                pointerEvents: "none",
              }}
            />

            {/* Surface gloss on pocket */}
            <div
              style={{
                position: "absolute",
                top: 0, left: 0, right: 0,
                height: "36%",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)",
                pointerEvents: "none",
              }}
            />

            {/* Inner stitching ring of pocket */}
            <Stitching inset={10} color="rgba(165,102,32,0.26)" br={16} />

            {/* PAY NOW — pointer-events re-enabled here */}
            <div
              style={{
                position:       "absolute",
                bottom:         22,
                left:           0,
                right:          0,
                display:        "flex",
                justifyContent: "center",
                zIndex:         2,
                pointerEvents:  "none", // container is none, button itself is auto
              }}
            >
              <PayButton />
            </div>
          </div>

        </div>{/* end wallet body */}

        {/* ── DRAG HINT ─────────────────────────────────────────── */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", delay: 1.4 }}
          style={{
            marginTop: 22,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 7,
          }}
        >
          <svg width="14" height="18" viewBox="0 0 14 18" fill="none" aria-hidden="true">
            <path
              d="M7 16V2M2 7L7 2L12 7"
              stroke="rgba(182,118,44,0.42)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div
            style={{
              fontSize:    10,
              letterSpacing: 4,
              fontWeight:  700,
              color:       "rgba(182,118,44,0.40)",
              fontFamily:  "'Courier New', Courier, monospace",
            }}
          >
            HOLD &amp; DRAG CARD UP
          </div>
        </motion.div>

        {/* ── CARD INDICATOR DOTS ───────────────────────────────── */}
        <div
          style={{
            marginTop: 14,
            display: "flex",
            justifyContent: "center",
            gap: 7,
          }}
        >
          {order.map((cardIdx, pos) => (
            <motion.div
              key={cardIdx}
              animate={{
                width:   pos === 0 ? 26 : 8,
                opacity: pos === 0 ? 0.86 : 0.28,
                background: pos === 0 ? "#c87830" : "#7a4a1a",
              }}
              transition={{ type: "spring", stiffness: 270, damping: 22 }}
              style={{ height: 4, borderRadius: 999 }}
            />
          ))}
        </div>

        {/* ── ACTIVE CARD LABEL ─────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCard.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 0.52, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.26 }}
            style={{
              marginTop:     9,
              textAlign:     "center",
              fontSize:      10,
              letterSpacing: 3.2,
              fontWeight:    700,
              color:         "rgba(200,148,56,0.70)",
              fontFamily:    "'Courier New', Courier, monospace",
            }}
          >
            {activeCard.bank}  ·  ···· {activeCard.number.slice(-4)}
          </motion.div>
        </AnimatePresence>

      </motion.div>
    </div>
  );
}
