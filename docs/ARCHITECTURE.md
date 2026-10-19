# Arquitetura SIG-UHE — auditoria e incremento inicial

## Evidências auditadas

Auditoria em 19/10/2026. Fontes imutáveis:

- Fleetbase `89ff7c34c336e865d174144762d182becb9ff6ce`, versão da console 0.7.71.
- Fleet-Ops `33032e53ebee5e4a514970ee2379c12348c77c54`, versão 0.6.74.
- Core API `931d48e5241e11bb4bb9f988796b030dadf197b0`, versão 1.6.72.

O `api/composer.lock` do Fleetbase resolve exatamente os dois últimos commits. Não inicializamos todos os submódulos: vários são produtos independentes. A ausência de código em um diretório de submódulo não significa funcionalidade inexistente.

## Plataforma verificada no código

Backend Laravel 10; manifesto exige PHP >=8.0 e <8.3 e core exige >=8.1: runtime escolhido PHP 8.2. Frontend Ember 5.4, Ember Engines e pnpm. Console e extensões comunicam-se por REST; SocketCluster atende atualizações. MySQL é o banco operacional nativo; Redis, filas e scheduler são componentes do Compose upstream. O incremento usa Redis 7.4 com Predis (já no lockfile), sessão em arquivo e fila Redis. O cache nativo de modelos exige Redis; ele não pode ser substituído apenas por CACHE_DRIVER=array. Um worker nativo está ativo e a fila foi testada. Scheduler e SocketCluster não estão homologados.

Extensões possuem `composer.json`, descoberta de service providers Laravel, migrations próprias e, para interface, `package.json`/`extension.json` com Ember Engine. Evidências: `fleetops/composer.json`, `extension.json`, `addon/engine.js`, `server/src/Providers/FleetOpsServiceProvider.php`.

As rotas nativas estão em `fleetops/server/src/routes.php`. A API consumível usa `fleetbase.api`; a console usa `fleetbase.protected` com Sanctum, sessão e AuthorizationGuard. A extensão usa o segundo grupo mais uma verificação explícita de `sig-uhe.read`/`sig-uhe.write`; uma permissão inexistente nega acesso. Organização e ator vêm da sessão autenticada, nunca do corpo da requisição.

## Incremento executável

`extensions/sig-uhe` é um pacote Laravel separado. O wrapper em `scripts/bootstrap.php` registra o provider sem alterar arquivos do Fleetbase, dependências ou lockfiles upstream. Em uma instalação convencional, o mesmo provider pode ser carregado pela descoberta Composer; esse caminho de instalação precisa de sua própria homologação.

Cadastros de UHE, reservatório e solicitação ficam no mesmo MySQL. Emissão cria `Place`, `Payload` e `Order` nativos e um vínculo rastreável dentro da mesma transação. A ordem usa inicialmente a configuração nativa `transport`, sem despacho automático. Não há uma segunda tabela de OS ou de equipes. Um futuro fluxo específico de inspeção deverá ser configurado e homologado antes de uso em campo. A duração é preservada nos metadados; sua tradução para o payload do otimizador ainda não está implementada.

A base é informada pelo planejador. O destino é o acesso cadastrado, diferente das coordenadas da ocorrência. Nenhuma distância, rota ou acessibilidade rodoviária é inferida nesta fase. O adaptador não chama serviços de mapas externos.

## Evolução geoespacial e integração

PostGIS será proprietário de geometrias versionadas e análises; MySQL mantém o estado operacional. IDs UUID estáveis serão usados nos contratos. As futuras gravações espaciais devem usar outbox transacional MySQL, consumidor idempotente e inbox PostGIS, sem transação distribuída. Não há sincronização implementada neste incremento.

O Fleet-Ops já registra `OrchestrationEngineRegistry`, `VroomOrchestrationEngine` e `OsrmTrackingProvider`. O primeiro usa `POST {base_uri}/solve`; não se deve apontá-lo indiscriminadamente para um servidor vroom-express que exponha outra rota. Validar contrato, timeouts e autenticação na fase 2. A existência do adaptador não demonstra funcionamento da integração, nem planejamento pluridiário.

## Escopo da validação

O alvo atual é a API operacional em desenvolvimento. Console Ember, mapas, PostGIS, SocketCluster, scheduler, VROOM/OSRM e app mobile não estão homologados por esse alvo. A arquitetura final continua modular sobre Fleetbase; não foi criada uma plataforma operacional paralela.

## Ajustes comprovados de runtime

A configuração upstream de Redis concatena nomes como `0_cache` para índices, e uma URL sem path usa `cache` como índice padrão. Redis SELECT exige inteiro. O wrapper aplica índices 0/1/2/3 via API de configuração Laravel após RegisterProviders e antes de BootProviders. Isso permite que o carregamento HTTP de configurações use Redis corretamente. É um problema observado na configuração auditada, contornado sem editar o núcleo.

A fila Redis é configurada com `after_commit=true`: eventos de modelos criados em lotes rejeitados não devem sair antes do commit. A criação por modelos nativos evita o job de finalização da API transport que tentaria calcular distância antes da fase de roteirização; ordens ficam `created`, com tracking e payload nativos, sem despacho. A leitura pela API nativa `/v1/orders/{public_id}` foi exercitada. Telemetria é desabilitada pela variável suportada `TELEMETRY_DISABLED=true`; mapas, notificações externas e serviços pagos não são chamados pelo incremento.
