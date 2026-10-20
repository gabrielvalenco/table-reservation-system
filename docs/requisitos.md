# Requisitos — v1

Este documento define o que precisa existir para colocar o sistema **em produção, num restaurante real**. Tudo o que não está aqui fica fora da v1 (ver [Fora de escopo](#fora-de-escopo)).

Valores marcados com ⚙️ são **padrões configuráveis**. Eles servem para começar a implementar e devem ser validados com o restaurante (ver [Perguntas em aberto](#perguntas-em-aberto)).

---

## 1. Visão geral

Um restaurante (uma unidade) recebe reservas de mesa pela web. O cliente reserva sem criar conta. A equipe do restaurante gerencia a agenda, as mesas e as regras numa área administrativa autenticada.

### Atores

| Ator | Descrição | Autenticação |
|---|---|---|
| **Cliente** | Pessoa que quer reservar | Nenhuma. Gerencia a própria reserva por um link com token secreto |
| **Equipe** | Atendente ou gerente do restaurante | E-mail + senha |

Na v1 há um único papel administrativo (`staff`). Perfis diferentes (gerente × atendente) ficam para depois.

---

## 2. Regras de negócio

Estas regras são o núcleo do sistema. Toda escrita (criar, editar, mudar mesa) passa por elas, sem exceção.

| ID | Regra |
|---|---|
| **RN01** | Toda reserva tem **início e fim**. Duração padrão: **2h** ⚙️. |
| **RN02** | **Duas reservas ativas não podem se sobrepor na mesma mesa.** Isso é garantido por *constraint* no banco (`EXCLUDE USING gist`), e não apenas por checagem na aplicação. |
| **RN03** | O horário de início é escolhido em intervalos de **30 min** ⚙️. |
| **RN04** | A reserva precisa caber inteira dentro de um **turno de funcionamento** (ex.: ter–dom 11:30–15:00 e 18:00–23:00 ⚙️). O último início possível é o fim do turno menos a duração. |
| **RN05** | Antecedência mínima de **1h** ⚙️ e máxima de **30 dias** ⚙️. Reserva no passado é sempre inválida. |
| **RN06** | Número de pessoas: mínimo 1, máximo igual à capacidade da maior mesa ativa. |
| **RN07** | **O cliente não escolhe a mesa.** Ele informa data, horário e número de pessoas, e o sistema atribui a **menor mesa ativa que comporte o grupo** e esteja livre. A equipe pode trocar a mesa manualmente. |
| **RN08** | Na troca manual de mesa, a capacidade da nova mesa precisa comportar o grupo e a RN02 continua valendo. |
| **RN09** | **Datas bloqueadas** (feriado, evento fechado) não aceitam novas reservas. Reservas já existentes nessas datas aparecem para a equipe tratar. |
| **RN10** | Uma mesa **desativada** não recebe novas reservas. As reservas futuras dela continuam válidas e aparecem para a equipe realocar. |
| **RN11** | O cliente pode cancelar pelo link até **2h antes** ⚙️ do início. A equipe pode cancelar a qualquer momento. |
| **RN12** | O mesmo contato (telefone ou e-mail) pode ter **no máximo 1 reserva ativa por turno** ⚙️ (antiabuso). |
| **RN13** | Reservas **nunca são apagadas**, apenas mudam de status. Status: `confirmada`, `cancelada`, `concluida`, `nao_compareceu`. Somente `confirmada` ocupa a mesa. |
| **RN14** | Todos os horários são armazenados em UTC (`timestamptz`) e exibidos no fuso do restaurante (**America/Sao_Paulo** ⚙️). |

---

## 3. Requisitos funcionais

Prioridade: **M** = obrigatório para ir a produção · **S** = desejável na v1 · **C** = se sobrar tempo.

### 3.1 Cliente (público)

| ID | Requisito | Prio |
|---|---|---|
| RF01 | Consultar **horários disponíveis** para uma data e um número de pessoas. Mostra apenas horários em que existe mesa que comporte o grupo. | M |
| RF02 | Criar reserva informando nome, telefone, e-mail, número de pessoas, data, horário e observação opcional (ex.: aniversário, cadeirinha). | M |
| RF03 | Ver uma tela de confirmação com código da reserva, data, horário, nº de pessoas e link de gerenciamento. | M |
| RF04 | Receber **e-mail de confirmação** com os mesmos dados e o link. | M |
| RF05 | Pelo link: ver a reserva e **cancelar** (respeitando a RN11). | M |
| RF06 | Pelo link: **alterar** data, horário ou nº de pessoas (passa por todas as regras de novo). | S |
| RF07 | Receber e-mail de **lembrete** 24h antes ⚙️. | C |
| RF08 | Aceitar o aviso de privacidade (LGPD) antes de enviar a reserva. | M |

### 3.2 Equipe (autenticada)

| ID | Requisito | Prio |
|---|---|---|
| RF10 | Login com e-mail e senha e logout. | M |
| RF11 | **Agenda do dia** (padrão) e navegação por data, com reservas agrupadas por turno e mesa. | M |
| RF12 | Filtrar por status e buscar por nome, telefone ou código. | M |
| RF13 | Criar reserva manualmente (ex.: pedido por telefone). Segue as mesmas regras, mas pode ignorar a antecedência mínima. | M |
| RF14 | Editar reserva: dados do cliente, data, horário, nº de pessoas e mesa. | M |
| RF15 | Cancelar, marcar como **concluída** ou como **não compareceu**. | M |
| RF16 | Cadastrar, editar e ativar/desativar **mesas** (número e capacidade). | M |
| RF17 | Ver as reservas afetadas por mesa desativada ou data bloqueada (RN09, RN10). | M |
| RF18 | Gerenciar **datas bloqueadas**. | S |
| RF19 | Editar **turnos de funcionamento** e as regras ⚙️ (duração, intervalo, antecedências) pela interface. Antes disso, elas vêm do seed do banco. | S |
| RF20 | Criar e desativar usuários da equipe. O primeiro usuário é criado por comando de CLI, e não existe cadastro público. | S |
| RF21 | Histórico de alterações de cada reserva (quem, quando, o quê). | S |

---

## 4. Requisitos não funcionais

### 4.1 Segurança

| ID | Requisito |
|---|---|
| RNF01 | HTTPS obrigatório em produção, com HSTS. |
| RNF02 | Front e API servidos **no mesmo domínio** (proxy reverso: `/` → web, `/api` → API). Assim não há CORS a configurar. |
| RNF03 | Senhas com **argon2id**. Sessão em cookie `HttpOnly`, `Secure`, `SameSite=Lax`, com expiração e invalidação no logout. |
| RNF04 | Proteção CSRF nas rotas que alteram estado (SameSite + verificação do header `Origin`). |
| RNF05 | Toda entrada validada com Zod na API. Todas as queries parametrizadas, sem concatenação de SQL. |
| RNF06 | Nenhum HTML montado com dado do usuário fora do escaping do React (nada de `dangerouslySetInnerHTML`). |
| RNF07 | **Rate limiting** no login, na criação de reserva e na consulta de disponibilidade. |
| RNF08 | O token do link do cliente é aleatório (≥ 128 bits) e o banco guarda apenas o **hash** dele. O código curto da reserva sozinho não dá acesso a nada. |
| RNF09 | Segredos só por variáveis de ambiente, nunca no repositório. A configuração é validada na inicialização e a aplicação não sobe se faltar algo. |
| RNF10 | Erros internos não vazam detalhes (stack trace, SQL) para o cliente. |
| RNF11 | Headers de segurança (CSP, `X-Content-Type-Options`, `Referrer-Policy`, etc.). |

### 4.2 Privacidade (LGPD)

| ID | Requisito |
|---|---|
| RNF12 | Coletar só o necessário: nome, telefone, e-mail e observação. |
| RNF13 | Aviso de privacidade acessível no formulário, com finalidade, retenção e contato. O texto final deve ser revisado pelo responsável legal do restaurante. |
| RNF14 | **Anonimização automática** dos dados pessoais de reservas encerradas há mais de **180 dias** ⚙️. Mantém-se apenas o necessário para estatística (data, nº de pessoas, status). |
| RNF15 | Logs sem dados pessoais (nome, telefone, e-mail, token). |

### 4.3 Confiabilidade e operação

| ID | Requisito |
|---|---|
| RNF16 | **Backup diário** do Postgres com retenção de 30 dias ⚙️ e **restore testado** antes de ir a produção. |
| RNF17 | Migrations versionadas, aplicadas automaticamente no deploy e apenas para frente (forward-only). |
| RNF18 | `GET /api/health` verifica a conexão com o banco, para uso do orquestrador/monitor. |
| RNF19 | Logs estruturados em JSON com `request_id` por requisição. |
| RNF20 | Monitor externo de disponibilidade com alerta. |
| RNF21 | Falha no envio de e-mail **não** desfaz a reserva. O envio é registrado e reprocessado. |
| RNF22 | Deploy reproduzível por imagem Docker. Rollback por imagem anterior. |

### 4.4 Qualidade

| ID | Requisito |
|---|---|
| RNF23 | CI em todo PR: lint, typecheck, testes e build. Não se faz merge com CI vermelho. |
| RNF24 | Testes de integração contra Postgres real cobrindo todas as RNs, incluindo um **teste de concorrência**: N reservas simultâneas para a mesma mesa e horário resultam em exatamente 1 sucesso. |
| RNF25 | Testes de API dos fluxos principais (reservar, cancelar pelo link, login, editar). |
| RNF26 | Cobertura não é meta. A meta é que toda regra da seção 2 tenha teste. |

### 4.5 Usabilidade

| ID | Requisito |
|---|---|
| RNF27 | **Mobile-first**, já que a maioria dos clientes reserva pelo celular. |
| RNF28 | Acessibilidade: formulários com labels, navegação por teclado, contraste adequado, erros associados aos campos (referência WCAG 2.1 AA). |
| RNF29 | Interface em pt-BR, com datas no formato `dd/mm/aaaa` e horário 24h. |

### 4.6 Desempenho

| ID | Requisito |
|---|---|
| RNF30 | Consulta de disponibilidade com p95 < 300 ms para até 50 mesas e 30 dias de agenda. Isso vai ser **medido** com um teste de carga simples antes do go-live, e não presumido. |

---

## 5. Fora de escopo

Fica fora da v1, de propósito:

- Múltiplos restaurantes/unidades
- Pagamento, sinal ou pré-autorização
- Mapa visual do salão
- Juntar mesas para grupos grandes (grupo maior que a maior mesa → contato por telefone)
- Lista de espera
- SMS / WhatsApp
- Aplicativo mobile nativo
- Conta de cliente / login social
- Internacionalização

---

## 6. Critérios de "pronto para produção"

- [ ] Todos os requisitos **M** implementados e testados
- [ ] Teste de concorrência da RN02 passando no CI
- [ ] Deploy em produção com HTTPS, no domínio definitivo
- [ ] Backup automático rodando **e** um restore feito com sucesso
- [ ] Monitor de disponibilidade com alerta configurado
- [ ] Envio de e-mail funcionando com domínio verificado (SPF/DKIM)
- [ ] Aviso de privacidade publicado e revisado
- [ ] Usuário admin inicial criado e senha padrão inexistente
- [ ] Teste de carga da RNF30 executado e resultado registrado
- [ ] README com setup local e runbook mínimo (deploy, rollback, restore)

---

## 7. Perguntas em aberto

Precisam de resposta antes ou durante a implementação. Os ⚙️ acima são os palpites iniciais.

1. **Duração da reserva:** 2h serve? Varia por tamanho do grupo?
2. **Turnos:** quais dias e horários reais?
3. **Política de cancelamento:** 2h antes está bom?
4. **E-mail obrigatório?** É o canal do link de gerenciamento. Sem ele, o cliente perde o acesso à reserva.
5. **Provedor de e-mail transacional:** qual? Precisa de domínio próprio com SPF/DKIM.
6. **Hospedagem:** VPS com Docker Compose + Caddy (simples e barato) ou PaaS com Postgres gerenciado (menos operação, mais caro)?
7. **Domínio:** qual vai ser?
8. **Grupos maiores que a maior mesa:** apenas recusar com "ligue para o restaurante" ou registrar como solicitação?
