ALTER TABLE reservations
  ADD COLUMN manage_token_hash text UNIQUE,
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancelled_by text CHECK (cancelled_by IN ('customer', 'staff')),
  ADD COLUMN anonymized_at timestamptz;

-- Cada contato tem no máximo 1 reserva ativa por turno (almoço: antes das 17h, jantar: a partir das 17h,
-- no horário de São Paulo). Vale por e-mail e por telefone, para não bastar trocar um dos dois.
CREATE UNIQUE INDEX reservations_one_per_email_shift ON reservations (
  lower(email),
  ((starts_at AT TIME ZONE 'America/Sao_Paulo')::date),
  ((extract(hour FROM starts_at AT TIME ZONE 'America/Sao_Paulo') < 17))
) WHERE status = 'confirmed' AND anonymized_at IS NULL;

CREATE UNIQUE INDEX reservations_one_per_phone_shift ON reservations (
  (nullif(regexp_replace(phone, '\D', '', 'g'), '')),
  ((starts_at AT TIME ZONE 'America/Sao_Paulo')::date),
  ((extract(hour FROM starts_at AT TIME ZONE 'America/Sao_Paulo') < 17))
) WHERE status = 'confirmed' AND anonymized_at IS NULL;
