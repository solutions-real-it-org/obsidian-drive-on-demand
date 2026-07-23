// Interfaces étroites (testabilité) — satisfaites structurellement par PullManager/PushManager.
interface SchedulerPull {
  refreshFile(path: string): Promise<unknown>;
}
interface SchedulerPush {
  flushPending(): Promise<void>;
}

export interface SyncSchedulerOptions {
  pull: SchedulerPull;
  push: SchedulerPush;
  /** Chemins des notes actuellement OUVERTES dans l'espace de travail (déjà normalisés NFC). */
  getOpenPaths: () => string[];
  /** Vrai si le chemin est une note synchronisée (sinon rien à tirer). */
  isSynced: (path: string) => boolean;
  isOnline: () => boolean;
  intervalMs?: number;
  onError?: (err: unknown) => void;
}

/** Synchronisation périodique CIBLÉE :
 *  - local → Drive : renvoie les modifs locales en attente (livret, résilience hors-ligne).
 *  - Drive → local : rafraîchit UNIQUEMENT les notes actuellement ouvertes (et synchronisées),
 *    pour qu'une note affichée reflète une édition faite ailleurs — sans scanner tout le reste.
 *  Les autres notes sont rafraîchies à leur ouverture (pull-on-open). Pausé hors-ligne. */
export class SyncScheduler {
  private running = false;
  private timer?: ReturnType<typeof setInterval>;

  constructor(private opts: SyncSchedulerOptions) {}

  async tick(): Promise<void> {
    if (this.running || !this.opts.isOnline()) return;
    this.running = true;
    try {
      await this.opts.push.flushPending(); // local → Drive (rattrapage hors-ligne)
      for (const path of this.opts.getOpenPaths()) {
        if (this.opts.isSynced(path)) await this.opts.pull.refreshFile(path);
      }
    } catch (e) {
      this.opts.onError?.(e); // ex. bascule hors-ligne en plein tick — le tick suivant réessaie
    } finally {
      this.running = false;
    }
  }

  /** Démarre la minuterie (+ un tick immédiat). */
  start(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.opts.intervalMs ?? 5000);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
