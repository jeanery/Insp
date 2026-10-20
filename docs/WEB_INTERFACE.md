# Interface SIG-UHE — incremento da fase 1

A interface é um Ember Engine montado na console Fleetbase, em `/sig-uhe`. Usa o menu, a sessão Sanctum, os componentes Button/Spinner/FaIcon e o estilo geral nativos. Não existe uma segunda autenticação SIG-UHE nem token embutido no frontend.

## Funcionalidades

- Visão geral com contagens agregadas de toda a organização, sem inferir totais a partir da primeira página.
- Cadastro e consulta de UHEs e reservatórios.
- Cadastro de equipes pelo modelo Fleet do Fleet-Ops, com [perfil operacional](TEAM_OPERATIONS.md) para habilidades, base, disponibilidade e jornada semanal.
- Solicitações com busca por protocolo/descrição, filtro de situação e paginação no servidor.
- Cadastro de solicitação com coordenadas da ocorrência e acesso opcional, separados.
- Detalhes, alteração justificada de situação e consulta das OS vinculadas.
- Emissão de OS nativa, exigindo ponto de acesso e base informada. Reenvios preservam a chave de idempotência.
- Importação CSV, modelo de arquivo e erros de validação visíveis. O identificador do reservatório é mostrado para preencher a planilha.
- Histórico paginado da organização.
- Controles de escrita ocultos para consulta; autorização e isolamento continuam validados no backend.

Ainda não há mapa, planejamento/distribuição de equipes, roteirização, campanhas, anexos ou offline. O cadastro de equipes não equivale a atribuição de inspetores e veículos. O histórico mostra referências dos atores; a resolução de nomes por perfil autorizado é evolução futura.

## Build e execução

```bash
cd /workspace/Insp
bash scripts/setup_all.sh
```

Node 24.19 foi usado neste ambiente. O instalador usa o pnpm 11.0.9 fixado pela console, o lockfile upstream e uma única dependência local adicional. `scripts/setup_console.py` monta a aplicação em `.runtime/console`, a partir do checkout auditado, e copia o engine local para `lib/sig-uhe`. Manifestos/lockfile da montagem são gerados; os arquivos originais em `.runtime/fleetbase` são preservados. Não edite a montagem gerada para desenvolver: edite `extensions/sig-uhe/addon` e execute o build novamente.

A compilação inicial inclui as extensões nativas e pode levar alguns minutos. Não foi substituída por uma página estática que imite a aplicação.

O serviço Compose `web` serve a compilação e encaminha as chamadas para a API na rede Docker, preservando autenticação, respostas e códigos HTTP. Ele escuta somente em loopback no host. O proxy externo não é usado para o serviço interno `api`. O gateway é de desenvolvimento, sem TLS, e ainda não é uma implantação corporativa ou um endereço público.

## Testes no navegador

```bash
bash scripts/test_web.sh
```

Usa Chromium em `/usr/bin/chromium` (ou `CHROMIUM_PATH`) e Playwright. Quando o pacote Python não estiver presente, instala a versão fixada em um ambiente virtual ignorado pelo Git. O seed gera senhas aleatórias para os perfis sintéticos; elas ficam somente em `.runtime/test-auth.json`, modo 0600, e nunca são impressas. A suíte espaça as chamadas para respeitar o limite real de 60 requisições/minuto da extensão; esse limite não é desativado nos testes. O navegador autentica pelo formulário real do Fleetbase. Não há credencial padrão pública.

Não utilize esse seed com dados de produção. A conta sintética serve para teste e demonstração; usuários corporativos devem ser provisionados pelo fluxo de identidade nativo e por sua política de acesso.

Capturas e resultados da validação são documentados em `docs/VALIDATION.md`. Os serviços precisam ser reiniciados após restauração; publicação do ambiente não cria uma hospedagem pública para a aplicação.
