import { ApiError } from "./api";

const messages: Record<string, string> = {
  no_table_available: "Esse horário acabou de ser ocupado. Escolha outro.",
  already_reserved: "Já existe uma reserva ativa com esse e-mail ou telefone nesse turno.",
  invalid_slot: "Horário inválido.",
  closed: "Não abrimos nesse horário.",
  too_soon: "É preciso reservar com pelo menos 1 hora de antecedência.",
  too_far: "Só aceitamos reservas com até 30 dias de antecedência.",
  invalid_body: "Confira os dados informados.",
  invalid_query: "Confira a data e o número de pessoas.",
  too_late_to_cancel: "O prazo para cancelar pelo link já passou. Fale com o restaurante.",
  not_active: "Essa reserva não está mais ativa.",
  not_found: "Não encontramos essa reserva.",
  invalid_credentials: "E-mail ou senha incorretos.",
  unauthorized: "Sua sessão expirou. Entre novamente.",
  table_unavailable: "Essa mesa está ocupada nesse horário ou foi desativada.",
  table_too_small: "A mesa não comporta esse número de pessoas.",
  not_editable: "Só reservas confirmadas podem ser alteradas.",
  number_taken: "Já existe uma mesa com esse número.",
};

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 429) return "Muitas tentativas. Aguarde um minuto e tente de novo.";
    return messages[error.code] ?? "Algo deu errado. Tente novamente.";
  }
  return "Não foi possível conectar ao servidor. Tente novamente.";
}
