# Validação executada — 20/10/2026

## Resultado

Incremento da API e da interface Ember de desenvolvimento validado com Fleetbase/Core/Fleet-Ops reais, PHP 8.2.34, MySQL 8.0 e Redis 7.4. Não é homologação do MVP completo ou de produção.

| Verificação | Resultado |
|---|---|
| Dependências do composer.lock upstream | 274 pacotes instalados, incluindo desenvolvimento; TLS e checksums do transporte preservados |
| Migrations nativas e SIG-UHE | Aplicadas; nova instalação repetida resultou em Nothing to migrate |
| `tests/functional.py` | 13 testes passaram, sem skips, última execução em 32,108 s |
| Cadastro/importação | 100 solicitações fictícias em CSV; lote inválido revertido; protocolo duplicado rejeitado |
| Ordens | 100 OS nativas emitidas em lote; reenvio idempotente; conteúdo divergente rejeitado |
| Integração nativa | OS consultada com sucesso em `/v1/orders/{public_id}` |
| Isolamento/autorização | Outra organização não lê/vincula registros; perfil consulta lê e recebe 403 ao escrever; anônimo recebe 401 |
| Acesso geográfico | Coordenadas inválidas e acesso incompleto rejeitados; emissão sem acesso bloqueada |
| Perfil operacional de equipe | Base, fuso, habilidades, jornadas e capacidade persistidos; sobreposição e valores inválidos rejeitados; versão antiga recebe 409; motivo e antes/depois auditados; isolamento e perfil consulta conferidos |
| Equipes/estados/auditoria | Fleets nativas criadas/consultadas; transições inválidas bloqueadas; motivo registrado; auditoria segregada |
| `tests/storage.php` | 100 ordens, payloads, estados independentes e coordenadas de acesso verificadas no MySQL |
| `tests/migration.php` | up/down das duas migrations em schema descartável com definições reais de companies/orders/fleets; banco de desenvolvimento preservado |
| `tests/queue.php` | Job enviado ao Redis e executado pelo worker Laravel; zero jobs falhos no banco de desenvolvimento |
| Repetibilidade | `python scripts/setup.py` executado após instalação; dependências existentes preservadas; serviços reiniciados |
| Código upstream | `git status --short` vazio no checkout de runtime; composer.json e composer.lock inalterados |

## Interface e gateway

- Console Fleetbase 0.7.71 com Ember Engine SIG-UHE compilada usando pnpm 11.0.9 e lockfile upstream preservado.
- `tests/browser.py`: nove grupos passaram no Chromium real, sem grupos omitidos: autenticação nativa; cadastros; bloqueio de OS sem acesso e situação justificada; OS idempotente após perda de resposta; CSV inválido/corrigido; paginação 50 + 1; histórico e layout móvel; perfil de consulta; perfil operacional com habilidades/jornada, validação de capacidade, reabertura e consulta desabilitada para escrita. Sem erros de execução JavaScript na sessão administrativa.
- `tests/web_gateway.py`: quatro testes passaram, incluindo arquivos privados inacessíveis, autenticação preservada, saúde/SPA e arquivos estáticos.
- Capturas reais com dados sintéticos: [painel](screenshots/sig-uhe-dashboard.png), [solicitações](screenshots/sig-uhe-solicitacoes.png), [celular](screenshots/sig-uhe-mobile.png), [perfil da equipe](screenshots/sig-uhe-equipe.png) e [equipe no celular](screenshots/sig-uhe-equipe-mobile.png).
- As credenciais de demonstração são geradas aleatoriamente pelo seed e permanecem privadas. O onboarding corporativo e a matriz completa de permissões nativas não foram homologados.

## Falhas investigadas e resolvidas

1. Imagem monolítica oficial excedeu o espaço do Docker vfs: runtime PHP menor a substituiu.
2. DNS de proxy no build/container e CA de ambiente: hostname explicitamente resolvido e certificado público instalado, sem desabilitar verificação.
3. GitHub zipball API bloqueada por política: cache de arquivos preenchido pelo endpoint oficial codeload com o mesmo SHA de cada pacote. Nenhum manifesto ou checksum foi alterado.
4. Banco auxiliar storefront inexistente: comando nativo `mysql:createdb` incorporado à instalação.
5. Cache de modelos nativos exigia Redis: serviço e cliente Predis incluídos; índices de Redis ajustados via configuração de runtime.
6. Fila de banco não tinha tabela jobs: adotada fila Redis nativa com after_commit.
7. Integração de controller e vínculos de permissão: controller Laravel e CompanyUser nativos usados; testes HTTP comprovam o resultado.
8. Arquivo privado de tokens criado como root: runtime passou a executar com UID/GID 1000, preservando modo 0600.
9. Engine isolado sem resolver componentes nativos: dependências Ember Core/UI declaradas, carregamento lazy e ember-engines como peer dependency.
10. Conta de teste sem papel nativo e senha com hash duplo: fixtures passaram a usar papel Sanctum e o mutator de senha nativo, permitindo login real.
11. Barra lateral vazia cobria o módulo no celular: layout da própria extensão ajustado; verificação passou a medir a área útil, além do overflow da página.
12. A suíte ampliada excedeu o limite real de 60 requisições/minuto. As chamadas do navegador passaram a respeitar esse limite e a busca passou a exigir HTTP 200 antes de usar os resultados; a proteção do servidor foi mantida.

As primeiras tentativas falharam antes da execução dos cenários; nenhum resultado com zero testes foi considerado aprovação.

## Limites e não executado

Mapas, importação XLSX, distribuição/skills/jornadas, OSRM/VROOM, rotas de vários dias, urgências, PostGIS, campanhas, inventário, anexos, etiquetagem, offline e relatórios ainda não foram implementados/testados neste incremento. Não há validação Android, de carga, backup/restauração, LGPD, pentest ou produção. Os 20 cenários do prompt permanecem uma matriz de homologação futura; criar três equipes não comprova distribuição otimizada.

O ambiente anterior foi publicado pelo usuário e seus caches e dados foram encontrados nesta tarefa; os serviços precisaram ser reiniciados. Esta nova versão da interface ainda depende de publicação. Não houve push nem validação da restauração dos novos commits em outra tarefa. Commits locais exigem preservação; a restauração automática desses commits não é garantida.
