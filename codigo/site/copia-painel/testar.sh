#!/usr/bin/env bash
# Percurso completo da demonstração no navegador. Uso: bash testar.sh
cd "$(dirname "$0")" || exit 1
AB="timeout 25 agent-browser --session copia-teste"
U="file://$(pwd)/index.html"
roda(){ sed "s/__PASSO__/\"$1\"/g" testes.js | $AB eval --stdin; }
como(){ $AB eval "__demo.verComo('$1')" >/dev/null; $AB wait 1500 >/dev/null; }
# Engenheiros e Helena entram pela primeira vez: senha inicial e depois a senha definitiva.
primeiro(){ como "$1"; sed "s/__EMAIL__/\"$1\"/; s/__NOME__/\"$2\"/" primeiro-acesso.js | $AB eval --stdin; }

$AB open "$U" >/dev/null
$AB wait 800 >/dev/null
$AB eval "__demo.reiniciar()" >/dev/null
$AB wait 800 >/dev/null
$AB eval "document.querySelector('#cxEntrarComo button[data-entrar^=\"marina\"]').click()" >/dev/null
$AB wait 4000 >/dev/null
roda equipe
primeiro rafael.souza@holding.exemplo Rafael; roda rafael
primeiro helena.rocha@empresa.exemplo Helena; roda helena
primeiro bruno.nunes@holding.exemplo Bruno; roda bruno
como marina.costa@empresa.exemplo; roda marina
como rafael.souza@holding.exemplo; roda rafael2
como marcos.prado@holding.exemplo; roda marcos
como gustavo@empresa.exemplo; roda gustavo
echo "--- erros do navegador:"; $AB errors | head -5
