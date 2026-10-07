# Vaga Radar

Busca posts de vagas no LinkedIn, filtra com IA as que combinam com o seu perfil e escreve
e-mails de candidatura com o currículo certo anexado. Roda só no seu computador: posts,
perfil, currículos e chaves ficam numa pasta local que nunca vai para o git.

- **Vagas:** os posts das suas buscas, separados em abas (grupos de busca que você cria), com
  filtro por texto, data e busca. A aba **Com e-mail** junta os posts que têm um endereço de
  e-mail, achado por código, sem IA.
- **Para você:** a IA lê os posts e deixa só as vagas que combinam com o seu perfil, da mais
  forte para a mais duvidosa, com o link para se candidatar.
- **E-mails:** para os posts que pedem currículo por e-mail, a IA escreve um card com o e-mail e o
  PDF certo. **Nada é enviado sem você clicar em Enviar.**

## O que você precisa

- [Node.js](https://nodejs.org) 22 ou mais novo e [Bun](https://bun.sh).
- Uma conta na [Apify](https://apify.com), que busca os posts no LinkedIn. O plano grátis dá
  alguns dólares de crédito por mês, e cada post custa cerca de US$ 0,002.
- Uma IA, de um destes jeitos:
  - **Chave de API** da Anthropic (Claude), OpenAI ou Google (Gemini), paga por uso; ou
  - **A sua assinatura**, se você tem o [Claude Code](https://code.claude.com/docs), o
    [Codex](https://developers.openai.com/codex/cli) ou o
    [Gemini CLI](https://github.com/google-gemini/gemini-cli) instalado e logado. Não precisa
    de chave: o app chama o CLI e gasta a cota da assinatura.
- Um e-mail para enviar: Gmail (com
  [senha de app](https://myaccount.google.com/apppasswords), que pede a verificação em 2
  etapas ligada) ou qualquer provedor com SMTP, como o e-mail do seu domínio. Nos provedores
  SMTP, o app salva uma cópia de cada envio na sua pasta Enviados, pelo IMAP.

## Instalação

```bash
git clone <url-deste-repositório> vaga-radar
cd vaga-radar
bun install
bun dev
```

Abra http://localhost:3100. Para parar, `Ctrl+C` no terminal.

## Primeiro uso

A página Vagas mostra uma lista de primeiros passos até tudo estar configurado:

1. **Buscas:** crie um grupo (vira uma aba) e coloque buscas nele. Se alguém te mandou um
   arquivo de buscas, use **Importar buscas**.
2. **Ajustes > Conexões:** cole o token da Apify (Settings › API & Integrations), escolha a IA e
   configure o e-mail. Cada parte tem um botão **Testar**.
3. **Perfil:** nome, assinatura dos e-mails, cidade, níveis e modalidades que você procura,
   pretensão salarial e os PDFs dos currículos (um por versão: front-end, back-end, inglês…).
   O botão **Escrever com IA** lê os PDFs e preenche o "Sobre você" para você revisar.
4. **Vagas:** clique em **Re-pesquisar**.
5. **Para você:** clique em **Analisar com IA**. O painel mostra antes quantos posts serão lidos
   e o custo estimado.
6. **E-mails:** clique em **Escrever e-mails com IA**, revise cada card e envie.

### Como escrever uma busca

É a pesquisa de posts do LinkedIn: termos entre aspas, ligados por `AND`, `OR` e `NOT` em
maiúsculas, com parênteses. Até 5 operadores por busca (a página avisa).

```
("react" OR "next.js") AND ("remoto") AND ("vaga" OR "contratando")
```

Várias buscas curtas funcionam melhor que uma longa: o LinkedIn devolve no máximo ~200 posts
por busca. Grupos marcados como **Só posts recentes** vão menos dias para trás na primeira
pesquisa, bom para posts que pedem currículo por e-mail.

## Custos

- **Apify:** ~US$ 0,002 por post. A primeira pesquisa de cada busca traz até 250 posts
  (~US$ 0,50); as seguintes, só o que saiu desde a anterior. Os limites ficam em Ajustes.
- **IA com chave:** com Claude Haiku 4.5, ler ~800 posts custa perto de US$ 1. Escrever um
  e-mail com Sonnet 5.5 sai por volta de US$ 0,01.
- **IA pela assinatura:** sem custo extra, mas gasta a cota. Ler centenas de posts de uma vez
  pode bater o limite de uso. O progresso fica salvo e a próxima análise continua de onde
  parou.

## Onde ficam os seus dados

Tudo em `data/`, fora do git:

| Arquivo | O que guarda |
| --- | --- |
| `posts.json` | Posts encontrados e o que você marcou (vi, apliquei) |
| `searches.json` | Grupos e buscas |
| `profile.json` | Perfil e informações dos currículos |
| `config.json` | Token da Apify, chave da IA e senha do e-mail |
| `matches.json`, `outreach.json` | Análises da IA e cards de e-mail |
| `settings.json` | Limites de Ajustes |
| `cvs/` | PDFs enviados pela página Perfil |

Para levar para outro computador, copie a pasta `data/`. As chaves também podem ir num
`.env.local` (veja `.env.example`), que vale por cima do que está salvo no site.

## Segurança

- **O app não tem login e foi feito para rodar só no seu computador.** Ele aceita conexões
  apenas de `127.0.0.1`. Não hospede na internet nem libere na rede: quem acessasse poderia
  enviar e-mails pela sua conta e gastar seus créditos.
- Chaves e senhas nunca voltam para o navegador depois de salvas.
- O texto dos posts é tratado como dado: a IA é instruída a ignorar pedidos dentro deles, e o
  código confere cada resposta (o link e o destinatário precisam estar no próprio post, o
  currículo precisa existir).
- No modo assinatura, o CLI roda numa pasta vazia e sem ferramentas: só lê os posts e
  responde.

## Desenvolvimento

```bash
bun run test     # testes (Vitest)
bun run lint     # ESLint
bun run build    # build de produção
bun run start    # roda o build
```

Next.js 16 (App Router), React 19, Tailwind CSS 4, AI SDK 7. Os dados são arquivos JSON em
`data/`, sem banco.

## Aviso

Projeto pessoal, mantido no tempo livre e sem garantia. Os CLIs de IA, os modelos e o actor da
Apify mudam com frequência: se algo quebrar, abra uma issue.

O app busca posts públicos do LinkedIn pela sua conta da Apify. Use com moderação e de acordo
com os termos do LinkedIn e da Apify. Revise todo e-mail antes de enviar: a IA erra.

## Licença

[MIT](LICENSE)
