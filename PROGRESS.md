# BarberFlow — Progresso

## Referência

- 24/11/2026. `main`, revisão local `78c5b74`, mais alterações locais de Agenda, recebimentos e fluxo solo preservadas na cópia de trabalho.
- A linha de base tem agenda diária autenticada, catálogo, turnos, fechamento e registro de recebimento. A reserva pública, o histórico do cliente e as visões de período são lacunas.
- Rubrica de 100 pontos do documento da Fase 2. Critérios parciais recebem zero.

| Critério | Base | Final | Evidência ou pendência |
| --- | ---: | ---: | --- |
| Fundação, landing e navegação (10) | 10 | 10 | Build, testes HTTP e verificações de largura. |
| Autenticação, recuperação, sessão e onboarding (10) | 0 | 0 | Fluxos disponíveis, cobertos por simulação HTTP. Falta verificar e-mail e sessão no Supabase completo. |
| Tenancy, papéis e isolamento de base (10) | 10 | 10 | `supabase/tests/tenancy.test.sql` e casos HTTP de acesso cruzado. |
| Profissionais, expediente e serviços (4) | 0 | 0 | Parcial. Cadastros, vínculos, descrição, especialidades, pausas e bloqueios operacionais. Faltam cadastro de foto e indicação das reservas afetadas pela inativação. |
| Motor e integridade concorrente (5) | 0 | 0 | Parcial. Disponibilidade, idempotência e sobreposição testadas. Ainda faltam cobertura de horário de verão, corrida com alteração de expediente e edição completa de serviço e profissional. |
| Agenda administrativa e painel (4) | 0 | 0 | Parcial. Dia, semana, mês, filtro, ações de status, reagendamento e indicadores existentes. Faltam edição completa e revisão de todos os estados. |
| Reserva pública protegida e jornada completa (5) | 0 | 0 | Parcial. Jornada concluída no navegador contra Data API simulada e regras testadas no PostgreSQL. Falta a integração com Supabase completo. |
| Deduplicação e histórico básico do cliente (2) | 0 | 2 | `supabase/tests/public_booking.test.sql` cobre reaproveitamento sem sobrescrever o cliente, total e último atendimento. O histórico aparece na edição do cliente. |
| Caixa, gestão avançada, comissões, assinaturas, lançamento, piloto e comercialização (50) | 0 | 0 | Critérios ainda parciais ou pendentes. Recebimentos existentes passaram na regressão. |

A linha de base é **20/100** (10 de fundação + 10 de tenancy). O resultado é **22/100** (20 da base + 2 da Fase 2). A Fase 2 soma **2/20** em critérios integralmente verificados. A meta de 50/100 permanece pendente.

## Validações

| Comando ou cenário | Ambiente | Resultado |
| --- | --- | --- |
| `npm run lint`, `npm run typecheck`, `npm run build` | Cópia local sem configuração de produção | Passaram |
| `npm test` | Node e Data API simulada em loopback | 50 passaram, zero falhas. Inclui reserva anônima e leitura pelo titular. |
| Migrações e `supabase/tests/*.test.sql` | PostgreSQL 18 descartável, com esquema Auth mínimo de teste | 89 verificações, incluindo 17 da reserva pública. |
| Reservas simultâneas | Duas conexões independentes ao PostgreSQL local | Uma reserva nas disputas público × público e público × manual. A regressão de duplicidade de pagamento passou. |
| Reserva no navegador | 320 px, dados sintéticos e Data API simulada | Busca e confirmação públicas, confirmação por teclado e leitura da mesma reserva na agenda semanal. A largura do documento não excedeu a da tela. |

## Configuração e pendências

- Validar com Auth, Data API e banco no mesmo Supabase de teste. Neste computador, Docker e Supabase CLI não foram encontrados. A suíte HTTP e o PostgreSQL isolado respondem por partes distintas dessa validação.
- Configurar `SUPABASE_BOOKING_SECRET` no servidor de teste. Aplicar as novas migrações na ordem do diretório. As migrações foram executadas em banco descartável, e o caminho de atualização com histórico representativo ainda precisa de uma validação dedicada.
- Completar edição de cliente, profissional e serviço do agendamento, foto, tratamento de inativação e cenários de corrida e horário de verão. Fazer revisão de acessibilidade além do percurso básico validado no navegador.
- Super Admin permanece no roadmap de operações de plataforma, após as dependências de autorização, auditoria, cobrança e recuperação.
