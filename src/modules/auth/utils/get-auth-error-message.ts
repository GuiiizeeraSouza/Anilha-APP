import { isAuthApiError } from '@supabase/supabase-js';

// Códigos de erro do GoTrue (Supabase Auth): https://supabase.com/docs/guides/auth/debugging/error-codes
const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.',
  user_already_exists: 'Já existe uma conta com este e-mail.',
  email_exists: 'Já existe uma conta com este e-mail.',
  user_not_found: 'Usuário não encontrado.',
  weak_password: 'Senha muito fraca. Escolha uma senha mais forte.',
  same_password: 'A nova senha deve ser diferente da senha atual.',
  over_email_send_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  email_address_invalid: 'E-mail inválido.',
  email_address_not_authorized: 'Este e-mail não tem permissão para se cadastrar.',
  signup_disabled: 'O cadastro de novas contas está desativado no momento.',
  user_banned: 'Esta conta foi suspensa.',
  session_expired: 'Sua sessão expirou. Faça login novamente.',
  session_not_found: 'Sua sessão expirou. Faça login novamente.',
  refresh_token_not_found: 'Sua sessão expirou. Faça login novamente.',
  refresh_token_already_used: 'Sua sessão expirou. Faça login novamente.',
  captcha_failed: 'Falha na verificação de segurança. Tente novamente.',
  validation_failed: 'Dados inválidos. Verifique os campos e tente novamente.',
  request_timeout: 'A solicitação demorou demais. Verifique sua conexão e tente novamente.',
  bad_json: 'Não foi possível processar a solicitação. Tente novamente.',
};

export function getAuthErrorMessage(error: unknown): string {
  if (isAuthApiError(error) && error.code && ERROR_MESSAGES[error.code]) {
    return ERROR_MESSAGES[error.code];
  }

  if (error instanceof Error && /network/i.test(error.message)) {
    return 'Falha de conexão. Verifique sua internet e tente novamente.';
  }

  return 'Ocorreu um erro inesperado. Tente novamente.';
}
