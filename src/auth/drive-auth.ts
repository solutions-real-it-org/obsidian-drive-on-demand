import type { HttpFn } from '../http';
import type { TokenStore } from './token-store';
import { refreshAccessToken, type AppCredentials } from './google-oauth';

interface RefreshResponse { access_token: string; expires_in: number }

export interface DriveAuthOptions {
  http: HttpFn;
  store: TokenStore;
  brokerBase: string;
  /** Mode BYO : si des identifiants Google de l'utilisateur sont configurés, le refresh
   *  se fait DIRECTEMENT chez Google (jamais via le broker). null/absent => broker Real-IT. */
  byoCredentials?: () => AppCredentials | null;
}

/** Fournit un access token Google valide. Le refresh (et donc le client_secret)
 *  est délégué au broker srv0 : le plugin n'échange jamais directement avec Google. */
export class ObsidianDriveAuth {
  private cached: { value: string; exp: number } | null = null;

  constructor(private opts: DriveAuthOptions) {}

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cached && this.cached.exp - 60_000 > now) return this.cached.value;

    const refresh = await this.opts.store.getRefresh();
    if (!refresh) throw new Error('NEED_INTERACTIVE_AUTH');

    const byo = this.opts.byoCredentials?.() ?? null;

    // Mode BYO : appel direct à Google avec les identifiants de l'utilisateur.
    if (byo) {
      try {
        const r = await refreshAccessToken(this.opts.http, refresh, byo);
        this.cached = { value: r.accessToken, exp: Date.now() + r.expiresIn * 1000 };
        return r.accessToken;
      } catch {
        await this.opts.store.clear();
        this.cached = null;
        throw new Error('NEED_INTERACTIVE_AUTH');
      }
    }

    // Mode managé : le broker Real-IT détient le client_secret et fait le refresh.
    const res = await this.opts.http({
      url: `${this.opts.brokerBase}/refresh`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (res.status !== 200) {
      // Refresh invalide/révoqué → on force une nouvelle auth interactive.
      await this.opts.store.clear();
      this.cached = null;
      throw new Error('NEED_INTERACTIVE_AUTH');
    }
    const j = res.json<RefreshResponse>();
    this.cached = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
    return j.access_token;
  }

  async setRefreshFromClaim(refreshToken: string): Promise<void> {
    await this.opts.store.setRefresh(refreshToken);
    this.cached = null;
  }

  /** Un compte est-il connecté (refresh token présent) ? Utilisé par l'onglet de réglages. */
  async isConnected(): Promise<boolean> {
    return (await this.opts.store.getRefresh()) !== null;
  }

  /** Déconnecte le compte : oublie le refresh token et le cache d'access token. */
  async disconnect(): Promise<void> {
    await this.opts.store.clear();
    this.cached = null;
  }
}
