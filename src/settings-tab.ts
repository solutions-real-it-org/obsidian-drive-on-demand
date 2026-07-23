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

    // --- Mode avancé : BYO credentials ---
    this.renderByo(containerEl);
  }

  /** Section « mode avancé » : identifiants Google personnels de l'utilisateur (lève le cap 100). */
  private renderByo(containerEl: HTMLElement): void {
    new Setting(containerEl).setName(t('settings.advancedHeading')).setHeading();

    const current = this.plugin.getByoConfig();
    const desc = containerEl.createEl('p', { text: t('settings.byoDesc') });
    desc.addClass('setting-item-description');
    containerEl.createEl('p', {
      text: current ? t('settings.byoStatusActive', { clientId: current.clientId }) : t('settings.byoStatusManaged'),
    }).addClass('setting-item-description');

    // URI de redirection à recopier dans le projet Google Cloud de l'utilisateur.
    new Setting(containerEl)
      .setName(t('settings.byoRedirectLabel'))
      .setDesc(t('settings.byoRedirectDesc'))
      .addText((text) => {
        text.setValue(this.plugin.byoRedirectUri());
        text.inputEl.readOnly = true;
        text.inputEl.style.width = '100%';
      });

    let clientId = current?.clientId ?? '';
    let clientSecret = '';
    new Setting(containerEl)
      .setName(t('settings.byoClientId'))
      .addText((text) => text.setValue(clientId).onChange((v) => { clientId = v; }));
    new Setting(containerEl)
      .setName(t('settings.byoClientSecret'))
      .addText((text) => {
        text.setPlaceholder(t('settings.byoClientSecretPlaceholder')).onChange((v) => { clientSecret = v; });
        text.inputEl.type = 'password';
      });

    new Setting(containerEl)
      .addButton((b) =>
        b.setButtonText(t('settings.byoSave')).setCta().onClick(async () => {
          if (!clientId.trim() || !clientSecret.trim()) { new Notice(t('settings.byoMissing')); return; }
          await this.plugin.setByoConfig({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
          new Notice(t('settings.byoSaved'));
          this.display();
        }),
      )
      .then((setting) => {
        if (!current) return;
        setting.addButton((b) =>
          b.setButtonText(t('settings.byoClear')).setWarning().onClick(async () => {
            await this.plugin.clearByoConfig();
            new Notice(t('settings.byoCleared'));
            this.display();
          }),
        );
      });
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
