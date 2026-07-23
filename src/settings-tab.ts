import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type GoogleDriveFodPlugin from './main';
import { t } from './i18n';

/** Onglet de réglages : tout se fait ici (connexion, ouverture du panneau, sync manuelle),
 *  sans passer par des commandes. L'installation se résume à « connecter mon compte ». */
export class DriveOnDemandSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: GoogleDriveFodPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // --- Compte Google ---
    const account = new Setting(containerEl)
      .setName(t('settings.accountName'))
      .setDesc(t('settings.accountChecking'));

    void this.renderAccount(account);

    // --- Ouvrir le panneau ---
    new Setting(containerEl)
      .setName(t('settings.openPanelName'))
      .setDesc(t('settings.openPanelDesc'))
      .addButton((b) =>
        b.setButtonText(t('settings.openPanel')).onClick(() => {
          void this.plugin.openPanel();
        }),
      );

    // --- Synchroniser maintenant ---
    new Setting(containerEl)
      .setName(t('settings.syncNowName'))
      .setDesc(t('settings.syncNowDesc'))
      .addButton((b) =>
        b.setButtonText(t('settings.syncNow')).onClick(async () => {
          b.setDisabled(true);
          try {
            await this.plugin.syncNow();
            new Notice(t('settings.syncNowDone'));
          } catch (e) {
            new Notice(t('settings.syncNowError', { error: String(e) }));
          } finally {
            b.setDisabled(false);
          }
        }),
      );
  }

  /** Remplit la ligne « Compte » selon l'état de connexion (async : lit le token + l'email). */
  private async renderAccount(account: Setting): Promise<void> {
    const connected = await this.plugin.isConnected();
    account.clear();

    if (!connected) {
      account
        .setName(t('settings.accountName'))
        .setDesc(t('settings.accountNotConnected'))
        .addButton((b) =>
          b
            .setButtonText(t('settings.connect'))
            .setCta()
            .onClick(() => {
              this.plugin.startAuth();
              new Notice(t('settings.connectStarted'));
            }),
        );
      return;
    }

    let email = '';
    try {
      email = (await this.plugin.accountEmail()) ?? '';
    } catch {
      /* hors-ligne : on affiche « connecté » sans l'email */
    }
    account
      .setName(t('settings.accountName'))
      .setDesc(email ? t('settings.accountConnected', { email }) : t('settings.accountConnectedNoEmail'))
      .addButton((b) =>
        b
          .setButtonText(t('settings.disconnect'))
          .setWarning()
          .onClick(async () => {
            await this.plugin.disconnect();
            new Notice(t('settings.disconnected'));
            this.display();
          }),
      );
  }
}
