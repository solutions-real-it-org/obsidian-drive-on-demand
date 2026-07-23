import type { HttpFn } from '../http';

/** Endpoint de tokens OAuth de Google (échange de code + refresh). */
export const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export interface AppCredentials {
  clientId: string;
  clientSecret: string;
}

export interface CodeExchangeCredentials extends AppCredentials {
  redirectUri: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AccessTokenResult {
  accessToken: string;
  expiresIn: number;
}

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function postForm(http: HttpFn, params: Record<string, string>): Promise<GoogleTokenResponse> {
  const res = await http({
    url: TOKEN_ENDPOINT,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const j = res.json<GoogleTokenResponse>();
  if (res.status !== 200) {
    const detail = j.error_description ?? j.error ?? res.text;
    throw new Error(`Google token ${res.status}: ${detail}`);
  }
  return j;
}

/** Échange le code d'autorisation contre un jeu de tokens (mode BYO : identifiants de
 *  l'utilisateur, échange direct avec Google — le broker n'a fait que rebondir le code). */
export async function exchangeCodeForTokens(
  http: HttpFn,
  code: string,
  creds: CodeExchangeCredentials,
): Promise<TokenSet> {
  const j = await postForm(http, {
    grant_type: 'authorization_code',
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: creds.redirectUri,
  });
  return {
    accessToken: j.access_token ?? '',
    refreshToken: j.refresh_token ?? '',
    expiresIn: j.expires_in ?? 0,
  };
}

/** Rafraîchit un access token (mode BYO : appel direct à Google avec les identifiants
 *  de l'utilisateur, sans passer par le broker Real-IT). */
export async function refreshAccessToken(
  http: HttpFn,
  refreshToken: string,
  creds: AppCredentials,
): Promise<AccessTokenResult> {
  const j = await postForm(http, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });
  return { accessToken: j.access_token ?? '', expiresIn: j.expires_in ?? 0 };
}
