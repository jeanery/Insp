# Validação — 24/10/2026

A versão Cloudflare foi executada no runtime local do Wrangler/workerd, com D1 real emulado pelo serviço local. Não dependeu dos containers PHP/MySQL/Redis da versão anterior.

| Verificação | Resultado |
|---|---|
| `npm ci` | Instalação repetida com package-lock preservado |
| `npm run build` | TypeScript estrito e Vite aprovados; cerca de 250 kB de arquivos, aproximadamente 77 kB comprimidos |
| `npm test` | 12 grupos de integração passaram, sem grupos omitidos, contra dois Workers e D1 local; dez testes adicionais verificam o configurador Cloudflare com API simulada |
| `npm run test:browser` | Quatro grupos no Chromium real passaram, sem erros JavaScript: login/cadastros, perfil de equipe, processo SIGA/OS/layout móvel e logout/consulta |
| `npm run test:siga -- <fonte original>` | Worker e migrations originais do ZIP do usuário, sem alterações, executados com D1/R2 locais e usuários sintéticos; bcrypt, sessão assinada, `/api/me`, negação de perfis e escrita autorizada conferidos |
| Segurança do destino de deploy | Placeholder do banco bloqueia a publicação antes de qualquer operação remota; script também verifica tabelas características do SIGA antes de migrar |
| Recursos reais da conta Cloudflare | Não utilizados; Wrangler informou ausência de autenticação |

## O que os testes de API verificam

1. Acesso anônimo, identidade forjada e perfil solicitante bloqueados.
2. Login delegado ao SIGA, cookie HttpOnly e ausência de token no JSON entregue ao frontend.
3. Escrita de consulta e origem externa bloqueadas.
4. UHEs, reservatórios e equipes persistidos.
5. Coordenadas e pares de acesso validados; OS sem acesso rejeitada.
6. CSV com 100 linhas, campo entre aspas com vírgula/quebra de linha, paginação 50 + 50 e rollback de lote inválido ou duplicado. O lote usa duas instruções SQL set-based em um único batch transacional, evitando uma consulta por registro.
7. Emissões concorrentes com a mesma chave produzem uma única OS; conteúdo diferente recebe 409; coordenadas de acesso preservadas.
8. Estados de solicitação e OS independentes, transições justificadas e salto inválido rejeitado.
9. Capacidade/jornada sobreposta rejeitadas, editores concorrentes protegidos por versão e consulta impedida de editar.
10. Consulta e vínculo SIGA validam acesso na origem, rejeitam duplicação e excluem documentos pessoais da resposta de integração.
11. Auditoria persistida, agregados e pesquisa literal de caracteres especiais.
12. Limite de tentativas de login aplicado.

## Evidências visuais

Capturas atuais, com dados fictícios: [painel](../docs/screenshots/cloudflare/painel.png), [solicitações](../docs/screenshots/cloudflare/solicitacoes.png), [celular](../docs/screenshots/cloudflare/celular.png).

## Limites

A compatibilidade foi exercitada com o código enviado no ZIP, não com contas ou dados da instância pública do SIGA. Os testes normais usam um Worker-fixture de contrato; o teste adicional executou o Worker original. As identidades fictícias e o fixture não fazem parte do deploy de produção. O código original copiado para esse teste e suas credenciais locais ficam somente em `.wrangler/`, ignorado pelo Git.

Não houve criação de recursos, publicação ou alteração no SIGA-CCU online. O GitHub Actions foi executado: instalação, build e testes remotos passaram; a etapa de configuração parou por ausência dos Secrets Cloudflare. O endereço público e a criação do D1 ainda dependem dessas credenciais. Não há homologação de produção, escala, restauração de backup, múltiplas organizações no mesmo banco, restrição por UHE, importação de dados MySQL ou equivalência de todo o Fleet-Ops. A emissão de 100 OS em um único endpoint de lote da API antiga ainda não foi portada; a nova API emite por solicitação.

O pacote enviado pelo usuário foi utilizado como referência de arquitetura e contrato. Nenhum `.env`, token, usuário real, banco ou recurso de produção do SIGA foi copiado para o repositório.

## Configuração automática da conta

O workflow agora aceita `database_id` vazio e executa `npm run configure:cloudflare`: verifica a presença do serviço SIGA, lista os D1 da conta, cria `sig-uhe` somente se não existir e verifica metadados do esquema antes de gravar o binding. Não altera o serviço ou o banco SIGA. Os dez testes adicionais desse configurador são locais e simulados; não comprovam acesso a uma conta real. A sessão Wrangler segue sem autenticação. A tentativa de listar Secrets via GitHub API recebeu HTTP 403 por escopo da integração, portanto não foi possível confirmar nem modificar os Secrets do repositório por aqui.

### Execução real do GitHub Actions

[Execução 40106235909](https://github.com/jeanery/Insp/actions/runs/40106235909), disparada no commit `d5875be`: instalação com `npm ci`, compilação e testes aprovados no runner GitHub. A configuração retornou a mensagem de Secrets ausentes. Os metadados do log confirmaram `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` vazios; nenhum valor de credencial foi lido ou exposto. A etapa de migrations/deploy foi omitida pelo próprio workflow após a falha. Nenhuma chamada autenticada ou recurso Cloudflare foi criado por essa execução.

O próximo passo é cadastrar os dois valores em [Settings → Secrets and variables → Actions](https://github.com/jeanery/Insp/settings/secrets/actions). Depois, repetir o workflow com `database_id` vazio; não é necessário criar o D1 manualmente.
