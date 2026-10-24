# SIG-UHE para Cloudflare

Versão React + TypeScript + Workers + D1 do SIG-UHE. Não depende de Docker, PHP, MySQL, Redis, Fleetbase ou do processamento do computador do usuário para operar online. Os arquivos da aplicação compilada somam cerca de 250 kB antes de compressão.

A versão anterior permanece na raiz do repositório para consulta e transição. Esta versão possui banco e ordens próprios: as ordens D1 não são objetos Fleet-Ops. Os dados MySQL existentes **não são migrados automaticamente**. Não há operação paralela sincronizada dos dois bancos.

## O que foi convertido

- UHEs, reservatórios e equipes.
- Solicitações, filtro/paginação de 50 registros e CSV atômico até 100 linhas/2 MiB.
- Ocorrência e acesso geográfico separados; bloqueio de OS sem acesso.
- OS com repetição idempotente e situação independente da solicitação.
- Perfil de equipe: habilidades, base, fuso IANA, jornadas, capacidade e versão contra perda de edição.
- Histórico transacional por usuário.
- Login pelo SIGA-CCU e vínculo autorizado de processos do SIGA com solicitações SIG-UHE.

Ainda não há mapas SIG-UHE, rotas/solver, campanhas, offline, anexos de inspeção, emissão de 100 OS por um único endpoint de lote ou migração dos dados antigos. Os caminhos e contratos da API foram adaptados para `/api/`; não se trata de uma implementação equivalente de toda a plataforma Fleet-Ops. O R2 do SIGA continua sob responsabilidade do SIGA; esta versão não acessa seus documentos.

## Integração SIGA-CCU

O binding `SIGA` chama o Worker `siga-ccu`, na mesma conta Cloudflare:

1. O SIG-UHE encaminha o login a `/api/auth/login` do SIGA.
2. Valida a sessão consultando `/api/me`. Não copia `AUTH_SECRET`, senha, hash ou tabela de usuários.
3. Guarda o token em cookie próprio HttpOnly, Secure em HTTPS, SameSite=Lax. Não retorna o token ao JavaScript nem usa localStorage.
4. Revalida usuário e perfil no SIGA em cada requisição. Alterações de perfil no SIGA passam a valer na próxima chamada.
5. Consulta os processos autorizados por `/api/requests` e `/api/requests/:id`. A resposta de integração expõe apenas identificador, protocolo, reservatório, município, coordenadas e descrição, excluindo documentos pessoais e anexos.
6. Ao vincular, busca novamente o processo pelo servidor e grava `source_siga_id`/`source_protocol`. Duplicações são rejeitadas. O processo original não é alterado e nenhuma OS é criada dentro do SIGA automaticamente.

As duas aplicações têm telas de entrada próprias. Reusar a mesma identidade não significa login automático entre domínios. Sair do SIG-UHE apaga seu cookie; revogação global de sessões depende do SIGA, cujo token atual expira em oito horas.

### Perfis

Escrita: `supervisor_inspecao`, `supervisor_cessao`, `coordenador`, `gerente`, `diretor`.
Consulta: os anteriores e `analista_fundiario`, `analista_respeitabilidade`, `analista_area`, `inspetor_vistoriador`.
`solicitante`, perfis desconhecidos e sessões inválidas são bloqueados. A tabela é explícita e deve ser homologada com o gestor antes da operação. D1 é exclusivo para uma organização/deployment; não há segregação multiempresa dentro desse banco. Para outras organizações, use deployments e D1 separados até implementar a autorização correspondente. Permissões por UHE permanecem pendentes.

## Publicar pela tela de criação de Worker da Cloudflare

O Worker é chamado `insp`, como o projeto selecionado na tela da Cloudflare; o nome de apresentação do sistema continua SIG-UHE. O banco dedicado `sig-uhe` informado pelo proprietário já está associado ao binding `DB` em `wrangler.toml`. O identificador é público de configuração, não uma credencial. A propriedade e a conectividade desse banco serão verificadas quando o build autenticado rodar na conta.

Com o repositório `jeanery/Insp`, branch `main`, e o diretório raiz do build mantido na raiz do repositório, use:

- **Project name:** `insp`.
- **Build command:** `cd cloudflare-app && npm ci && npm run build`.
- **Deploy command:** `cd cloudflare-app && npm run deploy`.
- **Preview builds:** desativadas por enquanto; não foi configurado um D1 isolado para previews.

Se o diretório raiz for explicitamente alterado para `cloudflare-app` nas opções avançadas da Cloudflare, retire `cd cloudflare-app &&` dos dois comandos. Não use as duas configurações simultaneamente.

Esse caminho usa a autenticação do build da própria Cloudflare. O comando verifica o esquema do D1 antes de migrar e publicar. O token do build precisa permitir edição do Worker e do D1 nessa conta; a associação ao serviço `siga-ccu` também será validada na publicação. Não altere o banco ou o Worker SIGA. Se o build falhar, consulte o erro antes de mudar permissões ou recursos.

## Publicar sem instalar nada no Windows

O fluxo GitHub Actions permite compilar, testar e publicar pela nuvem. Não é necessário executar o sistema no computador.

1. No GitHub do projeto, abra **Settings → Secrets and variables → Actions → New repository secret**. Cadastre `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` da **mesma conta Cloudflare** do SIGA-CCU. Nunca envie esses valores no chat ou em commits.
2. O token Cloudflare deve estar limitado à conta correta, com **Account → Workers Scripts → Edit**, **Account → D1 → Edit** e **Account → Account Settings → Read**. O Account ID é encontrado no painel da conta; não confunda com Database ID ou Zone ID.
3. Vá a **Actions → Publicar SIG-UHE na Cloudflare → Run workflow** e deixe **database_id vazio**.
4. O fluxo executa build e testes, confirma que o serviço `siga-ccu` existe nessa conta e cria ou localiza o D1 exclusivo `sig-uhe`. Não cria outro banco quando o D1 já existe. Verifica o esquema de destino, configura o binding `DB`, aplica migrations e publica o Worker `insp`. O Wrangler mostra o endereço na etapa de publicação; use esse endereço, sem presumir um hostname antes da publicação.
5. Entre com uma conta interna SIGA-CCU com um dos perfis permitidos. Não há senha pública padrão nem modo demonstrativo aberto em produção.

A criação do D1 é automática no fluxo; você não precisa criar o banco manualmente nem instalar ferramentas no Windows. Se preferir indicar um ID já existente, ele deve corresponder exatamente ao D1 `sig-uhe` da conta selecionada. A primeira publicação exige apenas os dois Secrets de conta. O workflow é manual: push de código não publica nem altera produção automaticamente. Se o serviço do SIGA tiver outro nome ou environment, ajuste o binding `SIGA` no `wrangler.toml`. O domínio público recebido anteriormente não substitui a confirmação desse nome na conta.

O comando de deploy recusa o ID placeholder e verifica se o banco contém tabelas características do SIGA; nesse caso interrompe sem aplicar migrations. Essa verificação reduz o risco de escolher o banco errado, mas não substitui a escolha explícita de um banco dedicado. Migrations futuras devem preservar dados e ter plano de recuperação próprio.

## Desenvolvimento opcional

Node.js 24, sem Docker:

```bash
cd cloudflare-app
npm ci
npm run build
npm run db:local
npm run dev
```

A autenticação requer um Worker SIGA vinculado; rodar apenas `wrangler dev` não cria usuários ou concede acesso. Para testes locais isolados, a suíte inicia também um Worker-fixture com identidades fictícias:

```bash
npm test
```

Teste visual opcional com Python + Playwright e Chromium (dependências em `../requirements-dev.txt`):

```bash
npm run test:browser
```

Para repetir a compatibilidade com o código original do ZIP:

```bash
npm run test:siga -- /caminho/siga-ccu-main
```

Esse último teste copia somente Worker, constantes e migrations para `.wrangler/`, usa D1/R2 locais e contas sintéticas. Nenhuma chamada ou alteração no SIGA publicado é realizada. Credenciais temporárias e logs ficam ignorados pelo Git.

## Publicação pela CLI (opcional)

Com as variáveis `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` configuradas de forma segura na máquina, execute `npm run configure:cloudflare` para criar/localizar o D1 e configurar o binding. Depois execute `npm run deploy`. O script verifica o destino antes de aplicar migrations e publicar. O código fornecido não contém recursos/IDs reais da conta do SIGA.

Veja os resultados em [VALIDATION.md](VALIDATION.md).

## Validação da configuração automática

`npm test` também executa dez testes do configurador contra respostas simuladas da API Cloudflare: criação, reutilização, conta/ID inválido, serviço SIGA ausente, banco errado ou ambíguo, esquema suspeito/incompleto e negação de permissões. Esses testes não criam recursos reais. A validação da conta e a publicação online exigem os Secrets no GitHub.
