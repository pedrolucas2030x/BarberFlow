# AGENTS.md --- BarberFlow

## Missão

Atue como engenheiro de software sênior responsável por construir um Micro-SaaS comercial para barbearias de 1 a 5 profissionais. Priorize simplicidade, segurança, experiência mobile e manutenção. Responda em português brasileiro. Não invente resultados de testes nem declare funcionalidades concluídas sem verificação.

## Produto

-   Nome provisório: BarberFlow. Slogan: Seu negócio. No controle.
-   Mercado piloto: Palmeirais e região; expansão nacional após validação.
-   Hipótese comercial: R\$ 49,90/mês, teste de 14 dias, sem cobrança automática não autorizada. Meta inicial: 10 clientes pagantes.
-   Interfaces: proprietário, profissional e página pública de agendamento sem instalação.
-   MVP: autenticação, estabelecimento, serviços, profissionais, clientes, agenda, caixa, comissões e dashboard.
-   Futuro: WhatsApp oficial com consentimento, recuperação de clientes, fidelidade, estoque, assinaturas de cortes e filiais. Não implementar antes de validar o MVP.

## Stack e arquitetura

Next.js App Router, TypeScript strict, Tailwind CSS, Lucide, Recharts, Zod, React Hook Form, Supabase PostgreSQL/Auth/SSR e Vercel. PWA após estabilização. Verifique package.json e versões existentes antes de instalar dependências. Use Server Components por padrão e Client Components apenas quando necessários. Separe UI, domínio, validação e acesso a dados. Evite abstrações prematuras.

Estrutura sugerida: - src/app/(auth): login e cadastro. - src/app/(dashboard): painel, agenda, clientes, equipe, serviços, financeiro e configurações. - src/app/agendar/\[slug\]: página pública. - src/components: componentes reutilizáveis. - src/lib/supabase: clientes browser/server e sessão. - src/lib/validation: schemas Zod. - src/features: lógica por domínio. - supabase/migrations: migrações SQL versionadas. - tests: testes de domínio e integração.

## Design

Identidade premium: preto #101010, grafite #27272A, dourado #D4AF37, branco #FAFAFA. Fonte Inter. Contraste acessível, foco visível, navegação por teclado, estados de carregamento, erro e vazio. Desktop com sidebar; celular com navegação compacta. Interface em pt-BR, moeda BRL, datas locais e fuso configurável (padrão America/Fortaleza). Não usar dourado como único indicador de estado. Evitar excesso de animações e gráficos decorativos.

## Modelo de dados

Use UUIDs, timestamps com timezone e valores monetários em centavos inteiros. Defina chaves estrangeiras, índices e restrições. Todas as entidades de negócio devem pertencer a um tenant.

-   profiles: user_id vinculado a auth.users, nome.
-   organizations: id, nome, slug único, timezone, status.
-   memberships: organization_id, user_id, role (owner, manager, barber), unique por usuário e organização.
-   professionals: organization_id, membership_id opcional, nome, ativo, comissão em pontos-base.
-   services: organization_id, nome, duração em minutos, preço em centavos, ativo.
-   professional_services: vínculo entre profissional e serviço.
-   customers: organization_id, nome, telefone normalizado, consentimento de marketing opcional.
-   working_hours e time_off: horários de trabalho, pausas e bloqueios.
-   appointments: organization_id, professional_id, service_id, customer_id, início, fim, status, preço e comissão congelados no momento definido pela regra de negócio.
-   payments: appointment_id, organization_id, valor, método, status, data; suportar idempotência.
-   cash_entries: organization_id, tipo receita/despesa, valor, categoria, referência e data; impedir lançamento duplicado.
-   subscriptions: organization_id, status, trial_ends_at, identificadores externos; sem dados de cartão.

## Segurança e privacidade

-   Multi-tenant obrigatório: RLS em todas as tabelas expostas; negar por padrão. Validar membership e papel no servidor e no banco. Nunca confiar em organization_id enviado pelo cliente sem autorização.
-   Impedir vínculos entre tenants usando constraints compostas ou mecanismo equivalente. Testar isolamento com dois estabelecimentos e usuários diferentes.
-   Chaves secretas e service role exclusivamente no servidor. Nunca commitar .env.local. Criar .env.example com placeholders. Não solicitar segredos no chat.
-   Onboarding transacional para organização e owner; impedir autoelevação de papel.
-   Página pública deve expor somente dados necessários; não permitir leitura pública de clientes, telefones ou agenda privada. Usar endpoint/RPC restrito, validação, rate limit e proteção contra abuso.
-   Aplicar LGPD: minimização, consentimento separado para marketing, política de privacidade, exclusão/exportação conforme aplicável, retenção definida. Não registrar dados pessoais desnecessários em logs.
-   Não executar migrações destrutivas, publicar em produção, contratar serviços ou efetuar cobranças sem autorização explícita. Usar ambiente de teste e dados fictícios.

## Regras de negócio

-   Agendamento: selecionar serviço, profissional, data, horário e contato; calcular duração e preço no servidor; respeitar expediente, pausas e bloqueios.
-   Impedir sobreposição de horários atomicamente no PostgreSQL, inclusive em requisições simultâneas (por exemplo, exclusion constraint com intervalo e profissional para status ativos).
-   Status: pending, confirmed, completed, canceled, no_show. Validar transições e permissões. Cancelamentos liberam horário. Histórico preservado.
-   Financeiro: atendimento concluído não significa pagamento recebido. Registrar pagamento explicitamente; calcular receita realizada apenas com pagamentos confirmados e evitar duplicidade. Despesas separadas. Comissões com regra documentada e valores históricos preservados.
-   Proprietário administra estabelecimento; profissional acessa sua agenda e informações necessárias ao atendimento; cliente público não acessa painel.
-   Dashboard: receita recebida, atendimentos concluídos, ticket médio com denominador consistente, próximos horários e despesas. Indicadores derivados de dados reais, nunca valores fictícios em produção.
-   Assinaturas: integrar provedor como Asaas somente após validação; webhooks autenticados e idempotentes, estados de teste/ativo/vencido/cancelado. Verificar termos comerciais dos serviços antes do lançamento.

## Roadmap e critérios de aceite

1.  Fundação: inspecionar repositório, configurar layout, lint, TypeScript, variáveis e documentação. Projeto roda localmente e build passa.
2.  Autenticação e tenancy: migrações, RLS, onboarding e sessão. Testes provam que tenant A não acessa tenant B.
3.  Cadastros: profissionais, serviços, clientes e expediente com CRUD autorizado e validação.
4.  Agenda: visão diária/semanal, criação manual, cancelamento e página pública. Testar concorrência, horários indisponíveis e timezone.
5.  Financeiro: pagamentos, despesas, comissões e dashboard com totais verificáveis.
6.  Piloto: testar com três barbearias mediante consentimento; corrigir problemas, medir agendamentos concluídos e feedback.
7.  Comercialização: cobrança recorrente, termos, privacidade, backups, observabilidade e deploy autorizado.

## Fluxo de trabalho do Codex

Antes de alterar código, inspecione os arquivos existentes e git status. Preserve alterações do usuário. Apresente plano curto e implemente uma etapa por vez. Não reescreva o projeto inteiro sem necessidade. Não use comandos destrutivos. Prefira dependências existentes. Execute lint, typecheck, testes e build quando disponíveis; se falharem, informe o erro real. Documente comandos, variáveis, migrações e decisões no README. Mantenha um checklist de progresso em docs/ROADMAP.md. Ao finalizar cada etapa, informe arquivos alterados, testes executados, pendências e próximo passo. Não simule integração funcional quando faltarem credenciais.

## Primeira tarefa

Inspecione o projeto atual. Se estiver vazio, inicialize Next.js com TypeScript, Tailwind, ESLint, App Router e src/. Se já existir, preserve a estrutura. Crie o layout responsivo BarberFlow, navegação e dashboard inicial com estados vazios ou demonstração explicitamente rotulada. Prepare .env.example, README e roadmap. Valide lint, typecheck e build. Não configure serviços externos nem publique sem autorização. Depois apresente a próxima etapa: Supabase, autenticação e isolamento multi-tenant.
