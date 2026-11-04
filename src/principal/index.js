// Painel de Scripts — processo principal do Electron: janela, bandeja e ligação com o núcleo.
'use strict';

const path = require('path');
const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, protocol } = require('electron');
const { version: VERSAO } = require('../../package.json');
const atualizador = require('./atualizador.js');

const ICONE_PNG = Buffer.from(require('../icone/painel.png'));
const ARQUIVOS = {
    '/': { corpo: require('../hub.html'), tipo: 'text/html; charset=utf-8' },
    '/vendor/codemirror.js': { corpo: require('../vendor/codemirror.js.txt'), tipo: 'application/javascript; charset=utf-8' },
    '/vendor/codemirror.css': { corpo: require('../vendor/codemirror.css.txt'), tipo: 'text/css; charset=utf-8' },
    '/favicon.ico': { corpo: Buffer.from(require('../icone/painel.ico')), tipo: 'image/x-icon' },
    '/icone.png': { corpo: ICONE_PNG, tipo: 'image/png' }
};
const HUB_URL = 'painel://hub/';

let janela = null;
let bandeja = null;
let saindo = false;
let avisouBandeja = false;

function mostrarJanela() {
    if (!janela) return;
    if (janela.isMinimized()) janela.restore();
    janela.show();
    janela.focus();
}

function criarJanela() {
    janela = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 900,
        minHeight: 600,
        show: false,
        title: 'Painel de Scripts',
        icon: nativeImage.createFromBuffer(ICONE_PNG),
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload', 'index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });
    janela.once('ready-to-show', () => janela.show());
    janela.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    janela.webContents.on('will-navigate', e => e.preventDefault());
    // Fechar a janela não fecha o Painel: sem ele, os scripts param nas abas abertas.
    janela.on('close', e => {
        if (saindo) return;
        e.preventDefault();
        janela.hide();
        if (!avisouBandeja) {
            avisouBandeja = true;
            bandeja.displayBalloon({ title: 'Painel de Scripts', content: 'O Painel continua aberto aqui, mantendo os scripts funcionando nas abas.' });
        }
    });
    janela.on('closed', () => { janela = null; });
    return janela.loadURL(HUB_URL);
}

function criarBandeja() {
    bandeja = new Tray(nativeImage.createFromBuffer(ICONE_PNG).resize({ width: 16, height: 16 }));
    bandeja.setToolTip('Painel de Scripts');
    bandeja.setContextMenu(Menu.buildFromTemplate([
        { label: 'Abrir o Painel', click: mostrarJanela },
        { type: 'separator' },
        { label: 'Fechar o Painel', click: () => app.quit() }
    ]));
    bandeja.on('click', mostrarJanela);
}

function avisarJanela() {
    if (janela && !janela.isDestroyed()) janela.webContents.send('estado:mudou');
}

async function iniciarApp() {
    await app.whenReady();
    const nucleo = require('../app.js');

    atualizador.configurar({ versaoAtual: VERSAO, empacotado: app.isPackaged, logger: nucleo.log, aoMudar: avisarJanela });

    protocol.handle('painel', req => {
        const { host, pathname } = new URL(req.url);
        const arquivo = host === 'hub' ? ARQUIVOS[pathname] : null;
        if (!arquivo) return new Response('', { status: 404 });
        return new Response(arquivo.corpo, { headers: { 'Content-Type': arquivo.tipo, 'Cache-Control': 'no-store' } });
    });
    ipcMain.handle('api', async (e, caminho, corpo) => {
        if (!e.senderFrame?.url.startsWith(HUB_URL)) return { status: 403, dados: { erro: 'Acesso negado' } };
        caminho = String(caminho);
        try {
            // A atualização é um assunto só do Electron: fica fora do núcleo, atendida aqui.
            if (caminho === '/api/atualizacao/verificar') { atualizador.verificar(); return { status: 200, dados: { ok: true } }; }
            if (caminho === '/api/atualizacao/instalar') { atualizador.instalarAgora(); return { status: 200, dados: { ok: true } }; }
            const r = await nucleo.tratarApi(caminho, corpo);
            if (caminho === '/api/estado' && r.status === 200) r.dados.atualizacao = atualizador.obterEstado();
            return r;
        } catch (erro) {
            return { status: 500, dados: { erro: erro.message } };
        }
    });
    app.on('before-quit', () => { saindo = true; });
    app.on('will-quit', () => nucleo.salvarPendente());

    Menu.setApplicationMenu(null);
    await nucleo.iniciar({ aoMudar: avisarJanela, sair: () => app.quit() });
    criarBandeja();
    await criarJanela();
    atualizador.iniciarVerificacoesPeriodicas();
}

protocol.registerSchemesAsPrivileged([{ scheme: 'painel', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.setAppUserModelId('com.gilmario.paineldescripts');
    app.on('second-instance', mostrarJanela);
    iniciarApp().catch(e => {
        dialog.showErrorBox('Painel de Scripts', String(e?.message || e));
        app.exit(1);
    });
}
