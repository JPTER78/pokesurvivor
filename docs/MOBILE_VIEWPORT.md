# Mobile viewport and input

Related report: https://github.com/JPTER78/pokesurvivor/issues/134

## Diagnosis

Previously `#game` used `100vw` and `100dvh`, but its backing store and camera
were measured from `clientWidth/clientHeight` only on `window.resize`. A CSS or
visual viewport change without that event (or one that settled after the event)
left the old backing store stretched to a new rectangle. Unequal horizontal and
vertical scaling deformed the world and the HUD. The screenshot in #134 shows
that deformation even in the pause button.

Input then compared window `clientX/clientY` to HUD coordinates from the old
canvas size. Offsets and scaling were ignored. The same assumption positioned
both joysticks; the editor used yet another size, `innerWidth/innerHeight`.
These are demonstrable defects in the code; identifying the exact sequence of
WebKit events on a particular iPhone still requires the real-device test.

Safe area values were cached until window resize/orientation events, capped to
44/28/20 pixels, and omitted when clamping custom controls and the fixed stick.

## Coordinate contract

1. `G.Viewport` sizes the `#app` root from the visual viewport at normal zoom.
   Its offsets place the app in the visible part of the layout viewport. Without
   VisualViewport, window inner dimensions are used, then document client sizes.
   Pinch zoom preserves the layout instead of continually shrinking the game.
2. `#game` fills that root with `100%` CSS dimensions. The root establishes the
   containing block for fixed overlays too, including dynamically created UI.
   Canvas, menus, pause overlays and editor therefore occupy the same rectangle.
3. The measured canvas `getBoundingClientRect()` width/height are logical HUD
   pixels. The backing store is rounded logical pixels times DPR (the existing
   1.5 performance cap is retained). Rendering uses exact backing/logical scale
   on each axis to account for fractional CSS sizes and rounding. Camera zoom
   remains uniform and sees the full world, including beneath unsafe edges.
4. Every canvas interaction maps client coordinates to logical local pixels:
   `(clientX - rect.left) * logicalWidth / rect.width`, and likewise for Y.
   DPR never participates in input. The editor uses the same transform with its
   own rectangle and the shared logical dimensions.
5. `G.ControlLayout` shares bar, pause and fixed stick geometry between drawing,
   hit targets and the editor. Safe insets constrain important UI, including
   custom positions, without reducing the world canvas. Saved positions remain
   proportions of the full canvas; unsaved editor positions survive resizing.

`G.Viewport.resize()` is idempotent: styles and buffer dimensions are written
only if different; camera/input/layout listeners run only on geometry, DPR or
safe area changes. Transitions cancel ongoing drags/sticks rather than retaining
an origin from an obsolete coordinate system. ResizeObserver watches CSS size,
compares against current measurements and queues writes outside its callback.

Window resize, orientationchange, pageshow, visible visibilitychange and visual
viewport resize/scroll share one coalescing scheduler. It remeasures on the next
animation frame and at 120/400 ms for multi-stage WebKit transitions. Later real
changes remain observable; the delays are revalidation, not a device heuristic.

Fingers use the complete touchstart/move/end/cancel lifecycle. Companion touch
pointer events are ignored to avoid duplicate button actions; mouse and pen
retain pointer events and pen capture. A second finger can select a move without
moving or releasing the first finger's stick. Blur/visibility cancel input.

Manifest fullscreen/landscape, PWA metadata, service worker and updater remain.
iOS decides whether to honor the orientation manifest; unsupported orientation
locking keeps the existing portrait rotate prompt and solo auto-pause.

## Reproducible checks

No root package or lint/test runner existed. Dependency-free tests use Node's
built-in test runner:

```sh
node --test tools/tests/*.test.js
```

The cases cover independent X/Y scaling, offsets, high DPR/fractional sizes,
fallback/pinch zoom, idempotency and observer feedback, portrait/landscape with
late settling, resume events, full safe insets, actual HUD button registration,
mouse input, both joysticks and multitouch/cancellation.

Optional integration checks in Chromium and WebKit:

```sh
npm install --prefix tools/cache/qa --no-audit --no-fund playwright
node tools/cache/qa/node_modules/playwright/cli.js install chromium webkit
node tools/tests/browser-smoke.js
```

The static QA server binds only for the test and closes afterward. It uses a
loopback hostname outside the cloud allowlist and guest saves, with no account
or server writes. Checks cover menu/settings, play, pause/resume, the editor,
rotation/restore, the production bundle's onboarding and service worker.
Native touchscreen taps test pause; multitouch movement uses injected event
payloads (Windows WebKit does not provide a constructible Touch object).
Screenshots are written to ignored `tools/cache/qa/`.

Official build sequence from CLAUDE.md:

```sh
node tools/build.js
node tools/export_data.js
python tools/make_seo_pages.py
```

On Windows with only the Python launcher configured, use `py` for the last step.
Generated index, English index, bundle and version fingerprint must be committed
from this sequence, never manually edited.

## Real iPhone acceptance

Open the temporary HTTPS preview in Safari, use the local/guest mode, and add it
to the Home Screen. Start it from the new icon with the device in landscape.
Check proportions, each attack, pause, a floating stick exactly under the finger
and a fixed stick at its displayed center; hold movement while changing attacks.
Try custom control positions near both cutouts and the home indicator. Rotate
to portrait and back, background/foreground the app, and repeat in Safari and
Chrome. Desktop WebKit tests cannot certify installed iOS PWA lifecycle,
Dynamic Island insets, native orientation locking or real hardware gestures.
