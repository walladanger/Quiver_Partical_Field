# Equation-to-Dynamics engine: particle interaction stage

The existing Quiver app has an optional Equation dynamics section at the bottom of its existing control panel. Open it, select or enter an equation, and press Apply equation. Existing vector inputs, presets, palette, layout, heat map, arrows, trails, and persisted settings remain available. Turn equation mode off to return to the component field. No original feature or file has been removed.

## Implemented

- Bounded symbolic AST parser for arithmetic, equalities, variables, implicit multiplication and supported function calls. No evaluation of submitted JavaScript.
- Signed constant-equality residuals. `1+1+1=2` yields 1; variable residuals and non-finite arithmetic are explicitly not numerically evaluated.
- Canonical AST, SHA-256 fingerprint, seeded random stream, 64 controls and complexity-dependent augmentation. Whitespace and redundant parentheses are equivalent for parsed inputs. Unsupported notation uses a labeled lexical fallback; it is not a complete LaTeX/PDE parser.
- Six potential/vortex harmonics and four particle species with bounded mass, drag, radius, charge-like bias and noise. Semi-implicit velocity update, damped motion, reflecting boundaries, and a fixed 1/120-second numerical step.
- Local particle attraction, short-range repulsion and charge-dependent pair forces. Linked spatial cells visit nearby pairs once. Each pair contributes equal and opposite force before aggregate safety limits.
- Mass-weighted collision impulses with restitution and two bounded overlap-correction sweeps. Exact coincidences use a deterministic normal. Dense clusters can retain overlap; there is no continuous collision detection or guarantee against tunneling. World-space contact radii are separate from unchanged pixel rendering radii.
- Dynamics version `edc-dynamics-v2` identifies the changed trajectories. Existing equation seeds and initial placement remain unchanged; the constructor option `{ interactions: false }` retains field-only integration for comparison. No UI changes were needed for this stage.
- Repeatable equation reset, numbered variations and deterministic click injection. Repeatability means the same program version, equation, variation, range, count, step count and interaction sequence. Wall-clock timing or browser floating-point differences are not a promise of cross-platform pixel-identical playback.
- Existing renderer integration: particles, arrows, heat map, hover sampling, pause and speed. Equation controls are collapsed and disabled by default, and use a separate store to preserve existing saved settings. Radius varies by species; the original palette is preserved.
- Eight examples: arithmetic, Navier–Stokes, Maxwell, Schrödinger, Boltzmann, Klein–Gordon, Dirac and Einstein. All currently run in Equation Driven mode.

## Explicitly unfinished

Literal Physics and Hybrid modes require validated solver adapters and are not exposed as working options. No SPH/PBF/LBM, Boltzmann collision operator, Schrödinger, Maxwell or general-relativity solver exists in this increment. Recognition of a label does not activate a solver. Temperature, lifetime, history forces, full tensor analysis and GPU acceleration remain future work. The Windows renderer now displays the shared 3D particle solver with canvas perspective projection. The new local collision model does not constitute a validated kinetic or fluid solver. Some syntax features influence the control vector only, rather than implementing their physical meaning. Do not remove or redesign existing app features without Warwick's decision.

## Verification

`npm run test:edc` now passes 14 test groups: SHA-256 against Node's implementation, arithmetic residuals and precedence, canonicalization, variation, malformed/injection-like input, bounded fields, fixed-step replay, click injection, boundaries, reset, existing math regressions, force direction and cutoff, broad-phase equivalence to a brute-force neighbor search, pair-force symmetry, isolated collision momentum and energy, deterministic coincidences, optional field-only integration, and 900-particle stability over 240 steps. This is CPU numerical verification, not a measured browser frame-rate guarantee. Spatial cells reduce work for sparse distributions; dense clusters can still approach quadratic cost.

TypeScript and the production build have passed in the development environment. A pre-existing package-lock inconsistency prevented `npm ci`; regenerating its dependency locations repaired installation without changing package.json dependency versions. Database migration correctly skips when DATABASE_URL is unset.

Browser interaction, desktop/mobile appearance and production browser smoke remain unverified: the available browser rejected access to the local app with ERR_BLOCKED_BY_CLIENT. The Windows packaging workflow is set up to build and upload the installer and portable executable on a Windows runner; the Windows build still needs to pass before release.

## Development

Use Node 22.18+ or Node 24. Run `npm ci`, `npm run test:edc`, `npm run typecheck`, then `npm run dev`. Run `npm run build` for a fresh production artifact. The supplied startup.sh and Grok preview/branding contracts are retained. Generated build files included in the original export are retained for provenance; regenerate them before deployment.

Original source was preserved in a local main-branch baseline. Work is on `codex/equation-dynamics`. Warwick supplied `https://github.com/walladanger/Quiver_Partical_Field`; the connected GitHub account still returns 404 for that repository. No GitHub upload or merge is claimed.
