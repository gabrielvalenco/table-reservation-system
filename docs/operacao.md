# Operação

Guia para colocar no ar e manter. Marcado com ✅ o que foi testado de verdade em desenvolvimento e com ⚠️ o que só dá para conferir na VPS real.

## O que sobe

`docker-compose.prod.yml` sobe três containers:

| Serviço | O que é |
|---|---|
| `db` | Postgres 17, volume `db`, sem porta aberta para fora |
| `api` | Node (Fastify). Roda as migrations ao iniciar. `/api/health` serve de healthcheck |
| `web` | Caddy: HTTPS automático, serve o front e faz proxy de `/api` (mesmo domínio, sem CORS) |

✅ Testado: as imagens constroem, a pilha sobe saudável, o front carrega sem violação de CSP, `/api` passa pelo proxy, os cabeçalhos de segurança saem e o log da API não tem token nem busca na URL.

## Primeiro deploy

Pré-requisitos: VPS com Docker, domínio apontando para o IP dela e portas 80 e 443 liberadas.

```sh
git clone <repositório> && cd table-reservation-system
cp .env.example .env.production   # edite: veja a lista abaixo
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Variáveis do `.env.production`:

| Variável | Valor |
|---|---|
| `DOMAIN` | domínio final, sem `https://` |
| `POSTGRES_PASSWORD` | senha longa e aleatória (`openssl rand -base64 32`) |
| `SMTP_URL` | URL SMTP do provedor, ex.: `smtps://usuario:senha@smtp.provedor.com:465` |
| `MAIL_FROM` | remetente, ex.: `Pincelada <reservas@seudominio.com.br>` |

Segredos ficam só nesse arquivo (fora do git). As variáveis de desenvolvimento (`DATABASE_URL`, `SEED_*`) não são usadas em produção.

Criar o primeiro usuário da equipe:

```sh
docker compose -f docker-compose.prod.yml --env-file .env.production exec api \
  node apps/api/dist/create-staff.js email@dominio.com "Nome" "senha-longa-com-10-ou-mais-caracteres"
```

(Em desenvolvimento, use `npm run staff:create -- email nome senha`.)

## Deploy no Dokploy

Quando a VPS já roda o Dokploy, o Traefik dele ocupa as portas 80/443 e faz o HTTPS. Use `docker-compose.dokploy.yml`, em que o Caddy só serve HTTP na rede interna.

1. **Create Service → Compose**, fonte Git: `https://github.com/gabrielvalenco/table-reservation-system`, branch `main`, caminho `docker-compose.dokploy.yml`.
2. **Environment:** `POSTGRES_PASSWORD` (longa e aleatória), `PUBLIC_URL` (`https://` + domínio), `SMTP_URL` e `MAIL_FROM` (opcionais até escolher o provedor; sem eles nenhum e-mail sai).
3. **Domains:** host do domínio, serviço `web`, porta `80`, HTTPS ligado com Let's Encrypt. O DNS do domínio precisa apontar para o IP da VPS.
4. **Deploy.** Depois, crie o usuário da equipe pelo terminal do container `api`: `node apps/api/dist/create-staff.js email "Nome" "senha-longa"`.

⚠️ Use um domínio com HTTPS. Em HTTP (por exemplo, um domínio `traefik.me` gerado pelo Dokploy) o cookie de sessão da equipe é `Secure` e o navegador não o guarda: o login não funciona.

## Atualizar e voltar atrás (rollback)

Atualizar:

```sh
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

As migrations rodam sozinhas ao subir a API e **só avançam** (arquivos `.sql` numerados). Por isso:

1. Antes de atualizar, rode `./scripts/backup.sh`.
2. Para voltar o código: `git checkout <commit-anterior>` e suba de novo. Isso serve quando a versão nova não trouxe migration.
3. Se a versão nova trouxe migration, voltar o código não desfaz o banco. Nesse caso, restaure o backup feito no passo 1 (próxima seção) e suba o código anterior.

## Backup e restauração

✅ `scripts/backup.sh` e `scripts/restore.sh` foram testados em desenvolvimento: o dump foi restaurado em um banco novo com 5 tabelas, 8 reservas, 3 migrations e a restrição `EXCLUDE` (a que impede reservas sobrepostas) de volta.

**Backup diário** (guarda 14 dias em `./backups`; confere que o arquivo é legível antes de aceitá-lo):

```sh
crontab -e
0 3 * * * cd /caminho/do/projeto && ./scripts/backup.sh >> backups/backup.log 2>&1
```

⚠️ Copie a pasta `backups/` para fora da VPS (outro servidor ou armazenamento de objetos), senão um problema no disco leva os dados e os backups juntos.

**Restaurar** nunca escreve por cima do banco em uso. O script cria um banco novo, e você confere antes de trocar:

```sh
./scripts/restore.sh backups/reservas-AAAAMMDD-HHMMSS.dump --check   # restaura num banco de teste, confere e apaga
./scripts/restore.sh backups/reservas-AAAAMMDD-HHMMSS.dump          # deixa o banco "reservas_restore" para você conferir
```

Para promover o restaurado: pare a API (`docker compose ... stop api`), renomeie os bancos (`ALTER DATABASE reservas RENAME TO reservas_antigo; ALTER DATABASE reservas_restore RENAME TO reservas;`) e suba a API.

⚠️ **Faça um restore de verdade na VPS antes de ir ao ar** e registre a data aqui: _ainda não feito_.

## Monitoramento

⚠️ Falta configurar na VPS: um monitor externo (UptimeRobot, Better Stack ou similar) chamando `https://SEU-DOMINIO/api/health` a cada minuto, com alerta por e-mail ou mensagem. A API responde `{"status":"ok"}` (200) e `503` quando o banco não responde. O container da API também tem healthcheck do Docker.

Logs: `docker compose -f docker-compose.prod.yml logs -f api` (JSON). Não levam dado pessoal: a URL sai sem o token do link e sem a query de busca, e cookies não são registrados.

## E-mail: SPF, DKIM e DMARC

⚠️ Dependem do provedor e do domínio, que ainda não foram escolhidos. Com o provedor definido:

1. Publique os registros **SPF** e **DKIM** que ele fornecer no DNS do domínio.
2. Publique um **DMARC** simples (`v=DMARC1; p=none; rua=mailto:...`) e endureça depois de ver os relatórios.
3. Envie um e-mail de teste para Gmail e Outlook e confira os cabeçalhos `spf=pass`, `dkim=pass` e `dmarc=pass`.

Uma falha no envio não desfaz a reserva: vira uma linha de log de erro (sem dado pessoal).

## LGPD

- A API anonimiza reservas com mais de 180 dias (nome, telefone, e-mail, observações e link) ao iniciar e uma vez por dia. Nada é apagado: a linha fica para as estatísticas.
- O aviso de privacidade está em `/privacidade`. ⚠️ **O contato do responsável pelos dados está como "A definir"** em `apps/web/src/pages/privacy.tsx`: preencha com os dados do restaurante e peça uma revisão jurídica antes de publicar.

## Desempenho

✅ `npm run bench:availability` mede a consulta de disponibilidade com 50 mesas e ~1.000 reservas no mês: p95 de cerca de 1 ms (sequencial, sem rede, na máquina de desenvolvimento), contra a meta de 300 ms. Rode de novo na VPS depois de subir.
