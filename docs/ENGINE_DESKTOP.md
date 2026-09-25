# Quiver equation graphics engine

The existing 2D field remains the default. Select **3D** in the header to view a deterministic three-dimensional equation universe. Drag to orbit, scroll or pinch to zoom, and use the fullscreen button. Tapping the scene injects particles. The equation, variation, and particle controls remain in the side panel.

This is an equation-driven particle simulator with three-dimensional forces and spatial neighbor interactions. Its named equation examples map mathematical notation into visual dynamics; they are not numerical Navier–Stokes, Maxwell, quantum, or general-relativity solvers.

## Browser app launcher

Install Node.js 22 or newer and run `npm ci` once inside this source folder. Double-click `desktop/Quiver.cmd` on Windows or `desktop/Quiver.command` on macOS, or use `npm run desktop` on Linux. The launcher builds the current web app, starts a loopback-only production server, and opens Chrome, Edge, or Chromium in an app window (falling back to the default browser). Keep the launcher process open while using Quiver; Ctrl+C closes its server.

## Windows installer and desktop app

The standalone Electron desktop app shares `src/lib/field/equation.ts` and `src/lib/field/dynamics-3d.ts` with the browser app. Install Node.js 24 or newer, then run `npm ci` and `npm run desktop:windows:dev` to develop it. Run `npm run desktop:windows:dist` on Windows to create an interactive NSIS installer and a portable executable in `release/windows`. After installation the renderer runs offline. The `Windows desktop installer` GitHub Actions workflow builds both Windows packages and uploads them as an artifact.

## TypeScript wrapper

Import `createGraphicsEngine` from `src/lib/field/engine.ts` to embed the deterministic engine in another TypeScript renderer:

```ts
import { createGraphicsEngine } from './src/lib/field/engine.ts';

const engine = createGraphicsEngine({ equation: '1+1+1=2', variation: 0, dimensions: 3 });
engine.step(120); // one second at a fixed 120 Hz
console.log(engine.particles, engine.time, engine.program.fingerprint);
```

`dimensions: 2` exposes the original equation simulation. For the same equation, variation, dimensions, range, and particle count, repeated runs yield the same initial state and fixed-step motion. The browser view uses Canvas 2D perspective projection to show the real 3D particle coordinates; it does not require a GPU or WebGL.
