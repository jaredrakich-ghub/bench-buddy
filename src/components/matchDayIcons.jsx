// Custom solid-fill icons for the match-day sticker-book redesign (see
// design_handoff_bench_buddy_match_day/README.md). Kept separate from
// lucide-react — used everywhere else in this app — because this specific
// design calls for solid/filled shapes ("do NOT use a thin outline gear")
// that lucide's stroke-based icon set doesn't provide. Reused across the
// redesign steps (header cog now, the real anchored cog menu and
// player-tap popover later) rather than redefined per screen.
import { tokens } from "./styles.js";

// Builds an 8-tooth gear silhouette as one SVG path, alternating between
// outer and root radius around the circle, plus a punched centre hole made
// from two opposite-winding arcs — combined with fill-rule="evenodd" below,
// that hole reads as empty rather than filled. Computed rather than
// hand-typed so the tooth spacing is actually even.
function gearPath({ cx = 12, cy = 12, teeth = 8, outerR = 9.2, rootR = 6.6, holeR = 3.4 }) {
  const step = (Math.PI * 2) / (teeth * 2);
  let d = "";
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 === 0 ? outerR : rootR;
    const angle = i * step - Math.PI / 2;
    const x = (cx + r * Math.cos(angle)).toFixed(2);
    const y = (cy + r * Math.sin(angle)).toFixed(2);
    d += (i === 0 ? "M" : "L") + x + "," + y + " ";
  }
  d += "Z ";
  d += `M${(cx + holeR).toFixed(2)},${cy} `;
  d += `A${holeR},${holeR} 0 1 0 ${(cx - holeR).toFixed(2)},${cy} `;
  d += `A${holeR},${holeR} 0 1 0 ${(cx + holeR).toFixed(2)},${cy} Z`;
  return d;
}

const GEAR_D = gearPath({});

export function GearIcon({ size = 20, color = tokens.color.deepGreen }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={GEAR_D} fill={color} fillRule="evenodd" />
    </svg>
  );
}

// A flat football-jersey silhouette: rounded shoulders, flared short
// sleeves narrowing back in at the armpit, a dipped collar notch, square
// body with rounded bottom corners. Not a pixel port of the design file's
// own SVG (that's reference-only per the handoff) — a clean equivalent
// built for this codebase, close enough to read the same at a glance.
const SHIRT_D = `
  M23,4 L14,0 L2,10 L14,20 L14,50
  Q14,56 20,56 L42,56 Q48,56 48,50
  L48,20 L60,10 L48,0 L39,4
  Q31,11 23,4 Z
`;

// width/height default to the design's own 62x58 kit-shirt tile; callers
// scale both together to match computeTokenSize's tiered pitch sizing
// (unrelated to this component — see formation.js) without this needing
// to know anything about headcount itself.
export function KitShirt({ width = 62, height = 58, isGk = false, strokeColor = tokens.color.deepGreen }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 62 58"
      style={{ filter: "drop-shadow(0 4px 0 rgba(0,0,0,.18))" }}
      aria-hidden="true"
    >
      <path
        d={SHIRT_D}
        fill={isGk ? tokens.color.yellow : tokens.color.creamPaper}
        stroke={strokeColor}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

// A medical-cross glyph — two overlapping rects forming a plus, matching
// the design file's own construction (it builds this the same way, not
// a single plus-shaped path) for the "Mark injured" action tile.
export function MedicalCross({ size = 18, color = tokens.color.injuryRed }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="3" width="6" height="18" rx="1.5" fill={color} />
      <rect x="3" y="9" width="18" height="6" rx="1.5" fill={color} />
    </svg>
  );
}
