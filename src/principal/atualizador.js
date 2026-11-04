// Verifica e instala atualizações publicadas como GitHub Release, usando electron-updater.
// Fica fora do núcleo (src/app.js) de propósito: é um assunto só do Electron, não da lógica
// de scripts/perfis/navegador, e assim não mexe no arquivo grande por causa disto.
'use strict';

const { autoUpdater } = require('electron-updater');

let log = () => {};
let avisarMudanca = () => {};
let empacotado = false;
let estado = { situacao: 'ociosa', versaoAtual: '', versaoNova: '', progresso: 0, erro: '' };

// A barra de progresso dispara várias vezes por segundo: não vale a pena avisar a janela
// a cada uma, então agrupa como o "notificarHub" do núcleo já faz.
let timerAviso = null;
function mudar(novo) {
    estado = { ...estado, ...novo };
    clearTimeout(timerAviso);
    timerAviso = setTimeout(avisarMudanca, 200);
}

function configurar({ versaoAtual, empacotado: emp, logger, aoMudar }) {
    log = logger || log;
    avisarMudanca = aoMudar || avisarMudanca;
    empacotado = Boolean(emp);
    estado.versaoAtual = versaoAtual;

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => mudar({ situacao: 'verificando', erro: '' }));
    autoUpdater.on('update-available', info => {
        log(`Atualização disponível: versão ${info.version}. Baixando...`);
        mudar({ situacao: 'baixando', versaoNova: info.version, progresso: 0, erro: '' });
    });
    autoUpdater.on('update-not-available', () => mudar({ situacao: 'ociosa', versaoNova: '' }));
    autoUpdater.on('download-progress', p => mudar({ situacao: 'baixando', progresso: Math.round(p.percent) }));
    autoUpdater.on('update-downloaded', info => {
        log(`Atualização baixada: versão ${info.version}. Pronta para instalar.`);
        mudar({ situacao: 'pronta', versaoNova: info.version, progresso: 100 });
    });
    autoUpdater.on('error', err => {
        log('Falha ao verificar atualização:', err.message);
        mudar({ situacao: 'erro', erro: err.message });
    });
}

async function verificar() {
    if (!empacotado) {
        // Rodando com "npm start" não há instalador nem arquivo de atualização: a verificação
        // não funciona e não deveria tentar, para não poluir o registro com um erro esperado.
        mudar({ situacao: 'erro', erro: 'A verificação de atualização só funciona no app instalado, não em "npm start".' });
        return;
    }
    try { await autoUpdater.checkForUpdates(); }
    catch { /* o evento 'error' já guardou o motivo em estado.erro */ }
}

function instalarAgora() {
    if (estado.situacao !== 'pronta') return;
    // Silencioso e reabrindo o app: sem isso o NSIS mostra o assistente de instalação inteiro.
    autoUpdater.quitAndInstall(true, true);
}

const obterEstado = () => estado;

// Primeira checagem pouco depois de abrir (dá tempo da janela aparecer antes), e depois a
// cada 4 horas: não precisa ser mais frequente, e assim evita bater no GitHub sem necessidade.
function iniciarVerificacoesPeriodicas() {
    if (!empacotado) return;
    setTimeout(verificar, 10000);
    setInterval(verificar, 4 * 60 * 60 * 1000);
}

module.exports = { configurar, verificar, instalarAgora, obterEstado, iniciarVerificacoesPeriodicas };
