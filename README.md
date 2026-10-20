# SIG-UHE

Extensão modular para Fleetbase/Fleet-Ops. A entrega atual reúne a **API e a interface web de desenvolvimento** para UHEs, reservatórios, solicitações, equipes e emissão de ordens nativas. O MVP completo descrito em [requisitos](docs/REQUIREMENTS.md) ainda está em desenvolvimento.

## Preparar e executar

Pré-requisitos: Linux, Docker Engine com Compose v2, Git, Python 3.12, Node.js 24 com npm/npx e acesso aos registries oficiais. Use o checkout existente; cada tarefa de nuvem já é isolada e não precisa de worktree.

```bash
cd /workspace/Insp
bash scripts/setup_all.sh
```

O instalador obtém o Fleetbase no commit auditado, preserva seu código e lockfile, prepara o runtime PHP 8.2, instala dependências, inicia MySQL e Redis, cria os bancos auxiliares nativos, aplica migrations e inicia API e worker e compila a console com o engine SIG-UHE. Credenciais locais aleatórias ficam somente no `.env` ignorado pelo Git; nunca coloque credenciais de produção. O runtime usa `.runtime/` e o banco usa volume Docker. Os processos devem ser reiniciados em cada máquina.

```bash
docker compose up -d --wait database cache api worker web
docker compose exec -T api php scripts/artisan.php migrate:status --no-ansi
```

O servidor PHP é exclusivo para desenvolvimento e escuta somente em loopback no host. A console Ember contém o módulo SIG-UHE com visão geral, UHEs, reservatórios, equipes, solicitações e histórico. Equipes têm [perfil operacional](docs/TEAM_OPERATIONS.md) com habilidades, base, disponibilidade e jornada semanal. Consulte [a documentação da interface](docs/WEB_INTERFACE.md). Não há usuário público padrão; os testes abaixo criam identidades sintéticas com tokens e senhas privados para validar os fluxos. Em instalações convencionais, usar o onboarding e autenticação nativos do Fleetbase.

## Testes funcionais

```bash
bash scripts/test.sh
```

Cada seed cria organizações isoladas; não execute em produção. Tokens ficam em `.runtime/test-auth.json` com modo 0600. A suíte usa HTTP autenticado real, MySQL e modelos Fleet-Ops. Veja [resultados e limitações](docs/VALIDATION.md). Para testar novamente, execute novamente o script; a verificação de armazenamento se refere à organização do seed mais recente.

## API inicial

Base `/sig-uhe/v1`, JSON, `Accept: application/json`, token Sanctum no header `Authorization: Bearer …`. Organização e ator são extraídos da sessão. Administradores da organização ou usuários com `sig-uhe.read`/`sig-uhe.write` têm acesso conforme a operação. O registro da permissão não concede acesso por si só: atribua-a pelo IAM nativo conforme a função.

| Método e recurso | Operação |
|---|---|
| GET `overview` | Totais da organização e permissão de escrita |
| GET/POST `plants` | Consultar/criar UHE: code, name, state |
| GET/POST `reservoirs` | Consultar/criar reservatório: plant_id, name |
| GET/POST `teams` | Consultar/criar Fleet nativa: name |
| GET/POST `requests` | Consultar/criar solicitação |
| PATCH `requests/{id}` | Alterar status com reason obrigatório e transição válida |
| POST `requests/import` | CSV UTF-8 com cabeçalho, Content-Type text/csv; até 100 registros, 2 MiB |
| GET/POST `requests/{id}/orders` | Consultar vínculos/emitir Order nativa |
| POST `requests/orders/batch` | Emitir até 100 ordens em uma transação |
| GET `audit` | Histórico da organização, paginado |

Solicitação requer `reservoir_id`, `protocol`, `description`, `category`, `priority` (`low`, `normal`, `high`, `urgent`), `latitude`, `longitude`, `service_seconds` (60–86400). Opcionais: par `access_latitude`/`access_longitude`, `due_at` em ISO 8601 com offset. Coordenadas são EPSG:4326 em graus. Não há cálculo de áreas em graus.

Emissão exige `idempotency_key`, `base_latitude`, `base_longitude` e acesso cadastrado na solicitação. Não despacha a equipe nem calcula uma rota. A chave repetida com o mesmo conteúdo devolve o vínculo existente; outro conteúdo recebe 409. No lote, envie `items` com esses campos e `request_id` em cada item. Várias OS por solicitação são possíveis com chaves distintas. O estado da solicitação permanece independente do estado da Order.

## Documentação técnica

- [Arquitetura e evidências](docs/ARCHITECTURE.md)
- [Matriz de reaproveitamento e licenças](docs/REUSE_MATRIX.md)
- [Modelo de dados](docs/DATA_MODEL.md)
- [Plano incremental](docs/IMPLEMENTATION_PLAN.md)
- [Riscos](docs/RISK_REGISTER.md)

Fleetbase e Fleet-Ops são AGPL-3.0-or-later. Não houve alteração de licenciamento nem implantação corporativa nesta entrega. Revisar as obrigações aplicáveis antes de distribuir ou oferecer versões modificadas pela rede.

## Testes e telas da interface

`bash scripts/test_web.sh` executa os cenários no Chromium com login nativo e a API real. As imagens em `docs/screenshots/` são capturas do sistema em execução com dados fictícios, não maquetes.

A compilação da console está em `.runtime/console/dist`. O serviço `web` é um gateway de desenvolvimento e usa somente loopback; publicar o ambiente não cria hospedagem pública.
