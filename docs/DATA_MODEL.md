# Modelo de dados

## Implementado

- `uhe_plants`: UUID, organização nativa, código único por organização, nome, UF e timestamps.
- `uhe_reservoirs`: UUID, organização, UHE e nome único por UHE. Relação UHE 1:N reservatórios.
- `uhe_requests`: UUID, organização, reservatório, protocolo único por organização, descrição, categoria, prioridade, estado independente, localização da ocorrência, acesso opcional, duração em segundos e prazo UTC.
- `uhe_request_orders`: vínculo N:M entre solicitação e `orders` nativas; UUID, organização, chave de idempotência e hash normalizado da operação. A emissão atual cria uma ordem por operação; múltiplas emissões com chaves distintas são permitidas. Agrupamento de várias solicitações numa OS é evolução futura.
- `uhe_audit_events`: UUID, organização, ator, ação, objeto, detalhes e instante. Escrita é transacional e a API só oferece consulta. Não é armazenamento imutável contra administradores do banco.

Chaves estrangeiras impedem remoção física de pais com filhos; não há exclusão na API inicial. Entidades operacionais nativas preservam seus mecanismos de UUID, public_id, soft delete e auditoria. Não se acessa banco de outra organização via IDs recebidos no corpo. A atribuição de `company_uuid` é sempre feita pelo servidor. Escopo de UHE por usuário ainda exige tabela de concessões e autorização própria; não é atendido apenas pelo isolamento de organizações.

Emissão de ordens serializa brevemente o registro da organização para coordenar chaves concorrentes e tranca a solicitação. A mesma chave e o mesmo conteúdo retornam o vínculo existente; conteúdo diferente retorna 409. A importação CSV e emissão em lote são atômicas. Limite de 100 itens por lote. A emissão não promove o estado da solicitação nem despacha a ordem.

## Planejado, ainda sem migrations

Campaign 1:N FieldMission; Campaign N:M ReservoirSector; Structure 1:N Inspection/StructureObservation; Structure 1:N StructureGeometryVersion e StructureTag; Campaign 1:N CampaignCoverage; RoutePlan 1:N RoutePlanVersion 1:N RouteStop; urgência gera UrgentDispatchEvent com versão anterior e proposta sujeita a aprovação.

Structure tem UUID permanente. Inspeções, fotos e etiquetas pertencem a um registro histórico e não substituem o cadastro a cada ciclo. Situação observada e situação administrativa são campos separados com permissões distintas. Medidas terão valor, unidade, método e incerteza. Ausência de observação não implica remoção. Geometrias EPSG:4326 para intercâmbio; cálculos métricos geodésicos ou em projeção adequada. Extensões PostGIS não serão simuladas com latitude/longitude em área plana.

Outbox terá event_id único, aggregate_id, versão, organização, payload e tentativas. Inbox espacial terá unicidade de event_id e versão esperada; aplicação fora de ordem deve ser rejeitada/reenfileirada. Evidências serão privadas e referenciadas por checksum e versão, com retenção definida pelo operador. O desenho não equivale à implementação dessas entidades.
