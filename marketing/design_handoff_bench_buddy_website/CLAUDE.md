# Handoff: Bench Buddy marketing website

## Overview

A single-page marketing site for Bench Buddy, an app that manages substitutions,
playing time and goalkeeper rotations for junior football teams. Its audience is
volunteer coaches, parents who help on the sideline, and clubs. It has exactly one
job: get the app downloaded. There is no navigation, no blog, no pricing — every
link on the page resolves to `#story` or `#get`.

The page tells a three-act story with real video footage. Act one is the Saturday
every coach already knows (a paper team sheet, kids asking when they go on, the
plan falling apart). The turn is a single full-bleed moment: ten minutes before
kick-off, Coach Dave is asked to referee and hands the subs to Emma, a parent who
has never run a rotation. Act two is the same Saturday run off the app. Benefits,
how-it-works and the download CTA follow.

## About the design files

The files in this bundle are **design references created in HTML** — prototypes
showing intended look and behaviour, not production code to copy directly.

The task is to **recreate these designs in your target environment** (React, Vue,
Astro, plain HTML — whatever the project uses) following its established patterns.
If no environment exists yet, this design is a static marketing page with no
application state: a static-site generator or hand-written HTML is the right
choice, and no framework is required.

Two caveats specific to this design:

1. `Bench Buddy Website.dc.html` is written in a component format with a small
   runtime (`<x-dc>`, `<sc-if>`, `style-hover` attributes, a `class Component`
   logic block). **Do not try to run or port that runtime.** Read the file for its
   exact values and markup structure; ignore the wrapper. The `<sc-if>` blocks and
   the `data-props` JSON exist only to toggle preview states in the design tool.
2. Styling is inline throughout, for the same tool reasons. In production, move it
   to a stylesheet or your framework's convention. The *values* are authoritative;
   the delivery mechanism is not.

## Fidelity

**High fidelity.** Colours, type, spacing, radii, motion timings and copy are all
final and have been reviewed. Contrast ratios were measured against resolved
backgrounds, not estimated. Recreate the UI faithfully. The copy in particular is
approved word-by-word — see section 7 of the spec — and must not be rewritten,
tightened or re-punctuated.

## Where the detail lives

**`SPEC.md` in this folder is the primary document.** It carries, in order:

1. What the site is
2. Assets to supply
3. Colour tokens with measured contrast ratios
4. Type scale as literal `clamp()` declarations
5. Global layout rules
6. Section-by-section geometry, plus the video map
7. **Every string of copy, verbatim**
8. Behaviour — video autoplay, visibility gating, reveal motion, hosting
9. Responsive and accessibility
10. Before-launch checklist

`Bench Buddy Website Spec.dc.html` is the same document as a formatted, printable
page if you would rather read it that way.

## The three things most likely to be got wrong

These are not stylistic preferences. Each one was a real defect during design.

### 1. Video autoplay must be wired in script, not markup

Set `muted` and `loop` as DOM **properties**:

```js
v.muted = true;
v.loop = true;
v.playsInline = true;
v.defaultMuted = true;
```

If you render `<video muted loop>` as markup through React, the bare attributes
arrive as `false`, autoplay is refused with `NotAllowedError`, and all sixteen
clips sit frozen on their first frame. Also handle failure: a broken video paints
opaque over whatever is behind it, so hide the element on `error` and reveal it on
`loadeddata`, with a ~4s timeout as a backstop.

### 2. Playback must be gated on visibility

One `IntersectionObserver` at `rootMargin: '25% 0px'`, `threshold: 0.01`: play a
clip as it approaches, pause it once it leaves. Every story clip is
`preload="none"`; only the hero preloads. Without this gate, fourteen 720p clips
download on page load. **Keep the observer after moving to a CDN** — it is not a
workaround for the staging host.

### 3. No media queries

There are none in the design and none should be added. Type uses `clamp()`, grids
use `repeat(auto-fit, minmax(...))`, and the story rows use `flex-wrap` with a
flex-basis. Every collapse point comes from the content, which is why the page
works at any width between 360 and 1920px without a breakpoint audit.

## Motion

One effect on the entire site: elements fade up 18px over
`700ms cubic-bezier(.22, .7, .25, 1)`, once each, triggered by an
`IntersectionObserver` at `threshold: 0.01, rootMargin: '0px 0px -8% 0px'`.

Two details that matter: resolve the observer root to the real scrolling ancestor
rather than assuming the viewport, and add a **1200ms failsafe** that reveals
anything still hidden. The failsafe is what keeps the page legible if the observer
never fires — print, an odd embed, a host-owned scroll container. Flag revealed
elements so a re-render cannot hide them again.

Fully suppressed under `prefers-reduced-motion: reduce`. No parallax, no counting
numbers, no scroll-jacking.

## Assets in this bundle

| Path | Notes |
| --- | --- |
| `assets/bench-buddy-mark.svg` | Logo, cropped to artwork bounds. 56px header, 42px footer. Has a white circular backing, so it only works on dark grounds — a transparent variant is needed before it can go on cream. |
| `screens/10-setup.png` | How it works, step 1 |
| `screens/promo-rotation-ready.png` | How it works, step 2 |
| `screens/03-match.png` | How it works, step 3 |

Screenshots are 1170×2532 (iPhone). They carry real alt text in the design; keep it.

### Assets you must source

- **The 16 video clips.** The reference build streams them from
  `raw.githubusercontent.com/jaredrakich-ghub/bench-buddy/main/docs/Marketing Videos/`.
  That is a staging arrangement only: it depends on the repo staying public, serves
  720p, and supports no range requests. Move them to a CDN, add a `poster` JPG per
  clip for first paint, and consider a smaller mobile encode. Slot-to-file mapping
  is in spec section 6.
- **Fonts.** Schibsted Grotesk (400–700), Nunito (400–700), Baloo 2 (700, 800),
  all on Google Fonts. Self-host for production and add `font-display: swap`.
  Baloo 2 is used for the wordmark *only* — it is the single visual thread back to
  the app and appears nowhere else on the page.
- **Store badges.** The design uses placeholder boxes. Use the official App Store
  and Google Play artwork, which has its own mandated clear space.

## Files in this bundle

| File | What it is |
| --- | --- |
| `README.md` | This file |
| `SPEC.md` | The build specification — read this second |
| `Bench Buddy Website.dc.html` | The design reference. Authoritative for values and structure; ignore its runtime wrapper. |
| `Bench Buddy Website Spec.dc.html` | The spec as a formatted printable page |
| `assets/`, `screens/` | Logo and app screenshots |

## Before launch

- Move all 16 clips to a CDN with poster frames; drop the raw.githubusercontent URLs
- Replace placeholder store badges with official artwork, and point them plus every
  `#get` CTA at the real store URLs
- Supply a transparent-background logo variant
- Write Privacy and Contact destinations — both footer links currently resolve to `#get`
- Self-host the three font families
- Add page title, meta description and an OG image (a hero frame works well)
