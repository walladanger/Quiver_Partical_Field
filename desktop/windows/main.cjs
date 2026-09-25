const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

const isDevelopment = !app.isPackaged && process.argv.includes('--dev');
const smokeTest = process.argv.includes('--smoke-test');
const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';

function createWindow() {
  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#07090c',
    title: 'Quiver Partical Field',
    show: !smokeTest,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDevelopment) void window.loadURL(devUrl);
  else void window.loadFile(path.join(__dirname, 'dist', 'index.html'));

  if (smokeTest) {
    window.webContents.once('did-finish-load', async () => {
      try {
        const result = await window.webContents.executeJavaScript(`(async () => {
          const canvas = document.querySelector('#field');
          const status = document.querySelector('#status');
          const presets = document.querySelectorAll('#presets option').length;
          if (!canvas || !canvas.getContext('2d')) throw new Error('Canvas renderer did not start');
          if (presets !== 8) throw new Error('Equation presets did not load');
          if (document.querySelector('#particle-total').textContent !== '420') throw new Error('Initial particle set did not load');
          const originalStatus = status.textContent;
          const input = document.querySelector('#equation');
          input.value = 'sin(x) + cos(y) = 0';
          document.querySelector('#equation-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          if (status.textContent === originalStatus) throw new Error('Equation Apply did not recompile the field');
          document.querySelector('#play').click();
          if (document.querySelector('#play').getAttribute('aria-pressed') !== 'false') throw new Error('Pause control did not toggle');
          document.querySelector('#reroll').click();
          if (document.querySelector('#variation').textContent !== '1') throw new Error('Variation control did not change');
          document.querySelector('#restart').click();
          if (document.querySelector('#variation').textContent !== '0') throw new Error('Restart did not restore deterministic variation');
          return { canvas: 'ok', presets, particles: 420, equation: 'ok', playback: 'ok', variation: 'ok' };
        })()`);
        console.log('[Quiver smoke test]', JSON.stringify(result));
        app.exit(0);
      } catch (error) {
        console.error('[Quiver smoke test failed]', error);
        app.exit(1);
      }
    });
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
