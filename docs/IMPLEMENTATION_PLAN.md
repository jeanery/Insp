# Plano incremental e critérios de aceite

1. **Fase 0 — auditoria:** documentos de arquitetura, reaproveitamento, modelo, plano e riscos; fontes fixadas. Concluída para a seleção inicial, com análises aprofundadas de GIS/mobile reservadas às suas fases.
2. **Fase 1 — incremento API:** runtime Docker menor com MySQL, Redis e worker, Laravel/Fleet-Ops reais, cadastros básicos de UHE/reservatório/solicitação, CSV, ordens nativas e auditoria. Testar isolamento, permissões, 100 solicitações e ordens, idempotência, acesso ausente e rollback. Esta é uma entrega parcial da fase 1: faltam interface Ember SIG-UHE, gestão de disponibilidade/habilidades, fluxo completo de OS e campos corporativos adicionais.
3. **Concluir fase 1:** registrar Ember Engine conforme mecanismo verificado; telas usando componentes Fleetbase; permissões por UHE, perfis, formulário completo e política de estados; onboarding de organização pela interface nativa; validação browser e e2e.
4. **Fase 2:** recorte OSM autorizado, imagens estáveis OSRM/VROOM com digest, PostGIS e Redis; testes reais de matriz sem acesso, skills, jornadas, não alocação, aprovação e orquestração de dias. Duração em metadados deve ser traduzida explicitamente para o solver.
5. **Fase 3:** versão de rota, urgência como proposta, preservar iniciados/concluídos, aprovação e evento auditável.
6. **Fases 4–6:** campanhas/missões sem pontos predefinidos, inventário permanente com revisão de possíveis duplicatas, comparação histórica e etiquetagem autenticada.
7. **Fases 7–8:** offline com outbox de dispositivo e conflitos visíveis; PDFs/exportações e indicadores com denominador de cobertura verificável.
8. **Fase 9:** matriz dos 20 cenários solicitados, carga, recuperação, segurança, acessibilidade e licença. Produção depende dessa homologação.

Nenhuma fase posterior é considerada pronta por existir uma interface, manifesto ou adaptador. Os testes nesta entrega não validam distribuição entre equipes, rotas, urgências, campanhas, GIS ou offline. O prompt original está preservado em `docs/REQUIREMENTS.md`.
