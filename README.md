# SOLARIS — The Ninth Orbit

An interactive solar system rendered in real time: eight explorable worlds on
astronomically derived Keplerian orbits, a procedural star, layered planetary
atmospheres, and a cinematic camera that treats every selection as a shot.

Beneath the astronomy sits a personal layer: eight signals to find, a pattern
that only exists once all eight are resolved, and a ninth orbit that was never on
the chart. The science is real; the meaning is private.

![Overview](public/textures/2k_earth_daymap.jpg)

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run maps       # regenerate derived texture maps (optional)
```

## Stack

| Layer | Responsibility |
| --- | --- |
| Next.js, React, TypeScript | App shell, single framed view, strict types |
| React Three Fiber + drei | Scene graph, OrbitControls, billboards, HTML anchors |
| Three.js + custom GLSL | Surfaces, atmospheres, corona, rings, starfield, the ninth world |
| @react-three/postprocessing | Bloom, film grain, vignette — quality-dependent, never everywhere |
| Motion.dev | All interface motion: panels, rail, title card, micro-interactions |
| GSAP + @gsap/react | Camera choreography only: entrance, per-world flights, the reveal |
| Zustand | View, simulation, toggles, discovery progress |
| Zod | Validation of the personal content and saved progress |
| Web Audio API | Optional ambience and cues, silent until switched on |
| Tailwind, Radix UI, Lucide | Styling, accessible primitives, icons |

**Who animates what.** Motion.dev never touches the camera or anything inside the
3D scene; GSAP never animates interface layout, opacity or transforms. The only
handover is deliberate — the GSAP flight lands, then the Motion title card fades
in over it. Camera flights are component-scoped through `useGSAP`, so leaving the
scene kills the timeline instead of leaving a tween running.

## Controls

| Input | Action |
| --- | --- |
| Drag / scroll | Orbit and zoom |
| Click a world (or `1`–`8`) | Fly to that world and open its dossier. Earth goes straight into its timeline |
| `←` / `→` | Move to the previous / next world |
| `9` | Approach the ninth orbit (once discovered) |
| `T` | Re-enter Earth's timeline while Earth is the selected world |
| `Space` | Play / pause the simulation |
| `R` | Reset time and rate |
| `Esc` | Close a message, close the signal log, leave the ninth orbit, or return to the overview |

The **Signals** control in the lower-left corner opens the log: eight planetary
records, the drifting probe, the anomalous star, and — once the eight are
resolved — the pattern and the ninth orbit. While it is open the log takes the
screen the way a dossier does: the world rail steps aside, and `Esc` returns it.

The dock also exposes play/pause, reverse time, reset, a logarithmic speed
control (0.02 – 36 simulated days per second) and toggles for orbits, labels and
atmospheres. The top-right control cycles render quality.

## Architecture

```
src/
  app/                 Next.js App Router shell, fonts, theme tokens
  components/          Interface layer (Motion.dev + Radix + Tailwind)
    SolarisApp.tsx     Composition root, keyboard model, HUD orchestration
    Intro.tsx          Asset loading sequence and entrance
    SignalLog.tsx      Discovery log and progress pips
    SignalModal.tsx    A resolved signal, read in place
    RevealOverlay.tsx  The ninth orbit's cinematic title card
    TimelineOverlay.tsx  Chapter titles, narrative, scrubber, closing message
    TopBar, PlanetRail, PlanetPanel, Dock, Tooltip, ui/IconButton
  content/
    universe.ts        All personal text, the fragments, the ninth world
    timeline.ts        Ten chapters: fixed scientific frame, personal slots
    schema.ts          Zod schemas: content shape, coverage, saved progress
  lib/
    discovery.ts       Zustand: signals, pattern, ninth orbit, local persistence
    planets.ts         J2000 orbital elements, physical data, art direction
    kepler.ts          Kepler solver, orbit sampling, camera framing math
    store.ts           Zustand: view, simulation, toggles, quality
    sim.ts             Simulation clock, epoch maths, date formatting
    motion.ts          Shared easings, durations and variants
    audio.ts           Web Audio ambience and cues, created on first click
  scene/               React Three Fiber layer
    SolarSystem...     SolarisCanvas, Scene composition
    Sun.tsx            Domain-warped photosphere shader + corona + light
    Planet.tsx         Surface, normal/roughness maps, clouds, atmospheres
    SaturnRings.tsx    Ring material with a cylindrical planet shadow
    OrbitPath.tsx      Orbit polylines with contextual emphasis
    Starfield.tsx      Twinkling point field
    GalacticDome.tsx   Milky Way backdrop
    CameraRig.tsx      GSAP choreography + OrbitControls + planet tracking
    SignalBeacon.tsx   The one discoverable object on each world
    SkyDiscoveries.tsx Probe, anomalous star, and the eight-point pattern
    NinthPlanet.tsx    Hidden world, its orbit, reveal flight, particle burst
    TimelineWorld.tsx  Ten era environments, entry flight, chapter camera
    Effects.tsx        Bloom, film grain, vignette presets
    AdaptiveQuality.tsx Frame-budget monitor that steps resolution down
```

## The personal layer

Everything intimate lives in **`src/content/universe.ts`**. Nothing in this
repository invents a fact about her: the copy is deliberately universal, and
every field that should carry a private detail is an empty, labelled slot.

```ts
PERSONAL.recipient      // her name — blank addresses her as “you”
PERSONAL.signature      // how the ninth orbit signs off
FRAGMENTS[].privateNote // a line only the two of you would understand
NINTH.name / accent / message / ring
```

The experience reads correctly while those are empty, so it can be opened the
moment it is finished and personalised afterwards without touching a component.

### Progression

1. Study a world and a **signal** is in orbit around it — the only clickable
   object on a planet, and only while that planet is selected.
2. Eight resolved signals make a **pattern** readable in the sky. It is not
   labelled until it is clicked.
3. Reading the pattern reveals the **ninth orbit**: a new line in the rail, a
   body beyond Neptune, and a GSAP flight into a particle burst and a Motion
   title card.

Discovery state persists in `localStorage` (`solaris.discovery.v1`), so a visit
can be resumed. `reset()` on the discovery store clears it.

## Earth · The Timeline of Us

Selecting Earth skips the dossier: the camera falls towards the planet while
*So let's take a trip through time* sits over the approach, then passes through
the atmosphere into a ten-chapter timeline — the cosmic record from the Big Bang
to 2026, used as the frame for a personal story. Closing the timeline returns to
the system with Earth's dossier open, so its signal can still be collected. The environment changes with every chapter rather than sitting
behind text — plasma, first stars, a spiral galaxy, a protoplanetary disc, a
molten Earth, a primordial ocean, a Cambrian sea, a dinosaur plain, a human
dawn, and the present Earth.

**The framework is fixed.** Chapter names, dates, order and scene are declared
in `TIMELINE_FRAMEWORK` (`src/content/schema.ts`) and validated against
`src/content/timeline.ts` at import. Renaming a chapter, reordering the cosmic
record or changing a scientific date fails the build.

**The personal layer is unfinished on purpose.** Each chapter accepts optional
`date`, `memory`, `photos`, `audio` and `discovery` fields; anything empty is
simply not rendered. Fill them in `src/content/timeline.ts` — no application
code needs to change.

Navigation: the chapter strip (or `←` / `→`) moves through the record, the
header shows chronological position, `Esc` or **Return to Earth** restores the
system, and the final chapter closes on the message in `TIMELINE.closing`.

GSAP owns the camera flight, the environmental palette and the per-chapter
dolly; Motion owns the chapter titles, body reveals, scrubber and the entry
choreography. Neither animates a property the other one owns.

### Extension points

The `FUTURE_MODULES` list records the planned features (Our Constellation,
Memory Archive, Her Planet, Messages from Earth, Our Timeline, Future Missions,
Special-date Star Map, Binary Star System, Time Capsule, Create Your Own Planet,
Hidden Sector). They are intentionally unimplemented. Each should arrive as a
scene object plus a dossier section reached through the existing camera
director and discovery store — never as a separate page with its own navigation,
lighting or type scale.

### Motion design

Two animation systems, deliberately separated by property ownership:

- **Motion.dev** owns the DOM: staggered entrances, the dossier panel, control
  state changes, hover/press springs, and the intro sequence. Shared tokens live
  in `lib/motion.ts` so timings stay consistent.
- **GSAP** owns the camera: the entrance dolly and every planet-to-planet flight
  are single timelines with an eased quadratic arc, and the camera keeps the
  focused world framed as it travels along its orbit.
- **R3F frame loop** owns scene state (orbital positions, spin, shaders).
- **GLSL** owns procedural surfaces: the photosphere, corona, atmospheric rim,
  the ring shadow and cloud deck.

No property is animated by more than one system.

### Orbital mechanics

Positions come from JPL's approximate J2000 elements (semi-major axis,
eccentricity, inclination, mean longitude, perihelion and node). Mean anomaly is
propagated linearly, Kepler's equation is solved with Newton-Raphson, and the
resulting ellipse is rotated into the ecliptic frame. Earth completes an orbit in
365.256 simulated days; Mercury in 87.969.

This is a two-body Keplerian model, **not** an N-body integration — mutual
perturbations, precession and secular element drift are not simulated.

Visual scale is compressed and separated from the data: planets use art-directed
radii and orbit distances so the system is legible, while eccentricity, node and
inclination shapes stay astronomical. Inclinations are multiplied by 1.6 purely
so the near-coplanar orbits remain readable. Every visual constant is a named
field on the planet record (`visualRadius`, `visualOrbit`, `inclinationBoost`).

### Performance

- Textures resolve inside a Suspense boundary behind the loading sequence, so
  nothing pops in.
- `AdaptiveQuality` samples the frame budget and lowers the pixel ratio (never
  raises it, to avoid oscillation), finally dropping to a bloom-free preset.
- Quality presets control pixel ratio, MSAA, bloom and star count.
- Materials and geometries are declarative R3F primitives, disposed on unmount;
  textures are cached by drei's loader and shared.

## Assets and credits

Planetary surface maps, the solar photosphere, Saturn's ring alpha and the
Milky Way panorama are from [Solar System Scope](https://www.solarsystemscope.com/textures/)
and are licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Normal maps, Earth's roughness map and the cloud alpha channel are derived from
those sources by `scripts/build-maps.mjs`.

Typography: Instrument Serif and Inter via `next/font`.

## Evaluated and intentionally omitted

- **Lenis / ScrollTrigger** — the experience is a single framed viewport, not a
  scrolling page; smooth scrolling would have no target to smooth.
- **Theatre.js** — the sequences are short and code-authored; a visual editor
  would add a runtime without replacing the GSAP timelines.
- **Rive / Lottie** — no vector animation assets are needed; DOM motion and
  shaders cover the interface.
- **Howler.js** — the sound design is three oscillators behind one filter, which
  the Web Audio API does directly without a second audio runtime.
- **React Spring** — Motion.dev already provides spring physics for the
  interface, so a second physics runtime would be redundant.
