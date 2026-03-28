---
title: "DeFi Tracker SaaS — Product Requirements Document v2.0"
description: "Vollständiges PRD: Personas, User Stories (MoSCoW), Functional Requirements, NFRs, Architektur, Roadmap, Definition of Done"
author: NextGen IT Solutions GmbH
date: 2026-03-26
version: v1.0
---

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>DeFiTracker</strong></p>
<p><strong>PRODUCT REQUIREMENTS DOCUMENT</strong></p>
<p>On-Chain Tax Intelligence SaaS — Vollständige Produktanforderungen</p>
<p>Version 2.0 · NextGen IT Solutions GmbH, Stuttgart · März 2026 · Vertraulich</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

| Produktname **DeFi Tracker SaaS**          | Version **2.0**        | Datum **März 2026**    | Status **Freigegeben**        |
|--------------------------------------------|------------------------|------------------------|-------------------------------|
| Auftraggeber **NextGen IT Solutions GmbH** | Autor **Product Team** | Reviewer **CTO + CEO** | Gültig bis **Sept. 2026 MVP** |

| **01** | **Executive Summary & Product Vision** |
|--------|----------------------------------------|

**01.1 Produktvision**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>PRODUCT VISION STATEMENT</strong></p>
<p>DeFi Tracker wird die einzige steuerliche Tracking-Lösung für Flare-Network-DeFi-Nutzer, die vollautomatisch, BMF-2025-konform und in unter 5 Minuten einen gerichtsfesten CoinTracking-Export liefert — ohne dass der Nutzer Steuerrecht verstehen muss.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**Strategische Zielsetzung**

| **Dimension**     | **Ziel**                                             | **Messgröße**                     | **Zeithorizont** |
|-------------------|------------------------------------------------------|-----------------------------------|------------------|
| **Marktposition** | First Mover im Segment Flare-DeFi-Steuer-Software DE | 0 direkte Konkurrenten bei Launch | Sept. 2026       |
| **Nutzer**        | 20.000 zahlende Nutzer                               | MRR ≥ € 30.000                    | Q2 2027          |
| **Compliance**    | BMF 2025 + DAC8 vollständig umgesetzt                | 0 bekannte Compliance-Lücken      | MVP-Launch       |
| **NPS**           | Produkt empfehlenswert für DeFi-Community            | NPS ≥ 50                          | Q4 2026          |
| **Time-to-Value** | Aha-Moment in \< 5 Minuten                           | TtV-Median \< 5 Min.              | MVP              |

**Produkt-Scope-Überblick**

| **Scope-Kategorie**    | **In Scope (MVP Phase 1)**                      | **Out of Scope (Phase 1)**                        |
|------------------------|-------------------------------------------------|---------------------------------------------------|
| **Netzwerke**          | Flare Network (EVM-kompatibel)                  | Ethereum Mainnet, Arbitrum, Polygon, Base, Solana |
| **Protokolle**         | SparkDEX V3+V4, Ēnosys DEX+CDP, Kinetic Market  | Stargate Bridge, Aave V3 (erst Phase 4)           |
| **Steuerrecht**        | DE (§ 22, § 23 EStG, BMF 2025)                  | AT (öEStG), CH (DBG), US (IRS), UK (HMRC)         |
| **Export**             | CoinTracking CSV (15 Spalten), PDF-Steuerreport | ELSTER XML, DATEV, Steuererklärung (Phase 4)      |
| **Nutzer**             | B2C Starter/Pro/Business                        | B2B Kanzlei-Portal, White-Label (Phase 4)         |
| **Bewertungsmethoden** | FIFO (Default), LIFO                            | HIFO (Phase 4 mit explizitem Disclaimer)          |
| **Compliance**         | DSGVO, GoBD, BMF 2025                           | DAC8-Meldepflicht (Meldung selbst), MiCA          |

| **02** | **Stakeholder-Analyse & User Personas** |
|--------|-----------------------------------------|

**02.1 Stakeholder-Matrix**

| **Stakeholder**                        | **Typ**               | **Einfluss** | **Interesse** | **Strategie**                                                  |
|----------------------------------------|-----------------------|--------------|---------------|----------------------------------------------------------------|
| **DeFi-Privatanleger (B2C)**           | Primär-Nutzer         | HOCH         | HOCH          | Co-Design; Beta-Tester; Community-Ambassadoren                 |
| **Steuerberatungskanzleien (B2B)**     | Sekundär-Nutzer       | MITTEL       | HOCH          | Early-Adopter-Programm; Feedback für Kanzlei-Portal-PRD        |
| **Flare Network Foundation**           | Technologie-Partner   | MITTEL       | MITTEL        | Ecosystem-Partnership; Tech-Support bei API-Fragen             |
| **CoinTracking.info**                  | Integrations-Partner  | NIEDRIG      | NIEDRIG       | Kompatibilitäts-Tests; ggf. Certified-Partner-Status           |
| **NextGen IT Solutions GmbH (intern)** | Auftraggeber / Dev    | SEHR HOCH    | SEHR HOCH     | Vollständige Transparenz; wöchentliche Status-Reviews          |
| **Steuerrechts-Berater (extern)**      | Validierungs-Partner  | MITTEL       | NIEDRIG       | Quartalsweise Regelwerk-Review; LP/CDP-Graubereich-Validierung |
| **Hetzner (Hosting)**                  | Infrastruktur-Partner | NIEDRIG      | SEHR NIEDRIG  | Betrieb sicherstellen; DSGVO-Konformität gewährleisten         |

**02.2 User Personas**

**Kai Müller**

| **Dimension**         | **Beschreibung**                                                                                                                  |
|-----------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| **Rolle / Profil**    | DeFi-Experte, 28, München                                                                                                         |
| **Tech-Level**        | Tech-Level: Experte (MetaMask, DeFi-native, eigener Node)                                                                         |
| **Hauptschmerzpunkt** | 3 Tage manuelle CSV-Aufbereitung pro Steuerjahr. CoinTracking erkennt SparkDEX V4 nicht. 847 TX ohne automatische Klassifikation. |
| **Primärziel**        | Vollautomatischer CoinTracking-Export ohne manuelle Nachbearbeitung. Alle Flare-DeFi-Protokolle korrekt klassifiziert.            |
| **JTBD-Statement**    | Ich will alle meine Flare-TX automatisch in ein BMF-konformes Format exportieren, ohne Steuerrecht zu lernen.                     |
| **Hiring-Trigger**    | Steuererklärungsfrist naht; CoinTracking zeigt 'Unbekannte TX'                                                                    |

**Lena Schneider**

| **Dimension**         | **Beschreibung**                                                                                 |
|-----------------------|--------------------------------------------------------------------------------------------------|
| **Rolle / Profil**    | DeFi-Einsteiger, 34, Hamburg                                                                     |
| **Tech-Level**        | Tech-Level: Mittel (Coinbase App, erste DeFi-Schritte)                                           |
| **Hauptschmerzpunkt** | Versteht § 22/§ 23 EStG nicht. Angst vor Fehlern beim Finanzamt. 124 TX, davon viele FlareDrops. |
| **Primärziel**        | Verstehen welche TX steuerpflichtig sind. Einfache Sprache. Kein Juristendeutsch.                |
| **JTBD-Statement**    | Ich will ohne Steuerfachkenntnisse sicher sein, dass ich nichts falsch mache.                    |
| **Hiring-Trigger**    | Freundin erzählt von Finanzamtsbrief; DAC8-Meldung in den Nachrichten                            |

**Marcus Heinz**

| **Dimension**         | **Beschreibung**                                                                                                       |
|-----------------------|------------------------------------------------------------------------------------------------------------------------|
| **Rolle / Profil**    | Institutioneller Anleger, 42, Frankfurt                                                                                |
| **Tech-Level**        | Tech-Level: Hoch (Bloomberg Terminal, 5 Wallets, 8 Chains)                                                             |
| **Hauptschmerzpunkt** | 5 Wallets auf 8 Chains — kein einheitlicher P&L-Überblick. Steuerberater fordert GoBD-konformen Bericht. 3.219 TX p.a. |
| **Primärziel**        | Multi-Wallet-Konsolidierung. GoBD-Audit-Log. ELSTER-Export. SLA-Garantie.                                              |
| **JTBD-Statement**    | Ich will alle meine Wallets konsolidiert sehen mit prüfungsfähigem Audit-Log.                                          |
| **Hiring-Trigger**    | Steuerberater fordert strukturierten Jahresabschluss; Quartalsbericht-Frist                                            |

**Andrea Weber**

| **Dimension**         | **Beschreibung**                                                                                                                    |
|-----------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| **Rolle / Profil**    | Steuerberaterin, 39, Stuttgart                                                                                                      |
| **Tech-Level**        | Tech-Level: Mittel (DATEV, kein Web3-Know-how)                                                                                      |
| **Hauptschmerzpunkt** | Mandanten bringen unstrukturierte CSV-Exporte — 4–8h manuelle Prüfung pro Mandant. Haftungsrisiko bei falscher DeFi-Klassifikation. |
| **Primärziel**        | Vorgefertigte, geprüfte DeFi-Steuerberichte. Multi-Mandanten-Portal. Automatische Graubereich-Warnungen.                            |
| **JTBD-Statement**    | Ich will DeFi-Mandanten professionell beraten ohne DeFi-Experte zu sein.                                                            |
| **Hiring-Trigger**    | Erster DeFi-Mandant; Kollegin aus Netzwerk empfiehlt Tool                                                                           |

| **03** | **Epics & User Stories (MoSCoW-Priorisierung)** |
|--------|-------------------------------------------------|

**03.1 Epic-Übersicht**

| **Epic-ID** | **Epic-Name**                            | **Story Points (gesamt)** | **Phase**            | **Primäre Persona** |
|-------------|------------------------------------------|---------------------------|----------------------|---------------------|
| **EP-01**   | Wallet-Verbindung & Synchronisation      | 13 SP                     | MVP Phase 1          | Kai, Lena, Marcus   |
| **EP-02**   | Protokoll-Indexierung (SparkDEX V3/V4)   | 34 SP                     | MVP Phase 1          | Kai                 |
| **EP-03**   | Protokoll-Indexierung (Ēnosys DEX + CDP) | 21 SP                     | MVP Phase 1          | Kai                 |
| **EP-04**   | Protokoll-Indexierung (Kinetic Market)   | 21 SP                     | MVP Phase 1          | Marcus              |
| **EP-05**   | EUR-Kursbewertung (FTSO + Fallback)      | 13 SP                     | MVP Phase 1          | Alle                |
| **EP-06**   | TX-Klassifikations-Engine                | 34 SP                     | MVP Phase 1          | Alle                |
| **EP-07**   | CoinTracking-CSV-Export                  | 13 SP                     | MVP Phase 1          | Alle                |
| **EP-08**   | Portfolio-Dashboard & Steuer-KPIs        | 13 SP                     | MVP Phase 1          | Marcus, Kai         |
| **EP-09**   | Graubereich-Ampel & Dual-Szenario        | 21 SP                     | MVP Phase 1          | Alle                |
| **EP-10**   | Manuelle TX-Klassifikation               | 8 SP                      | MVP Phase 1 (Should) | Alle                |
| **EP-11**   | FLR-Staking & FlareDrops                 | 8 SP                      | MVP Phase 1 (Should) | Kai, Lena           |
| **EP-12**   | Steuerberater-Zugang (Read-only)         | 13 SP                     | MVP Phase 1 (Should) | Andrea              |
| **EP-13**   | Stargate Cross-Chain-Bridge              | 34 SP                     | Phase 4              | Kai (Power User)    |
| **EP-14**   | Aave V3 Multi-Chain-Integration          | 55 SP                     | Phase 4              | Marcus              |
| **EP-15**   | ELSTER XML Export                        | 21 SP                     | Phase 4              | Alle                |
| **EP-16**   | Kanzlei-Portal (Multi-Mandant)           | 34 SP                     | Phase 4              | Andrea              |
| **EP-17**   | White-Label & API                        | 21 SP                     | Phase 4              | Andrea, Dev-Team    |
| **EP-18**   | HIFO + Tax-Loss-Harvesting               | 13 SP                     | Phase 4              | Marcus              |

**03.2 Must Have — MVP-Kern (Phase 1)**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>US-001 MoSCoW: Must</strong> Aufwand: 13 SP</p>
<p><em>Als DeFi-Anleger möchte ich meine EVM-Wallet-Adresse mit MetaMask oder WalletConnect verbinden und alle historischen Transaktionen automatisch importieren, damit ich keine Transaktionen manuell eingeben muss.</em></p>
<p><strong>Akzeptanzkriterien:</strong></p>
<ul>
<li><p>Wallet-Verbindung via MetaMask / WalletConnect / manuelle Adresseingabe in &lt; 30 Sekunden</p></li>
<li><p>Historischer TX-Import ab Wallet-Erstellungsdatum vollständig (keine Lücken)</p></li>
<li><p>Fortschrittsanzeige während des Imports: TX-Count + Protokoll + geschätzte Restzeit</p></li>
<li><p>Fehlermeldung bei unbekannten TX-Typen mit UI-geführter manueller Kategorisierung</p></li>
<li><p>Nur read-only-Zugang — kein Private Key gespeichert, keine Signatur-Request</p></li>
<li><p>Multi-Wallet-Support: bis zu 5 Wallets im Pro-Plan gleichzeitig synchronisierbar</p></li>
</ul></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>US-002 MoSCoW: Must</strong> Aufwand: 21 SP</p>
<p><em>Als DeFi-Anleger möchte ich alle SparkDEX V3/V4 Swaps automatisch als 'Trade' mit korrektem EUR-Kurs (FTSO) erkennen lassen, damit meine § 23 EStG Gewinn/Verlust-Berechnung automatisch korrekt ist.</em></p>
<p><strong>Akzeptanzkriterien:</strong></p>
<ul>
<li><p>Jeder Swap wird mit FTSO-EUR-Kurs zum exakten Transaktionszeitpunkt (Blockchain-Timestamp) bewertet</p></li>
<li><p>SparkDEX V4 Multi-Action-Transaktionen werden korrekt in Einzel-Events aufgeteilt (Gamma-Positionen, Multi-Hop)</p></li>
<li><p>CoinTracking-Typ 'Trade' korrekt zugewiesen; kein manueller Eingriff erforderlich</p></li>
<li><p>TX-Hash als unveränderlicher Nachweis im GoBD-Audit-Log gespeichert</p></li>
<li><p>SPRK-Farming-Rewards als 'LP Rewards' mit EUR-FTSO-Tageskurs erfasst</p></li>
</ul></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>US-003 MoSCoW: Must</strong> Aufwand: 34 SP</p>
<p><em>Als DeFi-Anleger möchte ich meine LP-Providing- und Farming-Aktivitäten tracken, auch wenn die steuerliche Einordnung unklar ist, damit ich alle TX dokumentiert habe und beim Steuerberater nachweisen kann.</em></p>
<p><strong>Akzeptanzkriterien:</strong></p>
<ul>
<li><p>LP Provide/Remove werden als separate Einträge mit LP-Token-Menge, Timestamp und EUR-Wert erfasst</p></li>
<li><p>Farming Rewards (SPRK, rFLR, WFLR) als 'LP Rewards' mit FTSO-Tageskurs erfasst</p></li>
<li><p>Graubereich-Hinweis (gelbe Ampel) bei jedem LP-Eintrag prominent sichtbar</p></li>
<li><p>Dual-Szenario-Berechnung: Modell A (Tausch → § 23 EStG) vs. Modell B (Nutzungsüberlassung → § 22 Nr. 3 EStG)</p></li>
<li><p>Nutzer wählt Modell; Wahl wird im GoBD-Audit-Log mit Timestamp dokumentiert</p></li>
<li><p>Impermanent-Loss-Berechnung: delta_V / V_hold als informativer Hinweis (kein Steuertatbestand)</p></li>
</ul></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>US-004 MoSCoW: Must</strong> Aufwand: 13 SP</p>
<p><em>Als DeFi-Anleger möchte ich einen CoinTracking-kompatiblen CSV-Export für ein Steuerjahr herunterladen, damit ich ihn direkt in CoinTracking importieren kann ohne manuelle Nachbearbeitung.</em></p>
<p><strong>Akzeptanzkriterien:</strong></p>
<ul>
<li><p>CSV-Export enthält alle 15 CoinTracking-Pflicht- und Optionsspalten in exakter Reihenfolge</p></li>
<li><p>Datum im Format DD.MM.YYYY HH:MM:SS (UTC); Dezimaltrennzeichen: Komma (DE-Format)</p></li>
<li><p>Alle CoinTracking-validen TX-Typen verwendet (Trade, Staking, LP Rewards, Lending Einnahme etc.)</p></li>
<li><p>Export wird direkt ohne Fehler von CoinTracking akzeptiert (E2E-Integrationstest als CI/CD-Schritt)</p></li>
<li><p>Alle EUR-Werte mit Quellenangabe (FTSO/CoinGecko/CMC/Manuell) im optionalen Comment-Feld</p></li>
<li><p>Pre-Export-Validierung: Warnung bei fehlenden Kursdaten oder unkategorisierten TX</p></li>
<li><p>Jeder Export wird versioniert gespeichert (GoBD: Unveränderlichkeit, 10 Jahre Aufbewahrung)</p></li>
</ul></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>US-005 MoSCoW: Must</strong> Aufwand: 21 SP</p>
<p><em>Als DeFi-Anleger möchte ich Kinetic-Lending-Transaktionen (Supply, Borrow, Repay, Liquidation) korrekt erfassen, damit Zinserträge als § 22 Nr. 3 EStG und Liquidationen als § 23 EStG korrekt ausgewiesen werden.</em></p>
<p><strong>Akzeptanzkriterien:</strong></p>
<ul>
<li><p>Supply/Withdraw korrekt als 'Lending Einnahme' / 'Remove Liquidity' klassifiziert</p></li>
<li><p>kToken-Akkumulierung (kFLR, kUSDT) wird automatisch berechnet; Zinsen aus kToken-Delta</p></li>
<li><p>Zinserträge als 'Lending Einnahme' mit EUR-FTSO-Tageskurs beim Claiming-Moment erfasst</p></li>
<li><p>Liquidationsereignisse als eigene TX-Gruppe mit Sonder-Hinweis (rote Ampel) markiert</p></li>
<li><p>Health-Factor-Events aus Kinetic-Compound-ABI als informativer Hinweis im Tool sichtbar</p></li>
<li><p>Borrow-Transaktionen: Neutraler Transfer (keine steuerliche Wirkung), dokumentiert</p></li>
</ul></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>US-006 MoSCoW: Must</strong> Aufwand: 13 SP</p>
<p><em>Als DeFi-Anleger möchte ich mein gesamtes Portfolio mit P&amp;L-Übersicht und offenen Steuerpositionen sehen, damit ich jederzeit den steuerlichen Status meiner Investitionen kenne.</em></p>
<p><strong>Akzeptanzkriterien:</strong></p>
<ul>
<li><p>Dashboard zeigt: Gesamt-P&amp;L, realisierte Gewinne/Verluste, offene Steuerpositionen (live FTSO-Kurse)</p></li>
<li><p>Freigrenze-Indikator: Fortschrittsbalken für § 23 (€ 1.000/Jahr) und § 22 Nr. 3 (€ 256/Jahr)</p></li>
<li><p>Haltefrist-Tracker: Welche Assets nähern sich dem 1-Jahres-Datum (Countdown-Anzeige)</p></li>
<li><p>Ampel-System: Alle TX farblich nach Klassifikationsstatus (Grün/Gelb/Rot/Grau) sortiert</p></li>
<li><p>Mobile-responsive Dashboard (ab 320px nutzbar); WCAG 2.2 AA konform</p></li>
</ul></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**03.3 Should Have (Phase 1 — nachrangig)**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>US-007 MoSCoW: Should</strong> Aufwand: 8 SP</p>
<p><em>Als DeFi-Anleger möchte ich FLR-Staking-Rewards und FlareDrops automatisch als § 22 Nr. 3 EStG Einkünfte tracken, damit ich auch meine passiven Einkünfte vollständig dokumentiert habe.</em></p>
<p><strong>Akzeptanzkriterien:</strong></p>
<ul>
<li><p>FlareDrops werden monatlich automatisch importiert (via Flare-API Delegation-Events)</p></li>
<li><p>Claiming-Zeitpunkt wird als Besteuerungszeitpunkt gesetzt (BMF 2025 Rz. 24 — Zufluss beim Claiming)</p></li>
<li><p>EUR-Bewertung via FTSO zum exakten Claiming-Zeitpunkt (Blockchain-Timestamp)</p></li>
<li><p>CoinTracking-Typ 'Staking' oder 'Airdrop' gemäß BMF-2025-Mapping</p></li>
<li><p>Unterscheidung: FlareDrops (§ 22 Nr. 3) vs. FLR-Delegation-Rewards (§ 22 Nr. 3)</p></li>
</ul></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>US-008 MoSCoW: Should</strong> Aufwand: 8 SP</p>
<p><em>Als DeFi-Anleger möchte ich unbekannte oder nicht automatisch erkannte Transaktionen manuell klassifizieren, damit keine TX verloren geht und das Audit-Log vollständig ist.</em></p>
<p><strong>Akzeptanzkriterien:</strong></p>
<ul>
<li><p>UI-geführter Kategorisierungs-Workflow für rote Ampel-TX (unbekannte Typen)</p></li>
<li><p>Alle CoinTracking-validen TX-Typen als Dropdown verfügbar (35+ Typen)</p></li>
<li><p>Manuelle Einträge als 'Manuell kategorisiert' in Audit-Log markiert (Zeitstempel + Nutzer-ID)</p></li>
<li><p>Bulk-Klassifikation: Gleiche unbekannte TX-Muster können als Gruppe klassifiziert werden</p></li>
<li><p>Warnhinweis: 'Manuelle Klassifikation — bitte Steuerberater konsultieren'</p></li>
</ul></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>US-009 MoSCoW: Should</strong> Aufwand: 13 SP</p>
<p><em>Als Steuerberater möchte ich alle Transaktionen eines Mandanten auf Plausibilität prüfen und kommentieren, damit ich meinen Mandanten gezielt auf steuerliche Risiken hinweisen kann.</em></p>
<p><strong>Akzeptanzkriterien:</strong></p>
<ul>
<li><p>Read-only Steuerberater-Zugang via Token-Link (ohne eigene DeFi-Tracker-Anmeldung)</p></li>
<li><p>Kommentar-Funktion pro Transaktion mit Zeitstempel und Berater-Initialen</p></li>
<li><p>Statusmarkierung: 'OK', 'Prüfen', 'Risiko' (farblich codiert)</p></li>
<li><p>PDF-Steuerberater-Report mit allen Kommentaren und Markierungen exportierbar</p></li>
<li><p>Berater-Zugriffstoken läuft nach 90 Tagen automatisch ab (Sicherheit)</p></li>
</ul></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**03.4 Could Have (Phase 4 — Erweiterung)**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>US-010 MoSCoW: Could</strong> Aufwand: 34 SP</p>
<p><em>Als Power User möchte ich Stargate-Bridge-Transaktionen korrekt chain-übergreifend verknüpfen, damit keine doppelten Einnahmen/Ausgaben in meiner Steuerrechnung entstehen.</em></p>
<p><strong>Akzeptanzkriterien:</strong></p>
<ul>
<li><p>LayerZero Message-ID als Cross-Chain-Anker für TX-Matching (Quelle + Ziel-Chain)</p></li>
<li><p>Beide TX-Seiten (Source-Chain + Destination-Chain) als ein zusammengehöriges Ereignis dargestellt</p></li>
<li><p>Steuerneutrale Bridge-Transfers korrekt als 'Transfer (intern)' klassifiziert (kein Veräußerungsvorgang)</p></li>
<li><p>Matching-Toleranz: ± 5 Minuten für verzögerte Destination-Chain-Bestätigung</p></li>
<li><p>Fallback: Manuelle Verknüpfung wenn LayerZero-API kein Match liefert</p></li>
</ul></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>US-011 MoSCoW: Could</strong> Aufwand: 21 SP</p>
<p><em>Als DeFi-Anleger möchte ich einen ELSTER-XML-Export direkt aus dem Tool generieren, damit ich meine Anlage SO ohne CoinTracking als Zwischenschritt einreichen kann.</em></p>
<p><strong>Akzeptanzkriterien:</strong></p>
<ul>
<li><p>ELSTER-kompatibles XML-Format (ElsterFormular; Datenart AnlageSOAusfuellhilfe)</p></li>
<li><p>Anlage SO vorausgefüllt: alle § 22 Nr. 3 und § 23 EStG Positionen mit korrekten Feldbezeichnungen</p></li>
<li><p>Schema-Validierung gegen ELSTER-XSD vor Download (0 Validierungsfehler)</p></li>
<li><p>Pflicht-Disclaimer: 'Dieses XML ist kein Ersatz für professionelle Steuerberatung'</p></li>
<li><p>Nur für Steuerjahr DE (01.01.–31.12.); keine AT/CH-Formulare in Phase 4</p></li>
</ul></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>US-012 MoSCoW: Could</strong> Aufwand: 13 SP</p>
<p><em>Als Steuerberater möchte ich das Tool als White-Label für meine Kanzlei einsetzen, damit meine Mandanten eine einheitliche Kanzlei-Experience erhalten.</em></p>
<p><strong>Akzeptanzkriterien:</strong></p>
<ul>
<li><p>Logo, Primärfarbe und Subdomain (kanzlei.defi-tracker.de) konfigurierbar</p></li>
<li><p>Kanzlei-Datenschutzerklärung als iframe oder redirect integrierbar</p></li>
<li><p>Multi-Mandanten-Dashboard: Übersicht aller Mandanten-Portfolios mit Ampel-Status</p></li>
<li><p>White-Label ohne DeFi-Tracker-Branding im Nutzer-UI (nur 'Powered by DeFi Tracker' im Footer)</p></li>
<li><p>Mindestlaufzeit: 12 Monate; Setup-Fee: € 5.000–15.000 + Kanzlei-Monatsgebühr</p></li>
</ul></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

| **04** | **Funktionale Anforderungen (Feature Specifications)** |
|--------|--------------------------------------------------------|

**04.1 Wallet-Verbindung & Synchronisation (EP-01)**

| **FR-ID**    | **Anforderung**                                                                       | **Priorität** | **Akzeptanzkriterium**                                                               |
|--------------|---------------------------------------------------------------------------------------|---------------|--------------------------------------------------------------------------------------|
| **FR-01-01** | Unterstützung von MetaMask (window.ethereum) als primäre Wallet-Verbindungsmethode    | KRITISCH      | MetaMask-Verbindung in \< 10s; keine Signatur-Request; kein Private Key übertragen   |
| **FR-01-02** | WalletConnect v2 (EVM-kompatibel) als alternative Verbindungsmethode                  | KRITISCH      | WalletConnect-Session aufgebaut in \< 30s; QR-Code korrekt generiert                 |
| **FR-01-03** | Manuelle Adresseingabe als dritte Option (Public Key / ENS)                           | HOCH          | Valide EVM-Adresse (0x + 40 Hex) oder ENS-Name akzeptiert; ENS resolved on-chain     |
| **FR-01-04** | Multi-Wallet-Support: Starter: 1, Pro: 5, Business/Kanzlei: 20 Wallets                | KRITISCH      | Wallet-Limit technisch enforced; Upgrade-Prompt bei Überschreitung                   |
| **FR-01-05** | Historische TX-Synchronisation ab Wallet-Erstellungsdatum (vollständig, keine Lücken) | KRITISCH      | 100% der TX ab Block 0 der Wallet importiert; validiert via Flarescan-API            |
| **FR-01-06** | Real-Time-Monitoring via WebSocket für neue Blöcke (\< 30s Latenz)                    | HOCH          | Neue TX erscheinen im Dashboard innerhalb von 30s nach Blockchain-Bestätigung        |
| **FR-01-07** | Sync-Fortschrittsanzeige: TX-Count, Protokoll, geschätzte Restzeit                    | HOCH          | Progress-Bar oder Spinner mit realem Fortschritt; kein fake Loading                  |
| **FR-01-08** | Fehlerbehandlung: Unbekannte TX → Manuelle Kategorisierung via In-App-UI              | KRITISCH      | Rote Ampel erscheint; UI-Flow führt Nutzer zur Kategorisierung; kein Abbruch         |
| **FR-01-09** | Re-Sync-Button für manuelle Aktualisierung (on-demand)                                | MITTEL        | Re-Sync löst vollständigen Delta-Import seit letztem Sync aus (kein Duplikat-Risiko) |

**04.2 Protokoll-Indexierung: SparkDEX V3 + V4 (EP-02)**

| **FR-ID**    | **TX-Typ**                                   | **ABI-Event**                                     | **CoinTracking-Typ**            | **Steuerrecht**                      |
|--------------|----------------------------------------------|---------------------------------------------------|---------------------------------|--------------------------------------|
| **FR-02-01** | Swap (V3)                                    | Swap(address,int256,int256,uint160,uint128,int24) | Trade                           | § 23 EStG — Tauschgeschäft           |
| **FR-02-02** | Swap (V4 Multi-Action)                       | Flash, Collect, Mint, Burn aggregiert zu Swap     | Trade (aufgeteilt)              | § 23 EStG — jede Teil-TX separat     |
| **FR-02-03** | LP Provide (V3/V4)                           | Mint(address,int24,int24,uint128,uint256,uint256) | Add Liquidity                   | Graubereich — Dual-Szenario Pflicht  |
| **FR-02-04** | LP Remove (V3/V4)                            | Burn(address,int24,int24,uint128,uint256,uint256) | Remove Liquidity                | Graubereich — Dual-Szenario Pflicht  |
| **FR-02-05** | Farming Reward Claim                         | Collect(address,address,uint128,uint128)          | LP Rewards                      | § 22 Nr. 3 EStG — Sonstige Einkünfte |
| **FR-02-06** | SPRK-Staking-Reward                          | Transfer von SPRK-Reward-Contract                 | Staking                         | § 22 Nr. 3 EStG                      |
| **FR-02-07** | Perps Long/Short öffnen                      | OpenPosition(uint256,address,bool,uint256,...)    | Margin Trade / Derivate         | § 23 EStG (Termingeschäft)           |
| **FR-02-08** | Perps Long/Short schließen                   | ClosePosition(uint256,int256,...)                 | Margin Trade / Derivate         | § 23 EStG — Realisierter G/V         |
| **FR-02-09** | Gamma-Position (konzentrierte Liquidität V4) | Compound + Rebalance Events                       | Add+Remove Liquidity kombiniert | Graubereich — Dual-Szenario          |
| **FR-02-10** | Token-Approval                               | Approve(address,uint256)                          | Keine (steuerlich irrelevant)   | Steuerneutral — Grau-Ampel           |

**04.3 Protokoll-Indexierung: Ēnosys DEX + CDP (EP-03)**

| **FR-ID**    | **TX-Typ**                             | **Steuerliche Behandlung**        | **Graubereich?**        | **Dual-Szenario**                                                |
|--------------|----------------------------------------|-----------------------------------|-------------------------|------------------------------------------------------------------|
| **FR-03-01** | DEX V3 Swap (Ēnosys AMM)               | § 23 EStG Tauschgeschäft          | NEIN                    | —                                                                |
| **FR-03-02** | LP Provide (Ēnosys V3)                 | Graubereich — analog SparkDEX     | JA                      | Modell A: Tausch; Modell B: Nutzungsüberlassung                  |
| **FR-03-03** | LP Remove (Ēnosys V3)                  | Graubereich — Rückgabe LP-Token   | JA                      | Modell A: Gegenläufiger Tausch; Modell B: Rückgabe               |
| **FR-03-04** | CDP öffnen (Loans — FXRP → Stablecoin) | Unklar: Darlehen vs. Tausch       | JA (besonders kritisch) | Modell A: Tausch → § 23 EStG; Modell B: Darlehen → steuerneutral |
| **FR-03-05** | Stablecoin Mint via CDP                | Analog CDP-Eröffnung              | JA                      | Dual-Szenario mit prominentem Hinweis                            |
| **FR-03-06** | CDP schließen + Collateral zurück      | Rückgabe Collateral               | JA                      | Dual-Szenario Umkehr                                             |
| **FR-03-07** | Liquidation (CDP)                      | § 23 EStG — Zwangsveräußerung     | NEIN                    | Klarer TX-Typ; Sonder-Hinweis                                    |
| **FR-03-08** | Bridge (Ēnosys → andere Chain)         | Steuerneutral (interner Transfer) | NEIN                    | Transfer intern — kein Tausch                                    |
| **FR-03-09** | ENSY/APS/HLN Farming-Rewards           | § 22 Nr. 3 EStG                   | NEIN                    | LP Rewards zum Claiming-Zeitpunkt                                |

**04.4 EUR-Kursbewertungs-Engine (EP-05)**

Die EUR-Kursbewertung folgt einer 4-stufigen Prioritätshierarchie. Jede TX wird mit dem Kurs der höchsten verfügbaren Stufe bewertet. Die verwendete Quelle wird unveränderlich im GoBD-Audit-Log gespeichert.

| **Priorität**     | **Quelle**                       | **Verfügbarkeit**                                         | **BMF-2025-Konformität**                  | **Fallback-Trigger**                                        |
|-------------------|----------------------------------|-----------------------------------------------------------|-------------------------------------------|-------------------------------------------------------------|
| **P1 (primär)**   | Flare FTSO On-Chain-Oracle       | Flare-native Tokens (FLR, FXRP, USDT0, kFLR, SPRK…)       | JA — explizit dezentral, Rz. 43           | Nur wenn FTSO-Feed ausgefallen (\< 0,1% Wahrscheinlichkeit) |
| **P2**            | CoinGecko API (historisch)       | Alle gelisteten Tokens, sekundengenauer historischer Kurs | JA — anerkannte Quelle                    | FTSO nicht verfügbar für Token                              |
| **P3 (Fallback)** | CoinMarketCap API                | Alle gelisteten Tokens                                    | JA — ausdrücklich BMF 2025 Rz. 43 genannt | CoinGecko-Rate-Limit oder API-Fehler                        |
| **P4 (manuell)**  | Nutzer-Eingabe mit Quellenangabe | Illiquide/ungelistete Tokens                              | JA — bei korrekter Dokumentation          | Token nicht in P1/P2/P3 gelistet                            |

| **FR-ID**    | **Anforderung**                                                            | **Akzeptanzkriterium**                                               |
|--------------|----------------------------------------------------------------------------|----------------------------------------------------------------------|
| **FR-05-01** | FTSO-Kurs-Abruf zum exakten TX-Zeitpunkt (Block-Timestamp)                 | Kurs-Abweichung \< 0,1% vom On-Chain-FTSO-Wert im selben Block       |
| **FR-05-02** | Historischer CoinGecko-Kurs mit 1-Minuten-Granularität                     | Max. 1 Minute Abweichung vom TX-Zeitpunkt für Kursbewertung          |
| **FR-05-03** | Preisquelle + Kurs + Timestamp im Audit-Log (unveränderlich)               | Audit-Log-Eintrag für jede TX vorhanden; SHA-256-Hash-Kette intakt   |
| **FR-05-04** | Preisvalidierung: Z-Score-Anomalie-Detektor (\> 3σ = Warnung)              | Alert wenn Preisabweichung \> 20% innerhalb einer Block-Gruppe       |
| **FR-05-05** | Rate-Limit-Handling: Automatisches Fallback bei CoinGecko \> 60% Kapazität | Automatischer CMC-Fallback ohne Nutzer-Eingriff; Log-Eintrag         |
| **FR-05-06** | Manuelle Kurs-Überschreibung mit Pflichtfeld: Quellenangabe + URL          | Manuelle Eingaben als 'Manuell — Nutzerangabe' im Audit-Log markiert |

**04.5 Steuerberechnungs-Engine (EP-06, Steuerrecht)**

| **Berechnungsmodul**        | **Methode**                                                                  | **Input**                                                      | **Output**                                                      | **§ EStG**                     |
|-----------------------------|------------------------------------------------------------------------------|----------------------------------------------------------------|-----------------------------------------------------------------|--------------------------------|
| **FIFO-Berechnung**         | Älteste Lots zuerst verkauft; chronologische Lot-Zuordnung                   | TX-Historie sortiert nach Timestamp; Anschaffungskosten je Lot | Realisierter G/V je TX; offene Lots; Haltefrist je Lot          | § 23 EStG                      |
| **LIFO-Berechnung**         | Neueste Lots zuerst verkauft (opt-in)                                        | TX-Historie; Nutzer-Auswahl LIFO                               | Realisierter G/V je TX (LIFO-Basis); Disclaimer                 | § 23 EStG — erhöhtes FA-Risiko |
| **Haltefrist-Tracker**      | 1-Jahr-Grenze je Lot (Anschaffungsdatum + 365 Tage)                          | Lot-Erstellungsdatum                                           | Steuerfrei ab Datum X; Countdown in Tagen                       | § 23 Abs. 1 S. 1 Nr. 2 EStG    |
| **Freigrenze-Monitor § 23** | Σ Gewinne − Σ Verluste ≤ € 1.000/Jahr                                        | Alle realisierten G/V des Steuerjahres                         | Ampel: Grün (\< € 800), Gelb (€ 800–1.000), Rot (\> € 1.000)    | § 23 Abs. 3 S. 5 EStG          |
| **Freigrenze-Monitor § 22** | Σ Rewards/Staking/LP-Einkünfte ≤ € 256/Jahr                                  | Alle sonstigen Einkünfte des Steuerjahres                      | Ampel: Grün, Gelb, Rot; Warnung bei Überschreitung              | § 22 Nr. 3 S. 2 EStG           |
| **LP-Dual-Szenario A**      | Tausch-Modell: LP-Provide = Tausch Token → LP-Token (§ 23 EStG)              | LP-TX-Daten; Nutzerwahl                                        | Steuerliche G/V-Berechnung bei Tausch; neue Haltefrist LP-Token | § 23 EStG                      |
| **LP-Dual-Szenario B**      | Nutzungsüberlassung: LP-Provide = Darlehen (steuerlich neutral beim Provide) | LP-TX-Daten; Nutzerwahl                                        | Rewards als § 22 Nr. 3; kein Veräußerungsvorgang beim Provide   | § 22 Nr. 3 EStG                |

**04.6 CoinTracking-Export-Engine (EP-07)**

**CSV-Format-Spezifikation (15-Spalten-Standard)**

| **Spalten-Nr.** | **Feldname**                   | **Pflicht?** | **Format / Beispiel**                                                                     |
|-----------------|--------------------------------|--------------|-------------------------------------------------------------------------------------------|
| **1**           | Type                           | JA           | Wert aus CT-Typ-Liste: Trade, Staking, LP Rewards, Lending Einnahme, Airdrop, Transfer, … |
| **2**           | Buy Amount                     | Bedingt      | Dezimalzahl, Komma als Dezimalzeichen: 1,523 (leer wenn reiner Verkauf)                   |
| **3**           | Buy Currency                   | Bedingt      | Ticker-Symbol: FLR, FXRP, USDT, SPRK (leer wenn reiner Verkauf)                           |
| **4**           | Sell Amount                    | Bedingt      | Dezimalzahl, Komma: 50,00 (leer wenn reiner Kauf)                                         |
| **5**           | Sell Currency                  | Bedingt      | Ticker-Symbol (leer wenn reiner Kauf)                                                     |
| **6**           | Fee                            | Optional     | Dezimalzahl in Fee-Währung                                                                |
| **7**           | Fee Currency                   | Optional     | Ticker-Symbol der Fee-Währung                                                             |
| **8**           | Exchange                       | EMPFOHLEN    | Plattform: SparkDEX, Ēnosys, Kinetic Market, Flare Network, DeFi Tracker                  |
| **9**           | Trade-Group                    | Optional     | Kategorie: DeFi-Flare, Staking, Farming, Lending                                          |
| **10**          | Comment                        | Optional     | Freitext: TX-Details, Graubereich-Modell, Kursquelle                                      |
| **11**          | Date                           | JA           | TT.MM.JJJJ HH:MM:SS (UTC, z.B. 12.03.2026 09:14:33)                                       |
| **12**          | Liquidity pool                 | Optional     | LP-Paar: wFLR/USDT V3 (nur bei LP-TX)                                                     |
| **13**          | Tx-ID                          | Optional     | 0xabc123def456... (vollständiger TX-Hash)                                                 |
| **14**          | Buy Value in Account Currency  | Optional     | EUR-Wert zum TX-Zeitpunkt: 2,64                                                           |
| **15**          | Sell Value in Account Currency | Optional     | EUR-Wert zum TX-Zeitpunkt: 50,00                                                          |

| **05** | **Nicht-Funktionale Anforderungen (NFRs)** |
|--------|--------------------------------------------|

**05.1 Performance-Anforderungen**

| **NFR-ID**  | **Anforderung**                                        | **Zielwert**                                        | **Messmethode**                                   | **Priorität** |
|-------------|--------------------------------------------------------|-----------------------------------------------------|---------------------------------------------------|---------------|
| **NFR-P01** | Time-to-Value: Wallet-Connect → erster grüner Ampel-TX | \< 5 Minuten (\< 1.000 TX)                          | Mixpanel-Event: wallet_connected → first_green_tx | KRITISCH      |
| **NFR-P02** | Historischer TX-Import (vollständig)                   | \< 10 Min. / 10.000 TX                              | k6-Last-Test; Indexer-Queue-Monitor               | HOCH          |
| **NFR-P03** | API-Response-Zeit (p95)                                | \< 500ms                                            | Prometheus + Grafana; Percentile-Monitoring       | HOCH          |
| **NFR-P04** | Dashboard-Ladezeit (First Contentful Paint)            | \< 2s auf 4G-Verbindung                             | Lighthouse CI; WebPageTest                        | HOCH          |
| **NFR-P05** | CoinTracking CSV-Export-Generierung                    | \< 10s für 10.000 TX                                | Automatisierter Integrationstest                  | MITTEL        |
| **NFR-P06** | Gleichzeitige Nutzer (Phase 1 Launch)                  | ≥ 500 simultane Nutzer ohne Performance-Degradation | k6-Last-Test: 500 VUs, 5 Min.                     | HOCH          |
| **NFR-P07** | Datenbankabfrage-Zeit (p95)                            | \< 200ms                                            | PostgreSQL slow-query-log; Prisma-Metrics         | MITTEL        |
| **NFR-P08** | WebSocket-Verbindungsstabilität                        | \> 99% Verbindungsrate über 24h                     | BullMQ-Queue-Depth-Monitor                        | MITTEL        |

**05.2 Sicherheits-Anforderungen**

| **NFR-ID**  | **Anforderung**                                                             | **Standard / Maßnahme**                                       | **Priorität** |
|-------------|-----------------------------------------------------------------------------|---------------------------------------------------------------|---------------|
| **NFR-S01** | Passwort-Hashing: Argon2id (OWASP-empfohlen)                                | OWASP Password Storage Cheat Sheet; params: m=19456, t=2, p=1 | KRITISCH      |
| **NFR-S02** | Wallet-Daten-Verschlüsselung: AES-256-GCM at rest                           | Hetzner KMS-verwaltete Schlüssel; Envelope-Encryption         | KRITISCH      |
| **NFR-S03** | Transport: TLS 1.3 ausschließlich; TLS 1.0/1.1 deaktiviert                  | Nginx: ssl_protocols TLSv1.3; HSTS-Header                     | KRITISCH      |
| **NFR-S04** | Keine Private Keys gespeichert — ausschließlich read-only Wallet-Verbindung | Architekturprinzip; Code-Review-Pflicht; Pentest-Scope        | KRITISCH      |
| **NFR-S05** | Session-Management: JWT (15 Min. Expiry) + Refresh-Token (7 Tage)           | NextAuth.js; HTTP-only Cookies; SameSite=Strict               | KRITISCH      |
| **NFR-S06** | 2FA (TOTP) für alle Nutzer-Accounts (Pflicht ab Phase 4; Optional Phase 1)  | RFC 6238; Google Authenticator / Authy kompatibel             | HOCH          |
| **NFR-S07** | Input-Validierung: Alle API-Inputs via Zod-Schema validiert (Backend)       | Zod v3; TypeScript-Strict; tRPC-Validierung                   | KRITISCH      |
| **NFR-S08** | OWASP Top 10: A01–A10 vollständig adressiert (dokumentiert)                 | OWASP ASVS Level 2; jährlicher Pentest                        | HOCH          |
| **NFR-S09** | GoBD-Audit-Log: SHA-256-Hash-Kette; unveränderlich; 10 Jahre                | § 147 AO; BMF-Schreiben 28.11.2019 (GoBD)                     | KRITISCH      |
| **NFR-S10** | Dependency-Scanning: Dependabot wöchentlich; CVSS ≥ 7 → Patch in 7 Tagen    | GitHub Dependabot + npm audit in CI/CD                        | HOCH          |

**05.3 Compliance-Anforderungen**

| **NFR-ID**  | **Regulierung**         | **Anforderung**                                                                                        | **Nachweis / Implementierung**                                                |
|-------------|-------------------------|--------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------|
| **NFR-C01** | DSGVO Art. 5            | Datensparsamkeit: Nur Public-Wallet-Adressen gespeichert; keine Private Keys; keine Saldos persistiert | Privacy-by-Design-Architektur; DSGVO-Checkliste im PRD                        |
| **NFR-C02** | DSGVO Art. 17           | Datenlöschung innerhalb 30 Tagen nach Antrag; vollständig und verifizierbar                            | Lösch-Job (cascade auf alle user\_\* Tabellen); Lösch-Bestätigung per E-Mail  |
| **NFR-C03** | DSGVO Art. 32           | Technische und organisatorische Maßnahmen (TOMs): Verschlüsselung, Zugriffskontrollen, Logging         | TOM-Dokument; Verarbeitungsverzeichnis; DPA mit Hetzner                       |
| **NFR-C04** | GoBD §147 AO            | Audit-Log: unveränderlich, vollständig, 10-jährige Aufbewahrung                                        | PostgreSQL + append-only Audit-Log-Tabelle; S3-Backup (Versioning aktiviert)  |
| **NFR-C05** | BMF 2025 Rz. 43         | EUR-Kursbewertung: Nachweis der Kursquelle (FTSO/CoinGecko/CMC) je TX                                  | Kursquelle in Audit-Log-Eintrag; unveränderlich gespeichert                   |
| **NFR-C06** | BFSG (Barrierefreiheit) | WCAG 2.2 Level AA ab 28.06.2025 für alle öffentlichen Seiten                                           | axe-core in CI/CD; Lighthouse Accessibility ≥ 90; manuelle Prüfung vor Launch |
| **NFR-C07** | DAC8 (EU-RL 2023/2226)  | Keine VASP-Funktion in Phase 1; bei Phase 4-API: Melde-Readiness prüfen                                | Rechtsberatung vor Phase-4-API-Launch; DAC8-Scope-Analyse                     |

**05.4 Skalierbarkeit & Infrastruktur**

| **NFR-ID**  | **Komponente**           | **Anforderung**                                               | **Hetzner-Konfiguration**                     | **Scale-Trigger**                         |
|-------------|--------------------------|---------------------------------------------------------------|-----------------------------------------------|-------------------------------------------|
| **NFR-I01** | API-Gateway              | Horizontal skalierbar; kein Single Point of Failure           | CX31 Basis; +1 Node ab 10.000 MAU             | CPU \> 70% über 15 Min.                   |
| **NFR-I02** | PostgreSQL               | ACID-konform; Read-Replica ab 5.000 aktiven Nutzern           | CPX31 (4 vCPU, 8GB RAM); Backup täglich       | Query p95 \> 200ms oder RAM \> 80%        |
| **NFR-I03** | Redis + BullMQ           | Queue-Tiefe \< 100 Jobs dauerhaft; Retry-Logik 3× exponential | CX21 Redis; Cluster ab 1.000 simultan-Syncs   | Queue-Depth \> 500 oder Job-Failure \> 5% |
| **NFR-I04** | Blockchain-Indexer       | 1 Indexer-Instanz pro Chain; horizontal skalierbar            | CX31 je Chain; aktuell: Flare                 | Block-Lag \> 30s oder TX-Backlog \> 1.000 |
| **NFR-I05** | Object Storage (Exporte) | Unbegrenzt; DSGVO-konform; Versionierung aktiviert            | Hetzner S3 (Nürnberg); SSE-S3-Verschlüsselung | N/A — pay-per-use                         |
| **NFR-I06** | Uptime-SLA               | ≥ 99,5% monatlich (B2C); ≥ 99,9% (Kanzlei-SLA)                | Multi-AZ nicht Phase 1; Coolify-Auto-Restart  | Downtime \> 15 Min. → P0-Alert            |

| **06** | **Technische Architektur & Tech-Stack** |
|--------|-----------------------------------------|

**06.1 System-Architektur (7-Layer)**

| **Layer**               | **Komponente**            | **Technologie**                                               | **Version**   | **Begründung**                                       |
|-------------------------|---------------------------|---------------------------------------------------------------|---------------|------------------------------------------------------|
| **L1 — Presentation**   | Frontend SPA              | Next.js 15 App Router + React Server Components               | 15.x          | RSC für SEO; App Router für Layout-Optimierung       |
| **L1 — Presentation**   | UI-Komponenten            | shadcn/ui + Radix UI + Tailwind CSS                           | latest        | Accessible by default; Design-System-Basis           |
| **L2 — API**            | Backend API               | Node.js + tRPC + Zod-Validierung                              | tRPC 11       | Type-safe End-to-End; automatische Validierung       |
| **L3 — Business Logic** | TX-Klassifikations-Engine | TypeScript + Custom Rule Engine + ML-Fallback                 | —             | Protokoll-spezifische Rules + Random-Forest-Fallback |
| **L3 — Business Logic** | Steuerberechnungs-Engine  | TypeScript (FIFO/LIFO/Freigrenze/Dual-Szenario)               | —             | Deterministisch; testbar; auditierbar                |
| **L4 — Data**           | Primärdatenbank           | PostgreSQL 16 + Prisma ORM v6                                 | PostgreSQL 16 | ACID; GoBD-tauglich; Relational für Audit-Log        |
| **L4 — Data**           | Queue + Cache             | Redis 7 + BullMQ v5                                           | Redis 7       | Asynchrone Indexierung; Retry-Logik; Rate-Limiting   |
| **L5 — Indexing**       | Blockchain-Indexer        | The Graph Protocol (Subgraph) + JSON-RPC Fallback             | —             | Effiziente On-Chain-Abfragen; event-driven           |
| **L5 — Indexing**       | Preis-Service             | Flare FTSO (On-Chain) + CoinGecko API + CMC API               | —             | 4-Stufen-Fallback-Hierarchie (BMF 2025)              |
| **L6 — Export**         | Export-Engine             | Node.js csv-writer + ExcelJS + Puppeteer (PDF)                | —             | CoinTracking-Format + PDF-Steuerreport               |
| **L7 — Auth/Security**  | Authentifizierung         | NextAuth.js v5 + 2FA TOTP                                     | v5            | Multi-Provider; Session-Management; TOTP             |
| **L7 — Auth/Security**  | Verschlüsselung           | Argon2id (Passwörter) + AES-256-GCM (Wallet-Daten) + pgcrypto | —             | OWASP-empfohlen; Hetzner-KMS                         |
| **Infra — Hosting**     | Cloud-Hosting             | Hetzner Cloud (Nürnberg) + Docker + Coolify                   | —             | DSGVO; EU-Serverstandort; ISO 27001 RZ               |
| **Infra — CI/CD**       | Pipeline                  | GitHub Actions: Lint → Test → Build → Deploy                  | —             | 4-Stage-Pipeline; Playwright E2E; k6 Last-Test       |
| **Infra — Monitoring**  | Observability             | Prometheus + Grafana + Sentry (Error-Tracking)                | —             | Metriken + Traces + Alerts                           |

**06.2 Datenbankschema — Kern-Tabellen**

| **Tabelle**            | **Primärschlüssel** | **Wichtigste Felder**                                                                                                                         | **Relationen**                                             | **GoBD-relevant?**  |
|------------------------|---------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------|---------------------|
| **users**              | id UUID PK          | email, password_hash (Argon2id), plan, created_at, deleted_at                                                                                 | 1:N wallets, 1:N subscriptions                             | Nein                |
| **wallets**            | id UUID PK          | user_id FK, address (0x…), chain_id, label, last_sync_at, sync_status                                                                         | N:1 users, 1:N transactions                                | Nein                |
| **transactions**       | id UUID PK          | wallet_id FK, tx_hash (UNIQUE), block_number, timestamp, protocol, tx_type, status (green/yellow/red/gray)                                    | N:1 wallets, 1:N tx_classifications, 1:1 audit_log_entries | JA                  |
| **tx_classifications** | id UUID PK          | tx_id FK, ct_type, buy_amount, buy_currency, sell_amount, sell_currency, fee, eur_value, price_source, model_choice (A/B), manual, created_at | N:1 transactions                                           | JA                  |
| **audit_log_entries**  | id UUID PK          | tx_id FK, field_changed, old_value, new_value, changed_by, changed_at, sha256_hash (prev_hash + data)                                         | N:1 transactions                                           | JA — Hash-Kette     |
| **exports**            | id UUID PK          | user_id FK, steuerjahr, method (FIFO/LIFO), generated_at, file_path (S3), status, row_count                                                   | N:1 users                                                  | JA — unveränderlich |
| **price_cache**        | id UUID PK          | token_address, timestamp_unix, eur_price, source (FTSO/CG/CMC/Manual), source_url                                                             | —                                                          | JA (Kursnachweis)   |
| **subscriptions**      | id UUID PK          | user_id FK, plan, stripe_sub_id, status, current_period_end, cancel_at                                                                        | N:1 users                                                  | Nein                |

| **07** | **UX-Flows & Interface-Spezifikation** |
|--------|----------------------------------------|

**07.1 Onboarding-Flow (6 Schritte, Ziel: TtV \< 5 Min.)**

| **Schritt** | **Screen-Name**  | **Haupt-CTA**       | **Inhalt**                                                                                                        | **Abbruch-Schutz**                                        | **Zeit-Budget**         |
|-------------|------------------|---------------------|-------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------|-------------------------|
| **1**       | Willkommen       | Kostenlos starten → | Produkt-Tagline (1 Satz) + 3 Key-Benefits + Trust-Signal (Hetzner DE, Read-only)                                  | Skip-Option sichtbar; kein Passwort-Feld                  | \< 10s                  |
| **2**       | Konto erstellen  | Konto anlegen →     | E-Mail + Passwort (Stärke-Indikator) + Zustimmung DSGVO + Datenschutzerklärung-Link                               | 'Bereits Konto?' Link; keine anderen Pflichtfelder        | \< 30s                  |
| **3**       | Wallet verbinden | Wallet verbinden →  | MetaMask / WalletConnect / Adresse-Eingabe; Read-Only-Hinweis prominent; 'Was ist das?'-Tooltip                   | Weiter ohne Verbindung (manuelle Eingabe) möglich         | \< 30s                  |
| **4**       | Synchronisierung | (automatisch)       | Fortschrittsbalken: TX-Count + Protokoll + Restzeit-Schätzung; Hintergrund-Sync-Option                            | 'E-Mail-Benachrichtigung wenn fertig' — kein Abbrechzwang | \< 2 Min. (\< 1.000 TX) |
| **5**       | Aha-Moment       | Dashboard ansehen → | Ampel-Dashboard: Grüne TX prominent; Anzahl klassifiziert; 1 highlighted TX; Graubereich-Erklärung wenn vorhanden | Niemals leerer State — immer min. 1 TX anzeigen           | \< 30s                  |
| **6**       | Export-Preview   | Export erstellen →  | 'Ihr erster Export ist bereit' + Plan-Paywall (Free: 20 TX) oder 'Pro freischalten'                               | Free-Export tatsächlich möglich — kein false Promise      | \< 30s                  |

**07.2 Ampel-System — TX-Review-Flow**

| **Ampel** | **CSS-Token**                   | **Bedeutung**                                                             | **Nutzer-Aktion (erforderlich)**                   | **CoinTracking-Export?**           |
|-----------|---------------------------------|---------------------------------------------------------------------------|----------------------------------------------------|------------------------------------|
| **GRÜN**  | --color-success (#00B56A)       | Automatisch klassifiziert, steuerlich eindeutig gemäß BMF 2025            | Keine — direkt exportierbar                        | JA                                 |
| **GELB**  | --color-warning (#F5A623)       | Graubereich erkannt — Dual-Szenario-Auswahl empfohlen (LP, CDP, Bridge)   | Modell A oder B wählen (oder 'Später entscheiden') | JA, nach Modellwahl                |
| **ROT**   | --color-danger (#EF4444)        | Unbekannter TX-Typ — manuelle Klassifikation zwingend nötig               | CoinTracking-Typ aus Dropdown wählen               | Erst nach manueller Klassifikation |
| **GRAU**  | --color-text-tertiary (#5A7A9E) | Steuerlich irrelevant: Approve, interne Transfers, Contract-Interaktionen | Keine — automatisch aus Export ausgeschlossen      | NEIN (ausgeschlossen)              |

**07.3 Dashboard-Konzept — Hauptscreen (Spezifikation)**

| **Widget**                                                                            | **Position**     | **Datenquelle**                                         | **Update-Frequenz**             | **Nutzer-Interaktion**                                 |
|---------------------------------------------------------------------------------------|------------------|---------------------------------------------------------|---------------------------------|--------------------------------------------------------|
| **KPI-Kacheln (4×): Gesamte TX, Klassifiziert (%), Freigrenze § 23, Freigrenze § 22** | Oben (Hero-Zone) | Aggregation über transactions + tx_classifications      | Real-time (FTSO-Kurs)           | Kachel klicken → Drill-down                            |
| **Ampel-Übersicht (Donut-Chart)**                                                     | Oben rechts      | COUNT(status) GROUP BY status                           | Real-time                       | Segment klicken → gefilterte TX-Liste                  |
| **TX-Liste (gefiltert, paginated)**                                                   | Haupt-Bereich    | transactions JOIN tx_classifications                    | On-page-load + WebSocket-Update | Filter nach Status/Protokoll/Datum; Suche nach TX-Hash |
| **Haltefrist-Tracker**                                                                | Sidebar          | Offene Lots mit Anschaffungsdatum + Countdown           | Täglich um 00:00 UTC            | Asset klicken → Lot-Detail                             |
| **Freigrenze-Balken (§ 23 + § 22)**                                                   | Sidebar          | Aggregation realisierter G/V / Rewards des Steuerjahres | Real-time                       | Hover → Tooltip mit Berechnung                         |
| **Aktivitäts-Chart (Sparkline MoM)**                                                  | Oben mitte       | TX-Count GROUP BY month                                 | Monatlich                       | Hover → Monatssumme                                    |
| **Protokoll-Filter (Chips)**                                                          | Über TX-Liste    | Distinct protocols aus wallets                          | On-load                         | Chip klicken → filtert TX-Liste                        |

| **08** | **API-Spezifikation (Phase 4 — B2B-Integration)** |
|--------|---------------------------------------------------|

**08.1 REST-API Endpoints (OpenAPI 3.0)**

| **Endpoint**                       | **Methode** | **Beschreibung**                            | **Auth**             | **Rate-Limit** | **Response-Format**                                                        |
|------------------------------------|-------------|---------------------------------------------|----------------------|----------------|----------------------------------------------------------------------------|
| **/v1/wallets**                    | POST        | Neue Wallet verbinden und Sync starten      | Bearer JWT           | 10/Min.        | { wallet_id, status, tx_count_est }                                        |
| **/v1/wallets/{id}/sync**          | POST        | Manueller Re-Sync einer Wallet              | Bearer JWT           | 5/Min.         | { job_id, status: queued }                                                 |
| **/v1/transactions**               | GET         | TX-Liste (paginiert, gefiltert)             | Bearer JWT           | 60/Min.        | { data: \[tx\], pagination: { page, total } }                              |
| **/v1/transactions/{id}**          | GET         | TX-Detail inkl. Klassifikation + Audit-Log  | Bearer JWT           | 120/Min.       | { tx, classification, audit_entries }                                      |
| **/v1/transactions/{id}/classify** | PATCH       | TX manuell klassifizieren                   | Bearer JWT           | 30/Min.        | { classification_id, ct_type, eur_value }                                  |
| **/v1/exports**                    | POST        | Neuen CoinTracking-CSV-Export erstellen     | Bearer JWT           | 3/Min.         | { export_id, status: generating }                                          |
| **/v1/exports/{id}**               | GET         | Export-Status + Download-URL (S3 presigned) | Bearer JWT           | 60/Min.        | { export_id, status, download_url (15 Min. TTL) }                          |
| **/v1/tax-summary**                | GET         | Steuerliche Jahres-Zusammenfassung          | Bearer JWT           | 10/Min.        | { year, total_gains, total_losses, rewards, freigrenze_23, freigrenze_22 } |
| **/v1/prices/{token}**             | GET         | Aktueller EUR-Kurs eines Tokens (FTSO)      | API-Key              | 120/Min.       | { token, eur_price, source, timestamp }                                    |
| **/v1/kanzlei/mandanten**          | GET         | Liste aller Mandanten (Kanzlei-Plan only)   | Bearer JWT (Kanzlei) | 30/Min.        | { mandanten: \[{ id, name, tx_count, status }\] }                          |

**08.2 Authentication & Rate-Limiting**

| **Dimension**              | **Spezifikation**                                                                                                |
|----------------------------|------------------------------------------------------------------------------------------------------------------|
| **Auth-Methode**           | Bearer JWT (15 Min.) + Refresh-Token (HTTP-only Cookie, 7 Tage) für Web-App; API-Key (Plan-gebunden) für B2B-API |
| **API-Key-Format**         | dt_live\_\[32-Char-Hex\] (Production) / dt_test\_\[32-Char-Hex\] (Sandbox)                                       |
| **Rate-Limit-Header**      | X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset (Unix-Timestamp)                                     |
| **Rate-Limit Starter/Pro** | 1.000 API-Requests/Minute (gesamt pro Account)                                                                   |
| **Rate-Limit Business**    | 5.000 API-Requests/Minute                                                                                        |
| **Rate-Limit Kanzlei**     | 10.000 API-Requests/Minute                                                                                       |
| **Error-Response-Format**  | { error: { code: 'RATE_LIMIT_EXCEEDED', message: '...', retry_after: 60 } }                                      |
| **Sandbox-Umgebung**       | api-sandbox.defi-tracker.de — Testdaten, keine echten TX, kein Stripe                                            |

| **09** | **Release-Plan & Meilensteine** |
|--------|---------------------------------|

**09.1 Roadmap-Übersicht (Phase 1–4)**

| **Phase**                | **Zeitraum**        | **Ziel**            | **Feature-Set (Kern)**                                                                   | **Erfolgs-KPI**                                       |
|--------------------------|---------------------|---------------------|------------------------------------------------------------------------------------------|-------------------------------------------------------|
| **Phase 0 — Foundation** | Jan–März 2026       | Architektur + Setup | Monorepo-Setup (pnpm+Turborepo), DB-Schema, Auth, CI/CD-Pipeline, Flare-RPC-Verbindung   | 0 Build-Errors; CI/CD grün; DB-Schema validiert       |
| **Phase 1 — MVP**        | Apr–Aug 2026        | Marktreifes Produkt | SparkDEX V3/V4, Ēnosys, Kinetic Indexer; FIFO; CoinTracking-CSV; Dashboard; DSGVO-Module | \< 5 Min. TtV; E2E-Tests grün; 50 Beta-Nutzer positiv |
| **Phase 2 — Beta**       | Jun–Aug 2026        | Beta-Test + Härtung | Bug-Fixing (2-Wochen-Sprints), Performance-Optimierung, Security-Audit, WCAG-2.2-Prüfung | SUS-Score \> 70; NPS \> 40; 0 P0-Bugs offen           |
| **Phase 3 — Launch**     | Sept. 2026          | Go-to-Market        | Pricing-Aktivierung; Marketing-Landing-Page; Press-Launch; CoinTracking-Partner-Outreach | ≥ 300 zahlende Nutzer; MRR ≥ € 6.000; Churn \< 5%     |
| **Phase 4 — Scale**      | Okt. 2026 – Q2 2027 | B2B + Multi-Chain   | Stargate-Bridge, Aave V3; ELSTER-XML; Kanzlei-Portal; REST-API; White-Label; LIFO/HIFO   | MRR ≥ € 30.000; ≥ 5 Kanzlei-Kunden; ARR ≥ € 360K      |

**09.2 Sprint-Plan MVP (Phase 1 — Apr. bis Aug. 2026)**

| **Sprint**    | **Zeitraum**       | **Epics**                                 | **Story Points** | **Sprint-Ziel / DoD**                                                             |
|---------------|--------------------|-------------------------------------------|------------------|-----------------------------------------------------------------------------------|
| **Sprint 1**  | 01.–14. Apr.       | EP-01 Wallet-Verbindung (Basis)           | 13 SP            | MetaMask-Connect + Adresseingabe + historischer Import-Job in Queue               |
| **Sprint 2**  | 15.–28. Apr.       | EP-05 EUR-Kursbewertung (FTSO + CG)       | 13 SP            | FTSO-On-Chain-Kurs abrufbar; CoinGecko-Fallback aktiv; Audit-Log-Eintrag erstellt |
| **Sprint 3**  | 29\. Apr.–12. Mai  | EP-02 SparkDEX V3 Swap-Indexer            | 21 SP            | SparkDEX-V3-Swaps vollständig klassifiziert; E2E-Test gegen echte TX              |
| **Sprint 4**  | 13.–26. Mai        | EP-02 SparkDEX V4 + Multi-Action          | 13 SP            | V4-Multi-Action korrekt aufgeteilt; Gamma-Positionen erkannt; alle Tests grün     |
| **Sprint 5**  | 27\. Mai–09. Jun.  | EP-03 Ēnosys DEX + CDP (Basis)            | 21 SP            | Ēnosys-AMM-Swaps + CDP-Eröffnung erkannt; Dual-Szenario-Modal implementiert       |
| **Sprint 6**  | 10.–23. Jun.       | EP-04 Kinetic Market Indexer              | 21 SP            | Supply/Borrow/Repay/Liquidation korrekt klassifiziert; kToken-Delta-Berechnung    |
| **Sprint 7**  | 24\. Jun.–07. Jul. | EP-06 TX-Klassifikations-Engine + Ampel   | 34 SP            | 5-Layer-Klassifikations-Engine fertig; Ampel-System im Dashboard sichtbar         |
| **Sprint 8**  | 08.–21. Jul.       | EP-07 CoinTracking CSV-Export             | 13 SP            | CSV-Export in korrektem Format; E2E-CoinTracking-Import-Test grün; Audit-Log      |
| **Sprint 9**  | 22\. Jul.–04. Aug. | EP-08 Dashboard + EP-09 Graubereich-Ampel | 21 SP            | Portfolio-Dashboard vollständig; Freigrenze-Anzeige; Haltefrist-Tracker           |
| **Sprint 10** | 05.–18. Aug.       | EP-10 Manuelle TX + EP-11 FlareDrops      | 8+8=16 SP        | Manuell-Kategorisierung UI; FlareDrops-Import; DSGVO-Löschfunktion                |
| **Sprint 11** | 19\. Aug.–Sept.    | Härtung, Security, WCAG, Performance      | Buffer           | 0 P0/P1 Bugs; WCAG 2.2 AA; TtV \< 5 Min.; k6-Test 500 VUs bestanden               |

| **10** | **Risiko-Register & Mitigationsstrategien** |
|--------|---------------------------------------------|

**10.1 Technische Risiken**

| **Risiko-ID** | **Risiko**                                               | **Wahrscheinlichkeit** | **Impact** | **Mitigation**                                                                             | **Frühwarnung**                            |
|---------------|----------------------------------------------------------|------------------------|------------|--------------------------------------------------------------------------------------------|--------------------------------------------|
| **R-T01**     | SparkDEX V4-Subgraph nicht vollständig / veraltet        | MITTEL                 | HOCH       | Dualer Ansatz: Subgraph + direkter RPC-Fallback (eth_getLogs); ABI-Registry aktuell halten | Subgraph-Sync-Lag \> 5 Min. → Alert        |
| **R-T02**     | FTSO-Preisfeed-Ausfall (\< 0,1% historisch)              | NIEDRIG                | HOCH       | Automatischer Fallback CoinGecko → CMC → manuelle Eingabe; Alert bei Ausfall               | FTSO-Feed-Age \> 5 Min. → P1-Alert         |
| **R-T03**     | Flare-Network-RPC-Überlastung bei Traffic-Spike          | MITTEL                 | MITTEL     | Multi-Provider-RPC (Ankr, Blast, eigener Hetzner-Node); Connection-Pooling                 | RPC-Error-Rate \> 5% → Fallback aktivieren |
| **R-T04**     | TX-Volume-Explosion: \> 100.000 TX / Wallet              | NIEDRIG                | MITTEL     | Horizontale Indexer-Skalierung; Job-Chunking (1.000 TX/Job); E-Mail-Benachrichtigung       | Indexer-Queue-Depth \> 500 Jobs            |
| **R-T05**     | Fehlerhafte LP-Dual-Szenario-Berechnung durch BMF-Update | HOCH                   | KRITISCH   | Modulares Regelwerk; Update-Sprint \< 1 Woche; Steuerberater-Review-Abo                    | BMF-Schreiben-Monitoring (RSS/Alert)       |

**10.2 Rechtliche & Compliance-Risiken**

| **Risiko-ID** | **Risiko**                                             | **Wahrscheinlichkeit** | **Impact** | **Mitigation**                                                                   | **Status**                 |
|---------------|--------------------------------------------------------|------------------------|------------|----------------------------------------------------------------------------------|----------------------------|
| **R-L01**     | Neues BMF-Schreiben ändert LP/CDP-Steuerlogik          | HOCH (jährlich)        | HOCH       | Modulares Steuerregelwerk; Anwalt-Watchdog; \< 1-Woche-Update-Sprint             | Aktiv monitoren            |
| **R-L02**     | EuGH/BFH-Urteil stuft DeFi-Staking anders ein          | MITTEL                 | HOCH       | Dual-Szenario-Engine auf alle Graubereich-TX erweiterbar; Disclaimer-System      | Rechtsprechungs-Alert      |
| **R-L03**     | DSGVO-Verstoß durch unzureichende Löschfunktion        | NIEDRIG                | KRITISCH   | Art. 17-Löschung vollständig implementiert; monatlicher DSGVO-Audit              | Löschtest monatlich        |
| **R-L04**     | DAC8: Tool wird als VASP eingestuft (unwahrscheinlich) | SEHR NIEDRIG           | SEHR HOCH  | Rechtsberatung vor Phase-4-API-Launch; Read-only-Architektur dokumentiert        | Vor API-Launch prüfen      |
| **R-L05**     | Haftung durch fehlerhafte Steuerberechnung (§ 280 BGB) | MITTEL                 | HOCH       | AGB-Disclaimer 'Kein Ersatz für Steuerberatung'; Empfehlung Steuerberater-Review | Disclaimer in jedem Export |

**10.3 Business-Risiken**

| **Risiko-ID** | **Risiko**                                          | **Wahrscheinlichkeit** | **Impact** | **Mitigation**                                                                                  |
|---------------|-----------------------------------------------------|------------------------|------------|-------------------------------------------------------------------------------------------------|
| **R-B01**     | CoinTracking oder Blockpit kündigt Flare-Support an | HOCH (12–18 Mon.)      | SEHR HOCH  | First-Mover-Bindung; Phase-4-Multi-Chain-Beschleunigung; B2B-Kanzlei-Segment intensivieren      |
| **R-B02**     | Flare-Network-TVL stagniert oder schrumpft          | MITTEL                 | HOCH       | Phase-4-Pivot zu Multi-Chain (Aave, Arbitrum) bereits in Roadmap; Aave-Integration priorisieren |
| **R-B03**     | Hohe Churn-Rate (\> 5%/Monat) nach Launch           | MITTEL                 | HOCH       | Onboarding-Optimierung (TtV \< 5 Min.); Jahres-Abo-Incentive (–17%); NPS-Survey nach 14 Tagen   |
| **R-B04**     | Kein Product-Market-Fit bei Kanzleien (Phase 4)     | MITTEL                 | MITTEL     | Kanzlei-Interviews vor Phase-4-Entwicklung; MVP-Kanzlei-Portal mit 3 Early-Adoptern validieren  |
| **R-B05**     | Team-Ressourcen für MVP unzureichend                | MITTEL                 | HOCH       | Sprint-Puffer (Sprint 11 = reine Härtung); klare MoSCoW-Priorisierung; Should/Could verschieben |

| **11** | **Definition of Done & Acceptance Criteria** |
|--------|----------------------------------------------|

**11.1 Definition of Done (DoD) — Feature-Level**

- Alle Akzeptanzkriterien der zugehörigen User Story erfüllt und durch Reviewer bestätigt

- Unit Tests (Vitest): Coverage ≥ 80% für geänderte Module; alle Tests grün

- Integration Tests: Datenbankabfragen und API-Endpoints getestet; kein flaky Test

- E2E-Tests (Playwright): Critical-Path für Feature manuell + automatisiert getestet

- Accessibility: axe-core 0 Violations (WCAG 2.2 AA) für neuen UI-Code

- Security: npm audit keine High/Critical Findings; Zod-Validierung auf allen neuen Endpoints

- Performance: p95 API-Response \< 500ms; kein Lighthouse-Score-Rückgang \> 5 Punkte

- Code-Review: Mindestens 1 Reviewer-Approval (Pull Request); kein direkter Push auf main

- Dokumentation: Inline-Kommentare für komplexe Logik; API-Endpoint in OpenAPI-Spec ergänzt

- Deployment: Feature erfolgreich in Staging deployed; Smoke-Test auf Staging bestanden

- GoBD: Wenn Audit-Log-relevant — SHA-256-Hash-Kette validiert; Unveränderlichkeit getestet

**11.2 Definition of Done — Sprint-Level**

- Alle Feature-DoD-Kriterien für alle Sprint-Items erfüllt

- Sprint-Demo mit Product Owner durchgeführt; Feedback dokumentiert

- Keine offenen P0- oder P1-Bugs am Sprint-Ende (P2 und P3 in Backlog dokumentiert)

- Velocity-Tracking aktualisiert; Burndown-Chart exportiert

- Retrospektive abgehalten; Action Items im nächsten Sprint-Backlog

**11.3 Definition of Done — MVP-Launch-Level**

| **Kriterium**                       | **Zielwert**                                                              | **Test-Methode**                                              | **Verantwortlich**    |
|-------------------------------------|---------------------------------------------------------------------------|---------------------------------------------------------------|-----------------------|
| **TtV (Time-to-Value)**             | \< 5 Min. für ≥ 4/5 Onboarding-Test-Teilnehmer                            | Think-Aloud-Onboarding-Test mit 5 Nutzern (Aug. 2026)         | Product + UX          |
| **CoinTracking CSV-Kompatibilität** | 100% der TX-Typen valide; CT-Import ohne Fehler                           | E2E-Integrationstest: Export → CT-Import → 0 Fehler           | Engineering           |
| **WCAG 2.2 AA**                     | 0 automatische Violations (axe); 0 manuell identifizierte Blocking-Issues | axe-core in CI/CD; manuelle Tastatur-Navigation-Prüfung       | UX + QA               |
| **Performance-Last-Test**           | 500 simultane Nutzer ohne Degradation (p95 \< 500ms)                      | k6-Last-Test; 5 Min. bei 500 VUs                              | DevOps                |
| **Security-Audit**                  | 0 kritische / 0 hohe CVSS-Findings                                        | Externes Pentest-Assessment oder interner OWASP-ASVS-L2-Check | CTO + extern          |
| **DSGVO-Compliance**                | Löschfunktion getestet (\< 30 Tage); TOM-Dokument vollständig             | Manueller Löschtest; DSGVO-Checkliste abgehakt                | CEO + DSB             |
| **BMF-2025-Validierung**            | LP-Dual-Szenario + alle TX-Typen von Steuerberater freigegeben            | Steuerberater-Review-Protokoll vorliegend                     | Legal + Steuerberater |
| **Beta-Nutzerfeedback**             | NPS ≥ 40; SUS-Score ≥ 70 aus Beta-Test                                    | In-App-Survey (14 Tage nach Beta-Registrierung)               | Product               |

**11.4 Testing-Pyramide**

| **Test-Typ**          | **Tool**               | **Coverage-Ziel**                 | **Scope**                                                                                 | **CI/CD-Stage**          |
|-----------------------|------------------------|-----------------------------------|-------------------------------------------------------------------------------------------|--------------------------|
| **Unit Tests**        | Vitest                 | ≥ 80% (geänderte Module)          | TX-Klassifikations-Engine, FIFO-Berechnung, Dual-Szenario, Freigrenze                     | Stage 1 — bei jedem PR   |
| **Integration Tests** | Vitest + Test-DB       | ≥ 70% (kritische Flows)           | API-Endpoints, DB-Queries, ABI-Decoding, Preis-Feed-Fallback                              | Stage 1 — bei jedem PR   |
| **E2E-Tests**         | Playwright             | Critical Paths (6 Flows)          | Onboarding, Wallet-Connect, TX-Review-Flow, CSV-Export, Manuell-Klassifikation, Login/2FA | Stage 2 — bei main-Merge |
| **Accessibility**     | axe-core               | 0 WCAG 2.2 AA Violations          | Alle UI-Seiten + neue Komponenten                                                         | Stage 2 — bei main-Merge |
| **Performance-Tests** | k6                     | p95 \< 500ms bei 500 VUs          | API-Endpoints + DB-Queries                                                                | Stage 3 — wöchentlich    |
| **Security-Scan**     | npm audit + Semgrep    | 0 Critical/High                   | Alle Dependencies + Custom Code                                                           | Stage 1 — bei jedem PR   |
| **Visual Regression** | Playwright Screenshots | Kein unerwarteter visueller Bruch | UI-Komponenten                                                                            | Stage 2 — optional       |

| **12** | **Glossar & Referenzdokumente** |
|--------|---------------------------------|

**12.1 Fachbegriff-Glossar**

| **Begriff**                            | **Definition**                                                                                   | **PRD-Kontext**                                            |
|----------------------------------------|--------------------------------------------------------------------------------------------------|------------------------------------------------------------|
| **ABI (Application Binary Interface)** | Schnittstellen-Beschreibung eines Smart Contracts; definiert Events und Funktionen               | Für Event-Decoding der Protokoll-TX erforderlich           |
| **Audit-Log (GoBD)**                   | Unveränderliches Protokoll aller Datenänderungen mit SHA-256-Hash-Kette                          | Pflicht für GoBD-Konformität; 10 Jahre Aufbewahrung        |
| **Ampel-System**                       | Farbkodiertes UI-Element: Grün=klar, Gelb=Graubereich, Rot=manuell, Grau=irrelevant              | Kernfeature für TX-Review-Flow                             |
| **BMF 2025**                           | BMF-Schreiben vom 06.03.2025 (BStBl 2025 I S. 658) zur Besteuerung von Kryptowährungen           | Rechtliche Grundlage für alle Steuerberechnungen           |
| **CoinTracking-Export**                | 15-Spalten-CSV-Format für Import in CoinTracking.info                                            | Kern-Exportformat; E2E-getestet                            |
| **DAC8**                               | EU-Richtlinie 2023/2226 zur automatischen Meldung von Krypto-Transaktionen ab 2026               | Compliance-Anforderung; kein VASP-Status für DeFi Tracker  |
| **Dual-Szenario (LP)**                 | Zwei steuerliche Interpretationsmodelle für LP-Providing: Tausch (A) vs. Nutzungsüberlassung (B) | Kernfeature für Graubereich-TX-Handling                    |
| **Epic**                               | Gruppe zusammengehöriger User Stories unter einem Thema                                          | Planungseinheit im Sprint-Plan                             |
| **FIFO**                               | First In, First Out — gesetzliche Standard-Bewertungsmethode für Krypto DE                       | Default-Bewertungsmethode; MVP                             |
| **FTSO (Flare Time Series Oracle)**    | Dezentrales On-Chain-Preisorakel auf Flare Network; liefert EUR-Feeds                            | Primäre Kursquelle; BMF-2025-konform                       |
| **GoBD**                               | Grundsätze ordnungsmäßiger Buchführung; BMF-Schreiben 28.11.2019                                 | Pflicht für Audit-Log und unveränderliche Datenspeicherung |
| **Graubereich**                        | Steuerlich nicht eindeutig geregelte DeFi-TX (LP, CDP, Bridge)                                   | Dual-Szenario + Ampel-Gelb                                 |
| **ICE-Score**                          | Impact × Confidence × Ease — Priorisierungs-Framework für Experimente                            | Experiment-Backlog-Priorisierung                           |
| **LP-Token**                           | Nachweis über Liquiditätsanteil in einem AMM-Pool                                                | Kritisch für LP-Provide/Remove-Klassifikation              |
| **MoSCoW**                             | Must/Should/Could/Won't — Priorisierungs-Framework für Requirements                              | User-Story-Priorisierung in diesem PRD                     |
| **NFR**                                | Non-Functional Requirement — Qualitätsanforderung (Performance, Security, Compliance)            | Kapitel 05 dieses PRDs                                     |
| **Story Points (SP)**                  | Relatives Aufwands-Maß (Fibonacci-Skala: 1, 2, 3, 5, 8, 13, 21, 34, 55)                          | Sprint-Kapazitätsplanung                                   |
| **TtV (Time-to-Value)**                | Zeit von Wallet-Connect bis erstem grünen Ampel-TX                                               | Kern-KPI: Ziel \< 5 Minuten                                |
| **tRPC**                               | TypeScript-Remote-Procedure-Call; type-safe API ohne Code-Gen                                    | API-Framework zwischen Next.js Frontend und Backend        |
| **WCAG 2.2 AA**                        | Web Content Accessibility Guidelines; Level AA = rechtliche Mindestanforderung (BFSG)            | Accessibility-Standard; Pflicht ab 28.06.2025              |

**12.2 Referenzdokumente**

| **Dokument**                     | **Beschreibung**                                                   | **Ablageort / Version**                |
|----------------------------------|--------------------------------------------------------------------|----------------------------------------|
| **DeFi Tracker Vollanalyse v10** | Vollständige technische und regulatorische Analyse (7.665 Absätze) | DeFi_Tracker_Komplett_v10_NextGen.docx |
| **Brand Book KOMPLETT v1.0**     | Markenhandbuch mit allen Kapiteln 01–06 (3.978 Absätze)            | DeFiTracker_BrandBook_KOMPLETT_v1.docx |
| **Admin Dashboard**              | Interaktives Admin-Dashboard für Operations                        | DeFiTracker_AdminDashboard.html        |
| **BMF-Schreiben 06.03.2025**     | Besteuerung von Kryptowährungen (BStBl 2025 I S. 658)              | Extern: BMF.de                         |
| **CoinTracking Import-Format**   | CSV-Formatspezifikation für CoinTracking.info                      | Extern: CoinTracking Dokumentation     |
| **WCAG 2.2**                     | Web Content Accessibility Guidelines Version 2.2                   | Extern: w3.org/TR/WCAG22/              |
| **OWASP ASVS Level 2**           | Application Security Verification Standard                         | Extern: owasp.org/ASVS                 |
| **GoBD (BMF 28.11.2019)**        | Grundsätze ordnungsmäßiger Buchführung                             | Extern: BMF.de                         |
| **DAC8 (EU-RL 2023/2226)**       | Reporting-Pflichten für Krypto-Dienstleister                       | Extern: EUR-Lex                        |
| **DSGVO (VO EU 2016/679)**       | Datenschutz-Grundverordnung                                        | Extern: EUR-Lex                        |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>DeFi Tracker SaaS — Product Requirements Document v2.0</strong></p>
<p>NextGen IT Solutions GmbH · Stuttgart · März 2026 · Vertraulich</p>
<p>12 Kapitel · 12 User Stories · 50+ Functional Requirements · 30+ NFRs · 15 Risiken · 11 Sprint-Plan</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>DeFiTracker</strong></p>
<p><strong>PRD v2.0 — ERGÄNZUNG: KAPITEL 09 (VOLLSTÄNDIG)</strong></p>
<p>Roadmap Phase 0–4: Ziele · Deliverables · Team · Budget · Sprint-Plan Phase 4 · Compliance-Roadmap R10</p>
<p>Ergänzung zum PRD v2.0 · NextGen IT Solutions GmbH · März 2026</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**09 Release-Plan & Meilensteine — Vollständige Phasenbeschreibung**

Die folgende Beschreibung ergänzt die Roadmap-Übersichtstabelle um vollständige Ziel-Statements, Deliverables, Team-Besetzung, Budget und Compliance-Maßnahmen für jede der fünf Entwicklungsphasen. Grundlage ist die Roadmap v1.0 (März 2026).

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>ROADMAP-KENNZAHLEN</strong></p>
<p>Gesamtdauer: 12 Monate (April 2026 – Q1 2027) · MVP-Kosten: € 62.000–87.000 · MVP-Launch: September 2026 · Ziel-Protokolle (gesamt): 6 DeFi-Protokolle · Zielmärkte: B2C + B2B · Break-Even: Q2 2027 bei 1.590 zahlenden Nutzern</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 10%" />
<col style="width: 61%" />
<col style="width: 28%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>P0</strong></th>
<th><p><strong>Discovery — Technische Grundlagen &amp; Rechtsvalidierung</strong></p>
<p>April 2026</p></th>
<th><strong>4 Wochen</strong></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>ZIEL PHASE 0</strong></p>
<p>Technische und rechtliche Grundlagen schaffen, bevor mit der Entwicklung begonnen wird. Alle Subgraph-Quellen validieren, Steuerrechts-Graubereiche klären, DSGVO-Konzept erstellen und erste Nutzerfeedbacks aus der Flare-Community einholen.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**Deliverables & Aufgaben (Phase 0)**

| **Aufgabe**                           | **Beschreibung**                                                                                            | **Verantwortlich**     | **Deliverable**                                            |
|---------------------------------------|-------------------------------------------------------------------------------------------------------------|------------------------|------------------------------------------------------------|
| **Technische Architektur definieren** | Systemarchitektur (7-Layer), Tech-Stack-Entscheidungen, Datenbankschema v1 dokumentieren                    | CTO                    | Architekturdokument DOCX + Draw.io-Diagramm                |
| **Smart-Contract-ABIs sammeln**       | ABIs aller 6 Ziel-Protokolle beschaffen: SparkDEX V4, Ēnosys V3+CDP, Kinetic, Stargate, Aave V3             | Backend-Dev            | ABI-Registry-Ordner (JSON-Dateien)                         |
| **Steuerrechts-Validierung**          | BMF 2025: LP-Graubereich, CDP-Einordnung, FlareDrop-Besteuerungszeitpunkt durch Steuerberater prüfen lassen | Steuerberater (extern) | Steuerberater-Gutachten + Mapping-Freigabe                 |
| **The Graph Subgraph-Audit**          | Verfügbare Subgraphs für SparkDEX V4 und Ēnosys V3 auf Vollständigkeit und Aktualität prüfen                | Backend-Dev            | Subgraph-Audit-Report; RPC-Fallback-Strategie dokumentiert |
| **10 Nutzerinterviews**               | Flare-Community-Mitglieder zu ihren TX-Tracking-Problemen befragen (Discord, Telegram)                      | CEO / Product          | Interview-Protokoll; Top-5-Probleme identifiziert          |
| **Wettbewerbsmonitoring**             | Blockpit, Koinly, CoinTracking auf Flare-Support prüfen; Battle-Cards erstellen                             | CEO                    | Wettbewerbs-Matrix; Alert-System für Flare-Integrationen   |
| **DSGVO-Datenschutzkonzept**          | DSFA (Art. 35 DSGVO) für Finanzdaten-Verarbeitung; VASP/CASP-Status klären (§ 2 GwG)                        | CEO + Rechtsberater    | DSFA-Dokument; VASP-Rechtsgutachten (Kurzform)             |
| **Sprint-Struktur aufsetzen**         | GitHub-Repos anlegen; CI/CD-Pipeline (GitHub Actions) konfigurieren; Sprint-Kalender festlegen              | DevOps                 | CI/CD läuft grün; Sprint-1-Backlog befüllt                 |

**Team & Ressourcen (Phase 0)**

| **Rolle**                           | **Aufwand**         | **Kosten (Schätzung)** | **Anmerkung**                                          |
|-------------------------------------|---------------------|------------------------|--------------------------------------------------------|
| **Senior Backend-Dev (Blockchain)** | 4 Wochen (Vollzeit) | € 8.000–10.000         | ABI-Sammlung, Subgraph-Audit, Architektur-Entscheidung |
| **Krypto-Steuerberater (extern)**   | 0,5 Wochen Beratung | € 2.000–4.000          | LP/CDP-Graubereich-Validierung; Einmalig Phase 0       |
| **CEO / Product**                   | 2 Wochen (Teilzeit) | intern                 | Nutzerinterviews, Wettbewerbsmonitoring, VASP-Klärung  |
| **Rechtsberater (extern)**          | 0,5 Wochen Beratung | € 1.500–3.000          | DSFA, VASP-Gutachten; Einmalig                         |

**Erfolgs-Kriterien (Phase-0-Gate)**

- Alle 6 Protokoll-ABIs beschafft und in ABI-Registry eingecheckt (GitHub)

- Steuerberater hat LP/CDP/Bridge-Mapping freigegeben (schriftlich)

- DSFA erstellt; VASP-Status als 'kein GwG-Verpflichteter' bestätigt

- Subgraphs für SparkDEX V4 + Ēnosys V3 als tauglich bewertet (oder RPC-Fallback dokumentiert)

- CI/CD-Pipeline läuft; Sprint-1-Backlog vollständig priorisiert

- ≥ 10 Nutzerinterviews abgeschlossen; Top-5-Pain-Points dokumentiert

<table>
<colgroup>
<col style="width: 10%" />
<col style="width: 61%" />
<col style="width: 28%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>P1</strong></th>
<th><p><strong>MVP Build — Kern-Entwicklung &amp; Flare-Integration</strong></p>
<p>Mai – Juli 2026</p></th>
<th><strong>12 Wochen</strong></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>ZIEL PHASE 1</strong></p>
<p>Vollständig funktionsfähiges MVP mit Integration aller drei Flare-nativen Protokolle (SparkDEX V3/V4, Ēnosys DEX+CDP, Kinetic Market), FTSO-EUR-Kursbewertung, CoinTracking-CSV-Export (15 Spalten) und FIFO-Steuerberechnung nach BMF 2025. Time-to-Value: &lt; 5 Minuten.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**Deliverables & Aufgaben (Phase 1)**

| **Aufgabe**                                  | **Sprint** | **Beschreibung**                                                                                             | **Akzeptanz**                                                       |
|----------------------------------------------|------------|--------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------|
| **Flare Network Wallet-Import & TX-Indexer** | S1–S2      | Multi-Wallet-Connect (MetaMask, WalletConnect, manuell); historischer Import ab Block 0; Real-Time WebSocket | 100% TX importiert; kein Duplikat; Fortschrittsanzeige              |
| **FTSO EUR-Kursbewertung**                   | S2         | On-Chain-FTSO-Kurs zum Block-Timestamp; CoinGecko + CMC Fallback; Audit-Log-Eintrag je TX                    | FTSO-Kurs-Abweichung \< 0,1%; Kursquelle im Log                     |
| **SparkDEX V3/V4 Indexer**                   | S3–S4      | Swap, LP Provide/Remove, Farming, Staking, Perps; V4-Multi-Action aufteilen; Gamma-Positionen                | E2E-Test gegen echte TX grün; alle CT-Typen korrekt                 |
| **Ēnosys DEX + CDP Indexer**                 | S5         | AMM-Swaps, CDP-Loans, Farming-Rewards; Dual-Szenario-Modal für CDP                                           | Dual-Szenario A/B funktioniert; Graubereich-Ampel gelb              |
| **Kinetic Market Indexer**                   | S6         | Supply/Borrow/Repay/Liquidation; kToken-Delta-Berechnung; Health-Factor-Events                               | Zinsertrag korrekt berechnet; Liquidation als Sonder-TX             |
| **TX-Klassifikations-Engine + Ampel**        | S7         | 5-Layer-Rule-Engine; Ampel-System (Grün/Gelb/Rot/Grau); Dual-Szenario-Logik                                  | Ampel korrekt für 100% der Test-TX; 0 falsche Grün-Klassifikationen |
| **CoinTracking CSV-Export**                  | S8         | 15-Spalten-Format; Pre-Export-Validierung; Audit-Log-Versionierung (GoBD)                                    | CoinTracking-Import 0 Fehler (E2E-Integrationstest)                 |
| **Portfolio-Dashboard**                      | S9         | KPI-Kacheln, Haltefrist-Tracker, Freigrenze-Balken, Ampel-Donut, TX-Liste                                    | Dashboard lädt \< 2s; WCAG 2.2 AA; Freigrenze korrekt               |
| **Manuelle TX-Klassifikation**               | S10        | UI-Flow für rote Ampel-TX; alle CT-Typen als Dropdown; Bulk-Klassifikation                                   | Nutzer kann alle TX manuell klassifizieren; Log-Eintrag             |
| **DSGVO-Module**                             | S10        | Datenschutzerklärung + Impressum; Lösch-Funktion (Art. 17); Cookie-Consent-Banner                            | Löschtest: Alle Daten innerhalb 30 Tagen gelöscht                   |
| **Auth + 2FA (TOTP)**                        | S1         | NextAuth.js v5; JWT + Refresh-Token; TOTP optional Phase 1                                                   | Login \< 3s; 2FA-Enrollment erfolgreich                             |
| **Pricing-Tiers (technisch)**                | S10        | Starter/Pro/Business in Stripe integriert; Feature-Flags je Plan; Trial-Modus (20 TX free)                   | Paywall korrekt enforced; Upgrade-Prompt bei Limit                  |

**Team & Budget (Phase 1)**

| **Rolle**                           | **Aufwand**          | **Kosten**          | **Kernaufgaben**                                                              |
|-------------------------------------|----------------------|---------------------|-------------------------------------------------------------------------------|
| **Senior Backend-Dev (Blockchain)** | 12 Wochen (Vollzeit) | € 24.000–32.000     | Protokoll-Indexer (SparkDEX, Ēnosys, Kinetic), FTSO-Integration, ABI-Decoding |
| **Backend-Dev (Node.js / API)**     | 12 Wochen (Vollzeit) | € 15.000–21.000     | tRPC-API, Steuerberechnungs-Engine (FIFO/Dual-Szenario), Export-Engine, Auth  |
| **Frontend-Dev (Next.js)**          | 12 Wochen (Vollzeit) | € 10.000–14.000     | Dashboard, Onboarding-Flow, Ampel-UI, Wallet-Connect-Modal                    |
| **DevOps / Cloud (Hetzner)**        | 4 Wochen (Teilzeit)  | € 4.000–6.000       | CI/CD-Pipeline, Docker+Coolify, PostgreSQL+Redis, Monitoring                  |
| **QA & Testing**                    | 4 Wochen (Teilzeit)  | € 4.000–6.000       | E2E-Tests (Playwright), k6-Performance-Tests, WCAG-axe-Audit                  |
| **GESAMT PHASE 1**                  | **~32 PM-Wochen**    | **€ 57.000–79.000** | Zzgl. Infrastructure (Hetzner ~€ 200/Monat) + Steuerberater-Review            |

<table>
<colgroup>
<col style="width: 10%" />
<col style="width: 61%" />
<col style="width: 28%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>P2</strong></th>
<th><p><strong>Beta — Geschlossener Beta-Test &amp; Validierung</strong></p>
<p>August 2026</p></th>
<th><strong>4 Wochen</strong></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>ZIEL PHASE 2</strong></p>
<p>50 Early-Adopter aus der Flare DeFi Community testen den MVP intensiv. Alle gefundenen Bugs werden behoben, der Steuerberater validiert alle 35+ TX-Mappings, und die CoinTracking-CSV-Kompatibilität wird End-to-End getestet. SUS-Score ≥ 70; NPS ≥ 40.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**Deliverables & Aufgaben (Phase 2)**

| **Aufgabe**                           | **Beschreibung**                                                                                                                   | **Verantwortlich**         | **Erfolgs-Kriterium**                                                              |
|---------------------------------------|------------------------------------------------------------------------------------------------------------------------------------|----------------------------|------------------------------------------------------------------------------------|
| **Beta-Recruiting: 50 Early-Adopter** | Flare-Community (Discord, Telegram, Reddit r/FlareNetworks) — Mix: 60% Einsteiger, 40% Experten; Incentive: 3 Monate Pro kostenlos | CEO + Community Manager    | 50 registrierte Beta-Nutzer mit aktivem Flare-Wallet                               |
| **Onboarding-Usability-Test**         | 5 Think-Aloud-Tests (3× Lena-Profil, 2× Kai-Profil); Session-Recording; TtV-Messung                                                | Product + UX               | TtV \< 5 Min. bei ≥ 4/5; SUS-Score ≥ 70; Top-3-Probleme dokumentiert               |
| **Bug-Fixing-Sprint (2 Wochen)**      | Alle P0/P1-Bugs aus Beta-Feedback beheben; Weekly-Builds für Beta-Tester                                                           | Engineering                | 0 offene P0-Bugs; \< 5 offene P1-Bugs am Ende Phase 2                              |
| **CoinTracking E2E-Import-Test**      | Exporte aus 10 verschiedenen Flare-Wallets (div. TX-Typen) direkt in CoinTracking importieren                                      | Backend-Dev + QA           | 100% der Test-Exporte werden von CoinTracking akzeptiert (0 Fehler)                |
| **Steuerberater-Abnahme**             | Alle 35+ TX-Typen-Mappings von qualifiziertem Steuerberater prüfen lassen; Protokoll erstellen                                     | CEO + Steuerberater extern | Schriftliche Freigabe aller TX-Mappings (§ 22/§ 23 EStG, LP-Dual-Szenario)         |
| **Performance-Optimierung Indexer**   | Sync-Latenz auf \< 30s optimieren; DB-Query-Plan-Optimierung; Redis-Cache für häufige Queries                                      | Backend-Dev + DevOps       | p95 API \< 500ms; Indexer-Lag \< 30s bei 1.000 TX/Wallet                           |
| **Security-Audit (intern)**           | OWASP-ASVS-L2-Check intern durchführen; Wallet-Datenspeicherung prüfen; API-Keys testen                                            | CTO                        | 0 kritische/hohe CVSS-Findings; Pentest-Scope für externe Prüfung Q3 2027          |
| **Nutzerdokumentation erstellen**     | FAQ (20 häufigste Fragen), Kurzanleitung, In-App-Tooltips, Graubereich-Erklärungstexte                                             | Product + Content          | FAQ live; alle Tooltips in Deutsch; Graubereich-Erklärung verständlich (Lena-Test) |
| **WCAG-2.2-AA-Prüfung**               | axe-core-Audit aller Screens; manuelle Tastatur-Navigation-Prüfung; Screen-Reader-Test (NVDA)                                      | UX + QA                    | 0 WCAG-2.2-AA-Violations; alle interaktiven Elemente tastatur-navigierbar          |

**Team & Budget (Phase 2)**

| **Rolle**                         | **Aufwand**         | **Kosten**          | **Aufgabe**                                                 |
|-----------------------------------|---------------------|---------------------|-------------------------------------------------------------|
| **Backend-Dev × 2**               | 4 Wochen (Vollzeit) | € 8.000–12.000      | Bug-Fixing, Performance-Optimierung, CoinTracking-E2E-Tests |
| **QA Engineer**                   | 4 Wochen (Vollzeit) | € 4.000–6.000       | Systematisches Bug-Testing, WCAG-Audit, Usability-Tests     |
| **Krypto-Steuerberater (extern)** | 1 Woche (Intensiv)  | € 3.000–5.000       | TX-Mapping-Abnahme; schriftliche Freigabe                   |
| **GESAMT PHASE 2**                | **~12 PM-Wochen**   | **€ 15.000–23.000** | Zzgl. Beta-Nutzer-Incentive (~€ 1.500 für 50× 3 Monate Pro) |

<table>
<colgroup>
<col style="width: 10%" />
<col style="width: 61%" />
<col style="width: 28%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>P3</strong></th>
<th><p><strong>Launch — Go-to-Market &amp; Markteinführung</strong></p>
<p>September 2026</p></th>
<th><strong>Go-Live</strong></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>ZIEL PHASE 3 + STRATEGISCHES TIMING</strong></p>
<p>Öffentlicher Launch auf app.defi-tracker.de. Pricing-Tiers aktivieren, Marketing-Kampagnen starten, strategische Partnerschaften einleiten. STRATEGISCHER VORTEIL: Der Launch im September 2026 ist unmittelbar vor der Hochsaison der Steuererklärungen (Abgabe bis 31.07.2027) und zeitgleich mit dem DAC8-Compliance-Druck, der Krypto-Nutzer ab 2026 erstmals systematisch erfasst. First-Mover-Fenster: 12–18 Monate.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**Deliverables & Aufgaben (Phase 3)**

| **Aufgabe**                             | **Beschreibung**                                                                                            | **Verantwortlich** | **KPI**                                                              |
|-----------------------------------------|-------------------------------------------------------------------------------------------------------------|--------------------|----------------------------------------------------------------------|
| **Public Launch: app.defi-tracker.de**  | Produktionsumgebung live schalten; DNS-Konfiguration; Monitoring aktivieren (Prometheus + Grafana + Sentry) | DevOps + CTO       | Uptime \> 99,5% am Launch-Tag; 0 P0-Vorfälle                         |
| **Pricing-Aktivierung**                 | Starter/Pro/Business/Kanzlei-Pläne in Stripe aktivieren; Jahres-Toggle; 30-Tage-Geld-zurück-Garantie        | Product + CEO      | Zahlungsflow funktioniert; Stripe-Webhook verarbeitet Events         |
| **Marketing-Launch (Owned)**            | Landing Page final; SEO-Artikel (5×) live; E-Mail-Warteliste konvertieren                                   | Content + SEO      | ≥ 500 Registrierungen in Woche 1; E-Mail-Open-Rate \> 40%            |
| **Community-PR (Earned)**               | Blocktrainer Forum + Discord-Post; Reddit r/CryptoCurrency DE + r/FlareNetworks; X/Twitter-Thread           | Community Manager  | ≥ 50 organische Diskussions-Kommentare; ≥ 3 DeFi-Influencer-Mentions |
| **Krypto-Medien PR**                    | Pressemitteilung an BTC-ECHO, Coin-Ratgeber, Cryptomonday; exklusives Interview CEO                         | CEO                | ≥ 2 publizierte Artikel; ≥ 1 ausführliche Review                     |
| **Flare Network Foundation — Partner**  | Ecosystem-Grant-Antrag; Listing auf flare.network/ecosystem; Co-Marketing-Agreement                         | CEO                | Antrag eingereicht; Erwähnung auf Flare-Website                      |
| **B2B-Outreach Kanzleien**              | 5 Steuerberatungskanzleien persönlich kontaktieren (Stuttgart + Frankfurt); Demo-Gespräche buchen           | CEO + Sales        | ≥ 3 Demo-Gespräche vereinbart; 1 Kanzlei-Trial gestartet             |
| **CoinTracking-Partner-Zertifizierung** | Certified-Partner-Status bei CoinTracking beantragen; Import-Kompatibilität nachweisen                      | Product + CEO      | Antrag eingereicht; Partner-Badge angestrebt                         |
| **Support-System einrichten**           | Zendesk oder Crisp einrichten; FAQ live; erste-Antwort-Zeit \< 4h (Werktage)                                | Support + Product  | First-Response-Time \< 4h; CSAT ≥ 4,0/5,0 nach 30 Tagen              |
| **Trustpilot-Profil + erste Reviews**   | Profil erstellen; erste 10 Beta-Nutzer um Bewertung bitten; Review-Request-Automation einrichten            | Marketing          | ≥ 10 Trustpilot-Bewertungen; Ø ≥ 4,0 Sterne                          |

**Team & Budget (Phase 3)**

| **Rolle**                        | **Aufwand**                     | **Kosten**     | **Aufgabe**                                               |
|----------------------------------|---------------------------------|----------------|-----------------------------------------------------------|
| **Full Dev-Team (on-call)**      | Launch-Woche Vollzeit, dann 50% | € 8.000–12.000 | Hotfixes, Performance-Monitoring, Launch-Day-Bereitschaft |
| **Marketing / Content**          | 4 Wochen (Vollzeit)             | € 4.000–8.000  | Landing Page, PR, Social Media, Community-Management      |
| **CEO / Sales**                  | 4 Wochen (Vollzeit)             | intern         | B2B-Outreach, Partnership-Gespräche, Press-Interviews     |
| **Support (extern oder intern)** | 4 Wochen (Teilzeit)             | € 2.000–3.000  | Helpdesk-Aufbau, FAQ-Pflege, erste User-Support-Tickets   |

**Launch-KPIs (30-Tage-Ziel)**

| **KPI**                 | **Zielwert**                       | **Messung**                            |
|-------------------------|------------------------------------|----------------------------------------|
| **Registrierungen**     | ≥ 300 in Monat 1                   | Mixpanel + Stripe Dashboard            |
| **Zahlende Nutzer**     | ≥ 80 (Trial→Paid Conversion ≥ 15%) | Stripe: subscription_created           |
| **MRR nach 30 Tagen**   | ≥ € 2.000                          | Stripe MRR-Dashboard                   |
| **Churn (Monat 1)**     | \< 5%                              | Stripe: subscription_cancelled / total |
| **NPS (erste Messung)** | ≥ 35 (Basis; optimistisch ≥ 40)    | In-App-Survey D+14                     |
| **Trustpilot**          | ≥ 10 Bewertungen; Ø ≥ 4,0 Sterne   | Trustpilot Dashboard                   |

<table>
<colgroup>
<col style="width: 10%" />
<col style="width: 61%" />
<col style="width: 28%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>P4</strong></th>
<th><p><strong>Skalierung — Multi-Chain, ELSTER &amp; B2B-Portal</strong></p>
<p>Q4 2026 – Q1 2027</p></th>
<th><strong>~6 Monate</strong></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>ZIEL PHASE 4</strong></p>
<p>Erweiterung auf die zwei verbleibenden DeFi-Protokolle (Stargate Finance Cross-Chain-Bridge, Aave V3 Multi-Chain), Einführung steuerlicher Optimierungswerkzeuge (LIFO/HIFO, Graubereich-Szenario-Rechner) und Aufbau des B2B-Steuerberater-Portals mit REST-API und White-Label-Option. Ziel: MRR ≥ € 30.000 (Q2 2027).</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**Deliverables & Aufgaben (Phase 4)**

| **Aufgabe**                                   | **Beschreibung**                                                                                                        | **Epics / USs**     | **Zeitraum**       |
|-----------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|---------------------|--------------------|
| **Stargate Cross-Chain-Bridge Indexer**       | LayerZero Message-ID als Cross-Chain-Anker; Matching Source- und Destination-Chain; steuerneutrale Bridge-Transfers     | EP-13 / US-010      | Q4 2026 Sprint 1–3 |
| **Aave V3 Multi-Chain Integration**           | 12-Chain-Integration (ETH Mainnet, Arbitrum, Polygon, Base…); Lending/Borrowing/Liquidation; kToken-Äquivalent (aToken) | EP-14               | Q4 2026 Sprint 3–6 |
| **LIFO-Steueroptimierungsrechner**            | LIFO als Opt-in-Bewertungsmethode mit explizitem FA-Risiko-Disclaimer; Vergleichsrechner FIFO vs. LIFO                  | EP-18 (Teil)        | Q4 2026 Sprint 2   |
| **HIFO + Tax-Loss-Harvesting**                | HIFO (Highest In, First Out) mit starkem Disclaimer; interaktiver Szenario-Rechner; Steueroptimierungs-Hinweise         | EP-18               | Q4 2026 Sprint 4   |
| **ELSTER XML Export**                         | ELSTER-kompatibles XML; Anlage SO vorausgefüllt; Schema-Validierung; Pflicht-Disclaimer                                 | EP-15 / US-011      | Q1 2027 Sprint 1–2 |
| **Kanzlei-Portal (Multi-Mandant)**            | Mandanten-Übersicht; Mandanten-Einladung; Report-Sharing; Berater-Kommentarfunktion                                     | EP-16               | Q4 2026 Sprint 5–7 |
| **REST-API für B2B-Integration**              | 10 Endpoints (lt. Kapitel 08); API-Key-Verwaltung; Rate-Limiting; OpenAPI-Doku; Sandbox                                 | EP-17               | Q1 2027 Sprint 3–4 |
| **White-Label-Option**                        | Logo/Farbe/Subdomain konfigurierbar; Kanzlei-Datenschutzerklärung integrierbar; ohne DeFi-Tracker-Branding              | EP-17 / US-012      | Q1 2027 Sprint 5   |
| **Portfolio-Analytics Dashboard (erweitert)** | P&L (realisiert + unrealisiert), DeFi-Rendite, Impermanent-Loss-Report, Risikokennzahlen                                | EP-18 (Teil)        | Q1 2027 Sprint 6   |
| **Wallet-Labeling**                           | Automatische Erkennung bekannter Protokoll-Contract-Adressen; Custom-Labels für Wallets                                 | Backlog             | Q4 2026 Sprint 6   |
| **AML-Screening Modul (optional B2B)**        | OFAC + EU-Sanctions-Check via Elliptic/Chainalysis-API für Enterprise-Kanzlei-Kunden                                    | EP-16 (Erweiterung) | Q1 2027 Sprint 7   |
| **AT / CH Steuerrecht (Phase 4 — DACH)**      | Österreich: öEStG-Mapping; Schweiz: CH-spezifische Hinweise (keine Kapitalgewinnsteuer auf Privatvermögen)              | Backlog             | Q2 2027            |

**Sprint-Plan Phase 4 (Q4 2026 – Q1 2027)**

| **Sprint** | **Zeitraum**        | **Epics / Aufgaben**                                                         | **Story Points** | **Sprint-Ziel**                                                             |
|------------|---------------------|------------------------------------------------------------------------------|------------------|-----------------------------------------------------------------------------|
| **P4-S1**  | Okt. 2026 Woche 1–2 | Stargate-Indexer Basis (EP-13); LayerZero-Message-ID-Matching                | 21 SP            | Stargate-TX von Flare nach ETH korrekt als steuerneutraler Transfer erkannt |
| **P4-S2**  | Okt. 2026 Woche 3–4 | Stargate vollständig (EP-13); LIFO-Rechner (EP-18 Teil)                      | 13+8=21 SP       | E2E-Test Cross-Chain-Matching; LIFO-Toggle mit Disclaimer funktioniert      |
| **P4-S3**  | Nov. 2026 Woche 1–2 | Aave V3 Basis: ETH Mainnet + Arbitrum (EP-14)                                | 34 SP            | Supply/Borrow/Repay auf Aave ETH + Arbitrum korrekt klassifiziert           |
| **P4-S4**  | Nov. 2026 Woche 3–4 | Aave V3 erweitert: +4 Chains; HIFO-Rechner (EP-18)                           | 21+13=34 SP      | 8 Chains gesamt; HIFO mit Szenario-Rechner live                             |
| **P4-S5**  | Dez. 2026 Woche 1–2 | Kanzlei-Portal Basis: Mandanten-Liste, Einladung (EP-16)                     | 21 SP            | Steuerberater kann Mandanten-Portfolio read-only einsehen                   |
| **P4-S6**  | Dez. 2026 Woche 3–4 | Kanzlei-Portal: Report-Sharing + Kommentarfunktion; Wallet-Labeling          | 13+8=21 SP       | PDF-Report mit Steuerberater-Kommentaren exportierbar                       |
| **P4-S7**  | Jan. 2027 Woche 1–2 | ELSTER XML Export (EP-15) Basis: Anlage SO                                   | 21 SP            | ELSTER-XML validiert gegen XSD; Anlage SO vorausgefüllt                     |
| **P4-S8**  | Jan. 2027 Woche 3–4 | ELSTER vollständig (US-011); REST-API Basis (EP-17)                          | 8+13=21 SP       | ELSTER-Export live; /v1/wallets und /v1/transactions API-Endpoints live     |
| **P4-S9**  | Feb. 2027 Woche 1–2 | REST-API vollständig (alle 10 Endpoints); API-Key-Management                 | 21 SP            | OpenAPI-Dokumentation live; Sandbox-Umgebung verfügbar                      |
| **P4-S10** | Feb. 2027 Woche 3–4 | White-Label Basis (US-012); AT/CH Steuerrecht erste Erweiterung              | 13+8=21 SP       | White-Label konfigurierbar; AT-Hinweis auf Pricing-Page                     |
| **P4-S11** | Mrz. 2027           | Portfolio-Analytics (P&L+IL+Risiko); AML-Modul (optional); AT/CH vollständig | 21 SP            | Phase-4-Launch-Review; MRR ≥ € 30.000 als KPI-Gate                          |

**Team-Erweiterung (Phase 4)**

| **Neue Rolle**                    | **Start**          | **Kosten/Monat** | **Aufgaben**                                                        |
|-----------------------------------|--------------------|------------------|---------------------------------------------------------------------|
| **B2B Sales Manager**             | Q4 2026            | € 4.000–6.000    | Kanzlei-Outreach, Demo-Gespräche, Vertragsabschlüsse, CRM-Pflege    |
| **Backend-Dev (Multi-Chain)**     | Q4 2026            | € 6.000–8.000    | Aave V3 12-Chain-Integration, Stargate-LayerZero-Matching, REST-API |
| **Frontend-Dev (Kanzlei-Portal)** | Q4 2026 (Teilzeit) | € 3.000–5.000    | Kanzlei-Portal UI, White-Label-Konfigurator, ELSTER-Export-UI       |

**09.3 Regulatorische Compliance-Roadmap (R10) — Maßnahmen je Phase**

Die folgende Matrix ordnet alle regulatorischen Compliance-Maßnahmen den Entwicklungsphasen zu. Sie definiert was bis wann rechtlich umgesetzt sein muss, um das Tool rechtskonform zu betreiben. Quelle: Rechtliche Analyse NextGen IT Solutions GmbH, März 2026.

| **Phase**           | **Regulatorische Maßnahme**                                                          | **Rechtsgrundlage**             | **Priorität** |
|---------------------|--------------------------------------------------------------------------------------|---------------------------------|---------------|
| **P0 — Discovery**  | DSFA (Datenschutz-Folgenabschätzung) für Finanzdaten-Verarbeitung durchführen        | Art. 35 DSGVO                   | **KRITISCH**  |
| **P0 — Discovery**  | Steuerberater-Validierung des LP/CDP-Graubereich-Mappings (schriftliche Freigabe)    | BMF-Schreiben 06.03.2025        | **KRITISCH**  |
| **P0 — Discovery**  | Klärung VASP/CASP-Status des Tools (kein GwG-Verpflichteter nachweisen)              | § 2 GwG; MiCA Art. 3            | HOCH          |
| **P1 — MVP Build**  | Datenschutzerklärung + Impressum gemäß DSGVO Art. 13/14 rechtlich prüfen lassen      | Art. 13/14 DSGVO; TMG           | **KRITISCH**  |
| **P1 — MVP Build**  | Verarbeitungsverzeichnis (VVT) anlegen und laufend pflegen                           | Art. 30 DSGVO                   | **KRITISCH**  |
| **P1 — MVP Build**  | Auftragsverarbeitungsvertrag (AVV) mit Hetzner und Preis-API-Anbietern abschließen   | Art. 28 DSGVO                   | **KRITISCH**  |
| **P1 — MVP Build**  | AES-256-GCM-Verschlüsselung aller Wallet-Daten at rest implementieren                | Art. 32 DSGVO; BSI-Empfehlung   | **KRITISCH**  |
| **P1 — MVP Build**  | FIFO-Steuerberechnung mit BMF-2025-konformen Kursdaten (FTSO-Primärquelle)           | BMF-Schreiben 06.03.2025 Rz. 43 | **KRITISCH**  |
| **P1 — MVP Build**  | GoBD-konformes Audit-Log (append-only, SHA-256-Hash-Kette, 10 Jahre)                 | GoBD BMF 28.11.2019; § 147 AO   | HOCH          |
| **P1 — MVP Build**  | Disclaimer für LP/CDP/Bridge-Graubereich-TX (§ 675 BGB; kein Steuerberatungsvertrag) | § 675 BGB; Haftungsrecht        | HOCH          |
| **P2 — Beta**       | Steuerberater-Abnahme aller 35+ TX-Typen-Mappings (schriftliches Protokoll)          | BMF 2025; § 22/23 EStG          | **KRITISCH**  |
| **P2 — Beta**       | Interner Penetrationstest der Wallet-Datenspeicherung (OWASP-ASVS-L2)                | Art. 32 DSGVO; ISO 27001        | HOCH          |
| **P2 — Beta**       | Rechtliche Prüfung der AGB und Haftungsausschlüsse (§§ 305–310 BGB)                  | §§ 305–310 BGB; § 675 BGB       | HOCH          |
| **P3 — Launch**     | Cookie-Consent-Banner (kein Tracking ohne explizite Einwilligung)                    | Art. 6 Abs. 1a DSGVO; TTDSG     | **KRITISCH**  |
| **P3 — Launch**     | AGB + Nutzungsbedingungen final rechtlich prüfen lassen                              | BGB; §§ 305 ff. BGB             | HOCH          |
| **P3 — Launch**     | Marketing + Pressemitteilung DSGVO-konform gestalten (kein Dark Pattern)             | UWG; DSGVO Art. 5               | MITTEL        |
| **P4 — Skalierung** | ELSTER-Export: DSGVO-konforme Datenübertragung; Datensicherheitsstandards            | §§ 87c; 150 AO; DSGVO           | HOCH          |
| **P4 — Skalierung** | B2B-Kanzlei-AVV-Template für Steuerberater (Berufsgeheimnisschutz § 203 StGB)        | Art. 28 DSGVO; § 203 StGB       | **KRITISCH**  |
| **P4 — Skalierung** | AML-Screening-Modul (OFAC, EU-Sanctions) für Enterprise-Kanzlei-Kunden (optional)    | §§ 2; 10 GwG; EU-Sanktionen     | MITTEL        |
| **P4 — Skalierung** | Regulatorischer Monitoring-Dienst für BMF, BFH, ESMA, DAC8-Updates einrichten        | Laufende Compliance-Pflicht     | HOCH          |

**09.4 Kritische Erfolgsfaktoren**

| **Faktor**                     | **Beschreibung**                                                                                        | **Maßnahme**                                                                                           | **Frühwarnung**                                                                                   |
|--------------------------------|---------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|
| **Steuerrechts-Aktualität**    | Jährliches BMF-Schreiben kann TX-Mappings verändern; veraltete Logik = Haftungsrisiko                   | Jährliches Update aller TX-Mappings; Steuerberater-Review-Abo (€ 3.000/Jahr); Watchdog-System          | BMF-Newsletter; RSS-Monitoring auf bmf.de; BFH-Rechtsprechungs-Alert                              |
| **Datenqualität (EUR-Kurs)**   | Zero-Fehler-Toleranz bei EUR-Kursbewertung — Basis für alle Steuerberechnungen                          | FTSO als Primärquelle; CoinGecko + CMC Fallback; Preisquelle je TX unveränderlich im Audit-Log         | FTSO-Feed-Age \> 5 Min. → P1-Alert; Preisabweichung \> 20% → Anomalie-Flag                        |
| **Time-to-Market**             | MVP-Launch September 2026 ist strategisch optimal (DAC8-Hochsaison, Steuererklärungen)                  | Kein Scope-Creep im MVP; Stargate/Aave erst Phase 4; Sprint 11 als reiner Härtungs-Buffer              | Sprint-Velocity unter 80% → CTO-Eskalation; Sprint-10-Deadline als hartes Datum                   |
| **Nutzerfreundlichkeit (TtV)** | TtV \> 5 Minuten = Produktversagen — CoinTracking braucht Stunden, Blockpit 20–30 Minuten               | Onboarding-Usability-Tests in Phase 2; A/B-Tests nach Launch; Progressive-Disclosure-UX                | TtV-Median \> 5 Min. in Phase-2-Tests → Onboarding-Redesign-Sprint                                |
| **Rechtssicherheit**           | Fehlklassifikationen = Haftungsrisiko (§ 280 BGB); Nutzer können Steuerberater-Fehler dem Tool anlasten | Disclaimer auf jedem Export; Steuerberater-Empfehlung in jedem Graubereich-Flow; AGB-Schutzklausel     | Nutzer-Beschwerde über Steuerfolge → sofortiger CTO + Steuerberater Review                        |
| **First-Mover-Verteidigung**   | CoinTracking oder Blockpit kündigt Flare-Support in 12–18 Monaten wahrscheinlich an                     | Phase-4-Multi-Chain beschleunigen; B2B-Kanzlei-Segment als höherer Lock-in aufbauen; Community-Bindung | Competitor-Alert: Blockpit/CT Flare-Erwähnung auf GitHub / Changelog → sofort in Sprint einplanen |

---

## Anhang C — Specification Change Log (Implementation Divergences)

This appendix tracks substantive differences between the original specification and the actual implementation, maintaining spec freshness per the project's spec-driven development practices.

**Last updated:** 2026-03-28

### C.1 Database Schema Divergences

| Area | Spec (Section 06.2) | Implementation | Rationale |
|------|---------------------|----------------|-----------|
| Audit log table | `audit_log_entries` | `audit_logs` (AuditLog model) | Entity-agnostic design allows auditing any entity type, not just transactions |
| Price cache table | `price_cache` | `token_prices` (TokenPrice model) | Clearer naming |
| Additional models | 8 core tables listed | 13 models total | TxLeg, TaxLot, TaxEvent, PriceAuditLog, NotificationPreference added to support User Stories EP-08, EP-05 and Phase 2 features |
| Transaction.tx_type | Listed as required field | Not present; type stored in TxClassification.ctType | Classification is a separate concern, linked via FK |
| User model | id, email, password_hash, plan | Adds stripeCustomerId, totpSecret, totpEnabled | Phase 2 Stripe + 2FA additions |

### C.2 Enum Value Changes

| Enum | Spec Values | Added in Implementation | Phase |
|------|-------------|------------------------|-------|
| TaxMethod | FIFO, LIFO | HIFO (pre-implemented) | Phase 4 (EP-18) |
| PlanTier | STARTER, PRO | KANZLEI (pre-implemented) | Phase 4 (EP-16) |

### C.3 Phase Timeline Adjustments

| Feature | Spec Phase | Actual Implementation | Notes |
|---------|-----------|----------------------|-------|
| Stripe billing integration | Phase 3 (Sept 2026) | Phase 2 (March 2026) | Infrastructure prepared early for Phase 3 launch |
| XLSX + PDF export formats | Phase 2 | Phase 2 | Matches spec |
| Notification preferences | Phase 2 | Phase 2 | Matches spec |
| WalletConnect v2 | Phase 1 | Phase 2 | Delayed from Phase 1 to Phase 2 |

### C.4 Architecture Decisions

| Decision | Spec Approach | Implementation | Rationale |
|----------|-------------- |----------------|-----------|
| API style | REST API (Section 08) | tRPC (type-safe RPC) | tRPC chosen for Phase 1/2; REST API planned for Phase 4 public API (EP-17) |
| Audit log design | TX-specific (tx_id FK) | Entity-agnostic (entityType + entityId) | Supports auditing classifications, exports, prices — not just transactions |
| Price transparency | Single price_cache table | TokenPrice + PriceAuditLog | Separate audit log tracks fallback chain (FTSO → CoinGecko → CMC) per NFR-C05 |
