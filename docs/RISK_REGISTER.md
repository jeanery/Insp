# Registro de riscos

| Risco | Evidência/impacto | Tratamento |
|---|---|---|
| Imagem oficial muito grande | Extração de `fleetbase/fleetbase-api:latest` falhou sem espaço no driver vfs | Runtime PHP 8.2 menor; dependências via lockfile, sem desligar TLS/checksums |
| Laravel 10 e PHP 8.2 | Base antiga; lock contém `laravel/framework` 10.x-dev com SHA | Não atualizar silenciosamente; revisar suporte e vulnerabilidades antes de produção |
| AGPL e integração corporativa | Fleetbase/Fleet-Ops AGPL-3.0-or-later | Revisão de obrigações, código correspondente e forma de disponibilização antes de implantação; licença própria ainda não definida |
| Escopo de UHE | Autorização inicial por organização e read/write | Implementar concessões por UHE e perfis antes de usuários com acessos territoriais diferentes |
| Runtime de desenvolvimento | Servidor PHP embutido, credencial local de banco, sem SocketCluster/scheduler de produção | Restrito ao loopback; substituir por implantação endurecida homologada |
| Metadados não equivalem a restrições | `service_seconds` preservado mas sem tradução para otimizador | Não alegar duração respeitada em rotas; implementar/testar na fase 2 |
| OS transport | Reutilização de Order/Payload evita duplicação, mas sem fluxo específico de inspeção | Configurar e homologar status e eventos de inspeção antes do campo |
| Índices Redis inválidos no upstream | Predis rejeitou SELECT de nomes como cache/0_cache | Override de configuração no wrapper; índices inteiros separados, núcleo preservado |
| Contrato VROOM | Adaptador nativo espera `/solve` | Verificar endpoint do deployment escolhido e respostas de erro; sem fallback inventado |
| Acesso territorial | Ocorrência pode não ter via rodoviária | Emissão exige acesso explícito; validação OSRM e modo náutico continuam pendentes |
| Two databases | Não há transação única MySQL/PostGIS | Outbox/inbox e reconciliação antes de sincronização espacial |
| Evidência e dados pessoais | Anexos/QR futuros podem expor informações | Autenticação, armazenamento privado, validação de uploads e política LGPD antes de habilitar |
| Duplicidade offline | Não implementada | UUID de operação, versão e fila com resolução humana de conflitos |
| Snapshot em nova tarefa | Docker volumes/processos não devem ser presumidos restaurados | Scripts recriam serviços; confirmar restauração após publicação na plataforma |

Não há dados reais, APIs pagas ou credenciais de produção nesta entrega.
