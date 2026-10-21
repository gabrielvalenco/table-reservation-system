# ADR 002 — Hospedagem

**Status:** aceita · 2026-10-21

## Decisão

VPS própria, de preferência em região de São Paulo, rodando Docker Compose (API + Postgres) com Caddy na frente.

## Por quê

- Um restaurante, poucas reservas por dia: 1–2 vCPU e 2 GB de RAM sobram.
- Custa uma fração de uma PaaS com Postgres gerenciado.
- O mesmo Compose de dev vira a base da produção.
- Caddy faz HTTPS automático e serve front e API no mesmo domínio.

## Custo

A operação fica com a gente: atualizar o SO, configurar firewall e acesso SSH só por chave, manter backup **fora da VPS** com restore testado e monitorar a disponibilidade.

## Descartado

- **PaaS (Render, Railway, Fly.io):** menos operação, mais caro. Volta à mesa se ninguém puder cuidar do servidor.
