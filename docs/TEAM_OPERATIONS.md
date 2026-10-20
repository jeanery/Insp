# Perfil operacional das equipes

O cadastro de equipe continua sendo o `Fleet` nativo do Fleet-Ops. O perfil SIG-UHE é uma extensão 1:1, em `uhe_team_profiles`; não substitui inspetores, veículos, áreas de serviço ou o status nativo da frota.

Na aba **Equipes**, abra **Perfil operacional** para informar:

- Disponibilidade para planejamento: disponível ou indisponível. Uma equipe sem perfil aparece como não configurada, sem disponibilidade presumida.
- Base operacional em latitude/longitude WGS84 e fuso IANA, como `America/Sao_Paulo`.
- Habilidades: inspeção fundiária, ambiental, engenharia, náutica, etiquetagem e drone.
- Intervalos semanais por dia ISO (1 = segunda, 7 = domingo), em horário local, incluindo múltiplos intervalos para pausas.
- Capacidade diária em minutos, limitada à soma de intervalos de cada dia cadastrado.
- Motivo obrigatório da alteração, preservado com versões anterior e posterior no histórico.

Intervalos sobrepostos, fim anterior ao início, coordenadas inválidas e fuso inexistente são rejeitados. Uma equipe disponível exige ao menos um intervalo. As horas seguem precisão de minutos e intervalos dentro do mesmo dia; turnos contínuos atravessando meia-noite ainda exigem evolução do modelo. Feriados, férias, ausências por data, capacidade diferenciada por dia, área de atuação, escala de inspetores e disponibilidade de veículos permanecem pendentes.

## API e concorrência

`GET /sig-uhe/v1/teams/{uuid}/profile` retorna `{ "profile": null }` para uma equipe própria ainda não configurada. O catálogo de equipes inclui `operational_profile` para cada equipe, consultado em lote.

`PATCH /sig-uhe/v1/teams/{uuid}/profile` recebe todos os campos do perfil, `reason` e `version` (zero no primeiro cadastro). A versão sobe a cada alteração. Um editor com versão antiga recebe HTTP 409 e deve recarregar antes de salvar; o formulário preserva os valores digitados em caso de erro. A transação bloqueia a equipe nativa inclusive na criação do primeiro perfil, evitando perda de atualização concorrente. O histórico é gravado na mesma transação.

O servidor obtém a organização da sessão. Perfis de outra organização retornam 404, usuários de consulta recebem 403 ao tentar escrever e os controles de edição ficam desabilitados na interface.

## Limite operacional

Disponibilidade e habilidades são dados cadastrais. Ainda não existe alocação automática, cálculo de elegibilidade por instante, OSRM/VROOM nem despacho que aplique essas restrições. Salvar um perfil não programa ordens ou muda o estado delas. A integração dessas restrições com planejamento e solver será validada em etapa própria.

Capturas reais com dados sintéticos: [perfil da equipe](screenshots/sig-uhe-equipe.png) e [celular](screenshots/sig-uhe-equipe-mobile.png).
