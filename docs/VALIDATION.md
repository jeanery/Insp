# Validação executada — 19/10/2026

## Resultado

Incremento inicial da API de desenvolvimento validado com Fleetbase/Core/Fleet-Ops reais, PHP 8.2.34, MySQL 8.0 e Redis 7.4. Não é homologação do MVP completo ou de produção.

| Verificação | Resultado |
|---|---|
| Dependências do composer.lock upstream | 274 pacotes instalados, incluindo desenvolvimento; TLS e checksums do transporte preservados |
| Migrations nativas e SIG-UHE | Aplicadas; nova instalação repetida resultou em Nothing to migrate |
| `tests/functional.py` | 10 testes passaram, sem skips, última execução em 7,190 s |
| Cadastro/importação | 100 solicitações fictícias em CSV; lote inválido revertido; protocolo duplicado rejeitado |
| Ordens | 100 OS nativas emitidas em lote; reenvio idempotente; conteúdo divergente rejeitado |
| Integração nativa | OS consultada com sucesso em `/v1/orders/{public_id}` |
| Isolamento/autorização | Outra organização não lê/vincula registros; perfil consulta lê e recebe 403 ao escrever; anônimo recebe 401 |
| Acesso geográfico | Coordenadas inválidas e acesso incompleto rejeitados; emissão sem acesso bloqueada |
| Equipes/estados/auditoria | Fleets nativas criadas/consultadas; transições inválidas bloqueadas; motivo registrado; auditoria segregada |
| `tests/storage.php` | 100 ordens, payloads, estados independentes e coordenadas de acesso verificadas no MySQL |
| `tests/migration.php` | up/down em schema descartável com definições reais de companies/orders; banco de desenvolvimento preservado |
| `tests/queue.php` | Job enviado ao Redis e executado pelo worker Laravel; zero jobs falhos no banco de desenvolvimento |
| Repetibilidade | `python scripts/setup.py` executado após instalação; dependências existentes preservadas; serviços reiniciados |
| Código upstream | `git status --short` vazio no checkout de runtime; composer.json e composer.lock inalterados |

## Falhas investigadas e resolvidas

1. Imagem monolítica oficial excedeu o espaço do Docker vfs: runtime PHP menor a substituiu.
2. DNS de proxy no build/container e CA de ambiente: hostname explicitamente resolvido e certificado público instalado, sem desabilitar verificação.
3. GitHub zipball API bloqueada por política: cache de arquivos preenchido pelo endpoint oficial codeload com o mesmo SHA de cada pacote. Nenhum manifesto ou checksum foi alterado.
4. Banco auxiliar storefront inexistente: comando nativo `mysql:createdb` incorporado à instalação.
5. Cache de modelos nativos exigia Redis: serviço e cliente Predis incluídos; índices de Redis ajustados via configuração de runtime.
6. Fila de banco não tinha tabela jobs: adotada fila Redis nativa com after_commit.
7. Integração de controller e vínculos de permissão: controller Laravel e CompanyUser nativos usados; testes HTTP comprovam o resultado.
8. Arquivo privado de tokens criado como root: runtime passou a executar com UID/GID 1000, preservando modo 0600.

As primeiras tentativas falharam antes da execução dos cenários; nenhum resultado com zero testes foi considerado aprovação.

## Limites e não executado

Interface Ember SIG-UHE, mapas, importação XLSX, distribuição/skills/jornadas, OSRM/VROOM, rotas de vários dias, urgências, PostGIS, campanhas, inventário, anexos, etiquetagem, offline e relatórios ainda não foram implementados/testados neste incremento. Não há validação Android, de carga, backup/restauração, LGPD, pentest ou produção. Os 20 cenários do prompt permanecem uma matriz de homologação futura; criar três equipes não comprova distribuição otimizada.

Serviços e dados atuais pertencem a esta máquina. Não houve push, publicação de ambiente ou validação em uma nova tarefa. Os commits locais e o volume de desenvolvimento precisam de preservação na estratégia de publicação; sua restauração futura não foi demonstrada.
