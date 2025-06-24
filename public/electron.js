const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const campaignsPath = path.join(app.getPath('documents'), 'StarForge', 'Campaigns');
fs.mkdirSync(campaignsPath, { recursive: true });

async function createWindow() {
  const { default: isDev } = await import('electron-is-dev');

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev,
    },
  });

  mainWindow.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  );

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  // --- Início dos Handlers IPC ---

  ipcMain.handle('backup-campaign', async (event, campaignData) => {
    if (!campaignData || !campaignData.name) {
      return { success: false, message: 'Dados da campanha inválidos para backup.' };
    }
    const result = await dialog.showSaveDialog({
      title: 'Fazer Backup da Campanha',
      buttonLabel: 'Salvar Backup',
      defaultPath: `${campaignData.name.replace(/[^a-z0-9]/gi, '_')}.json`,
      filters: [{ name: 'Ficheiros de Campanha StarForge', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePath) {
      return { success: false, message: 'Backup cancelado pelo utilizador.' };
    }
    try {
      await fs.promises.writeFile(result.filePath, JSON.stringify(campaignData, null, 2));
      return { success: true };
    } catch (error) {
      console.error('Erro ao fazer backup da campanha:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('import-campaign', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Importar Campanha',
      buttonLabel: 'Importar',
      properties: ['openFile'],
      filters: [{ name: 'Ficheiros de Campanha StarForge', extensions: ['json'] }]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: 'Nenhum ficheiro selecionado.' };
    }
    const sourcePath = result.filePaths[0];
    try {
      const fileContent = await fs.promises.readFile(sourcePath, 'utf-8');
      const campaignData = JSON.parse(fileContent);
      if (!campaignData.id || !campaignData.name) {
        throw new Error('O ficheiro selecionado não parece ser uma campanha válida.');
      }
      const destinationPath = path.join(campaignsPath, `${campaignData.id}.json`);
      if (fs.existsSync(destinationPath)) {
        throw new Error(`Uma campanha com o ID "${campaignData.id}" já existe.`);
      }
      await fs.promises.writeFile(destinationPath, fileContent);
      return { success: true, campaign: campaignData };
    } catch (error) {
      console.error('Erro ao importar campanha:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('open-campaigns-folder', () => shell.openPath(campaignsPath));
  
  ipcMain.handle('get-campaigns', async () => { 
    try { 
      const files = await fs.promises.readdir(campaignsPath); 
      const jsonFiles = files.filter(f => f.endsWith('.json')); 
      return Promise.all(jsonFiles.map(async f => JSON.parse(await fs.promises.readFile(path.join(campaignsPath, f), 'utf-8')))); 
    } catch (e) { console.error('Erro ao carregar campanhas:', e); return []; } 
  });
  
  ipcMain.handle('save-campaign', async (e, d) => { 
    try { 
      if (!d || !d.id) throw new Error("Dados da campanha para salvar são inválidos.");
      await fs.promises.writeFile(path.join(campaignsPath, `${d.id}.json`), JSON.stringify(d, null, 2)); 
      return { success: true }; 
    } catch (err) { return { success: false, message: err.message }; } 
  });
  
  ipcMain.handle('delete-campaign', async (e, id) => { 
    try { 
      if (!id) throw new Error("ID da campanha para apagar é inválido.");
      const p = path.join(campaignsPath, `${id}.json`); 
      if (fs.existsSync(p)) await fs.promises.unlink(p); 
      return { success: true }; 
    } catch (err) { return { success: false, message: err.message }; } 
  });
  
  ipcMain.handle('gemini-api-call', async (e, p) => { 
    const k = "SUA_CHAVE_API_VAI_AQUI"; 
    if (k.startsWith("SUA")) return JSON.stringify({error:{message:"Chave da API não configurada no electron.js"}}); 
    try { 
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${k}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:p}]}]})}); 
      const d=await r.json(); 
      return r.ok ? d.candidates[0].content.parts[0].text : JSON.stringify({error:d.error}); 
    } catch (err) { return JSON.stringify({error:{message:err.message}}); } 
  });
  
  // --- Fim dos Handlers IPC ---

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});