# Quiver Windows desktop wrapper

This Electron shell runs a local Vite renderer that imports the same equation compiler and 3D particle solver used by the Quiver web application. The Windows package works offline after installation; the renderer and engine are bundled with the app.

## Run the renderer in a browser

```sh
npx vite --config desktop/windows/vite.config.ts --host 127.0.0.1
```

## Run the desktop app during development

```sh
npm run desktop:windows:dev
```

## Build Windows packages

On Windows:

```powershell
npm ci
npm run test:edc
npm run desktop:windows:dist
```

The `release/windows` folder contains an interactive NSIS installer and a portable `.exe`. The `Windows desktop installer` GitHub Actions workflow runs the same checks and uploads both packages as a build artifact.

## Controls

- Drag to orbit; hold Shift or use the right mouse button to pan; use the wheel to zoom.
- Enter an equation and select **Apply**, or choose a built-in equation preset.
- Use **Pause**, the particle count, **Trails**, and **Variation +** to control the run.
- **Restart simulation** restores the initial deterministic state; **Reset camera** restores the default view.
