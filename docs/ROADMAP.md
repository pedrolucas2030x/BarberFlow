# Roadmap do BarberFlow

## 1. Fundação

- [x] Aproveitar a estrutura existente do Next.js App Router com TypeScript strict, Tailwind e ESLint.
- [x] Aplicar a identidade visual, o layout responsivo e a navegação em português.
- [x] Entregar a landing comercial responsiva com condições previstas do piloto.
- [x] Entregar painel administrativo e seções iniciais com estados de carregamento, vazio, erro e página não encontrada.
- [x] Documentar comandos e variáveis e disponibilizar `.env.example`.
- [x] Validar lint, tipos, build e suíte HTTP e unitária da Fase 1.
- [ ] Conferir visualmente as versões desktop e mobile e exercitar o menu compacto no navegador.

## 2. Supabase, autenticação e isolamento multi-tenant

- [x] Criar e verificar a migration de `profiles`, `organizations` e `memberships` em PostgreSQL isolado.
- [x] Implementar login, cadastro, confirmação de e-mail, recuperação de senha e sessão SSR com proteção das rotas privadas.
- [x] Implementar onboarding transacional de estabelecimento e proprietário.
- [x] Aplicar RLS com negação por padrão, permissões mínimas e validação de papéis no servidor e no banco.
- [x] Testar acesso autorizado, isolamento com dois estabelecimentos e usuários diferentes, concorrência e bloqueio de autoelevação de papel.
- [ ] Executar o fluxo completo com Supabase Auth, Data API e caixa de e-mail do Supabase local ou com projeto hospedado de teste autorizado.

## 3. Cadastros

- [x] Cadastrar, editar, desativar e reativar serviços e profissionais.
- [x] Cadastrar, editar e excluir clientes com confirmação, telefone normalizado e consentimento opcional de marketing.
- [x] Vincular serviços a profissionais e gerenciar turnos semanais, pausas e bloqueios no fuso da barbearia.
- [x] Validar formulários e permissões com a suíte da aplicação e testar integridade e isolamento em PostgreSQL local.
- [ ] Validar os cadastros de ponta a ponta com as migrações aplicadas em um Supabase de teste autorizado.

## 4. Agenda

- [x] Implementar agenda diária, criação manual e cancelamento com histórico.
- [ ] Entregar visão semanal e agendamento público com proteção contra abuso.
- [ ] Validar o fluxo completo no Supabase de teste, incluindo disponibilidade e fuso horário.

## 5. Financeiro

- [ ] Registrar pagamentos, despesas e comissões com idempotência e histórico.
- [ ] Alimentar o painel com indicadores calculados a partir dos registros reais e testar os totais.

## 6. Piloto

- [ ] Validar com três barbearias mediante consentimento, acompanhar atendimentos e coletar feedback.
- [ ] Definir política de privacidade, retenção e procedimento de exportação ou exclusão antes de receber dados reais do piloto.

## 7. Comercialização

- [ ] Validar cobrança recorrente, termos, privacidade, backups e observabilidade e preparar o deploy autorizado.
