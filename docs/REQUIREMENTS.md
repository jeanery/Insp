# PROMPT MESTRE — DESENVOLVIMENTO DO SIG-UHE
## Sistema Integrado de Gestão de Inspeções, Campanhas e Roteirização de Usinas Hidrelétricas

Você atuará como um **arquiteto de software sênior, engenheiro full-stack, especialista em sistemas GIS, logística, otimização de rotas, gestão de ativos, inspeções territoriais e desenvolvimento de aplicações corporativas open source**.

Sua missão é projetar e implementar o **SIG-UHE**, uma plataforma web e mobile destinada ao gerenciamento de solicitações, ordens de serviço, campanhas de inspeção, monitoramento de bordas de reservatórios, inventário de estruturas e intervenções, etiquetagem, planejamento de equipes e roteirização inteligente.

O projeto deverá aproveitar ao máximo softwares open source existentes, evitando desenvolver novamente funcionalidades que já estejam disponíveis.

**Não se limite a produzir documentação ou protótipos visuais.** O objetivo é construir gradualmente uma aplicação funcional, integrada, testável e preparada para implantação corporativa.

---

# 1. OBJETIVO GERAL

Desenvolver um sistema integrado para gerenciar inspeções e monitoramentos realizados em usinas hidrelétricas e seus reservatórios.

O sistema deverá suportar três modalidades principais de operação:

### Modalidade A — Ordens de Serviço Pontuais

Inspeções solicitadas para locais específicos, com coordenadas conhecidas.

Exemplos:

- Vistoria de rampa de acesso.
- Verificação de píer ou trapiche.
- Inspeção de ocupação irregular.
- Constatação de erosão.
- Verificação de estrutura abandonada.
- Acompanhamento de desmobilização.
- Fiscalização de intervenção georreferenciada.
- Atendimento de denúncia.
- Verificação de cumprimento de condicionantes.

As solicitações deverão gerar ordens de serviço, que poderão ser distribuídas entre equipes com roteirização automática.

### Modalidade B — Campanhas de Monitoramento Territorial

Campanhas periódicas realizadas em determinado reservatório ou setor geográfico, mesmo quando não existem pontos de inspeção previamente cadastrados.

Exemplo:

Campanha de Monitoramento de Bordas — UHE Canoas I — 2027.

O gestor abre uma campanha para o reservatório. As equipes recebem missões de monitoramento, percorrem as margens e cadastram estruturas e intervenções encontradas durante as inspeções.

As campanhas devem permitir identificar novas estruturas, atualizar registros existentes, comparar dimensões, fotografar intervenções, acompanhar possíveis irregularidades e identificar mudanças em relação aos monitoramentos anteriores.

### Modalidade C — Campanhas de Etiquetagem

Campanhas organizadas por reservatório e ciclo para identificação, registro e etiquetagem de estruturas abandonadas.

Exemplo:

Campanha de Etiquetagem — UHE Canoas II — Ciclo 2027.

O inspetor deverá cadastrar ou localizar uma estrutura, registrar evidências, instalar a etiqueta e atualizar o histórico.

As campanhas serão unidades formais de planejamento, execução, acompanhamento e encerramento.

---

# 2. REPOSITÓRIOS E TECNOLOGIAS

Utilizar os seguintes projetos como referências principais:

**Fleetbase — Plataforma principal**

https://github.com/fleetbase/fleetbase

**Fleet-Ops — Gestão operacional, equipes, ordens e despacho**

https://github.com/fleetbase/fleetops

**VROOM — Otimização de rotas**

https://github.com/VROOM-Project/vroom

**OSRM — Cálculo de trajetos e matrizes de deslocamento**

https://github.com/Project-OSRM/osrm-backend

**PostGIS — Banco de dados geoespacial**

https://github.com/postgis/postgis

Outras tecnologias permitidas:

- Laravel.
- Ember.js.
- PostgreSQL.
- MySQL.
- Redis.
- Docker e Docker Compose.
- Leaflet ou MapLibre GL JS, quando justificado.
- OpenStreetMap.
- GDAL/OGR.
- GeoJSON, KML, KMZ, GPX e Shapefile.
- Filas de processamento.
- API REST.
- WebSockets ou mecanismo equivalente para atualizações operacionais.

Antes de iniciar, verificar versões, licenças, dependências, documentação, manutenção dos repositórios e mecanismos de integração existentes.

Não presumir que determinada API, funcionalidade ou biblioteca esteja disponível sem verificar o código-fonte.

A adoção dos componentes está condicionada à avaliação técnica e ao atendimento das respectivas licenças.

---

# 3. PRINCÍPIOS DE ARQUITETURA

Adotar preferencialmente uma arquitetura modular.

O Fleetbase deverá funcionar como plataforma central.

O Fleet-Ops deverá fornecer as funcionalidades operacionais reaproveitáveis.

O SIG-UHE deverá ser desenvolvido como extensão ou conjunto de módulos independentes e integrados, evitando alterações diretas no núcleo do Fleetbase.

Separar responsabilidades em:

1. Núcleo operacional.
2. Gestão de solicitações e ordens de serviço.
3. Gestão de campanhas.
4. Inventário de estruturas e intervenções.
5. Inspeções de campo.
6. Etiquetagem.
7. Motor de roteirização.
8. Plataforma geoespacial.
9. Indicadores e relatórios.
10. Administração e segurança.

Manter, inicialmente, o banco operacional nativo do Fleetbase.

Utilizar PostgreSQL/PostGIS para informações geográficas e consultas espaciais.

Evitar duplicação de entidades já disponíveis no Fleetbase.

Definir estratégias de sincronização, identificadores estáveis, integridade e idempotência entre os serviços.

Nenhuma operação crítica deverá depender de transações distribuídas não controladas entre MySQL e PostgreSQL.

---

# 4. CADASTRO DE USINAS E RESERVATÓRIOS

Desenvolver módulo de cadastro de usinas hidrelétricas.

Campos:

- Código da UHE.
- Nome.
- Empreendimento.
- Reservatório.
- Operador ou organização.
- Município.
- Estado.
- Coordenadas.
- Geometria do reservatório.
- Área operacional.
- Situação cadastral.
- Documentos vinculados.

Permitir que uma UHE possua múltiplas áreas e setores geográficos.

Permitir importar limites por KML, KMZ, GeoJSON e Shapefile.

Exemplos de UHEs para testes fictícios:

- Canoas I.
- Canoas II.
- Capivara.
- Chavantes.
- Jurumirim.
- Jupiá.
- Ilha Solteira.
- Rosana.
- Taquaruçu.

Não utilizar dados internos reais sem autorização.

---

# 5. SOLICITAÇÕES DE INSPEÇÃO

Criar módulo para receber, cadastrar, importar e acompanhar solicitações.

Campos mínimos:

- ID.
- Protocolo.
- UHE.
- Reservatório.
- Município e UF.
- Solicitante.
- Categoria.
- Tipo de inspeção.
- Descrição.
- Prioridade.
- Data de abertura.
- Prazo.
- Tempo estimado de inspeção.
- Latitude e longitude.
- Ponto de acesso.
- Anexos.
- Status.
- Histórico.

Estados sugeridos:

- Aberta.
- Em triagem.
- Aguardando programação.
- Programada.
- Em execução.
- Concluída.
- Cancelada.

Permitir uma solicitação gerar uma ou mais ordens de serviço.

Permitir também que uma OS agrupe atividades relacionadas, preservando a rastreabilidade individual.

Importar solicitações de planilhas XLSX e CSV.

Validar obrigatoriedade, formato de coordenadas, duplicidades e informações inconsistentes.

---

# 6. GESTÃO DE ORDENS DE SERVIÇO

Desenvolver fluxo completo de OS, reutilizando os recursos do Fleet-Ops sempre que possível.

Cada OS deverá possuir:

- Número único.
- Solicitação vinculada.
- UHE e reservatório.
- Localização.
- Tipo de atividade.
- Prioridade.
- Prazo.
- Responsável.
- Equipe designada.
- Rota associada.
- Previsão de execução.
- Data de execução.
- Status.
- Evidências.
- Resultado.
- Histórico.

Permitir:

- Emissão individual.
- Emissão em lote.
- Distribuição manual.
- Distribuição otimizada.
- Reprogramação.
- Transferência entre equipes.
- Cancelamento justificado.
- Encerramento técnico.
- Reabertura autorizada.

Os status das OS deverão ser independentes dos status das solicitações.

O sistema deverá manter histórico auditável de todas as mudanças relevantes.

---

# 7. GESTÃO DE EQUIPES

Cadastrar:

- Inspetores.
- Equipes.
- Responsáveis técnicos.
- Veículos.
- Bases operacionais.
- Disponibilidade.
- Jornadas.
- Habilidades.
- Áreas de atuação.
- Calendário de trabalho.

Cada equipe poderá possuir habilidades necessárias para determinadas inspeções.

Exemplos:

- Inspeção fundiária.
- Inspeção ambiental.
- Engenharia.
- Inspeção náutica.
- Etiquetagem.
- Inspeção com drone.

A distribuição de serviços deverá respeitar disponibilidade, competências e restrições operacionais.

---

# 8. ROTEIRIZAÇÃO INTELIGENTE

Integrar VROOM e OSRM.

O sistema deverá sugerir rotas para conjuntos de solicitações e ordens de serviço.

## 8.1 Planejamento em lote

O gestor poderá selecionar diversas OS pendentes, informar período e equipes disponíveis e solicitar a otimização.

O algoritmo deverá considerar:

- Coordenadas dos pontos de acesso.
- Local inicial de cada equipe.
- Ponto de retorno.
- Tempo de deslocamento.
- Tempo estimado de vistoria.
- Jornada de trabalho.
- Horários disponíveis.
- Pausas.
- Prioridades.
- Prazos.
- Habilidades.
- Restrições de acesso.
- Distribuição entre equipes.
- Distribuição entre dias.

O resultado deverá apresentar:

- Equipes utilizadas.
- OS atribuídas.
- Sequência de execução.
- Horário estimado de chegada.
- Horário estimado de saída.
- Distância.
- Tempo total.
- OS não alocadas.
- Justificativa para não alocação.

O gestor poderá aprovar, rejeitar, ajustar manualmente ou regenerar o planejamento.

## 8.2 Planejamento de múltiplos dias

Desenvolver uma camada de orquestração capaz de considerar vários dias de trabalho.

Não presumir que o VROOM resolva sozinho todas as restrições de planejamento pluridiário.

Implementar as regras adicionais necessárias para calendário de equipes, jornadas, indisponibilidades, atividades fixas e capacidade diária.

## 8.3 Distribuição dinâmica de urgências

Quando uma OS urgente for recebida, o sistema deverá:

1. Identificar equipes elegíveis.
2. Considerar localização conhecida e disponibilidade.
3. Consultar as rotas em andamento.
4. Preservar serviços concluídos e iniciados.
5. Simular diferentes possibilidades de encaixe.
6. Calcular impacto no restante do roteiro.
7. Apresentar alternativas ao gestor.
8. Exigir aprovação para modificar rotas.
9. Atualizar as equipes envolvidas.
10. Registrar as alterações.

Não realizar redistribuições silenciosas que possam comprometer serviços já iniciados.

Caso não exista solução viável, informar claramente as restrições impeditivas.

## 8.4 Acessibilidade geográfica

Diferenciar:

- Localização da ocorrência.
- Ponto de acesso terrestre.
- Ponto de embarque, quando aplicável.
- Local efetivo de inspeção.

Não presumir acesso rodoviário direto a todos os pontos das margens dos reservatórios.

Permitir cadastro de acessos conhecidos e rotas alternativas.

Quando não houver trajeto viário válido, o sistema deverá sinalizar a ocorrência e solicitar tratamento manual, sem inventar trajetos.

---

# 9. GESTÃO DE CAMPANHAS

Desenvolver um módulo próprio denominado Campaign Management.

As campanhas são conjuntos de atividades vinculadas a determinado objetivo, período e abrangência territorial.

Cada campanha deverá possuir:

- ID.
- Código único.
- Nome.
- Tipo.
- UHE.
- Reservatório.
- Setores de abrangência.
- Data inicial.
- Data final.
- Periodicidade.
- Responsável.
- Equipes.
- Objetivos.
- Instruções.
- Formulário de inspeção.
- Indicadores.
- Status.

Estados sugeridos:

- Rascunho.
- Planejada.
- Aberta.
- Em execução.
- Suspensa.
- Em validação.
- Concluída.
- Encerrada.

Permitir campanhas periódicas, anuais, semestrais e extraordinárias.

Uma campanha deverá permitir múltiplas missões, inspeções, inspetores e equipes.

Uma mesma estrutura poderá ser inspecionada em diversas campanhas.

---

# 10. MONITORAMENTO DE BORDAS

Implementar uma modalidade de campanha que não exija pontos de inspeção previamente cadastrados.

Exemplo:

Monitoramento de Bordas — UHE Canoas I — Ciclo 2027.

O gestor define o reservatório ou os setores a serem monitorados.

Os inspetores executam as missões e registram as estruturas e intervenções identificadas.

## 10.1 Tipos de registros

Permitir:

- Nova estrutura.
- Estrutura existente.
- Alteração de estrutura.
- Ampliação de intervenção.
- Redução de intervenção.
- Estrutura removida.
- Estrutura não localizada.
- Indícios de ocupação irregular.
- Estrutura abandonada.
- Alteração de uso.
- Outras ocorrências.

## 10.2 Tipos de estruturas

Manter um catálogo configurável com exemplos:

- Rampa de acesso.
- Píer.
- Trapiche.
- Passarela.
- Flutuante.
- Edificação.
- Muro.
- Cerca.
- Alambrado.
- Área impermeabilizada.
- Acesso permeável.
- Captação de água.
- Tubulação.
- Drenagem.
- Plataforma.
- Estrutura náutica.
- Outras intervenções.

Permitir criação de novos tipos por usuários autorizados.

## 10.3 Dados de campo

Cada registro deverá contemplar:

- UHE.
- Reservatório.
- Campanha.
- Setor.
- Coordenadas.
- Inspetor.
- Data e hora.
- Tipo de estrutura.
- Dimensões.
- Material.
- Uso observado.
- Estado de conservação.
- Fotografias.
- Observações.
- Situação identificada.
- Necessidade de acompanhamento.
- Identificador da estrutura, quando existente.

Permitir cadastro de pontos, linhas e polígonos.

As dimensões deverão possuir unidades de medida e indicação da metodologia utilizada.

---

# 11. INVENTÁRIO PERMANENTE DE ESTRUTURAS

Desenvolver um cadastro georreferenciado permanente de estruturas e intervenções.

Cada estrutura deverá possuir um identificador estável.

Exemplo fictício:

CN1-EST-000128.

A estrutura não deverá ser duplicada a cada campanha.

Uma estrutura pode participar de muitas inspeções e campanhas.

O sistema deverá manter:

- Cadastro principal.
- Localização.
- Geometria atual.
- Tipo.
- Histórico de dimensões.
- Histórico de observações.
- Histórico fotográfico.
- Histórico de regularidade.
- Histórico de inspeções.
- Histórico de etiquetagem.
- Vínculos a processos.
- Estado atual.

## 11.1 Controle de duplicidades

Ao cadastrar uma estrutura, verificar se existem registros próximos.

Apresentar ao inspetor possíveis correspondências com distância e características.

Permitir:

- Vincular a estrutura existente.
- Criar nova estrutura.
- Sinalizar possível duplicidade.
- Encaminhar para validação.

Não mesclar estruturas automaticamente sem confirmação.

## 11.2 Classificação de regularidade

Separar situação observada em campo de situação documental/jurídica.

Exemplos:

**Situação observada**
- Em uso.
- Aparentemente abandonada.
- Danificada.
- Em ampliação.
- Desmobilizada.

**Situação administrativa**
- Regular.
- Irregular.
- Em análise.
- Em processo de regularização.
- Não determinada.

A situação administrativa deverá depender de validação por usuário autorizado.

O inspetor poderá registrar indícios, mas não definir automaticamente uma irregularidade jurídica.

---

# 12. COMPARAÇÃO TEMPORAL DE INTERVENÇÕES

Implementar comparação entre inspeções e campanhas.

O sistema deverá permitir visualizar:

- Primeira identificação.
- Última inspeção.
- Novas fotografias.
- Alteração dimensional.
- Ampliação de área.
- Alteração de comprimento.
- Alteração de quantidade.
- Mudança de uso.
- Alteração de regularidade.
- Remoção comprovada.
- Pendências.

Exemplo fictício:

Estrutura CN1-EST-000128

2026: rampa com 40 m².

2027: rampa com 60 m².

Resultado: aumento de 20 m², equivalente a 50%.

As comparações deverão informar diferenças de metodologia de medição e eventuais incertezas.

A ausência de uma estrutura em uma campanha não deverá ser tratada automaticamente como desmobilização.

Distinguir:

- Não vistoriada.
- Não localizada.
- Remoção informada.
- Remoção verificada.
- Remoção comprovada.

Toda alteração deverá preservar o histórico anterior.

---

# 13. ETIQUETAGEM DE ESTRUTURAS ABANDONADAS

Implementar campanhas de etiquetagem por reservatório e ciclo.

Cada estrutura etiquetada deverá possuir identificador próprio.

Exemplo fictício:

CN1-ETQ-000218.

Permitir gerar QR Code vinculado ao cadastro.

Campos:

- Campanha.
- UHE.
- Reservatório.
- Estrutura.
- Código da etiqueta.
- Data da instalação.
- Responsável.
- Coordenadas.
- Fotografia da estrutura.
- Fotografia da etiqueta.
- Estado de conservação.
- Observações.

Status possíveis:

- Etiquetagem pendente.
- Etiqueta instalada.
- Etiqueta mantida.
- Etiqueta substituída.
- Etiqueta danificada.
- Etiqueta removida.
- Estrutura não localizada.

O QR Code não deverá expor informações pessoais, jurídicas ou internas sensíveis sem autenticação adequada.

Permitir reinspeções em campanhas posteriores.

---

# 14. SETORIZAÇÃO DOS RESERVATÓRIOS

Implementar a divisão das margens dos reservatórios em setores operacionais.

Cada setor deverá possuir:

- Identificador.
- UHE.
- Reservatório.
- Nome.
- Geometria.
- Extensão.
- Acessos.
- Equipe responsável.
- Histórico.
- Último monitoramento.
- Situação de cobertura.

Permitir importar setores existentes ou criá-los por ferramentas GIS.

Permitir gerar sugestões de divisão por trechos, mantendo revisão humana.

O sistema deverá informar:

- Setores programados.
- Setores em andamento.
- Setores concluídos.
- Setores pendentes.
- Setores não acessíveis.
- Setores parcialmente inspecionados.

Diferenciar conclusão administrativa da missão e cobertura territorial efetivamente verificada.

---

# 15. MISSÕES DE CAMPO

As campanhas deverão ser executadas por meio de missões atribuídas aos inspetores.

Uma missão poderá conter:

- Campanha.
- Setor.
- Equipe.
- Inspetores.
- Data programada.
- Objetivo.
- Instruções.
- Acessos conhecidos.
- Atividades previstas.
- Checklist.
- Status.

Permitir que uma missão seja realizada sem estruturas previamente cadastradas.

Durante a missão, o inspetor poderá descobrir e cadastrar novas intervenções.

Uma missão poderá gerar novas ordens pontuais de acompanhamento.

---

# 16. APLICATIVO DE CAMPO

Desenvolver ou integrar aplicativo mobile compatível com o ecossistema adotado.

Priorizar:

- Android.
- Operação offline.
- GPS.
- Captura de fotografias.
- Cadastro de estruturas.
- Consulta ao histórico.
- Execução de OS.
- Execução de missões.
- Formulários configuráveis.
- Leitura de QR Code.
- Registro de etiqueta.
- Sincronização posterior.

O inspetor deverá poder receber uma missão, acessar mapas e dados previamente sincronizados, registrar informações e transmitir os resultados quando houver conexão.

A operação offline deverá incluir tratamento de conflitos e registros duplicados.

Não sobrescrever automaticamente alterações conflitantes feitas por outros inspetores.

Implementar fila de sincronização com status visível e possibilidade de reenvio.

Não afirmar que o Fleetbase já oferece todos esses recursos offline sem verificar.

---

# 17. SISTEMA GIS E CARTOGRAFIA

Utilizar PostGIS para geometria e análises espaciais.

A interface cartográfica deverá suportar:

- OpenStreetMap.
- Mapas de satélite mediante serviço autorizado.
- Camadas vetoriais.
- Pontos de inspeção.
- Estruturas.
- Setores.
- Limites de reservatórios.
- Rotas.
- Trilhas de monitoramento.
- Etiquetas.
- Ordens de serviço.

Permitir:

- Pesquisar por coordenadas.
- Selecionar estruturas no mapa.
- Medir distâncias.
- Medir áreas.
- Importar arquivos.
- Exportar dados.
- Filtrar por UHE.
- Filtrar por campanha.
- Filtrar por status.
- Consultar histórico geográfico.

Utilizar EPSG:4326 para intercâmbio de coordenadas e sistemas projetados adequados para medições métricas.

Suportar importação com identificação e transformação explícita de sistemas de referência, incluindo SIRGAS 2000.

Não usar latitude e longitude diretamente para calcular áreas planas em metros quadrados.

---

# 18. INDICADORES E DASHBOARDS

Desenvolver dashboards para gestores e equipes.

## Ordens de Serviço

- OS abertas.
- OS programadas.
- OS concluídas.
- OS atrasadas.
- Tempo médio de atendimento.
- Produtividade por equipe.
- Distância percorrida.
- Eficiência de roteirização.

## Campanhas

- Campanhas abertas.
- Campanhas concluídas.
- Missões programadas.
- Missões executadas.
- Setores monitorados.
- Cobertura territorial verificada.
- Pendências.
- Inspeções realizadas.

## Estruturas

- Estruturas cadastradas.
- Novas estruturas identificadas.
- Estruturas reinspecionadas.
- Intervenções ampliadas.
- Intervenções removidas.
- Estruturas com situação administrativa regular, irregular ou indeterminada.
- Estruturas etiquetadas.
- Etiquetas pendentes.
- Alterações entre ciclos.

Permitir filtros por UHE, reservatório, período, equipe, município e campanha.

---

# 19. RELATÓRIOS

Implementar geração de relatórios em PDF e exportações tabulares.

Relatórios necessários:

1. Ordem de serviço.
2. Relatório individual de inspeção.
3. Relatório de campanha.
4. Relatório de monitoramento de bordas.
5. Relatório de etiquetagem.
6. Histórico individual de estrutura.
7. Comparativo entre campanhas.
8. Relatório de produtividade.
9. Mapa de ocorrências.
10. Relatório de pendências.

Os relatórios técnicos deverão apresentar, quando aplicável:

- Identificação.
- Objetivo.
- Localização.
- Data.
- Responsáveis.
- Metodologia.
- Estruturas identificadas.
- Coordenadas.
- Fotografias.
- Descrição.
- Resultados.
- Conclusões.
- Mapa.
- Anexos.

Manter referência aos registros originais e às respectivas versões.

---

# 20. PERFIS E PERMISSÕES

Implementar controle de acesso por função, organização e abrangência operacional.

Perfis iniciais:

**Administrador**
- Configurações gerais.
- Usuários.
- Permissões.
- Integrações.

**Gestor**
- Campanhas.
- OS.
- Equipes.
- Planejamento.
- Aprovação.
- Relatórios.

**Planejador**
- Programação.
- Rotas.
- Atribuições.
- Reprogramações autorizadas.

**Inspetor**
- Missões atribuídas.
- OS atribuídas.
- Registros de campo.
- Fotografias.
- Etiquetagem.

**Validador técnico**
- Revisão de inspeções.
- Validação de classificações.
- Aprovação de registros.

**Consulta**
- Visualização autorizada.
- Relatórios permitidos.

Aplicar princípio do menor privilégio.

Implementar auditoria de alterações relevantes.

---

# 21. SEGURANÇA E CONFORMIDADE

Considerar:

- LGPD.
- Autenticação segura.
- Controle de sessão.
- Autorização em APIs.
- Segregação por organização e UHE.
- Proteção de anexos.
- Validação de uploads.
- Proteção contra injeções.
- Rate limiting.
- Auditoria.
- Backup.
- Recuperação de falhas.
- Gestão segura de segredos.
- Atualização de dependências.
- Política de retenção de dados.
- Rastreabilidade de evidências.

Não expor dados internos em mapas públicos.

Não incorporar chaves de APIs no frontend sem justificativa e proteção adequada.

Verificar obrigações AGPL e demais licenças antes de orientar implantação corporativa.

---

# 22. MODELO DE DADOS

Projetar as entidades necessárias, contemplando:

- HydropowerPlant
- Reservoir
- ReservoirSector
- InspectionRequest
- ServiceOrder
- InspectionTeam
- TeamAvailability
- Campaign
- CampaignAssignment
- CampaignSector
- FieldMission
- Inspection
- Structure
- StructureObservation
- StructureGeometryVersion
- StructureTag
- InspectionEvidence
- SurveyTrack
- CampaignCoverage
- RoutePlan
- RoutePlanVersion
- RouteStop
- RouteAssignment
- UrgentDispatchEvent
- AuditEvent

Os nomes são conceituais.

Antes de criar tabelas, identificar equivalentes existentes no Fleetbase e Fleet-Ops.

Definir relacionamentos, cardinalidades, índices, chaves estrangeiras, exclusões lógicas, políticas de versionamento e regras de consistência.

Criar migrations reversíveis e dados sintéticos de demonstração.

---

# 23. INTERFACE WEB

Criar menu principal SIG-UHE com:

**Centro de Operações**
- Dashboard.
- Solicitações.
- Ordens de serviço.
- Planejador de rotas.
- Equipes.

**Campanhas**
- Todas as campanhas.
- Nova campanha.
- Missões.
- Calendário.
- Acompanhamento.
- Encerramento.

**Monitoramento**
- Inventário de estruturas.
- Mapa de intervenções.
- Histórico.
- Comparação temporal.
- Cobertura territorial.

**Etiquetagem**
- Campanhas.
- Etiquetas.
- Estruturas etiquetadas.
- Pendências.

**Gestão**
- UHEs.
- Reservatórios.
- Setores.
- Usuários.
- Configurações.

**Resultados**
- Indicadores.
- Relatórios.
- Exportações.

Preservar a identidade visual geral do Fleetbase, com interface limpa, responsiva, consistente e apropriada para uso corporativo.

Não substituir componentes nativos sem necessidade.

---

# 24. MOTOR DE PLANEJAMENTO TERRITORIAL

Diferenciar dois problemas:

**Roteirização por pontos:** visitar OS com localizações conhecidas.

**Cobertura territorial:** percorrer setores das margens de um reservatório para descobrir ocorrências.

O VROOM deve ser utilizado prioritariamente para roteirização por pontos.

A cobertura territorial deverá possuir lógica específica, considerando geometrias de setores, percursos, acessos, trechos não vistoriados e condições operacionais.

Não converter automaticamente todo o perímetro do reservatório em uma sequência arbitrária de pontos de entrega.

Registrar trilhas GPS quando permitido.

Permitir verificar cobertura de trechos com base em evidências e parâmetros configuráveis de distância e visibilidade.

Não considerar um trecho efetivamente inspecionado apenas porque uma equipe passou por uma via próxima.

---

# 25. TESTES E HOMOLOGAÇÃO

Construir testes automatizados.

Cenários obrigatórios:

1. Cadastrar 100 solicitações fictícias.
2. Criar OS em lote.
3. Distribuir OS entre três equipes.
4. Calcular rotas para vários dias.
5. Inserir OS urgente.
6. Preservar visitas concluídas.
7. Registrar solicitação sem acesso rodoviário.
8. Criar campanha para Canoas I.
9. Criar missão sem pontos predefinidos.
10. Cadastrar nova rampa durante a campanha.
11. Reinspecionar a mesma rampa.
12. Registrar ampliação dimensional.
13. Sinalizar possível duplicidade.
14. Registrar estrutura abandonada.
15. Instalar etiqueta.
16. Reinspecionar etiqueta em ciclo posterior.
17. Encerrar campanha.
18. Gerar relatório consolidado.
19. Simular perda de conexão durante inspeção.
20. Sincronizar registros após recuperação de conexão.

Verificar integridade de dados, rastreabilidade, permissões, desempenho e usabilidade.

---

# 26. AMBIENTE DE DESENVOLVIMENTO

Priorizar desenvolvimento reproduzível utilizando Docker.

Estrutura lógica sugerida:

```text
sig-uhe/
├── fleetbase/
├── fleetops/
├── extensions/
│   └── sig-uhe/
├── services/
│   ├── route-planner/
│   └── geospatial/
├── infrastructure/
│   ├── docker/
│   ├── osrm/
│   └── postgis/
├── tests/
├── docs/
└── README.md
```

Adequar a estrutura ao mecanismo real de extensões do Fleetbase.

Configurar:

- Desenvolvimento.
- Testes.
- Variáveis de ambiente.
- Bancos de dados.
- Redis.
- OSRM.
- VROOM.
- PostGIS.
- Serviços internos.
- Volumes persistentes.
- Health checks.
- Logs.

Não utilizar dados reais ou credenciais de produção.

---

# 27. FASES DE IMPLEMENTAÇÃO

## Fase 0 — Auditoria técnica

Inspecionar repositórios, arquitetura, licenças, dependências e integração.

Entregáveis:

- ARCHITECTURE.md
- REUSE_MATRIX.md
- DATA_MODEL.md
- IMPLEMENTATION_PLAN.md
- RISK_REGISTER.md

## Fase 1 — Núcleo operacional

Instalar o Fleetbase e integrar o Fleet-Ops.

Implementar cadastro de UHEs, reservatórios, equipes, solicitações e OS.

## Fase 2 — Roteirização

Implantar OSRM e VROOM.

Implementar planejamento em lote, mapas e aprovação dos roteiros.

## Fase 3 — Urgências

Implementar redistribuição dinâmica, simulações de encaixe e versionamento das rotas.

## Fase 4 — Campanhas

Implementar criação, atribuição, acompanhamento e encerramento de campanhas e missões.

## Fase 5 — Inventário geográfico

Implementar cadastro permanente de estruturas, fotografias, geometrias e histórico de inspeção.

## Fase 6 — Etiquetagem

Implementar ciclos de etiquetagem, QR Code e acompanhamento.

## Fase 7 — Campo e offline

Implementar ou integrar aplicação de campo, sincronização offline e resolução de conflitos.

## Fase 8 — Indicadores e relatórios

Desenvolver dashboards, relatórios e comparações temporais.

## Fase 9 — Homologação

Executar testes integrados, corrigir problemas, revisar segurança e preparar documentação de implantação.

---

# 28. REGRAS PARA EXECUÇÃO PELO CODEX

Você deverá trabalhar de maneira incremental e organizada.

1. Inspecione antes de modificar.
2. Reutilize funcionalidades existentes.
3. Priorize código modular.
4. Evite alterações desnecessárias no núcleo.
5. Registre decisões arquiteturais.
6. Crie commits pequenos e descritivos.
7. Execute testes após alterações relevantes.
8. Não declare uma funcionalidade pronta sem verificar sua execução.
9. Informe limitações e riscos.
10. Documente configurações e integrações.
11. Não modifique dados de produção.
12. Não utilize APIs pagas sem configuração e autorização.
13. Não armazene segredos no repositório.
14. Não instale dependências desnecessárias.
15. Não implemente IA generativa antes das funcionalidades essenciais.

Ferramentas ou plugins de desenvolvimento poderão ser utilizados quando disponíveis, desde que sejam compatíveis e não introduzam riscos ou dependências sem justificativa.

Em cada fase, apresentar:

- Objetivo executado.
- Arquivos criados ou modificados.
- Funcionalidades implementadas.
- Testes realizados.
- Resultados obtidos.
- Problemas encontrados.
- Riscos conhecidos.
- Próximos passos.

Continuar autonomamente nas tarefas de baixo risco e reversíveis, respeitando os limites do ambiente.

Antes de mudanças destrutivas, operações em produção, alterações de licenciamento ou decisões arquiteturais de alto impacto, solicitar aprovação.

---

# 29. DEFINIÇÃO DE MVP

A primeira versão funcional deverá permitir:

1. Iniciar a plataforma via Docker.
2. Cadastrar uma UHE e seu reservatório.
3. Cadastrar e importar solicitações com coordenadas.
4. Emitir OS.
5. Cadastrar equipes.
6. Planejar e aprovar rotas.
7. Simular inclusão de urgências.
8. Criar campanha de monitoramento de bordas.
9. Atribuir missão a inspetor.
10. Registrar nova estrutura georreferenciada.
11. Anexar fotografias.
12. Reinspecionar uma estrutura cadastrada.
13. Comparar registros de períodos diferentes.
14. Criar campanha de etiquetagem.
15. Registrar etiqueta instalada.
16. Exibir informações em mapa.
17. Gerar relatórios básicos.

A operação offline completa e os indicadores avançados poderão ser implementados em fases posteriores, desde que as interfaces de dados sejam preparadas para essa evolução.

---

# 30. PRIMEIRA EXECUÇÃO

Inicie agora pela auditoria dos repositórios Fleetbase e Fleet-Ops.

Identifique:

- Arquitetura existente.
- Tecnologia de frontend e backend.
- Serviços disponíveis.
- Modelos reutilizáveis.
- Sistema de extensões.
- Recursos de ordens.
- Recursos de rotas.
- Recursos de mapas.
- Autenticação.
- Permissões.
- APIs.
- Integração com VROOM e OSRM.
- Bancos utilizados.
- Compatibilidade com Docker.

Depois prepare o projeto SIG-UHE e implemente a primeira fase funcional, evitando refazer funcionalidades existentes.

Não produza somente uma proposta textual: quando o ambiente e as permissões permitirem, execute a instalação, crie os arquivos necessários, programe os módulos iniciais e valide o funcionamento.

**Resultado esperado: uma plataforma SIG-UHE modular e extensível, capaz de evoluir de gestão de OS e roteirização para monitoramento contínuo das bordas, campanhas territoriais, inventário histórico de intervenções e etiquetagem de estruturas abandonadas.**