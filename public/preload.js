// O script de pré-carregamento (preload) corre num contexto privilegiado que tem
// acesso tanto ao Node.js do Electron como às APIs do navegador.
// No entanto, por razões de segurança, não devemos expor APIs do Node.js diretamente
// ao código da sua página web (o processo de renderização).

// Em vez disso, usamos a `contextBridge` para expor APIs controladas e seguras.
const { contextBridge } = require('electron');

// Por enquanto, não precisamos de expor nenhuma funcionalidade do sistema operativo
// para a nossa aplicação React, por isso, esta ponte está vazia.
// No futuro, se quiséssemos, por exemplo, ler um ficheiro do sistema,
// adicionaríamos a função aqui.

contextBridge.exposeInMainWorld('electronAPI', {
  // Exemplo:
  // loadCampaign: () => ipcRenderer.invoke('dialog:openFile'),
});
