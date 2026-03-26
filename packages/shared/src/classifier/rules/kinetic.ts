// ---------------------------------------------------------------------------
// Kinetic Market — Transaction Classification Rules
// ---------------------------------------------------------------------------
// Classifies decoded events from Kinetic Market (Compound V2 fork on Flare).
// Covers lending supply/withdraw, borrow/repay, liquidations, interest
// accrual, and kToken transfers.
// ---------------------------------------------------------------------------

import type { DecodedEvent, ClassificationResult } from '../types';

/**
 * Classify a decoded event from Kinetic Market.
 *
 * @param event - The decoded on-chain event.
 * @returns A ClassificationResult, or null if the event is not from Kinetic Market.
 */
export function classifyKinetic(event: DecodedEvent): ClassificationResult | null {
  const proto = event.protocol?.toLowerCase() ?? '';
  if (!proto.includes('kinetic')) {
    return null;
  }

  const name = event.eventName;

  switch (name) {
    // -----------------------------------------------------------------
    // Supply — Lending deposit, GRAY (tax neutral at time of deposit)
    // The deposit itself is not a disposal — the user retains economic
    // ownership. kTokens received are merely receipts.
    // -----------------------------------------------------------------
    case 'Mint':
    case 'Supply':
      return {
        ctType: 'Deposit',
        buyAmount: stringOrNull(event.args['mintTokens'] ?? event.args['cTokens']),
        buyCurrency: stringOrNull(event.args['cToken'] ?? event.args['kToken']),
        sellAmount: stringOrNull(event.args['mintAmount'] ?? event.args['underlyingAmount']),
        sellCurrency: stringOrNull(event.args['underlying'] ?? event.args['token']),
        fee: null,
        feeCurrency: null,
        exchange: 'Kinetic Market',
        tradeGroup: 'Lending',
        ampelStatus: 'GRAY',
        isGraubereich: false,
        modelChoice: null,
        comment:
          'Kinetic Market Einzahlung — steuerlich neutral zum Zeitpunkt der Einlage. ' +
          'Kein Tausch, wirtschaftliches Eigentum bleibt beim Nutzer. ' +
          'kToken ist lediglich Quittung/Empfangsbestaetigung.',
      };

    // -----------------------------------------------------------------
    // Withdraw — Remove from lending, GRAY (tax neutral)
    // -----------------------------------------------------------------
    case 'Redeem':
    case 'Withdraw':
      return {
        ctType: 'Withdrawal',
        buyAmount: stringOrNull(event.args['redeemAmount'] ?? event.args['underlyingAmount']),
        buyCurrency: stringOrNull(event.args['underlying'] ?? event.args['token']),
        sellAmount: stringOrNull(event.args['redeemTokens'] ?? event.args['cTokens']),
        sellCurrency: stringOrNull(event.args['cToken'] ?? event.args['kToken']),
        fee: null,
        feeCurrency: null,
        exchange: 'Kinetic Market',
        tradeGroup: 'Lending',
        ampelStatus: 'GRAY',
        isGraubereich: false,
        modelChoice: null,
        comment:
          'Kinetic Market Auszahlung — steuerlich neutrale Rueckgabe der Einlage. ' +
          'Differenz zum Einzahlungsbetrag (Zinsen) separat als Einkuenfte zu erfassen.',
      };

    // -----------------------------------------------------------------
    // Borrow — Neutral transfer (loan received), GRAY
    // Receiving a loan is not taxable income.
    // -----------------------------------------------------------------
    case 'Borrow':
      return {
        ctType: 'Other',
        buyAmount: stringOrNull(event.args['borrowAmount'] ?? event.args['amount']),
        buyCurrency: stringOrNull(event.args['underlying'] ?? event.args['token']),
        sellAmount: null,
        sellCurrency: null,
        fee: null,
        feeCurrency: null,
        exchange: 'Kinetic Market',
        tradeGroup: 'Lending',
        ampelStatus: 'GRAY',
        isGraubereich: false,
        modelChoice: null,
        comment:
          'Kinetic Market Kreditaufnahme (Borrow) — steuerlich neutral. ' +
          'Darlehensaufnahme ist kein steuerbarer Vorgang. Zinszahlungen separat erfassen.',
      };

    // -----------------------------------------------------------------
    // Repay — Neutral transfer (loan repaid), GRAY
    // Repaying a loan is not a taxable event.
    // -----------------------------------------------------------------
    case 'RepayBorrow':
    case 'Repay':
      return {
        ctType: 'Other',
        buyAmount: null,
        buyCurrency: null,
        sellAmount: stringOrNull(event.args['repayAmount'] ?? event.args['amount']),
        sellCurrency: stringOrNull(event.args['underlying'] ?? event.args['token']),
        fee: null,
        feeCurrency: null,
        exchange: 'Kinetic Market',
        tradeGroup: 'Lending',
        ampelStatus: 'GRAY',
        isGraubereich: false,
        modelChoice: null,
        comment:
          'Kinetic Market Kreditrueckzahlung (Repay) — steuerlich neutral. ' +
          'Darlehensrueckzahlung ist kein steuerbarer Vorgang.',
      };

    // -----------------------------------------------------------------
    // Liquidation — RED, forced disposal under §23 EStG
    // When a borrower is liquidated, collateral is forcibly sold.
    // -----------------------------------------------------------------
    case 'LiquidateBorrow':
    case 'Liquidation':
      return {
        ctType: 'Liquidation',
        buyAmount: stringOrNull(event.args['repayAmount'] ?? event.args['debtRepaid']),
        buyCurrency: stringOrNull(event.args['borrowToken'] ?? event.args['debtToken']),
        sellAmount: stringOrNull(event.args['seizeTokens'] ?? event.args['collateralSeized']),
        sellCurrency: stringOrNull(event.args['collateralToken'] ?? event.args['cToken']),
        fee: stringOrNull(event.args['liquidationIncentive'] ?? event.args['penalty']),
        feeCurrency: stringOrNull(event.args['collateralToken']),
        exchange: 'Kinetic Market',
        tradeGroup: 'Lending',
        ampelStatus: 'RED',
        isGraubereich: false,
        modelChoice: null,
        comment:
          'Kinetic Market Liquidation — Zwangsveraeusserung gemaess §23 EStG. ' +
          'ACHTUNG: Collateral wird zwangsweise veraeussert. Gilt als privates Veraeusserungsgeschaeft. ' +
          'Liquidationsstrafe als Veraeusserungskosten absetzbar. Manuelle Pruefung dringend empfohlen.',
      };

    // -----------------------------------------------------------------
    // AccrueInterest / kToken value increase — Lending income
    // §22 Nr.3 EStG sonstige Einkuenfte
    // -----------------------------------------------------------------
    case 'AccrueInterest':
      return {
        ctType: 'Lending Einnahme',
        buyAmount: stringOrNull(event.args['interestAccumulated'] ?? event.args['cashPrior']),
        buyCurrency: stringOrNull(event.args['underlying'] ?? event.args['token']),
        sellAmount: null,
        sellCurrency: null,
        fee: null,
        feeCurrency: null,
        exchange: 'Kinetic Market',
        tradeGroup: 'Lending',
        ampelStatus: 'GREEN',
        isGraubereich: false,
        modelChoice: null,
        comment:
          'Kinetic Market Zinseinkuenfte — sonstige Einkuenfte gemaess §22 Nr.3 EStG. ' +
          'Freigrenze 256 EUR/Jahr beachten. Zuflusszeitpunkt ist steuerlich relevant.',
      };

    // -----------------------------------------------------------------
    // Transfer (kToken) — Context-dependent classification
    // Could be a simple transfer or part of a protocol operation.
    // -----------------------------------------------------------------
    case 'Transfer': {
      const from = String(event.args['from'] ?? '').toLowerCase();
      const to = String(event.args['to'] ?? '').toLowerCase();
      const zeroAddress = '0x0000000000000000000000000000000000000000';

      // Mint (from zero address) — part of Supply flow
      if (from === zeroAddress) {
        return {
          ctType: 'Deposit',
          buyAmount: stringOrNull(event.args['value'] ?? event.args['amount']),
          buyCurrency: stringOrNull(event.args['token'] ?? 'kToken'),
          sellAmount: null,
          sellCurrency: null,
          fee: null,
          feeCurrency: null,
          exchange: 'Kinetic Market',
          tradeGroup: 'Lending',
          ampelStatus: 'GRAY',
          isGraubereich: false,
          modelChoice: null,
          comment: 'Kinetic Market kToken Mint (Supply) — steuerlich neutral, Teil der Einzahlung.',
        };
      }

      // Burn (to zero address) — part of Withdraw flow
      if (to === zeroAddress) {
        return {
          ctType: 'Withdrawal',
          buyAmount: null,
          buyCurrency: null,
          sellAmount: stringOrNull(event.args['value'] ?? event.args['amount']),
          sellCurrency: stringOrNull(event.args['token'] ?? 'kToken'),
          fee: null,
          feeCurrency: null,
          exchange: 'Kinetic Market',
          tradeGroup: 'Lending',
          ampelStatus: 'GRAY',
          isGraubereich: false,
          modelChoice: null,
          comment: 'Kinetic Market kToken Burn (Withdraw) — steuerlich neutral, Teil der Auszahlung.',
        };
      }

      // Regular kToken transfer between addresses
      return {
        ctType: 'Transfer (intern)',
        buyAmount: stringOrNull(event.args['value'] ?? event.args['amount']),
        buyCurrency: stringOrNull(event.args['token'] ?? 'kToken'),
        sellAmount: stringOrNull(event.args['value'] ?? event.args['amount']),
        sellCurrency: stringOrNull(event.args['token'] ?? 'kToken'),
        fee: null,
        feeCurrency: null,
        exchange: 'Kinetic Market',
        tradeGroup: 'Lending',
        ampelStatus: 'GRAY',
        isGraubereich: false,
        modelChoice: null,
        comment:
          'Kinetic Market kToken Transfer — interner Transfer. ' +
          'Steuerlich neutral sofern kein Verkauf an Dritte (dann §23 EStG pruefen).',
      };
    }

    // -----------------------------------------------------------------
    // Approval — Tax-irrelevant
    // -----------------------------------------------------------------
    case 'Approval':
      return {
        ctType: 'Other',
        buyAmount: null,
        buyCurrency: null,
        sellAmount: null,
        sellCurrency: null,
        fee: null,
        feeCurrency: null,
        exchange: 'Kinetic Market',
        tradeGroup: 'Lending',
        ampelStatus: 'GRAY',
        isGraubereich: false,
        modelChoice: null,
        comment: 'Kinetic Market Approval — steuerlich irrelevant.',
      };

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely convert an unknown event arg to a string, or return null.
 */
function stringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
}
