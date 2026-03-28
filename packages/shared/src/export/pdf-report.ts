// ---------------------------------------------------------------------------
// PDF Tax Report Generator (HTML placeholder)
// Generates a well-structured HTML document that can be converted to PDF
// via Puppeteer or similar headless browser tooling.
//
// @spec EP-07 — Tax report PDF export
// ---------------------------------------------------------------------------

/**
 * Data structure for the tax report.
 */
export interface TaxReportData {
  /** User's display name */
  userName: string;
  /** Tax year being reported */
  taxYear: number;
  /** Tax lot method used (FIFO / LIFO) */
  method: string;
  /** Total number of on-chain transactions processed */
  totalTransactions: number;
  /** Number of successfully classified transactions */
  classifiedCount: number;
  /** Summary of Section 23 EStG (private disposal gains) */
  paragraph23Summary: {
    totalGainLossEur: string;
    taxableCount: number;
    taxFreeCount: number;
  };
  /** Summary of Section 22 Nr. 3 EStG (other income: staking, LP rewards, etc.) */
  paragraph22Nr3Summary: {
    totalIncomeEur: string;
    stakingEur: string;
    lpRewardsEur: string;
    otherEur: string;
  };
  /** Freigrenze (exemption threshold) status */
  freigrenzeStatus: {
    paragraph23: {
      used: number;
      limit: number;
      remaining: number;
      status: string;
    };
    paragraph22Nr3: {
      used: number;
      limit: number;
      remaining: number;
      status: string;
    };
  };
  /** Transactions that benefited from the 1-year Haltefrist */
  haltefristEntries: Array<{
    txHash: string;
    tokenSymbol: string;
    amount: string;
    acquisitionDate: string;
    disposalDate: string;
    holdingDays: number;
    gainEur: string;
  }>;
  /** Date when the export was generated (DD.MM.YYYY HH:MM:SS) */
  exportDate: string;
  /** Legal disclaimer text */
  disclaimer: string;
}

/**
 * Escapes HTML special characters to prevent XSS in generated reports.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates a well-structured HTML document for the tax report.
 * This HTML can be converted to PDF using Puppeteer or similar tools.
 *
 * Features:
 * - DeFi Tracker branding with dark professional theme
 * - Summary tables for Section 23 and Section 22 Nr. 3
 * - Freigrenze status with color-coded indicators
 * - Haltefrist entries table
 * - Legal disclaimer (German)
 *
 * @param data - Tax report data
 * @returns Complete HTML document string
 */
export function generateTaxReportHtml(data: TaxReportData): string {
  const safeUserName = escapeHtml(data.userName);
  const safeMethod = escapeHtml(data.method);
  const safeExportDate = escapeHtml(data.exportDate);

  const haltefristRows = data.haltefristEntries
    .map(
      (entry) => `
        <tr>
          <td title="${escapeHtml(entry.txHash)}">${escapeHtml(entry.txHash.slice(0, 10))}...</td>
          <td>${escapeHtml(entry.tokenSymbol)}</td>
          <td>${escapeHtml(entry.amount)}</td>
          <td>${escapeHtml(entry.acquisitionDate)}</td>
          <td>${escapeHtml(entry.disposalDate)}</td>
          <td>${entry.holdingDays}</td>
          <td>${escapeHtml(entry.gainEur)}</td>
        </tr>`,
    )
    .join('\n');

  const freigrenzeP23Status = data.freigrenzeStatus.paragraph23.status;
  const freigrenzeP22Status = data.freigrenzeStatus.paragraph22Nr3.status;

  const statusColor = (status: string): string => {
    switch (status.toUpperCase()) {
      case 'GREEN':
        return '#22c55e';
      case 'YELLOW':
        return '#eab308';
      case 'RED':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const disclaimer =
    data.disclaimer ||
    'Dieses Dokument ersetzt keine professionelle Steuerberatung. Bitte konsultieren Sie einen Steuerberater.';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DeFi Tracker - Steuerbericht ${data.taxYear}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #0f172a;
      color: #e2e8f0;
      font-size: 14px;
      line-height: 1.6;
      padding: 40px;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      background-color: #1e293b;
      border-radius: 12px;
      padding: 48px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    }

    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 2px solid #334155;
      padding-bottom: 24px;
    }

    .header h1 {
      font-size: 28px;
      font-weight: 700;
      color: #38bdf8;
      margin-bottom: 4px;
    }

    .header .brand {
      font-size: 14px;
      color: #64748b;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .header .subtitle {
      font-size: 18px;
      color: #94a3b8;
      margin-top: 12px;
    }

    .meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 32px;
      padding: 16px;
      background-color: #0f172a;
      border-radius: 8px;
    }

    .meta-item {
      text-align: center;
    }

    .meta-item .label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .meta-item .value {
      font-size: 16px;
      font-weight: 600;
      color: #f1f5f9;
      margin-top: 4px;
    }

    h2 {
      font-size: 20px;
      font-weight: 600;
      color: #38bdf8;
      margin-bottom: 16px;
      margin-top: 32px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }

    th {
      background-color: #0f172a;
      color: #94a3b8;
      font-weight: 600;
      text-align: left;
      padding: 12px 16px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    td {
      padding: 10px 16px;
      border-bottom: 1px solid #334155;
      color: #cbd5e1;
    }

    tr:hover td {
      background-color: #263449;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 32px;
    }

    .summary-card {
      background-color: #0f172a;
      border-radius: 8px;
      padding: 20px;
      border: 1px solid #334155;
    }

    .summary-card h3 {
      font-size: 14px;
      color: #94a3b8;
      margin-bottom: 12px;
    }

    .summary-card .amount {
      font-size: 24px;
      font-weight: 700;
      color: #f1f5f9;
    }

    .summary-card .detail {
      font-size: 12px;
      color: #64748b;
      margin-top: 8px;
    }

    .freigrenze-bar {
      height: 8px;
      background-color: #334155;
      border-radius: 4px;
      margin-top: 12px;
      overflow: hidden;
    }

    .freigrenze-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .status-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      color: #0f172a;
    }

    .disclaimer {
      margin-top: 40px;
      padding: 20px;
      background-color: #1a1a2e;
      border-left: 4px solid #eab308;
      border-radius: 4px;
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.8;
    }

    .footer {
      text-align: center;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #334155;
      font-size: 12px;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">DeFi Tracker by NextGen IT Solutions</div>
      <h1>Steuerbericht ${data.taxYear}</h1>
      <div class="subtitle">On-Chain Tax Intelligence &mdash; Flare Network</div>
    </div>

    <div class="meta">
      <div class="meta-item">
        <div class="label">Steuerpflichtiger</div>
        <div class="value">${safeUserName}</div>
      </div>
      <div class="meta-item">
        <div class="label">Steuerjahr</div>
        <div class="value">${data.taxYear}</div>
      </div>
      <div class="meta-item">
        <div class="label">Methode</div>
        <div class="value">${safeMethod}</div>
      </div>
      <div class="meta-item">
        <div class="label">Erstellt am</div>
        <div class="value">${safeExportDate}</div>
      </div>
    </div>

    <div class="meta" style="justify-content: space-around;">
      <div class="meta-item">
        <div class="label">Transaktionen gesamt</div>
        <div class="value">${data.totalTransactions}</div>
      </div>
      <div class="meta-item">
        <div class="label">Klassifiziert</div>
        <div class="value">${data.classifiedCount}</div>
      </div>
      <div class="meta-item">
        <div class="label">Klassifizierungsrate</div>
        <div class="value">${data.totalTransactions > 0 ? Math.round((data.classifiedCount / data.totalTransactions) * 100) : 0}%</div>
      </div>
    </div>

    <h2>&sect; 23 EStG &mdash; Private Ver&auml;u&szlig;erungsgesch&auml;fte</h2>
    <div class="summary-grid">
      <div class="summary-card">
        <h3>Gesamtergebnis</h3>
        <div class="amount">${escapeHtml(data.paragraph23Summary.totalGainLossEur)} EUR</div>
        <div class="detail">
          Steuerpflichtig: ${data.paragraph23Summary.taxableCount} |
          Steuerfrei (Haltefrist): ${data.paragraph23Summary.taxFreeCount}
        </div>
      </div>
      <div class="summary-card">
        <h3>Freigrenze &sect; 23 (${data.freigrenzeStatus.paragraph23.limit} EUR)</h3>
        <div class="amount">${data.freigrenzeStatus.paragraph23.used.toFixed(2)} EUR</div>
        <div class="detail">
          Verbleibend: ${data.freigrenzeStatus.paragraph23.remaining.toFixed(2)} EUR
          <span class="status-badge" style="background-color: ${statusColor(freigrenzeP23Status)};">${escapeHtml(freigrenzeP23Status)}</span>
        </div>
        <div class="freigrenze-bar">
          <div class="freigrenze-fill" style="width: ${Math.min((data.freigrenzeStatus.paragraph23.used / data.freigrenzeStatus.paragraph23.limit) * 100, 100)}%; background-color: ${statusColor(freigrenzeP23Status)};"></div>
        </div>
      </div>
    </div>

    <h2>&sect; 22 Nr. 3 EStG &mdash; Sonstige Eink&uuml;nfte</h2>
    <div class="summary-grid">
      <div class="summary-card">
        <h3>Gesamteink&uuml;nfte</h3>
        <div class="amount">${escapeHtml(data.paragraph22Nr3Summary.totalIncomeEur)} EUR</div>
        <div class="detail">
          Staking: ${escapeHtml(data.paragraph22Nr3Summary.stakingEur)} EUR |
          LP Rewards: ${escapeHtml(data.paragraph22Nr3Summary.lpRewardsEur)} EUR |
          Sonstige: ${escapeHtml(data.paragraph22Nr3Summary.otherEur)} EUR
        </div>
      </div>
      <div class="summary-card">
        <h3>Freigrenze &sect; 22 Nr. 3 (${data.freigrenzeStatus.paragraph22Nr3.limit} EUR)</h3>
        <div class="amount">${data.freigrenzeStatus.paragraph22Nr3.used.toFixed(2)} EUR</div>
        <div class="detail">
          Verbleibend: ${data.freigrenzeStatus.paragraph22Nr3.remaining.toFixed(2)} EUR
          <span class="status-badge" style="background-color: ${statusColor(freigrenzeP22Status)};">${escapeHtml(freigrenzeP22Status)}</span>
        </div>
        <div class="freigrenze-bar">
          <div class="freigrenze-fill" style="width: ${Math.min((data.freigrenzeStatus.paragraph22Nr3.used / data.freigrenzeStatus.paragraph22Nr3.limit) * 100, 100)}%; background-color: ${statusColor(freigrenzeP22Status)};"></div>
        </div>
      </div>
    </div>

    <h2>Haltefrist-Eintr&auml;ge (steuerfrei nach &gt; 365 Tage)</h2>
    ${
      data.haltefristEntries.length > 0
        ? `<table>
      <thead>
        <tr>
          <th>TX-Hash</th>
          <th>Token</th>
          <th>Menge</th>
          <th>Erwerb</th>
          <th>Ver&auml;u&szlig;erung</th>
          <th>Haltetage</th>
          <th>Gewinn (EUR)</th>
        </tr>
      </thead>
      <tbody>
        ${haltefristRows}
      </tbody>
    </table>`
        : '<p style="color: #64748b; margin-bottom: 24px;">Keine steuerfreien Haltefrist-Transaktionen im Berichtszeitraum.</p>'
    }

    <div class="disclaimer">
      <strong>Hinweis:</strong> ${escapeHtml(disclaimer)}
    </div>

    <div class="footer">
      DeFi Tracker &mdash; On-Chain Tax Intelligence for Flare Network<br>
      &copy; ${data.taxYear} NextGen IT Solutions GmbH, Stuttgart<br>
      Erstellt am ${safeExportDate}
    </div>
  </div>
</body>
</html>`;
}
