const { app, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');

// Função para criar a janela principal da aplicação
async function createWindow() {
  // Importa dinamicamente o 'electron-is-dev' para compatibilidade
  const { default: isDev } = await import('electron-is-dev');

  // Cria a janela do navegador.
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // O preload agora é carregado a partir da raiz do projeto
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Carrega a aplicação React.
  // Em desenvolvimento, carrega a partir do servidor de desenvolvimento.
  // Em produção, carrega o ficheiro index.html da pasta 'build'.
  const startUrl = isDev
    ? 'http://localhost:3000'
    : url.format({
        // CORREÇÃO: O caminho agora parte da raiz do projeto para a pasta 'build'.
        pathname: path.join(__dirname, 'build/index.html'),
        protocol: 'file:',
        slashes: true,
      });

  win.loadURL(startUrl);

  // Abre as Ferramentas de Desenvolvedor (DevTools) se estiver em modo de desenvolvimento.
  if (isDev) {
    win.webContents.openDevTools();
  }
}

// Este método será chamado quando o Electron terminar
// a inicialização e estiver pronto para criar janelas de navegador.
app.whenReady().then(() => {
  createWindow();

  // No macOS, é comum recriar uma janela na aplicação quando o
  // ícone da dock é clicado e não existem outras janelas abertas.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Saia quando todas as janelas estiverem fechadas, exceto no macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
