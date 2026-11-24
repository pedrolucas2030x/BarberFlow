# BarberFlow

**Seu negócio. No controle.**

Micro-SaaS para barbearias de 1 a 5 profissionais. A Fase 1 inclui landing comercial, acesso por e-mail, cadastro da barbearia e painel administrativo. O painel usa o estabelecimento, o papel de acesso e o fuso gravados no banco. Agenda, cadastros e financeiro ainda exibem estados vazios. A oferta exibida na landing é uma proposta para o piloto, com 14 dias de teste previstos, sem ativação de assinatura ou cobrança nesta fase.

## Rodar o site

Use Node.js 22 LTS e npm. Em PowerShell, `npm.cmd` funciona se a política de execução bloquear `npm.ps1`.

```sh
npm ci
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). A landing funciona antes de configurar o banco. Para testar um cadastro completo, prepare o Supabase abaixo.

## Configurar o Supabase local

Use Supabase CLI v3 e um runtime de contêiner compatível. O projeto inclui `supabase/config.toml`, migration versionada, templates de e-mail e testes SQL. Os comandos abaixo operam na instância local. [Guia do Supabase CLI](https://supabase.com/docs/guides/local-development)

```sh
npx --yes supabase@3.3.0 start
npx --yes supabase@3.3.0 migration up
npx --yes supabase@3.3.0 test db supabase/tests
```

1. Copie `.env.example` para `.env.local`. Preencha a URL da API local (por padrão `http://127.0.0.1:54321`) e a chave `sb_publishable_...` mostrada pelo CLI local.
2. Mantenha `BARBERFLOW_APP_URL=http://localhost:3000`, igual ao `site_url` de `supabase/config.toml`. Reinicie o servidor Next.js após editar o arquivo.
3. Cadastre uma conta de teste e abra a caixa de e-mail local em `http://localhost:54324`. Abra a mensagem e confirme o e-mail na página BarberFlow. Faça login, cadastre uma barbearia e confira os dados em `/configuracoes`.
4. Teste a recuperação enviando um novo e-mail, abrindo o link e cadastrando a nova senha antes de entrar novamente.

Se mudar de origem no desenvolvimento, ajuste também `site_url` e `additional_redirect_urls` no arquivo de configuração. Os templates usam a mesma origem do Supabase Auth. [Templates locais de e-mail](https://supabase.com/docs/guides/local-development/customizing-email-templates)

## Variáveis de ambiente

| Variável | Valor esperado |
| --- | --- |
| `BARBERFLOW_APP_URL` | Origem do aplicativo sem caminho, igual ao Site URL do Auth. Use HTTPS em ambiente hospedado. |
| `BARBERFLOW_TIMEZONE` | Fuso IANA que o formulário sugere para novos estabelecimentos. O padrão é `America/Fortaleza`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Origem da API do projeto, via HTTPS ou HTTP em loopback local. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Somente a chave publicável `sb_publishable_...`. |

Mantenha `.env.local` fora do Git. A fase usa somente a chave publicável, com autorização por sessão e RLS. Chaves secretas e `service_role` pertencem exclusivamente ao servidor e não são exigidas pelo BarberFlow.

## Validar em um projeto hospedado de teste

1. Escolha um projeto de teste autorizado e revise a migration em `supabase/migrations/` antes de aplicá-la. Ela cria três tabelas e prepara os perfis das contas Auth já existentes no projeto.
2. No Supabase Auth, habilite cadastro por e-mail e confirmação, mantenha entradas anônimas desabilitadas e configure senha mínima de 12 caracteres. Faça o Site URL coincidir com `BARBERFLOW_APP_URL`. Inclua a URL exata `<origem>/auth/confirm` nos redirecionamentos permitidos. [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
3. Use `supabase/templates/confirmation.html` para confirmação e `supabase/templates/recovery.html` para recuperação. Os links usam `TokenHash` e os tipos `email` ou `recovery`. Configure SMTP próprio se necessário para aplicar os templates e enviar para os participantes do piloto. Projetos Free novos dependem de SMTP próprio para personalizá-los. [SMTP no Supabase](https://supabase.com/docs/guides/auth/auth-smtp) · [Personalização de templates no plano Free](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier)
4. Configure as quatro variáveis no ambiente do aplicativo e valide o fluxo com duas contas em estabelecimentos diferentes. Confira a confirmação e a recuperação pelo e-mail recebido, o onboarding, as rotas privadas e a saída da conta. No proxy ou provedor de hospedagem, exclua a query de `/auth/confirm` dos registros de acesso para preservar os tokens de confirmação.

## Verificações do código

```sh
npm run lint
npm run typecheck
npm run build
npm test
```

Execute `npm test` após o build. A suíte executa testes de formulário e sobe a aplicação de produção em portas efêmeras. O serviço HTTP de teste simula o contrato de Auth e da Data API. Ele permite verificar login, cookies, autorização por perfil, estados sem configuração e onboarding sem usar contas reais.

`supabase/tests/tenancy.test.sql` testa permissões e integridade no PostgreSQL, incluindo isolamento entre usuários de estabelecimentos diferentes. A validação desta fase executou a migration e a suíte em um PostgreSQL 18 isolado, com o schema Auth mínimo exigido pelos testes. Para validar os serviços juntos e a entrega dos e-mails, use o ambiente Supabase local descrito acima.

## Estrutura e decisões

- `src/app/(marketing)` atende a página pública. `src/app/(auth)` e `src/app/auth/confirm` concentram acesso e confirmação de links. O GET de confirmação guarda o token temporariamente, e o envio do formulário consome o token.
- `src/app/(setup)` conduz o onboarding. A RPC `create_organization` grava o estabelecimento e o vínculo de proprietário na mesma transação e serializa requisições simultâneas da mesma conta.
- `src/app/(dashboard)` reúne as rotas com sessão obrigatória. Proprietários e gestores acessam `/painel`, e profissionais têm acesso à rota da agenda. A aplicação verifica o vínculo e o papel no servidor, e o banco aplica RLS.
- `src/lib/supabase` contém a configuração e o cliente SSR. `src/proxy.ts` atualiza os cookies de sessão e desabilita o cache nas rotas autenticadas.
- Nesta fase, uma conta sem vínculo pode cadastrar um estabelecimento. A troca entre estabelecimentos e o convite de profissionais pertencem a etapas futuras.

<details>
<summary>Imagem e identidade visual</summary>

A interface usa Tailwind, ícones Lucide e Inter distribuída com o aplicativo. A foto em `public/barbershop.webp` foi gerada com ImageGen e otimizada para WebP.

> Use case: photorealistic-natural. Asset type: wide background photo for a premium Brazilian barbershop dashboard. Subject: an empty, classic black tufted leather barber chair with brushed brass details in a dark, modern barbershop with charcoal plaster walls, oak worktops and warm amber mirror lighting. Real editorial interior photograph with subtle grain. Frame the chair on the right third, fully visible around its arms and back. Leave the left third in deep charcoal shadow for overlay text. Wide horizontal composition, soft highlights, no people, text, logos or watermark.

</details>

Veja o [roadmap](docs/ROADMAP.md) para os critérios das etapas seguintes.
