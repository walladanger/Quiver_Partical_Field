# Quiver Partical Simulator

Interactive vector-field plotter with editable simulation controls, animated flow lines, a browser build, and a Windows desktop wrapper.

## What this includes

- Vite web app for the simulator UI.
- Electron desktop shell.
- Windows NSIS installer and portable EXE build through `electron-builder`.
- GitHub Actions workflow that uploads installer artifacts on every `main` push or manual run.

## Local development

```powershell
npm install
npm run dev
```

## Desktop development

```powershell
npm install
npm run dev:desktop
```

## Build the web app

```powershell
npm run build
```

## Build the Windows installer

```powershell
npm install
npm run dist:win
```

The installer and portable build are written to `release/`.

## GitHub installer workflow

Open the **Actions** tab and run **Build Windows Installer**. The workflow uploads a `quiver-partical-field-windows` artifact containing the installer output.
