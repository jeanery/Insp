# Matriz de reaproveitamento

| Necessidade | Evidência no Fleet-Ops/Core | Decisão e estado |
|---|---|---|
| Organização, usuário, autenticação | Core `Models/Company.php`, `Models/User.php`, middleware Sanctum | Reutilizados; sem cadastro paralelo de identidade |
| Permissões | Core `HasPolicies`, `AuthorizationGuard`, Spatie | Reutilizados com autorização explícita da extensão; granularidade por UHE pendente |
| Equipes | `Models/Fleet.php`, `FleetDriver.php`, `FleetVehicle.php` | Reutilizar; fixture cria três fleets nativas; calendário e habilidades de equipe pendentes |
| Inspetor e veículo | `Models/Driver.php`, `Vehicle.php` | Reutilizar; adequação do perfil inspetor pendente |
| OS roteirizável | `Models/Order.php`, `OrderConfig.php`, `Payload.php`, `Place.php` | Reutilizados pelo adaptador; estado próprio da solicitação preservado |
| OS de manutenção | `Models/WorkOrder.php` | Existe; não confundir automaticamente com Order roteirizável. Objeto de manutenção não adotado como duplicata de inspeção |
| Formulários e inspeção | Rotas de `PublicInspectionController`, modelos nativos de inspeção | Avaliar reutilização de formulário/evidência antes da fase de campo; links públicos não adotados |
| VROOM | `Orchestration/Engines/VroomOrchestrationEngine.php` | Adaptador existe; validação com solver e restrições SIG-UHE pendente |
| OSRM | `Tracking/Providers/OsrmTrackingProvider.php`, config `fleetops.osrm` | Adaptador existe; acesso terrestre e sem-rota precisam ser homologados |
| Mapas | dependências Leaflet, leaflet-draw e routing-machine em `package.json` | Reaproveitar interface nativa; mapa SIG-UHE ainda não criado |
| Relatórios | dompdf no Composer e `Support/LabelPdf.php` | Reutilizar infraestrutura, sem confundir etiqueta logística com relatório técnico |
| UHE e reservatório | Não identificados como entidades específicas na auditoria | Novas tabelas prefixadas `uhe_` |
| Campanhas e inventário permanente | Sem equivalentes completos comprovados | Módulos futuros; avaliar Asset e Inspection por responsabilidade |
| Offline | Sem comprovação de todos os requisitos no código auditado | Não declarado disponível; fase própria com conflitos explícitos |

## Licenças e manutenção

Fleetbase/Core/Fleet-Ops declaram AGPL-3.0-or-later. Os commits consultados datam de 19/10/2026; atividade recente é evidência de manutenção, não uma garantia de suporte. Obrigações de código correspondente e disponibilização a usuários de versão modificada pela rede devem ser avaliadas antes da implantação corporativa. Nenhum relicenciamento foi feito neste incremento.

Fontes adicionais consultadas por SHA:

| Componente | SHA auditado | Licença observada | Decisão |
|---|---|---|---|
| VROOM | `07be776fc20b8d6c85d9f78797e38a9f4e44ec44` | BSD de duas cláusulas, arquivo LICENSE | Solver previsto para fase 2; não instalado |
| OSRM | `f2147ead8d9c6a2c724120113d9c56ab85963262` | BSD de duas cláusulas, LICENSE.TXT | C++20/CMake; datasets OSM e perfil precisam de versão e recorte próprios |
| PostGIS | `29bca0936d30f4e026dd4fe67e447c381c65be1a` | GPL v2, arquivo COPYING | Versão de desenvolvimento observada 3.7.0dev; não usar automaticamente em produção |

Os arquivos consultados estão em `.runtime/audit`. Essas referências de desenvolvimento não são versões de implantação escolhidas. Dependências nativas e imagens estáveis desses três componentes serão fechadas e testadas na fase correspondente; não há alegação de compatibilidade operacional já validada.
