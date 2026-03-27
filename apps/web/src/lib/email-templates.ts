// ---------------------------------------------------------------------------
// German-language HTML email templates — professional dark theme, inline CSS
// ---------------------------------------------------------------------------

/** Shared wrapper that applies dark-theme branding to all emails. */
function wrapLayout(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DeFi Tracker</title>
</head>
<body style="margin:0;padding:0;background-color:#0f1117;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e4e4e7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f1117;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#18181b;border-radius:12px;border:1px solid #27272a;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 16px;text-align:center;border-bottom:1px solid #27272a;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#f4f4f5;">DeFi Tracker</h1>
              <p style="margin:4px 0 0;font-size:13px;color:#71717a;">On-Chain Tax Intelligence</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 32px;text-align:center;border-top:1px solid #27272a;">
              <p style="margin:0;font-size:12px;color:#52525b;">
                NextGen IT Solutions GmbH &middot; Stuttgart, Deutschland<br />
                <a href="https://app.defi.nextgenitsolutions.de" style="color:#6366f1;text-decoration:none;">app.defi.nextgenitsolutions.de</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 1. Export Completed
// ---------------------------------------------------------------------------

export function exportCompletedEmail(params: {
  userName: string;
  taxYear: number;
  format: string;
}): { subject: string; html: string } {
  const subject = `Dein ${params.format}-Export f\u00fcr ${params.taxYear} ist fertig`;
  const html = wrapLayout(`
    <p style="margin:0 0 16px;font-size:16px;color:#f4f4f5;">Hallo ${params.userName},</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#a1a1aa;">
      Dein <strong style="color:#f4f4f5;">${params.format}</strong>-Export f\u00fcr das Steuerjahr
      <strong style="color:#f4f4f5;">${params.taxYear}</strong> wurde erfolgreich erstellt und steht
      zum Download bereit.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
      <tr>
        <td style="background-color:#6366f1;border-radius:8px;">
          <a href="https://app.defi.nextgenitsolutions.de/dashboard/exports"
             style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
            Export herunterladen
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#71717a;">
      Falls du diese E-Mail nicht erwartet hast, kannst du sie ignorieren.
    </p>
  `);
  return { subject, html };
}

// ---------------------------------------------------------------------------
// 2. Sync Error
// ---------------------------------------------------------------------------

export function syncErrorEmail(params: {
  userName: string;
  walletAddress: string;
  errorMessage: string;
}): { subject: string; html: string } {
  const shortAddr = `${params.walletAddress.slice(0, 6)}...${params.walletAddress.slice(-4)}`;
  const subject = `Synchronisierungsfehler bei Wallet ${shortAddr}`;
  const html = wrapLayout(`
    <p style="margin:0 0 16px;font-size:16px;color:#f4f4f5;">Hallo ${params.userName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#a1a1aa;">
      Bei der Synchronisierung deiner Wallet ist ein Fehler aufgetreten:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="background-color:#1c1c22;border-radius:8px;padding:16px;border:1px solid #27272a;">
          <p style="margin:0 0 8px;font-size:13px;color:#71717a;">Wallet</p>
          <p style="margin:0 0 12px;font-size:14px;font-family:monospace;color:#f4f4f5;word-break:break-all;">
            ${params.walletAddress}
          </p>
          <p style="margin:0 0 8px;font-size:13px;color:#71717a;">Fehler</p>
          <p style="margin:0;font-size:14px;color:#ef4444;">
            ${params.errorMessage}
          </p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#a1a1aa;">
      Du kannst die Synchronisierung erneut starten oder den Support kontaktieren.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
      <tr>
        <td style="background-color:#6366f1;border-radius:8px;">
          <a href="https://app.defi.nextgenitsolutions.de/dashboard/wallets"
             style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
            Wallets verwalten
          </a>
        </td>
      </tr>
    </table>
  `);
  return { subject, html };
}

// ---------------------------------------------------------------------------
// 3. Tax Reminder
// ---------------------------------------------------------------------------

export function taxReminderEmail(params: {
  userName: string;
  taxYear: number;
  deadline: string;
}): { subject: string; html: string } {
  const subject = `Erinnerung: Steuererkl\u00e4rung ${params.taxYear} bis ${params.deadline}`;
  const html = wrapLayout(`
    <p style="margin:0 0 16px;font-size:16px;color:#f4f4f5;">Hallo ${params.userName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#a1a1aa;">
      Die Abgabefrist f\u00fcr die Steuererkl\u00e4rung <strong style="color:#f4f4f5;">${params.taxYear}</strong>
      endet am <strong style="color:#f4f4f5;">${params.deadline}</strong>.
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#a1a1aa;">
      Stelle sicher, dass alle Wallets synchronisiert sind und dein CoinTracking-Export
      auf dem neuesten Stand ist. Erstelle jetzt deinen Export, um vorbereitet zu sein.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
      <tr>
        <td style="background-color:#6366f1;border-radius:8px;">
          <a href="https://app.defi.nextgenitsolutions.de/dashboard/exports"
             style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
            Export erstellen
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#71717a;">
      Dieses Dokument ersetzt keine professionelle Steuerberatung.
      Bitte konsultiere einen Steuerberater.
    </p>
  `);
  return { subject, html };
}
