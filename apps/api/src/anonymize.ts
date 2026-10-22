import type pg from "pg";

export const RETENTION_DAYS = 180;

/**
 * LGPD: depois de 180 dias, a reserva perde os dados pessoais. A linha continua (nada é apagado)
 * para as estatísticas, mas nome, telefone, e-mail, observações e o link de gerenciamento somem.
 */
export async function anonymizeOld(pool: pg.Pool, now: Date, days = RETENTION_DAYS) {
  const limit = new Date(now.getTime() - days * 86_400_000);
  const { rowCount } = await pool.query(
    `UPDATE reservations
     SET name = 'Anonimizado', phone = '', email = '', notes = NULL, manage_token_hash = NULL, anonymized_at = $2
     WHERE ends_at < $1 AND anonymized_at IS NULL`,
    [limit, now],
  );
  return rowCount ?? 0;
}
