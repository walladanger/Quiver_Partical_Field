/** Desktop wrapper for the production Quiver app. Requires Node 22+ and a browser. */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.QUIVER_DESKTOP_PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid QUIVER_DESKTOP_PORT');
const url = `http://127.0.0.1:${port}/`;
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

async function healthy(): Promise<boolean> {
  try { const response = await fetch(url, { signal: AbortSignal.timeout(1500) }); return response.ok; }
  catch { return false; }
}

function openWindow(address: string): boolean {
  const platform = process.platform;
  if (platform === 'darwin') {
    for (const app of ['Google Chrome', 'Microsoft Edge', 'Chromium']) {
      if (spawnSync('open', ['-a', app, '--args', `--app=${address}`], {stdio:'ignore'}).status === 0) return true;
    }
    return spawnSync('open', [address], {stdio:'ignore'}).status === 0;
  }
  if (platform === 'win32') {
    const ps = `foreach ($browser in @('msedge','chrome')) { try { Start-Process -FilePath $browser -ArgumentList '${`--app=${address}`}' -ErrorAction Stop; exit 0 } catch {} }; Start-Process '${address}'`;
    return spawnSync('powershell.exe', ['-NoProfile','-Command',ps], {stdio:'ignore'}).status === 0;
  }
  for (const executable of ['google-chrome','chromium','chromium-browser','microsoft-edge']) {
    if (spawnSync('which',[executable],{stdio:'ignore'}).status !== 0) continue;
    const child = spawn(executable,[`--app=${address}`],{stdio:'ignore',detached:true});
    child.unref(); return true;
  }
  return spawnSync('xdg-open',[address],{stdio:'ignore'}).status === 0;
}

export async function startDesktop(): Promise<{url: string; server: ChildProcess | null}> {
  if (!existsSync(resolve(root,'node_modules'))) throw new Error('Run npm install in the Quiver folder first.');
  // The generated bundle may belong to an older source revision; rebuild each launch.
  const build = spawnSync(npm,['run','build'],{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
  if (build.status !== 0) throw new Error('Quiver production build failed.');
  let server: ChildProcess | null = null;
  if (!await healthy()) {
    server = spawn(npm,['run','preview','--','--host','127.0.0.1','--port',String(port)],{
      cwd:root,stdio:'inherit',shell:process.platform==='win32',env:{...process.env,PORT:String(port)},
    });
    for (let i=0;i<60 && !await healthy();i++) {
      if (server.exitCode !== null) throw new Error('Desktop preview server exited.');
      await delay(500);
    }
    if (!await healthy()) {server.kill();throw new Error('Desktop preview did not start.');}
  }
  if (!openWindow(url)) {server?.kill();throw new Error('No browser available for desktop window.');}
  return {url,server};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startDesktop().then(({url,server}) => {
    process.stdout.write(`Quiver desktop opened at ${url}\n`);
    if (server) {
      const stop = () => {server.kill();process.exit(0);};
      process.on('SIGINT',stop);process.on('SIGTERM',stop);
    }
  }).catch(error => {console.error(error);process.exitCode=1;});
}
