interface AuthCallbackParams {
  access_token?: string;
  refresh_token?: string;
  type?: string;
  error_description?: string;
}

// Os links de recuperação de senha do Supabase trazem os tokens como fragmento
// (#access_token=...) e não como query string, então não dá pra usar URLSearchParams direto.
export function parseAuthCallbackUrl(url: string): AuthCallbackParams {
  const paramsString = url
    .replace(/^[^?#]*/, '')
    .replace(/^[?#]/, '')
    .replace(/[?#]/g, '&');

  const params: Record<string, string> = {};
  for (const pair of paramsString.split('&')) {
    if (!pair) continue;
    const [key, value] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value ?? '');
  }

  return params;
}
