import React, { useState, useEffect, useCallback } from 'react';

// --- Funções da API Gemini ---
const callGeminiAPI = async (prompt, showNotification) => {
    // A Chave de API é usada tanto para Gemini (texto) quanto para Imagen (imagens).
    const apiKey = "SUA_CHAVE_DA_API_AQUI"; 

    if (apiKey === "SUA_CHAVE_DA_API_AQUI" || !apiKey) {
        showNotification("Erro: Chave da API não configurada no código.", "error");
        return null;
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) {
            console.error('Erro da API Gemini:', result);
            const errorMessage = result?.error?.message || response.statusText || "Erro desconhecido da API Gemini";
            showNotification(`Erro ao gerar texto com IA: ${errorMessage}`, 'error');
            return null;
        }
        if (result.candidates && result.candidates[0].content?.parts?.length > 0) {
            return result.candidates[0].content.parts[0].text;
        } else {
            console.error('Resposta de texto inesperada da API Gemini:', result);
            showNotification('Não foi possível obter uma resposta de texto válida da IA.', 'error');
            return null;
        }
    } catch (error) {
        console.error('Erro ao chamar a API Gemini:', error);
        showNotification(`Erro de conexão com a IA de texto: ${error.message}`, 'error');
        return null;
    }
};

// --- Utilitários para localStorage ---
const LOCAL_STORAGE_KEY = 'starforge_local_data_v1';

const loadDataFromLocalStorage = () => {
    try {
        const serializedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (serializedData === null) {
            return { campaigns: [] }; 
        }
        return JSON.parse(serializedData);
    } catch (error) {
        console.error("Erro ao carregar dados do localStorage:", error);
        return { campaigns: [] }; 
    }
};

const saveDataToLocalStorage = (data) => {
    try {
        const serializedData = JSON.stringify(data);
        localStorage.setItem(LOCAL_STORAGE_KEY, serializedData);
    } catch (error) {
        console.error("Erro ao salvar dados no localStorage:", error);
    }
};

const formatDistance = (value) => {
    const speedTranslations = {'walk': 'andar', 'fly': 'voo', 'swim': 'natação', 'burrow': 'escavação', 'climb': 'escalada'};
    if (typeof value === 'object' && value !== null) {
         return Object.entries(value).map(([key, val]) => `${speedTranslations[key] || key} ${formatDistance(val)}`).join(', ');
    }
    if (typeof value === 'number') {
        const meters = Math.round(value * 0.3048);
        return `${meters}m (${value} pés)`;
    }
    if (typeof value === 'string') {
        const feetRegex = /(\d+)\s*-?\s*(foot|feet|ft\.)/g;
        return value.replace(feetRegex, (match, feetValue) => {
            const meters = Math.round(parseInt(feetValue, 10) * 0.3048);
            return `${meters}m (${feetValue} pés)`;
        });
    }
    return value; 
};

// --- Componentes de UI ---
const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
    if (!isOpen) return null;
    const sizeClasses = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl', '4xl': 'max-w-4xl' };
    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300" onClick={onClose}>
            <div 
                className={`bg-slate-800 border border-slate-700 p-6 rounded-lg shadow-2xl shadow-cyan-500/10 w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto transform transition-all duration-300 ease-in-out`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
                    <h2 className="text-2xl font-bold text-cyan-400 font-orbitron">{title}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl leading-none p-1 rounded-full hover:bg-slate-700 transition-colors">&times;</button>
                </div>
                {children}
            </div>
        </div>
    );
};

const Notification = ({ message, type, onClose }) => {
    if (!message) return null;
    const typeClasses = {
        error: 'from-red-500 to-red-600', success: 'from-green-500 to-green-600',
        info: 'from-sky-500 to-sky-600', warning: 'from-yellow-400 to-yellow-500 text-slate-900'
    };
    return (
        <div className={`fixed top-5 right-5 bg-gradient-to-br ${typeClasses[type] || typeClasses.info} text-white p-4 rounded-lg shadow-2xl shadow-black/50 z-[100] flex items-center space-x-3 transition-all duration-300 ease-in-out`}>
            <span className="font-semibold">{message}</span>
            <button onClick={onClose} className="ml-auto font-bold text-lg leading-none p-1 rounded-full hover:bg-black/20 transition-colors">&times;</button>
        </div>
    );
};

const ConfirmModal = ({ isOpen, onClose, title, message, onConfirm, confirmText = "Confirmar", cancelText = "Cancelar" }) => {
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
            <p className="text-slate-300 mb-6">{message}</p>
            <div className="flex justify-end space-x-3">
                <button onClick={onClose} className="py-2 px-4 bg-slate-600 hover:bg-slate-500 rounded-md text-white transition-colors">Cancelar</button>
                <button onClick={() => { onConfirm(); onClose(); }} className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded-md text-white transition-colors">{confirmText}</button>
            </div>
        </Modal>
    );
};

const ViewDetailModal = ({ isOpen, onClose, itemData, isLoading }) => {
    if (!isOpen || !itemData) return null;

    const { item } = itemData;
    
    const attributeTranslations = {
        strength: 'FOR', dexterity: 'DES', constitution: 'CON',
        intelligence: 'INT', wisdom: 'SAB', charisma: 'CAR'
    };

    const renderContent = () => {
        if(isLoading) {
            return <div className="flex justify-center items-center h-40"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-500"></div><p className="ml-3 text-slate-400">A traduzir...</p></div>
        }

        switch (itemData.type) {
            case 'image':
                return (
                    <>
                        {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-auto max-h-80 object-contain rounded mb-4 bg-slate-900/50" />}
                        <p className="text-slate-300 whitespace-pre-line">{item.description}</p>
                    </>
                );
            case 'npc':
                return (
                    <>
                        {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-auto max-h-80 object-contain rounded mb-4 bg-slate-900/50" />}
                        <p className="text-slate-300 whitespace-pre-line">{item.description}</p>
                        {item.keywords && <p className="text-xs text-slate-500 mt-2">Palavras-chave: {item.keywords}</p>}
                    </>
                );
            case 'bestiary':
                // Se for um monstro da API SRD, formata os dados completos
                if (item.source === 'srd' && item.fullData) {
                    const data = item.fullData;
                    return (
                        <div className="space-y-2 text-sm text-slate-300">
                            <p>{data.size} {data.type}, {data.alignment}</p>
                            <p><strong>Classe de Armadura:</strong> {data.armor_class?.map(ac => `${ac.value} (${ac.type})`).join(', ') || 'N/A'}</p>
                            <p><strong>Pontos de Vida:</strong> {data.hit_points} ({data.hit_dice})</p>
                            <p><strong>Deslocamento:</strong> {formatDistance(data.speed)}</p>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center my-2 pt-2 border-t border-slate-700">
                                {Object.keys(attributeTranslations).map(attr => (
                                     <div key={attr}><p className="font-bold uppercase">{attributeTranslations[attr]}</p><p>{data[attr]} ({(Math.floor((data[attr] - 10) / 2)) >= 0 ? '+' : ''}{Math.floor((data[attr] - 10) / 2)})</p></div>
                                ))}
                            </div>
                            {data.special_abilities?.length > 0 && <div className="pt-2 border-t border-slate-700"><strong>Habilidades Especiais:</strong> {data.special_abilities.map(a => <div key={a.name} className="mt-1"><p className="font-semibold">{a.name}:</p><p>{a.desc}</p></div>)}</div>}
                            {data.actions?.length > 0 && <div className="pt-2 border-t border-slate-700"><strong>Ações:</strong> {data.actions.map(a => <div key={a.name} className="mt-1"><p className="font-semibold">{a.name}:</p><p>{a.desc}</p></div>)}</div>}
                            {data.legendary_actions?.length > 0 && <div className="pt-2 border-t border-slate-700"><strong>Ações Lendárias:</strong> {data.legendary_actions.map(a => <div key={a.name} className="mt-1"><p className="font-semibold">{a.name}:</p><p>{a.desc}</p></div>)}</div>}
                        </div>
                    );
                }
                // Se for gerado por IA ou manual
                return (
                     <div className="space-y-2 text-sm text-slate-300">
                        <p className="whitespace-pre-line">{item.description}</p>
                        <p className="font-semibold mt-2">Atributos:</p>
                        <p className="whitespace-pre-line">{item.stats}</p>
                    </div>
                );
            default:
                return <p>Tipo de item desconhecido.</p>;
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={item.name} size="xl">
            {renderContent()}
        </Modal>
    );
};

// --- Componente para Importar Monstros ---
const ImportMonsterModal = ({ isOpen, onClose, onImport, showNotification }) => {
    const DND_API_BASE_URL = "https://www.dnd5eapi.co/api";
    const [allMonsters, setAllMonsters] = useState([]);
    const [filteredMonsters, setFilteredMonsters] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        const fetchAllMonsters = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`${DND_API_BASE_URL}/monsters`);
                if (!response.ok) throw new Error("Falha ao carregar lista de monstros do SRD.");
                const data = await response.json();
                setAllMonsters(data.results);
                setFilteredMonsters(data.results);
            } catch (error) {
                console.error(error);
                showNotification(error.message, 'error');
            }
            setIsLoading(false);
        };
        fetchAllMonsters();
    }, [isOpen, showNotification]);

    useEffect(() => {
        if (!searchTerm) {
            setFilteredMonsters(allMonsters);
        } else {
            setFilteredMonsters(
                allMonsters.filter(monster =>
                    monster.name.toLowerCase().includes(searchTerm.toLowerCase())
                )
            );
        }
    }, [searchTerm, allMonsters]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Importar Monstro do SRD" size="lg">
            <div className="space-y-4">
                <input
                    type="text"
                    placeholder="Pesquisar monstro..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full p-2 bg-slate-700 rounded border border-slate-600"
                />
                {isLoading ? (
                    <p className="text-slate-400">Carregando monstros...</p>
                ) : (
                    <div className="max-h-80 overflow-y-auto pr-2">
                        {filteredMonsters.map(monster => (
                            <button
                                key={monster.index}
                                onClick={() => onImport(monster.url)}
                                className="block w-full text-left p-2 rounded hover:bg-slate-700 transition-colors"
                            >
                                {monster.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
};


// --- Componentes da Aplicação Local ---

const MasterDashboard = ({ campaignsData, setCampaignsData, showNotification }) => {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newCampaignName, setNewCampaignName] = useState('');
    const [newCampaignDesc, setNewCampaignDesc] = useState('');
    const [campaignTheme, setCampaignTheme] = useState('');
    const [selectedCampaign, setSelectedCampaign] = useState(null);
    const [loadingAction, setLoadingAction] = useState(false);
    const [generatingIdeas, setGeneratingIdeas] = useState(false);
    const [aiCampaignIdeas, setAiCampaignIdeas] = useState([]);
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [campaignToDeleteId, setCampaignToDeleteId] = useState(null);

    const handleGenerateCampaignIdeas = async () => {
        if (!campaignTheme.trim()) {
            showNotification("Por favor, insira um tema ou gênero.", "warning");
            return;
        }
        setGeneratingIdeas(true);
        setAiCampaignIdeas([]);
        const prompt = `Gere 3 ideias concisas para nomes e descrições de campanhas de RPG de mesa com o tema: "${campaignTheme}". Formato: [{"name": "Nome Ideia", "description": "Descrição."}]`;
        
        const resultText = await callGeminiAPI(prompt, showNotification);
        if (resultText) {
            try {
                const jsonMatch = resultText.match(/(\[[\s\S]*\])/);
                if (jsonMatch && jsonMatch[0]) {
                    const parsedIdeas = JSON.parse(jsonMatch[0]);
                    if (Array.isArray(parsedIdeas) && parsedIdeas.every(idea => idea.name && idea.description)) {
                         setAiCampaignIdeas(parsedIdeas);
                         showNotification("Ideias geradas com IA!", "success");
                    } else { throw new Error("Formato de ideias da IA inválido."); }
                } else { throw new Error("Nenhum JSON de ideias encontrado na resposta da IA."); }
            } catch (e) {
                console.error("Erro ao processar ideias da IA:", e);
                showNotification(`Erro ao processar ideias da IA: ${e.message}`, "error");
            }
        }
        setGeneratingIdeas(false);
    };

    const handleCreateCampaign = (e) => {
        e.preventDefault();
        if (!newCampaignName.trim()) {
            showNotification("O nome da campanha é obrigatório.", "error"); return;
        }
        setLoadingAction(true);
        const newCampaign = {
            id: crypto.randomUUID(),
            name: newCampaignName,
            description: newCampaignDesc,
            images: [], npcs: [], materials: [], gmNotes: [], characterSheetsData: [], bestiary: [], events: [],
            createdAt: new Date().toISOString(),
        };
        const updatedCampaigns = [...campaignsData.campaigns, newCampaign];
        setCampaignsData({ ...campaignsData, campaigns: updatedCampaigns });
        
        showNotification("Campanha criada com sucesso!", "success");
        setNewCampaignName(''); setNewCampaignDesc(''); setCampaignTheme(''); setAiCampaignIdeas([]);
        setShowCreateModal(false);
        setLoadingAction(false);
    };
    
    const requestDeleteCampaign = (campaignId) => {
        setCampaignToDeleteId(campaignId);
        setShowConfirmDeleteModal(true);
    };

    const executeDeleteCampaign = () => {
        if (!campaignToDeleteId) return;
        setLoadingAction(true);
        const updatedCampaigns = campaignsData.campaigns.filter(c => c.id !== campaignToDeleteId);
        setCampaignsData({ ...campaignsData, campaigns: updatedCampaigns });
        
        showNotification("Campanha excluída com sucesso.", "success");
        if (selectedCampaign && selectedCampaign.id === campaignToDeleteId) {
            setSelectedCampaign(null);
        }
        setCampaignToDeleteId(null);
        setLoadingAction(false);
    };
    
    const updateCampaign = (updatedCampaign) => {
        const updatedCampaigns = campaignsData.campaigns.map(c => 
            c.id === updatedCampaign.id ? updatedCampaign : c
        );
        setCampaignsData({ ...campaignsData, campaigns: updatedCampaigns });
    };


    if (selectedCampaign) {
        return <ManageLocalCampaign 
                    campaign={selectedCampaign} 
                    updateCampaignInList={updateCampaign}
                    showNotification={showNotification} 
                    goBack={() => setSelectedCampaign(null)} 
                    onDeleteCampaignRequest={() => requestDeleteCampaign(selectedCampaign.id)} 
                />;
    }

    return (
        <div className="p-4 md:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold text-cyan-400 font-orbitron">Minhas Campanhas</h2>
                <button onClick={() => { setShowCreateModal(true); setAiCampaignIdeas([]); setCampaignTheme(''); setNewCampaignName(''); setNewCampaignDesc(''); }} 
                    className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition duration-150 shadow-md hover:shadow-lg shadow-cyan-500/20 w-full sm:w-auto">
                    + Nova Campanha
                </button>
            </div>

            {loadingAction && <div className="text-center py-5"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500 mx-auto"></div></div>}
            
            {!loadingAction && campaignsData.campaigns.length === 0 && (
                <div className="text-center py-10 bg-slate-800/50 border border-slate-700 rounded-lg shadow-inner"><svg className="mx-auto h-12 w-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg><h3 className="mt-2 text-xl font-medium text-slate-300">Nenhuma campanha criada</h3><p className="mt-1 text-sm text-slate-500">Crie sua primeira aventura!</p></div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {campaignsData.campaigns.map(campaign => (
                    <div key={campaign.id} className="bg-slate-800 p-6 rounded-lg shadow-xl border border-slate-700/50 hover:border-cyan-500/50 hover:shadow-cyan-500/10 transition-all duration-300 transform hover:-translate-y-1">
                        <h3 className="text-xl font-orbitron font-semibold text-cyan-300 mb-2 truncate">{campaign.name}</h3>
                        <p className="text-slate-400 text-sm mb-4 h-20 overflow-hidden line-clamp-3">{campaign.description || "Sem descrição."}</p>
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-4 border-t border-slate-700">
                           <button onClick={() => setSelectedCampaign(campaign)} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md text-sm transition duration-150 shadow-md">Gerenciar</button>
                           <button onClick={() => requestDeleteCampaign(campaign.id)} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-md text-sm transition duration-150 shadow-md">Excluir</button>
                        </div>
                    </div>
                ))}
            </div>

            <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Criar Nova Campanha" size="lg">
                <form onSubmit={handleCreateCampaign} className="space-y-4">
                    <div><label className="block text-sm font-medium text-slate-300">Nome da Campanha</label><input type="text" value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)} className="w-full p-3 bg-slate-700 rounded-md border border-slate-600" required /></div>
                    <div><label className="block text-sm font-medium text-slate-300">Descrição</label><textarea value={newCampaignDesc} onChange={(e) => setNewCampaignDesc(e.target.value)} rows="3" className="w-full p-3 bg-slate-700 rounded-md border border-slate-600" /></div>
                    <div className="pt-2 border-t border-slate-700 space-y-3">
                        <h4 className="text-md font-semibold text-cyan-400 font-orbitron">✨ Assistente com IA</h4>
                        <div><label className="block text-sm font-medium text-slate-300">Tema/Gênero para Ideias</label><input type="text" value={campaignTheme} onChange={(e) => setCampaignTheme(e.target.value)} className="w-full p-3 bg-slate-700 rounded-md border border-slate-600" placeholder="Ex: Fantasia medieval, Ficção científica" /></div>
                        <button type="button" onClick={handleGenerateCampaignIdeas} disabled={generatingIdeas || !campaignTheme.trim()} className="w-full p-3 bg-teal-600 hover:bg-teal-700 rounded-md font-semibold transition duration-150 disabled:opacity-50 flex items-center justify-center gap-2">
                            {generatingIdeas ? <><svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75"></path></svg>Gerando...</> : "✨ Gerar Ideias com IA"}
                        </button>
                        {aiCampaignIdeas.length > 0 && (
                            <div className="mt-4 space-y-3 bg-slate-700/50 p-3 rounded-md max-h-48 overflow-y-auto">{aiCampaignIdeas.map((idea, index) => (<div key={index} className="p-2 border border-slate-600 rounded-md hover:bg-slate-600/50"><p className="font-medium text-cyan-300">{idea.name}</p><p className="text-xs text-slate-400">{idea.description}</p><button type="button" onClick={() => { setNewCampaignName(idea.name); setNewCampaignDesc(idea.description); }} className="mt-1 text-xs text-teal-400 hover:text-teal-300">Usar</button></div>))}</div>
                        )}
                    </div>
                    <button type="submit" disabled={loadingAction} className="w-full p-3 bg-green-500 hover:bg-green-600 rounded-md font-semibold disabled:opacity-60">{loadingAction ? 'Criando...' : 'Criar Campanha'}</button>
                </form>
            </Modal>
            <ConfirmModal isOpen={showConfirmDeleteModal} onClose={() => setShowConfirmDeleteModal(false)} title="Excluir Campanha" message="Tem certeza? Todos os dados desta campanha local serão perdidos." onConfirm={executeDeleteCampaign} confirmText="Excluir" />
        </div>
    );
};


// Gerenciamento de uma Campanha Local Específica
const ManageLocalCampaign = ({ campaign: initialCampaign, updateCampaignInList, showNotification, goBack, onDeleteCampaignRequest }) => {
    const [campaign, setCampaign] = useState(initialCampaign); 
    const [activeTab, setActiveTab] = useState('info'); 
    
    // Campos para "Imagens"
    const [showImageModal, setShowImageModal] = useState(false);
    const [imageName, setImageName] = useState('');
    const [imageDescription, setImageDescription] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [editingImage, setEditingImage] = useState(null);

    // Campos para "NPCs"
    const [showNpcModal, setShowNpcModal] = useState(false);
    const [npcName, setNpcName] = useState('');
    const [npcDesc, setNpcDesc] = useState('');
    const [npcKeywords, setNpcKeywords] = useState('');
    const [npcImageUrl, setNpcImageUrl] = useState(''); 
    const [generatingNpcDesc, setGeneratingNpcDesc] = useState(false);
    const [editingNpc, setEditingNpc] = useState(null);

    // Campos para "Bestiário"
    const [showMonsterGeneratorModal, setShowMonsterGeneratorModal] = useState(false);
    const [showAddMonsterModal, setShowAddMonsterModal] = useState(false);
    const [monsterName, setMonsterName] = useState('');
    const [monsterDescription, setMonsterDescription] = useState('');
    const [monsterStats, setMonsterStats] = useState('');
    const [editingMonster, setEditingMonster] = useState(null);
    const [monsterGenKeywords, setMonsterGenKeywords] = useState('');
    const [generatedMonster, setGeneratedMonster] = useState(null); 
    const [generatingMonster, setGeneratingMonster] = useState(false);
    const [showImportMonsterModal, setShowImportMonsterModal] = useState(false);

    // Campos para "Materiais"
    const [showMaterialModal, setShowMaterialModal] = useState(false);
    const [materialName, setMaterialName] = useState('');
    const [materialNotes, setMaterialNotes] = useState('');
    const [editingMaterial, setEditingMaterial] = useState(null);

    // Campos para "Notas do Mestre"
    const [showGmNoteModal, setShowGmNoteModal] = useState(false);
    const [gmNoteContent, setGmNoteContent] = useState('');
    const [editingGmNote, setEditingGmNote] = useState(null);
    
    const [showCharacterSheetModal, setShowCharacterSheetModal] = useState(false);
    const [csPlayerName, setCsPlayerName] = useState(''); 
    const [csCharacterName, setCsCharacterName] = useState('');
    const [csClass, setCsClass] = useState('');
    const [csLevel, setCsLevel] = useState(1);
    const [csAttributes, setCsAttributes] = useState({});
    const [csOtherNotes, setCsOtherNotes] = useState('');
    const [editingCharacterSheet, setEditingCharacterSheet] = useState(null);


    const [showConfirmDeleteItemModal, setShowConfirmDeleteItemModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null); 
    
    const [viewingItem, setViewingItem] = useState(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);


    useEffect(() => {
        setCampaign(initialCampaign);
    }, [initialCampaign]);

    const saveCampaignChanges = useCallback((updatedCampaignData) => {
        const newCampaignState = { ...campaign, ...updatedCampaignData, updatedAt: new Date().toISOString() };
        setCampaign(newCampaignState); 
        updateCampaignInList(newCampaignState); 
    }, [campaign, updateCampaignInList]);

    // --- Funções CRUD ---

    const handleImageFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageFile(reader.result); // Salva a imagem como base64
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleSaveImage = () => {
        if (!imageName.trim()) { showNotification("O nome da imagem é obrigatório.", "warning"); return; }
        let updatedImages;
        const imageData = { name: imageName, description: imageDescription, imageUrl: editingImage ? (imageFile || editingImage.imageUrl) : imageFile };
        
        if (editingImage) {
            updatedImages = campaign.images.map(img => img.id === editingImage.id ? { ...editingImage, ...imageData } : img);
        } else {
            if (!imageFile) { showNotification("Por favor, selecione um arquivo de imagem.", "warning"); return; }
            updatedImages = [...(campaign.images || []), { id: crypto.randomUUID(), ...imageData }];
        }
        saveCampaignChanges({ images: updatedImages });
        setShowImageModal(false); setEditingImage(null); setImageName(''); setImageDescription(''); setImageFile(null);
        showNotification(editingImage ? "Imagem atualizada!" : "Imagem adicionada!", "success");
    };

    const openEditImageModal = (e, img) => {
        e.stopPropagation();
        setEditingImage(img);
        setImageName(img.name);
        setImageDescription(img.description);
        setImageFile(img.imageUrl); // Preenche para visualização, mas a mudança requer novo upload
        setShowImageModal(true);
    };

    const handleGenerateNpcDescription = async () => {
        if (!npcName.trim()) { showNotification("Insira o nome do NPC.", "warning"); return; }
        setGeneratingNpcDesc(true);
        const prompt = `Gere uma descrição (backstory, aparência, personalidade) para um NPC de RPG chamado "${npcName}"${npcKeywords ? ` com características: "${npcKeywords}"` : ""}.`;
        const desc = await callGeminiAPI(prompt, showNotification);
        if (desc) { setNpcDesc(desc); showNotification("Descrição gerada!", "success");}
        setGeneratingNpcDesc(false);
    };
    const handleSaveNpc = () => {
        if (!npcName.trim()) { showNotification("Nome do NPC é obrigatório.", "warning"); return; }
        let updatedNpcs;
        const npcData = { name: npcName, description: npcDesc, keywords: npcKeywords, imageUrl: npcImageUrl };
        if (editingNpc) {
            updatedNpcs = campaign.npcs.map(n => n.id === editingNpc.id ? { ...editingNpc, ...npcData } : n);
        } else {
            updatedNpcs = [...(campaign.npcs || []), { id: crypto.randomUUID(), ...npcData }];
        }
        saveCampaignChanges({ npcs: updatedNpcs });
        setShowNpcModal(false); setEditingNpc(null); setNpcName(''); setNpcDesc(''); setNpcKeywords(''); setNpcImageUrl('');
        showNotification(editingNpc ? "NPC atualizado!" : "NPC adicionado!", "success");
    };
    const openEditNpcModal = (e, npc) => {
        e.stopPropagation();
        setEditingNpc(npc); setNpcName(npc.name); setNpcDesc(npc.description); setNpcKeywords(npc.keywords || ''); setNpcImageUrl(npc.imageUrl || ''); setShowNpcModal(true);
    };

    const handleGenerateMonster = async () => {
        if (!monsterGenKeywords.trim()) { showNotification("Insira algumas palavras-chave para o monstro.", "warning"); return; }
        setGeneratingMonster(true);
        setGeneratedMonster(null);
        const prompt = `Gere uma criatura de RPG de mesa com base nas seguintes palavras-chave: "${monsterGenKeywords}". Formate a resposta como um objeto JSON com as chaves "name", "description" e "stats". A chave "stats" deve ser uma string com os atributos e habilidades principais da criatura. Exemplo de formato: {"name": "Goblin Ladrão", "description": "Uma criatura pequena e sorrateira...", "stats": "HP: 7, AC: 13, Ataque: Adaga +4 (1d4+2 dano perfurante)"}`;
        
        const resultText = await callGeminiAPI(prompt, showNotification);
        if (resultText) {
            try {
                const jsonMatch = resultText.match(/(\{[\s\S]*\})/);
                if (jsonMatch && jsonMatch[0]) {
                    const parsedMonster = JSON.parse(jsonMatch[0]);
                    if (parsedMonster.name && parsedMonster.description && parsedMonster.stats) {
                        setGeneratedMonster(parsedMonster);
                        showNotification("Monstro gerado com sucesso!", "success");
                    } else { throw new Error("Formato do monstro gerado pela IA é inválido."); }
                } else { throw new Error("Nenhum JSON de monstro encontrado na resposta da IA."); }
            } catch (e) {
                console.error("Erro ao processar monstro da IA:", e);
                showNotification(`Erro ao processar monstro da IA: ${e.message}`, "error");
            }
        }
        setGeneratingMonster(false);
    };

    const handleAddGeneratedMonsterToBestiary = () => {
        if (!generatedMonster) { showNotification("Nenhum monstro gerado para adicionar.", "warning"); return; }
        const newMonster = { ...generatedMonster, id: crypto.randomUUID(), source: 'ai' };
        saveCampaignChanges({ bestiary: [...(campaign.bestiary || []), newMonster] });
        setShowMonsterGeneratorModal(false); setGeneratedMonster(null); setMonsterGenKeywords('');
        showNotification(`${newMonster.name} foi adicionado ao Bestiário!`, "success");
    };
    
    const handleImportMonster = async (monsterUrl) => {
        try {
            const response = await fetch(`https://www.dnd5eapi.co${monsterUrl}`);
            if (!response.ok) throw new Error('Falha ao buscar detalhes do monstro.');
            const monsterData = await response.json();
            const newMonster = {
                id: crypto.randomUUID(),
                name: monsterData.name,
                source: 'srd', // Indica que veio do SRD
                fullData: monsterData // Salva todos os dados da API
            };
            saveCampaignChanges({ bestiary: [...(campaign.bestiary || []), newMonster] });
            showNotification(`${newMonster.name} importado para o Bestiário!`, "success");
        } catch (error) {
            showNotification(`Erro ao importar monstro: ${error.message}`, 'error');
        }
        setShowImportMonsterModal(false);
    };

    const handleSaveMonster = (e) => {
        e.preventDefault();
        if (!monsterName.trim()) { showNotification("O nome do monstro é obrigatório.", "warning"); return; }
        const monsterData = {
            name: monsterName,
            description: monsterDescription,
            stats: monsterStats,
            source: 'manual', // Indica que foi criado manualmente
        };
        let updatedBestiary;
        if (editingMonster) {
            updatedBestiary = campaign.bestiary.map(m => m.id === editingMonster.id ? { ...editingMonster, ...monsterData } : m);
        } else {
            updatedBestiary = [...(campaign.bestiary || []), { ...monsterData, id: crypto.randomUUID() }];
        }
        saveCampaignChanges({ bestiary: updatedBestiary });
        setShowAddMonsterModal(false);
        setEditingMonster(null);
        setMonsterName(''); setMonsterDescription(''); setMonsterStats('');
    };

    const openAddMonsterModal = () => {
        setEditingMonster(null);
        setMonsterName('');
        setMonsterDescription('');
        setMonsterStats('');
        setShowAddMonsterModal(true);
    }
    
    const handleSaveMaterial = () => {
        if (!materialName.trim()) { showNotification("Nome do material é obrigatório.", "warning"); return; }
        let updatedMaterials;
        if (editingMaterial) {
            updatedMaterials = campaign.materials.map(m => m.id === editingMaterial.id ? { ...editingMaterial, name: materialName, notes: materialNotes } : m);
        } else {
            updatedMaterials = [...(campaign.materials || []), { id: crypto.randomUUID(), name: materialName, notes: materialNotes }];
        }
        saveCampaignChanges({ materials: updatedMaterials });
        setShowMaterialModal(false); setEditingMaterial(null); setMaterialName(''); setMaterialNotes('');
        showNotification(editingMaterial ? "Material atualizado!" : "Material adicionado!", "success");
    };
    const openEditMaterialModal = (material) => {
        setEditingMaterial(material); setMaterialName(material.name); setMaterialNotes(material.notes); setShowMaterialModal(true);
    };

    const handleSaveGmNote = () => {
        if (!gmNoteContent.trim()) { showNotification("Conteúdo da nota é obrigatório.", "warning"); return; }
        let updatedGmNotes;
        if (editingGmNote) {
            updatedGmNotes = campaign.gmNotes.map(n => n.id === editingGmNote.id ? { ...editingGmNote, content: gmNoteContent, updatedAt: new Date().toISOString() } : n);
        } else {
            updatedGmNotes = [...(campaign.gmNotes || []), { id: crypto.randomUUID(), content: gmNoteContent, createdAt: new Date().toISOString() }];
        }
        saveCampaignChanges({ gmNotes: updatedGmNotes });
        setShowGmNoteModal(false); setEditingGmNote(null); setGmNoteContent('');
        showNotification(editingGmNote ? "Nota atualizada!" : "Nota adicionada!", "success");
    };
    const openEditGmNoteModal = (note) => {
        setEditingGmNote(note); setGmNoteContent(note.content); setShowGmNoteModal(true);
    };

    const handleSaveCharacterSheet = (e) => {
        e.preventDefault();
        if (!csCharacterName.trim()) { showNotification("Nome do personagem é obrigatório.", "warning"); return; }
        let updatedSheets;
        const sheetData = { playerName: csPlayerName, characterName: csCharacterName, class: csClass, level: csLevel, attributes: csAttributes, otherNotes: csOtherNotes };
        if (editingCharacterSheet) {
            updatedSheets = campaign.characterSheetsData.map(s => s.id === editingCharacterSheet.id ? { ...editingCharacterSheet, ...sheetData } : s);
        } else {
            updatedSheets = [...(campaign.characterSheetsData || []), { id: crypto.randomUUID(), ...sheetData }];
        }
        saveCampaignChanges({ characterSheetsData: updatedSheets });
        setShowCharacterSheetModal(false); setEditingCharacterSheet(null); 
        setCsPlayerName(''); setCsCharacterName(''); setCsClass(''); setCsLevel(1); setCsAttributes({}); setCsOtherNotes('');
        showNotification(editingCharacterSheet ? "Ficha atualizada!" : "Ficha adicionada!", "success");
    };
    const openEditCharacterSheetModal = (sheet) => {
        setEditingCharacterSheet(sheet);
        setCsPlayerName(sheet.playerName); setCsCharacterName(sheet.characterName); setCsClass(sheet.class);
        setCsLevel(sheet.level); setCsAttributes(sheet.attributes || {}); setCsOtherNotes(sheet.otherNotes);
        setShowCharacterSheetModal(true);
    };

    const requestDeleteItem = (e, type, id, name) => {
        e.stopPropagation();
        setItemToDelete({ type, id, name });
        setShowConfirmDeleteItemModal(true);
    };
    const executeDeleteItem = () => {
        if (!itemToDelete) return;
        const { type, id } = itemToDelete;
        let updatedItemsArray;
        let fieldName;

        switch(type) {
            case 'image': fieldName = 'images'; updatedItemsArray = campaign.images.filter(item => item.id !== id); break;
            case 'npc': fieldName = 'npcs'; updatedItemsArray = campaign.npcs.filter(item => item.id !== id); break;
            case 'bestiary': fieldName = 'bestiary'; updatedItemsArray = campaign.bestiary.filter(item => item.id !== id); break;
            case 'material': fieldName = 'materials'; updatedItemsArray = campaign.materials.filter(item => item.id !== id); break;
            case 'gmNote': fieldName = 'gmNotes'; updatedItemsArray = campaign.gmNotes.filter(item => item.id !== id); break;
            case 'characterSheet': fieldName = 'characterSheetsData'; updatedItemsArray = campaign.characterSheetsData.filter(item => item.id !== id); break;
            case 'event': fieldName = 'events'; updatedItemsArray = campaign.events.filter(item => item.id !== id); break;
            default: showNotification("Tipo de item inválido para exclusão.", "error"); return;
        }
        
        saveCampaignChanges({ [fieldName]: updatedItemsArray });
        showNotification("Item excluído!", "success");
        setItemToDelete(null);
    };

    const handleViewDetails = async (item, type) => {
        if (type === 'bestiary' && item.source === 'srd' && !item.fullData.translated_pt) {
            setIsLoadingDetails(true);
            setViewingItem({ item, type }); // Mostra o modal com os dados em inglês enquanto traduz
            showNotification("Traduzindo bloco de estatísticas...", "info", 5000);
            try {
                const prompt = `Translate the descriptive text values in the following D&D JSON object to Brazilian Portuguese. Keep the JSON structure and keys in English. Only translate string values that are descriptive text (like alignment, size, type, and the 'name' and 'desc' fields within arrays like special_abilities, actions, etc.). Do not translate values that are identifiers like 'V', 'S', 'M', or numeric stats. Return only the translated JSON object, nothing else. Object to translate: ${JSON.stringify(item.fullData)}`;
                const translatedJsonString = await callGeminiAPI(prompt, showNotification);
    
                let finalData = item.fullData;
                if (translatedJsonString) {
                    try {
                        const jsonMatch = translatedJsonString.match(/(\{[\s\S]*\})/);
                        if(jsonMatch && jsonMatch[0]) {
                            finalData = { ...item.fullData, ...JSON.parse(jsonMatch[0]), translated_pt: true };
                        } else { throw new Error("IA não retornou um JSON válido."); }
                    } catch (e) {
                        console.error("Falha ao processar JSON traduzido:", e);
                        showNotification("Falha ao processar tradução. Exibindo em inglês.", "warning");
                    }
                }
                
                const updatedMonster = { ...item, fullData: finalData };
                saveCampaignChanges({ bestiary: campaign.bestiary.map(m => m.id === item.id ? updatedMonster : m) });
                setViewingItem({ item: updatedMonster, type: 'bestiary' }); // Atualiza o modal com os dados traduzidos
    
            } catch (error) {
                showNotification(`Erro na tradução: ${error.message}`, 'error');
                setViewingItem({ item, type });
            } finally {
                setIsLoadingDetails(false);
            }
        } else {
            setViewingItem({ item, type });
        }
    };
    
    
    const renderTabContent = () => {
        if (!campaign) {
            return <p className="text-slate-400">Campanha não encontrada ou inválida.</p>;
        }
        switch (activeTab) {
            case 'info':
                return (
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                        <h3 className="text-xl font-bold text-cyan-300 font-orbitron">Detalhes da Campanha</h3>
                        <p className="text-slate-300 mt-1 whitespace-pre-line">{campaign.description || "Sem descrição."}</p>
                        <p className="text-xs text-slate-500 mt-2">Criada em: {new Date(campaign.createdAt).toLocaleDateString()}</p>
                         {campaign.updatedAt && <p className="text-xs text-slate-500">Última atualização: {new Date(campaign.updatedAt).toLocaleString()}</p>}
                    </div>
                );
            case 'images':
                return (
                    <div>
                        <div className="flex flex-wrap gap-2 mb-4">
                            <button onClick={() => { setEditingImage(null); setImageName(''); setImageDescription(''); setImageFile(null); setShowImageModal(true);}} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-md">Adicionar Imagem</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(campaign.images || []).map(img => (<div key={img.id} onClick={() => handleViewDetails(img, 'image')} className="p-3 rounded-lg shadow cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-cyan-500 bg-slate-800 border border-slate-700">
                                <img src={img.imageUrl} alt={img.name} className="w-full h-40 object-cover rounded mb-2 border border-slate-600"/>
                                <h4 className="text-cyan-300 font-semibold truncate mb-1">{img.name}</h4>
                                <p className="text-slate-400 text-xs line-clamp-3 h-12 overflow-hidden whitespace-pre-line">{img.description}</p>
                                <div className="mt-2 flex justify-end gap-2">
                                    <button onClick={(e) => openEditImageModal(e, img)} className="text-blue-400 hover:underline text-xs">Editar</button>
                                    <button onClick={(e) => requestDeleteItem(e, 'image', img.id, img.name)} className="text-red-400 hover:underline text-xs">Excluir</button>
                                </div>
                            </div>))}
                        </div>
                        {(campaign.images || []).length === 0 && <p className="text-slate-400 italic">Nenhuma imagem.</p>}
                    </div>
                );
            case 'bestiary':
                return (
                    <div>
                        <div className="flex flex-wrap gap-2 mb-4">
                             <button onClick={() => openAddMonsterModal()} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-md">Adicionar Monstro Manualmente</button>
                            <button onClick={() => { setGeneratedMonster(null); setMonsterGenKeywords(''); setShowMonsterGeneratorModal(true); }} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded shadow-md">✨ Gerar Monstro com IA</button>
                            <button onClick={() => setShowImportMonsterModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow-md">Importar Monstro do SRD</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(campaign.bestiary || []).map(monster => (
                                <div key={monster.id} onClick={() => handleViewDetails(monster, 'bestiary')} className={`p-4 rounded-lg shadow cursor-pointer transition-all duration-200 hover:ring-2 ${monster.source === 'ai' ? 'bg-red-900/40 border border-red-700 hover:ring-red-500' : monster.source === 'srd' ? 'bg-indigo-900/40 border border-indigo-700 hover:ring-indigo-500' : 'bg-slate-800/80 border border-slate-700 hover:ring-cyan-500'}`}>
                                    <h4 className={`font-bold text-lg ${monster.source === 'ai' ? 'text-red-300' : monster.source === 'srd' ? 'text-indigo-300' : 'text-cyan-300'}`}>{monster.name} <span className="text-xs text-slate-400">({monster.source})</span></h4>
                                    <p className="text-sm text-slate-300 mt-2 line-clamp-3 h-16 overflow-hidden whitespace-pre-line">{monster.description || (monster.fullData && 'Clique para ver detalhes...')}</p>
                                    <div className="mt-3 flex justify-end">
                                        <button onClick={(e) => requestDeleteItem(e, 'bestiary', monster.id, monster.name)} className="text-red-400 hover:underline text-xs">Excluir</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                         {(campaign.bestiary || []).length === 0 && <p className="text-slate-400 italic">Nenhum monstro no bestiário.</p>}
                    </div>
                );
             case 'npcs':
                return (
                    <div>
                        <button onClick={() => { setEditingNpc(null); setNpcName(''); setNpcDesc(''); setNpcKeywords(''); setNpcImageUrl(''); setShowNpcModal(true); }} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-md">Adicionar NPC</button>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(campaign.npcs || []).map(n => (<div key={n.id} onClick={() => handleViewDetails(n, 'npc')} className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-cyan-500">
                                <h4 className="text-cyan-300 font-semibold truncate mb-1">{n.name}</h4>
                                {n.imageUrl && <img src={n.imageUrl} alt={n.name} className="w-full h-32 object-cover rounded my-1 border border-slate-600" onError={(e) => e.target.style.display='none'}/>}
                                <p className="text-slate-400 text-xs line-clamp-3 h-12 overflow-hidden my-1 whitespace-pre-line">{n.description}</p>
                                <p className="text-slate-500 text-xs truncate">Palavras-chave: {n.keywords || "N/A"}</p>
                                <div className="mt-2 flex justify-end gap-2">
                                    <button onClick={(e) => openEditNpcModal(e, n)} className="text-blue-400 hover:underline text-xs">Editar</button>
                                    <button onClick={(e) => requestDeleteItem(e, 'npc', n.id, n.name)} className="text-red-400 hover:underline text-xs">Excluir</button>
                                </div>
                            </div>))}
                        </div>
                        {(campaign.npcs || []).length === 0 && <p className="text-slate-400 italic">Nenhum NPC.</p>}
                    </div>
                );
            case 'materials':
                return (
                    <div>
                        <button onClick={() => { setEditingMaterial(null); setMaterialName(''); setMaterialNotes(''); setShowMaterialModal(true); }} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-md">Adicionar Material</button>
                        <ul className="space-y-3">
                           {(campaign.materials || []).map(mat => (<li key={mat.id} className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow flex justify-between items-start"><div><h4 className="text-cyan-300 font-medium">{mat.name}</h4><p className="text-slate-400 text-xs whitespace-pre-line">{mat.notes}</p></div><div className="flex gap-2 shrink-0 ml-2"><button onClick={(e) => { e.stopPropagation(); openEditMaterialModal(mat); }} className="text-blue-400 hover:underline text-xs">Editar</button><button onClick={(e) => requestDeleteItem(e, 'material', mat.id, mat.name)} className="text-red-400 hover:underline text-xs">Excluir</button></div></li>))}
                        </ul>
                        {(campaign.materials || []).length === 0 && <p className="text-slate-400 italic">Nenhum material.</p>}
                    </div>
                );
            case 'gmNotes':
                 return (
                    <div>
                        <button onClick={() => { setEditingGmNote(null); setGmNoteContent(''); setShowGmNoteModal(true);}} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-md">+ Nova Nota</button>
                        <div className="space-y-4">
                            {(campaign.gmNotes || []).map(note => (<div key={note.id} className="bg-slate-800 border border-slate-700 p-4 rounded-lg shadow"><p className="text-slate-300 whitespace-pre-wrap">{note.content}</p><div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-600"><small className="text-slate-500 text-xs">Criada: {new Date(note.createdAt).toLocaleString()}{note.updatedAt && ` (Atualizada: ${new Date(note.updatedAt).toLocaleString()})`}</small><div className="flex gap-2"><button onClick={(e) => { e.stopPropagation(); openEditGmNoteModal(note); }} className="text-blue-400 hover:underline text-xs">Editar</button><button onClick={(e) => requestDeleteItem(e, 'gmNote', note.id, 'esta nota')} className="text-red-400 hover:underline text-xs">Excluir</button></div></div></div>))}
                        </div>
                        {(campaign.gmNotes || []).length === 0 && <p className="text-slate-400 italic">Nenhuma nota.</p>}
                    </div>
                );
            case 'characterSheetsData': 
                return (
                    <div>
                        <button onClick={() => { setEditingCharacterSheet(null); setCsPlayerName(''); setCsCharacterName(''); setCsClass(''); setCsLevel(1); setCsAttributes({}); setCsOtherNotes(''); setShowCharacterSheetModal(true);}} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mb-4 shadow-md">Adicionar Ficha de Personagem</button>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(campaign.characterSheetsData || []).map(sheet => (
                                <div key={sheet.id} className="bg-slate-800 border border-slate-700 p-4 rounded-lg shadow">
                                     <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="text-cyan-300 font-semibold">{sheet.characterName}</h4>
                                            <p className="text-xs text-slate-400">{sheet.playerName || 'Jogador Desconhecido'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium">{sheet.class || 'Classe'}{sheet.level ? ` - Nv. ${sheet.level}` : ''}</p>
                                            <p className="text-xs text-slate-400">{sheet.attributes?.race || 'Raça'}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-600/50 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                        <p><strong>PV:</strong> {sheet.attributes?.hp_current || '?'}/{sheet.attributes?.hp_max || '?'}</p>
                                        <p><strong>CA:</strong> {sheet.attributes?.ac || '?'}</p>
                                        <p><strong>Desloc.:</strong> {sheet.attributes?.speed || '?'}</p>
                                        <p><strong>Iniciativa:</strong> {sheet.attributes?.initiative || '?'}</p>
                                    </div>
                                    <div className="mt-3 flex justify-end gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); openEditCharacterSheetModal(sheet); }} className="text-blue-400 hover:underline text-xs">Editar</button>
                                        <button onClick={(e) => requestDeleteItem(e, 'characterSheet', sheet.id, sheet.characterName)} className="text-red-400 hover:underline text-xs">Excluir</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {(campaign.characterSheetsData || []).length === 0 && <p className="text-slate-400 italic">Nenhuma ficha de personagem anotada.</p>}
                    </div>
                );

            default: return null;
        }
    };
    
    const TABS = ['info', 'bestiary', 'images', 'npcs', 'materials', 'gmNotes', 'characterSheetsData', 'calendar'];

    return (
        <div className="p-4 md:p-6">
            <button onClick={goBack} className="mb-6 text-cyan-400 hover:text-cyan-300 flex items-center group transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                Voltar
            </button>
            <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-3">
                <div className="max-w-xl flex items-center gap-4">
                    <h2 className="text-3xl font-bold font-orbitron text-cyan-300 break-words">{campaign?.name || "Campanha sem nome"}</h2>
                </div>
                <button onClick={onDeleteCampaignRequest} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-lg shadow-md whitespace-nowrap">Excluir Campanha</button>
            </div>
            <div className="mb-6 border-b border-slate-700">
                <nav className="flex space-x-1 sm:space-x-4 -mb-px overflow-x-auto pb-1">
                    {TABS.map(tab => (<button key={tab} onClick={() => setActiveTab(tab)} className={`py-3 px-2 sm:px-4 font-medium text-sm border-b-2 whitespace-nowrap ${activeTab === tab ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}>{tab === 'characterSheetsData' ? 'Fichas' : tab === 'gmNotes' ? 'Notas' : tab.charAt(0).toUpperCase() + tab.slice(1)}</button>))}
                </nav>
            </div>
            {renderTabContent()}

            {/* Modais */}
            <ViewDetailModal isOpen={!!viewingItem} onClose={() => setViewingItem(null)} itemData={viewingItem} isLoading={isLoadingDetails} />
            <ImportMonsterModal isOpen={showImportMonsterModal} onClose={() => setShowImportMonsterModal(false)} onImport={handleImportMonster} showNotification={showNotification}/>
            <Modal isOpen={showImageModal} onClose={() => setShowImageModal(false)} title={editingImage ? "Editar Imagem" : "Adicionar Nova Imagem"}>
                <form onSubmit={(e) => { e.preventDefault(); handleSaveImage(); }} className="space-y-4">
                    <div><label>Nome da Imagem</label><input type="text" value={imageName} onChange={e => setImageName(e.target.value)} className="w-full p-2 bg-slate-700 rounded" required/></div>
                    <div><label>Descrição</label><textarea value={imageDescription} onChange={e => setImageDescription(e.target.value)} rows="3" className="w-full p-2 bg-slate-700 rounded"></textarea></div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300">Ficheiro de Imagem</label>
                        <input type="file" accept="image/*" onChange={handleImageFileChange}
                            className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-100 file:text-cyan-700 hover:file:bg-cyan-200 cursor-pointer" 
                            required={!editingImage} />
                    </div>
                    {imageFile && <img src={imageFile} alt="Pré-visualização" className="w-full rounded mt-2 max-h-48 object-contain"/>}
                    <button type="submit" className="w-full p-2 bg-green-600 hover:bg-green-700 rounded">{editingImage ? "Salvar Imagem" : "Adicionar Imagem"}</button>
                </form>
            </Modal>

            <Modal isOpen={showAddMonsterModal} onClose={() => setShowAddMonsterModal(false)} title="Adicionar Monstro Manualmente" size="lg">
                <form onSubmit={(e) => { e.preventDefault(); handleSaveMonster(); }} className="space-y-4">
                    <div><label>Nome do Monstro</label><input type="text" value={monsterName} onChange={e => setMonsterName(e.target.value)} className="w-full p-2 bg-slate-700 rounded" required/></div>
                    <div><label>Descrição</label><textarea value={monsterDescription} onChange={e => setMonsterDescription(e.target.value)} rows="3" className="w-full p-2 bg-slate-700 rounded"></textarea></div>
                    <div><label>Bloco de Estatísticas</label><textarea value={monsterStats} onChange={e => setMonsterStats(e.target.value)} rows="5" className="w-full p-2 bg-slate-700 rounded"></textarea></div>
                    <button type="submit" className="w-full p-2 bg-green-600 hover:bg-green-700 rounded">Adicionar Monstro</button>
                </form>
            </Modal>

            <Modal isOpen={showMonsterGeneratorModal} onClose={() => setShowMonsterGeneratorModal(false)} title="Gerador de Monstros com IA" size="2xl">
                <div className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Palavras-chave</label>
                        <input type="text" value={monsterGenKeywords} onChange={e => setMonsterGenKeywords(e.target.value)} className="w-full p-2 bg-slate-700 rounded border border-slate-600" placeholder="Ex: golem de obsidiana, elemental, mágico"/>
                    </div>
                    <button onClick={handleGenerateMonster} disabled={generatingMonster} className="w-full p-2 bg-teal-600 hover:bg-teal-700 rounded disabled:opacity-50 flex items-center justify-center gap-2">
                        {generatingMonster ? <><svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75"></path></svg>Gerando...</> : "✨ Gerar Monstro"}
                    </button>
                    {generatedMonster && (
                         <div className="mt-3 bg-red-900/40 border border-red-700 p-4 rounded-md max-h-72 overflow-y-auto">
                            <h4 className="text-red-300 font-bold text-lg">{generatedMonster.name}</h4>
                            <p className="text-sm text-slate-300 mt-2 whitespace-pre-line">{generatedMonster.description}</p>
                            <p className="text-sm text-slate-400 mt-3 font-semibold">Atributos:</p>
                            <p className="text-sm text-slate-300 whitespace-pre-line">{generatedMonster.stats}</p>
                            <button onClick={handleAddGeneratedMonsterToBestiary} className="mt-3 w-full p-2 bg-green-600 hover:bg-green-700 rounded text-sm">Adicionar ao Bestiário</button>
                        </div>
                    )}
                </div>
            </Modal>

            <Modal isOpen={showNpcModal} onClose={() => setShowNpcModal(false)} title={editingNpc ? "Editar NPC" : "Adicionar NPC"} size="lg">
                <form onSubmit={(e) => { e.preventDefault(); handleSaveNpc(); }} className="space-y-4">
                    <div><label>Nome do NPC</label><input type="text" value={npcName} onChange={e => setNpcName(e.target.value)} className="w-full p-2 bg-slate-700 rounded" required/></div>
                    <div><label>Palavras-chave para IA</label><input type="text" value={npcKeywords} onChange={e => setNpcKeywords(e.target.value)} className="w-full p-2 bg-slate-700 rounded" placeholder="Ex: misterioso, elfo, taverneiro"/></div>
                    <button type="button" onClick={handleGenerateNpcDescription} disabled={generatingNpcDesc || !npcName.trim()} className="w-full p-2 bg-teal-600 hover:bg-teal-700 rounded disabled:opacity-50"> {generatingNpcDesc ? "Gerando..." : "✨ Gerar Descrição com IA"}</button>
                    <div><label>Descrição</label><textarea value={npcDesc} onChange={e => setNpcDesc(e.target.value)} rows="4" className="w-full p-2 bg-slate-700 rounded"></textarea></div>
                    <div><label>URL da Imagem (opcional)</label><input type="url" value={npcImageUrl} onChange={e => setNpcImageUrl(e.target.value)} className="w-full p-2 bg-slate-700 rounded" placeholder="https://exemplo.com/imagem.jpg"/></div>
                    <button type="submit" className="w-full p-2 bg-green-600 hover:bg-green-700 rounded">{editingNpc ? "Salvar NPC" : "Adicionar NPC"}</button>
                </form>
            </Modal>

            <Modal isOpen={showMaterialModal} onClose={() => setShowMaterialModal(false)} title={editingMaterial ? "Editar Material" : "Adicionar Material"}>
                <form onSubmit={(e) => { e.preventDefault(); handleSaveMaterial(); }} className="space-y-4">
                    <div><label>Nome do Material</label><input type="text" value={materialName} onChange={e => setMaterialName(e.target.value)} className="w-full p-2 bg-slate-700 rounded" required/></div>
                    <div><label>Anotações (Ex: Livro de Regras p.42, PDF no PC)</label><textarea value={materialNotes} onChange={e => setMaterialNotes(e.target.value)} rows="3" className="w-full p-2 bg-slate-700 rounded"></textarea></div>
                    <button type="submit" className="w-full p-2 bg-green-600 hover:bg-green-700 rounded">{editingMaterial ? "Salvar Material" : "Adicionar Material"}</button>
                </form>
            </Modal>

            <Modal isOpen={showGmNoteModal} onClose={() => setShowGmNoteModal(false)} title={editingGmNote ? "Editar Nota" : "Adicionar Nota Privada"}>
                <form onSubmit={(e) => { e.preventDefault(); handleSaveGmNote(); }} className="space-y-4">
                    <div><label>Conteúdo da Nota</label><textarea value={gmNoteContent} onChange={e => setGmNoteContent(e.target.value)} rows="5" className="w-full p-2 bg-slate-700 rounded" required></textarea></div>
                    <button type="submit" className="w-full p-2 bg-green-600 hover:bg-green-700 rounded">{editingGmNote ? "Salvar Nota" : "Adicionar Nota"}</button>
                </form>
            </Modal>
            
            <Modal isOpen={showCharacterSheetModal} onClose={() => setShowCharacterSheetModal(false)} title={editingCharacterSheet ? "Editar Ficha" : "Adicionar Ficha de Personagem"} size="4xl">
                <form onSubmit={(e) => {e.preventDefault(); handleSaveCharacterSheet();}} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-900/50 rounded-lg">
                        <h3 className="md:col-span-3 text-lg font-semibold text-cyan-300 font-orbitron border-b border-cyan-500/50 pb-2 mb-2">Informações Básicas</h3>
                        <div><label>Nome do Jogador</label><input type="text" value={csPlayerName} onChange={e => setCsPlayerName(e.target.value)} className="w-full p-2 bg-slate-700 rounded"/></div>
                        <div><label>Nome do Personagem</label><input type="text" value={csCharacterName} onChange={e => setCsCharacterName(e.target.value)} className="w-full p-2 bg-slate-700 rounded" required/></div>
                         <div><label>Raça</label><input type="text" value={csAttributes.race || ''} onChange={e => setCsAttributes(s => ({...s, race: e.target.value}))} className="w-full p-2 bg-slate-700 rounded"/></div>
                        <div><label>Classe</label><input type="text" value={csClass} onChange={e => setCsClass(e.target.value)} className="w-full p-2 bg-slate-700 rounded"/></div>
                        <div><label>Nível</label><input type="number" value={csLevel} min="1" onChange={e => setCsLevel(parseInt(e.target.value) || 1)} className="w-full p-2 bg-slate-700 rounded"/></div>
                        <div><label>Antecedente</label><input type="text" value={csAttributes.background || ''} onChange={e => setCsAttributes(s => ({...s, background: e.target.value}))} className="w-full p-2 bg-slate-700 rounded"/></div>
                        <div className="md:col-span-3"><label>Tendência</label><input type="text" value={csAttributes.alignment || ''} onChange={e => setCsAttributes(s => ({...s, alignment: e.target.value}))} className="w-full p-2 bg-slate-700 rounded"/></div>
                    </div>

                     <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-slate-900/50 rounded-lg">
                        <h3 className="col-span-full text-lg font-semibold text-cyan-300 font-orbitron border-b border-cyan-500/50 pb-2 mb-2">Combate</h3>
                        <div><label>CA</label><input type="number" value={csAttributes.ac || ''} onChange={e => setCsAttributes(s => ({...s, ac: e.target.value}))} className="w-full p-2 bg-slate-700 rounded"/></div>
                        <div><label>Iniciativa</label><input type="text" value={csAttributes.initiative || ''} onChange={e => setCsAttributes(s => ({...s, initiative: e.target.value}))} className="w-full p-2 bg-slate-700 rounded"/></div>
                        <div><label>Deslocamento</label><input type="text" value={csAttributes.speed || ''} onChange={e => setCsAttributes(s => ({...s, speed: e.target.value}))} className="w-full p-2 bg-slate-700 rounded"/></div>
                        <div><label>PV Atuais</label><input type="number" value={csAttributes.hp_current || ''} onChange={e => setCsAttributes(s => ({...s, hp_current: e.target.value}))} className="w-full p-2 bg-slate-700 rounded"/></div>
                        <div><label>PV Máximos</label><input type="number" value={csAttributes.hp_max || ''} onChange={e => setCsAttributes(s => ({...s, hp_max: e.target.value}))} className="w-full p-2 bg-slate-700 rounded"/></div>
                    </div>
                     
                     <div className="p-4 bg-slate-900/50 rounded-lg">
                         <h3 className="text-lg font-semibold text-cyan-300 font-orbitron border-b border-cyan-500/50 pb-2 mb-2">Atributos</h3>
                         <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                             {Object.entries({strength: 'FOR', dexterity: 'DES', constitution: 'CON', intelligence: 'INT', wisdom: 'SAB', charisma: 'CAR'}).map(([key, label]) => (
                                <div key={key}>
                                    <label>{label}</label>
                                    <input type="number" value={csAttributes[key] || ''} onChange={e => setCsAttributes(s => ({...s, [key]: e.target.value}))} className="w-full p-2 bg-slate-700 rounded"/>
                                </div>
                             ))}
                        </div>
                    </div>

                    <div>
                        <label>Outras Notas (Equipamento, História, etc.)</label>
                        <textarea value={csOtherNotes} onChange={e => setCsOtherNotes(e.target.value)} rows="4" className="w-full p-2 bg-slate-700 rounded"></textarea>
                    </div>
                    
                    <button type="submit" className="w-full p-2 bg-green-600 hover:bg-green-700 rounded">{editingCharacterSheet ? "Salvar Ficha" : "Adicionar Ficha"}</button>
                </form>
            </Modal>

            <ConfirmModal isOpen={showConfirmDeleteItemModal} onClose={() => setShowConfirmDeleteItemModal(false)} title="Excluir Item" message={itemToDelete?.name ? `Excluir "${itemToDelete.name}"?` : "Excluir este item?"} onConfirm={executeDeleteItem} confirmText="Excluir"/>
        </div>
    );
};


// Componente Principal da Aplicação Local
const App = () => {
    const [appData, setAppData] = useState({ campaigns: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState({ message: '', type: '' });
    const [activeView, setActiveView] = useState('campaigns'); // 'campaigns' ou 'dnd_resources'

    useEffect(() => {
        const data = loadDataFromLocalStorage();
        setAppData(data);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (!isLoading) { 
            saveDataToLocalStorage(appData);
        }
    }, [appData, isLoading]);

    const showNotification = useCallback((message, type = 'info', duration = 4000) => {
        setNotification({ message, type });
        const timer = setTimeout(() => {
            setNotification(prev => prev.message === message ? { message: '', type: '' } : prev);
        }, duration);
        return () => clearTimeout(timer);
    }, []);

    return (
        <>
            <style>
              {`
                @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;600&family=Orbitron:wght@400;700&display=swap');
                .font-orbitron { font-family: 'Orbitron', sans-serif; }
                .font-exo2 { font-family: 'Exo 2', sans-serif; }
              `}
            </style>
            <div className="min-h-screen bg-slate-900 text-slate-200 font-exo2 antialiased">
                <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ message: '', type: '' })} />
                
                <header className="bg-slate-900/70 backdrop-blur-md p-4 shadow-lg shadow-cyan-500/10 sticky top-0 z-40 border-b border-slate-800">
                    <div className="container mx-auto flex justify-between items-center">
                        <div className="text-2xl font-bold text-cyan-400 font-orbitron">StarForge</div>
                        <nav className="flex space-x-2 sm:space-x-4">
                            <button onClick={() => setActiveView('campaigns')} className={`py-2 px-3 rounded-md text-sm font-medium transition-colors ${activeView === 'campaigns' ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>Minhas Campanhas</button>
                            <button onClick={() => setActiveView('dnd_resources')} className={`py-2 px-3 rounded-md text-sm font-medium transition-colors ${activeView === 'dnd_resources' ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>Recursos D&D 5e</button>
                        </nav>
                    </div>
                </header>

                <main className="container mx-auto p-2 sm:p-4">
                    {isLoading ? (
                         <div className="min-h-screen flex items-center justify-center">
                            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cyan-500"></div>
                            <p className="ml-4 text-xl">Carregando StarForge...</p>
                        </div>
                    ) : activeView === 'campaigns' ? (
                        <MasterDashboard 
                            campaignsData={appData} 
                            setCampaignsData={setAppData} 
                            showNotification={showNotification} 
                        />
                    ) : (
                        <DndResourcesView showNotification={showNotification} />
                    )}
                </main>
                 <footer className="text-center py-8 text-slate-500 text-sm border-t border-slate-800/50 mt-12">
                    <p>&copy; {new Date().getFullYear()} StarForge RPG Manager. Criado por RaryPoters.</p>
                     <p className="text-xs mt-1">Dica: Faça backups regulares exportando seus dados (funcionalidade futura) ou copiando o conteúdo do localStorage.</p>
                </footer>
            </div>
        </>
    );
};

// --- Componente para Recursos D&D 5e (TRADUZIDO E EXPANDIDO) ---
const DndResourcesView = ({ showNotification }) => {
    const DND_API_BASE_URL = "https://www.dnd5eapi.co/api";
    const [activeTab, setActiveTab] = useState('spells');
    const [allData, setAllData] = useState({ spells: [], monsters: [], classes: [], races: [], equipment: [] });
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredData, setFilteredData] = useState([]);
    const [selectedItemDetails, setSelectedItemDetails] = useState(null);
    const [isLoadingList, setIsLoadingList] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    // Mapa de tradução para escolas de magia
    const schoolTranslations = {
        'Abjuration': 'Abjuração', 'Conjuration': 'Conjuração', 
        'Divination': 'Adivinhação', 'Enchantment': 'Encantamento', 
        'Evocation': 'Evocação', 'Illusion': 'Ilusão', 
        'Necromancy': 'Necromancia', 'Transmutation': 'Transmutação'
    };
    const getTranslatedSchool = (schoolName) => schoolTranslations[schoolName] || schoolName;
    
    // Dados estáticos para a taverna
    const tavernItems = {
        foods: [
            { name: "Ensopado do Viajante", price: "3 pc", desc: "Um guisado simples e quente de raízes e legumes, com pedaços de carne de origem duvidosa. Reconfortante." },
            { name: "Pão com Queijo", price: "2 pc", desc: "Uma fatia de pão escuro e um pedaço de queijo duro. Sustenta, mas não inspira." },
            { name: "Leitão Assado (fatia)", price: "8 pp", desc: "Uma porção generosa de leitão assado com pele crocante e ervas. Um luxo para o viajante." },
            { name: "Sopa de Nabo", price: "1 pc", desc: "Uma sopa aguada com mais nabo do que qualquer outra coisa. Pelo menos é quente." }
        ],
        drinks: [
            { name: "Cerveja Comum", price: "4 pc", desc: "Uma caneca de cerveja local, aguada mas refrescante." },
            { name: "Vinho (taça)", price: "2 pp", desc: "Um vinho tinto robusto da região. Deixa uma mancha roxa nos lábios." },
            { name: "Hidromel", price: "5 pc", desc: "Doce e forte, uma bebida favorita entre anões e bárbaros." },
            { name: "Água", price: "Grátis", desc: "Pode vir do poço ou da chuva. Beba por sua conta e risco." }
        ]
    };

    // Carrega a lista de itens para a aba ativa
    useEffect(() => {
        const fetchListData = async () => {
            if (activeTab === 'tavern') {
                const allTavernItems = [...tavernItems.foods, ...tavernItems.drinks];
                setAllData(prev => ({...prev, tavern: allTavernItems}));
                setFilteredData(allTavernItems);
                return;
            }

            const cachedData = sessionStorage.getItem(`translated_list_${activeTab}`);
            if (cachedData) {
                const parsedData = JSON.parse(cachedData);
                setAllData(prevData => ({ ...prevData, [activeTab]: parsedData }));
                setFilteredData(parsedData);
                return;
            }

            setIsLoadingList(true);
            try {
                const response = await fetch(`${DND_API_BASE_URL}/${activeTab}`);
                if (!response.ok) throw new Error(`Falha ao carregar a lista de ${activeTab}.`);
                const data = await response.json();
                
                const namesToTranslate = data.results.map(item => item.name).join(', ');
                const prompt = `Translate the following list of names from English to Brazilian Portuguese, keeping the order: ${namesToTranslate}. Reply only with the translated names, separated by a comma and a space.`;
                const translatedNamesString = await callGeminiAPI(prompt, showNotification);
                
                let translatedData = data.results;
                if (translatedNamesString) {
                    const translatedNames = translatedNamesString.split(', ');
                    if (translatedNames.length === data.results.length) {
                        translatedData = data.results.map((item, index) => ({
                            ...item,
                            name_pt: translatedNames[index],
                        }));
                    }
                }
                
                sessionStorage.setItem(`translated_list_${activeTab}`, JSON.stringify(translatedData));
                setAllData(prevData => ({ ...prevData, [activeTab]: translatedData }));
                setFilteredData(translatedData);

            } catch (error) {
                console.error(error);
                showNotification(error.message, 'error');
            }
            setIsLoadingList(false);
        };
        fetchListData();
    }, [activeTab, showNotification, tavernItems.drinks, tavernItems.foods]);

    // Filtra os dados com base no termo de pesquisa
    useEffect(() => {
        const dataToFilter = activeTab === 'tavern' 
            ? [...tavernItems.foods, ...tavernItems.drinks] 
            : allData[activeTab];
        
        if (!searchTerm) {
            setFilteredData(dataToFilter);
        } else {
            setFilteredData(
                (dataToFilter || []).filter(item => 
                    (item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (item.name_pt && item.name_pt.toLowerCase().includes(searchTerm.toLowerCase()))
                )
            );
        }
    }, [searchTerm, allData, activeTab, tavernItems.drinks, tavernItems.foods]);

    const handleSelectItem = async (itemUrl, isStatic = false, staticItem = null) => {
        if (isStatic) {
            setSelectedItemDetails(staticItem);
            return;
        }

        setIsLoadingDetails(true);
        setSelectedItemDetails(null); 
        try {
            const response = await fetch(`https://www.dnd5eapi.co${itemUrl}`);
            if (!response.ok) throw new Error("Falha ao carregar detalhes do item.");
            const data = await response.json();
            
            const prompt = `Translate the descriptive text values in the following D&D JSON object to Brazilian Portuguese. Keep the JSON structure and keys in English. Only translate string values that are descriptive text (like alignment, size, type, and the 'name' and 'desc' fields within arrays like special_abilities, actions, etc.). Do not translate values that are identifiers like 'V', 'S', 'M', or numeric stats. Return only the translated JSON object, nothing else. Object to translate: ${JSON.stringify(data)}`;

            const translatedJsonString = await callGeminiAPI(prompt, showNotification);
            
            let finalData = data;
            if (translatedJsonString) {
                try {
                    const jsonMatch = translatedJsonString.match(/(\{[\s\S]*\})/);
                    if(jsonMatch && jsonMatch[0]) {
                        finalData = { ...data, ...JSON.parse(jsonMatch[0]) };
                    } else { throw new Error("Resposta da IA não continha um JSON válido."); }
                } catch(e) {
                    console.error("Erro ao parsear JSON traduzido:", e);
                    showNotification("Falha ao processar tradução da IA. Exibindo em inglês.", "warning");
                    finalData = data;
                }
            }
            
            setSelectedItemDetails(finalData);

        } catch (error) {
            console.error(error);
            showNotification(error.message, 'error');
        }
        setIsLoadingDetails(false);
    };
    
    const renderDetails = (item) => {
        if(!item) return null;
        
        const attributeTranslations = {
            strength: 'FOR', dexterity: 'DES', constitution: 'CON',
            intelligence: 'INT', wisdom: 'SAB', charisma: 'CAR'
        };
        
        switch(activeTab) {
            case 'spells':
                 return <div className="space-y-2 text-sm text-slate-300">
                        <p><strong>Nível:</strong> {item.level > 0 ? `${item.level}º Círculo de ` : "Truque de "} {getTranslatedSchool(item.school.name)}</p>
                        <p><strong>Tempo de Conjuração:</strong> {item.casting_time}</p>
                        <p><strong>Alcance:</strong> {formatDistance(item.range)}</p>
                        <p><strong>Componentes:</strong> {item.components.join(', ')} {item.material && `(${item.material.substring(0, 100)}${item.material.length > 100 ? '...' : ''})`}</p>
                        <p><strong>Duração:</strong> {item.duration}</p>
                        <div className="mt-3 pt-3 border-t border-slate-700">{(item.desc || []).map((p, i) => <p key={i} className="mb-2">{p}</p>)}</div>
                        {item.higher_level?.length > 0 && (<div className="mt-3 pt-3 border-t border-slate-700"><p><strong>Em Níveis Superiores:</strong></p>{(item.higher_level).map((p, i) => <p key={i} className="mb-2">{p}</p>)}</div>)}
                         <p className="text-xs text-slate-500 pt-2">Classes: {(item.classes || []).map(c => c.name).join(', ')}</p>
                    </div>;
            case 'monsters':
                return <div className="space-y-2 text-sm text-slate-300">
                    <p>{item.size} {item.type}, {item.alignment}</p>
                    <p><strong>Classe de Armadura:</strong> {item.armor_class?.map(ac => `${ac.value} (${ac.type})`).join(', ') || 'N/A'}</p>
                    <p><strong>Pontos de Vida:</strong> {item.hit_points} ({item.hit_dice})</p>
                    <p><strong>Deslocamento:</strong> {formatDistance(item.speed)}</p>
                    <div className="grid grid-cols-6 gap-2 text-center my-2 pt-2 border-t border-slate-700">
                         {Object.keys(attributeTranslations).map(attr => (
                             <div key={attr}><p className="font-bold uppercase">{attributeTranslations[attr]}</p><p>{item[attr]} ({(Math.floor((item[attr] - 10) / 2)) >= 0 ? '+' : ''}{Math.floor((item[attr] - 10) / 2)})</p></div>
                        ))}
                    </div>
                    {item.special_abilities?.length > 0 && <div className="pt-2 border-t border-slate-700"><strong>Habilidades Especiais:</strong> {item.special_abilities.map(a => <div key={a.name} className="mt-1"><p className="font-semibold">{a.name}:</p><p>{a.desc}</p></div>)}</div>}
                    {item.actions?.length > 0 && <div className="pt-2 border-t border-slate-700"><strong>Ações:</strong> {item.actions.map(a => <div key={a.name} className="mt-1"><p className="font-semibold">{a.name}:</p><p>{a.desc}</p></div>)}</div>}
                    {item.legendary_actions?.length > 0 && <div className="pt-2 border-t border-slate-700"><strong>Ações Lendárias:</strong> {item.legendary_actions.map(a => <div key={a.name} className="mt-1"><p className="font-semibold">{a.name}:</p><p>{a.desc}</p></div>)}</div>}
                </div>;
            case 'classes':
                 return <div className="space-y-2 text-sm text-slate-300">
                    <p><strong>Dado de Vida:</strong> d{item.hit_die}</p>
                    <p><strong>Proficiências:</strong> {item.proficiencies.map(p => p.name).join(', ')}</p>
                    <div className="pt-2 border-t border-slate-700">
                        <h4 className="font-semibold mb-1">Testes de Resistência:</h4>
                        <p>{item.saving_throws.map(s => s.name).join(', ')}</p>
                    </div>
                </div>;
            case 'races':
                return <div className="space-y-2 text-sm text-slate-300">
                    <p><strong>Aumento de Atributo:</strong> {item.ability_bonuses.map(b => `${b.ability_score.name} +${b.bonus}`).join(', ')}</p>
                    <p><strong>Tendência:</strong> {item.alignment}</p>
                    <p><strong>Idade:</strong> {item.age}</p>
                    <p><strong>Tamanho:</strong> {item.size_description}</p>
                    <p><strong>Deslocamento:</strong> {formatDistance(item.speed)}</p>
                    <div className="pt-2 border-t border-slate-700">
                        <h4 className="font-semibold mb-1">Traços Raciais:</h4>
                        {item.traits.map(t => <p key={t.index}>- {t.name}</p>)}
                    </div>
                </div>;
            case 'equipment':
                return <div className="space-y-2 text-sm text-slate-300">
                    {item.desc?.map((p, i) => <p key={i}>{p}</p>)}
                    <p><strong>Custo:</strong> {item.cost.quantity} {item.cost.unit}</p>
                    <p><strong>Peso:</strong> {item.weight} lb.</p>
                    {item.damage && <p><strong>Dano:</strong> {item.damage.damage_dice} {item.damage.damage_type.name}</p>}
                    {item.properties?.length > 0 && <p><strong>Propriedades:</strong> {item.properties.map(p => p.name).join(', ')}</p>}
                </div>;
            case 'tavern':
                 return <div className="space-y-2 text-sm text-slate-300">
                    <p><strong>Preço:</strong> {item.price}</p>
                    <p className="mt-2">{item.desc}</p>
                 </div>;
            default: return null;
        }
    }
    
    const TABS_CONFIG = {
        spells: { name: 'Magias', api: true, endpoint: 'spells' },
        monsters: { name: 'Monstros', api: true, endpoint: 'monsters' },
        classes: { name: 'Classes', api: true, endpoint: 'classes' },
        races: { name: 'Raças', api: true, endpoint: 'races' },
        equipment: { name: 'Loja', api: true, endpoint: 'equipment' },
        tavern: { name: 'Taverna', api: false }
    };

    return (
        <div className="p-4 md:p-6 bg-slate-800/50 rounded-lg border border-slate-700">
            <h2 className="text-3xl font-bold text-cyan-400 font-orbitron mb-4">Recursos de D&D 5e (SRD)</h2>
            <p className="text-sm text-slate-400 mb-6">Consulte informações do Documento de Referência do Sistema 5e. Requer conexão com a internet. Os dados são traduzidos experimentalmente por IA.</p>
            
            <div className="flex border-b border-slate-700 mb-4 overflow-x-auto">
                {Object.entries(TABS_CONFIG).map(([key, { name }]) => (
                    <button key={key} onClick={() => { setActiveTab(key); setSearchTerm(''); }} className={`py-2 px-4 text-sm font-medium -mb-px border-b-2 whitespace-nowrap ${activeTab === key ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                        {name}
                    </button>
                ))}
            </div>

            <div className="mb-4">
                <input 
                    type="text"
                    placeholder={`Pesquisar em ${TABS_CONFIG[activeTab].name}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-3 bg-slate-700 rounded-md border border-slate-600 focus:ring-cyan-500 focus:border-cyan-500"
                />
            </div>
            
            {(isLoadingList || isLoadingDetails) && <p className="text-cyan-400 animate-pulse">{isLoadingList ? `Carregando e traduzindo lista de ${TABS_CONFIG[activeTab].name}...` : `Carregando e traduzindo detalhes...`}</p>}
            
            <div className="max-h-96 overflow-y-auto pr-2">
                 {activeTab === 'tavern' ? (
                    <>
                        <h3 className="text-xl font-semibold text-cyan-300 font-orbitron mt-4 mb-2">Comidas</h3>
                        {tavernItems.foods.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                            <button key={item.name} onClick={() => handleSelectItem(null, true, { ...item, type: 'tavern' })} className="block w-full text-left p-2 rounded hover:bg-slate-700 transition-colors">
                                {item.name} <span className="text-xs text-slate-400">- {item.price}</span>
                            </button>
                        ))}
                         <h3 className="text-xl font-semibold text-cyan-300 font-orbitron mt-4 mb-2">Bebidas</h3>
                        {tavernItems.drinks.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                             <button key={item.name} onClick={() => handleSelectItem(null, true, { ...item, type: 'tavern' })} className="block w-full text-left p-2 rounded hover:bg-slate-700 transition-colors">
                                {item.name} <span className="text-xs text-slate-400">- {item.price}</span>
                            </button>
                        ))}
                    </>
                ) : (
                    (filteredData || []).map(item => (
                        <button 
                            key={item.index}
                            onClick={() => handleSelectItem(item.url)}
                            disabled={isLoadingDetails}
                            className="block w-full text-left p-2 rounded hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {item.name_pt || item.name}
                        </button>
                    ))
                )}
            </div>

            {selectedItemDetails && (
                <Modal isOpen={!!selectedItemDetails} onClose={() => setSelectedItemDetails(null)} title={selectedItemDetails.name} size="lg">
                   {renderDetails(selectedItemDetails)}
                </Modal>
            )}
        </div>
    );
};


export default App;
