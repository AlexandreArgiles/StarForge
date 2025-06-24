const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // NOVO: Adicionamos a função para fazer backup de uma campanha
  backupCampaign: (campaignData) => ipcRenderer.invoke('backup-campaign', campaignData),

  // (Funções existentes permanecem aqui)
  importCampaign: () => ipcRenderer.invoke('import-campaign'),
  getCampaigns: () => ipcRenderer.invoke('get-campaigns'),
  saveCampaign: (campaignData) => ipcRenderer.invoke('save-campaign', campaignData),
  deleteCampaign: (campaignId) => ipcRenderer.invoke('delete-campaign', campaignId),
  openCampaignsFolder: () => ipcRenderer.invoke('open-campaigns-folder'),
  callGemini: (prompt) => ipcRenderer.invoke('gemini-api-call', prompt)
});