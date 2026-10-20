# Requisitos — v1

Objetivo: um restaurante real recebendo reservas em produção.
⚙️ = valor configurável e ainda a confirmar com o restaurante.

## Atores

- **Cliente:** não tem conta. Gerencia a reserva por um link secreto enviado por e-mail.
- **Equipe:** entra com e-mail e senha. Há um papel só na v1.

## Regras de negócio

1. A reserva tem início e fim. Duração: **2h** ⚙️.
2. **Duas reservas ativas não se sobrepõem na mesma mesa.** Quem garante é o banco, não o código.
3. Os inícios vão de **30 em 30 min** ⚙️.
4. A reserva cabe inteira em um turno de funcionamento ⚙️.
5. Antecedência mínima de **1h** ⚙️ e máxima de **30 dias** ⚙️. Nada no passado.
6. **O cliente não escolhe a mesa.** O sistema atribui a menor mesa livre que comporte o grupo. A equipe pode trocar.
7. O número de pessoas não pode passar da capacidade da mesa.
8. Mesa desativada e data bloqueada não recebem reservas novas. As reservas já existentes aparecem para a equipe tratar.
9. O cliente cancela até **2h antes** ⚙️. A equipe cancela quando quiser.
10. Cada contato tem no máximo **1 reserva ativa por turno** ⚙️.
11. Nada é apagado. Status possíveis: `confirmada`, `cancelada`, `concluida`, `nao_compareceu`.
12. O banco guarda horários em UTC e a interface exibe em `America/Sao_Paulo` ⚙️.

## Funcionalidades

**Obrigatório para produção**

- Cliente: ver horários livres, reservar, receber e-mail de confirmação, cancelar pelo link.
- Equipe: login, agenda do dia, busca e filtros, criar e editar reserva (inclusive trocar mesa), cancelar, marcar concluída ou não compareceu, CRUD de mesas.

**Depois, se der tempo:** cliente alterar a reserva pelo link, lembrete por e-mail, datas bloqueadas e turnos editáveis na interface, gestão de usuários, histórico de alterações.

## Não funcionais

- **Segurança:** HTTPS; front e API no mesmo domínio (sem CORS); senha com argon2id; cookie `HttpOnly`/`Secure`/`SameSite`; rate limit no login, na reserva e na consulta de disponibilidade; token do link com 128 bits ou mais, guardado só o hash; segredos em variáveis de ambiente.
- **LGPD:** coletar só nome, telefone e e-mail; aviso de privacidade; anonimizar após **180 dias** ⚙️; logs sem dado pessoal.
- **Operação:** backup diário com restore testado; migrations rodando no deploy; `/api/health`; logs em JSON; monitor com alerta. Falha no envio de e-mail não desfaz a reserva.
- **Qualidade:** CI em todo PR (lint, typecheck, teste, build). Toda regra de negócio tem teste. Um teste de concorrência obrigatório: N reservas simultâneas para a mesma mesa resultam em exatamente 1 sucesso.
- **Interface:** mobile-first, acessível, em pt-BR.
- **Desempenho:** disponibilidade com p95 < 300 ms para 50 mesas. Medido, não presumido.

## Fora da v1

Multi-restaurante, pagamento, mapa do salão, juntar mesas, lista de espera, SMS/WhatsApp, app nativo, conta de cliente.

## Pronto para produção quando

- [ ] Tudo o que é obrigatório funciona e tem teste
- [ ] O teste de concorrência passa no CI
- [ ] Está no ar com HTTPS no domínio final
- [ ] Um backup foi restaurado com sucesso pelo menos uma vez
- [ ] O monitor tem alerta configurado
- [ ] O e-mail sai com SPF/DKIM configurados
- [ ] O aviso de privacidade está publicado
- [ ] O README explica setup, deploy, rollback e restore

## Em aberto

1. Duração da reserva e turnos reais de funcionamento
2. Política de cancelamento
3. Provedor de e-mail e domínio
4. Hospedagem: VPS com Docker Compose ou serviço gerenciado (PaaS)
5. O que fazer com grupo maior que a maior mesa
