import { ApiError } from "./api";

const messages: Record<string, string> = {
  no_table_available: "Esse horário acabou de ser ocupado. Escolha outro.",
  invalid_slot: "Horário inválido.",
  closed: "Não abrimos nesse horário.",
  too_soon: "É preciso reservar com pelo menos 1 hora de antecedência.",
  too_far: "Só aceitamos reservas com até 30 dias de antecedência.",
  invalid_body: "Confira os dados informados.",
  invalid_query: "Confira a data e o número de pessoas.",
};

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return messages[error.code] ?? "Algo deu errado. Tente novamente.";
  return "Não foi possível conectar ao servidor. Tente novamente.";
}
