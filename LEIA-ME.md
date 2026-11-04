# Painel de Scripts

App para Windows, feito em Electron. Abre o Edge ou o Chrome nos perfis do usuário e injeta
userscripts no SmartBus (Guanabara) e na Tallos, sem precisar do Tampermonkey. O hub, que é a
tela de controle, é a janela do app. A versão fica em `version` no `package.json`.

O planejamento das próximas etapas está em [PLANEJAMENTO.md](PLANEJAMENTO.md).

## Estrutura

| Caminho | O que é |
|---|---|
| `src/principal/index.js` | Processo principal do Electron: janela, bandeja, instância única e o protocolo `painel://`, que entrega o hub. |
| `src/preload/index.js` | Ponte entre a janela e o processo principal (`window.painel`). |
| `src/app.js` | Núcleo. Faz a cópia dos perfis, abre o navegador (puppeteer-core via `--remote-debugging-port`), injeta os scripts, emula o GM_* e responde aos pedidos do hub (`tratarApi`). |
| `src/runtime.txt` | Código injetado uma vez por aba: funções GM_*, `registrarModulo`, liga/desliga ao vivo e as "zonas", que desfazem scripts comuns ao desligar. |
| `src/ponte.txt` | Casca colocada em volta de cada userscript (`/*__USERSCRIPT__*/`). |
| `src/hub.html` | Interface do hub: perfis, lista de scripts e editor CodeMirror. |
| `src/embutidos/painel.user.txt` | Script unificado original. `gerar-modulos.js` corta ele em um módulo por arquivo. |
| `src/embutidos/substituicoes/` | Versões novas de módulos, que entram no lugar do trecho do unificado. Exemplo: `mod-reserva_automatica.user.txt`, o **Copiar e Refazer Reserva**. |
| `src/embutidos/extras/` | Módulos que não vêm do unificado. Exemplo: `fast_loading.user.txt`. |
| `src/embutidos/modulos/` | **Gerado** por `gerar-modulos.js`. Não edite aqui, edite em `substituicoes/` ou `extras/`. |
| `src/icone/`, `src/vendor/` | Ícone do app e CodeMirror 5.65.16 embutido. |
| `gerar-modulos.js` | Gera `src/embutidos/modulos/` e o `index.js`. |

## Módulos (userscripts)

- Um módulo chama `registrarModulo({ init, destroy })` e liga e desliga na hora pelo hub.
- Um script comum, sem `registrarModulo`, também funciona: o runtime registra o que ele cria e desfaz ao desligar.
- Cabeçalhos aceitos: `@name`, `@version`, `@description`, `@match`/`@include`/`@exclude`, `@run-at`, `@require`, `@connect` e `@grupo` (SmartBus/Tallos).

## Como rodar e gerar o instalador

```bash
npm install
npm run gerar          # só se mudou algo em src/embutidos
npm start              # abre o app sem instalar
npm run dist           # gera out/PainelDeScripts-Setup-<versão>.exe
```

Antes de gerar, suba `version` no `package.json` e o `@version` do módulo alterado.

Se o Electron abrir como Node puro (erro ao carregar `electron`), a variável
`ELECTRON_RUN_AS_NODE` está definida no terminal: rode `unset ELECTRON_RUN_AS_NODE` antes.

## Dados no Windows

Ficam em `%LOCALAPPDATA%\PainelDeScripts`:

- `config.json` e `dados.json`
- `perfis.json`: os perfis do app (cada um com seus scripts ligados, listas de perfis do navegador e navegador)
- a pasta `scripts/`
- `painel.log`
- as cópias de perfil: `edge-perfis`, `chrome-perfis`

O app instalado fica em outro lugar (por padrão `%LOCALAPPDATA%\Programs`), então desinstalar
pelo Windows não apaga esses dados. A pasta `app\` ali dentro só existe em máquinas que tiveram a 6.x.
