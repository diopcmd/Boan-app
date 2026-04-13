/**
 * BOAN App — Mise en forme Google Sheets
 * ════════════════════════════════════════════════════════════════════
 * VERSION     : Avril 2026
 *
 * SÉCURITÉ    : Ce script ne modifie AUCUNE donnée.
 *               Il applique uniquement : couleurs, polices, largeurs de
 *               colonnes, formats de nombres, lignes alternées,
 *               mise en forme conditionnelle et notes info-bulles.
 *
 * UTILISATION :
 *   1. Dans Google Sheets → Extensions → Apps Script
 *   2. Coller ce code dans l'éditeur (remplacer tout le contenu)
 *   3. Sélectionner "formatAllSheets" dans le menu déroulant en haut
 *   4. Cliquer sur ▶ Exécuter
 *   5. Autoriser les permissions si demandé (1ère fois uniquement)
 *   6. Répéter pour chaque classeur (Fondateur, Gérant, RGA, Fallou)
 * ════════════════════════════════════════════════════════════════════
 */

// ─── PALETTE DE COULEURS ─────────────────────────────────────────────────────
var COLOR = {
  headerBg   : '#1E3A5F',  // Bleu marine       — fond en-tête
  headerText : '#FFFFFF',  // Blanc             — texte en-tête
  rowEven    : '#EEF3F9',  // Bleu très clair   — lignes paires
  rowOdd     : '#FFFFFF',  // Blanc             — lignes impaires
  keyBg      : '#E8F0FE',  // Bleu pâle         — colonne clé (Config_App)
  keyText    : '#1E3A5F',  // Bleu marine       — texte clé
  valBg      : '#FFFFFF',  // Blanc             — colonne valeur
  borderColor: '#B8CCE4',  // Gris-bleu         — bordures
  greenPos   : '#D4EDDA',  // Vert clair        — valeur positive
  greenText  : '#155724',  // Vert foncé
  redNeg     : '#F8D7DA',  // Rouge clair       — valeur négative
  redText    : '#721C24',  // Rouge foncé
  decesAlert : '#FFCCCC',  // Rose              — alerte décès
  decesText  : '#CC0000',  // Rouge vif         — texte décès
};

// ─── FONCTION PRINCIPALE ─────────────────────────────────────────────────────
function formatAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var resp = ui.alert(
    'BOAN — Mise en forme',
    'Ce script va appliquer la mise en forme visuelle à tous les onglets.\n\n' +
    'Aucune donnée ne sera modifiée.\n\n' +
    'Continuer ?',
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;

  var sheets = ss.getSheets();
  var done = 0;

  sheets.forEach(function(sheet) {
    var name = sheet.getName();
    try {
      if      (name === 'Config_Cycle')      { _fmtConfigCycle(sheet);   done++; }
      else if (name === 'Config_App')        { _fmtConfigApp(sheet);     done++; }
      else if (name === 'Historique_Cycles') { _fmtHistoCycles(sheet);   done++; }
      else if (name === 'Fiche_Quotidienne') { _fmtFicheQuot(sheet);     done++; }
      else if (name === 'SOP_Check')         { _fmtSOP(sheet);           done++; }
      else if (name === 'Pesees')            { _fmtPesees(sheet);        done++; }
      else if (name === 'Stock_Nourriture')  { _fmtStock(sheet);         done++; }
      else if (name === 'Incidents')         { _fmtIncidents(sheet);     done++; }
      else if (name === 'Sante_Mortalite')   { _fmtSante(sheet);         done++; }
      else if (name === 'Hebdomadaire')      { _fmtHebdo(sheet);         done++; }
      else if (name === 'KPI_Mensuels')      { _fmtKPIMensuels(sheet);   done++; }
      else if (name === 'KPI_Hebdo')         { _fmtKPIHebdo(sheet);      done++; }
      else if (name === 'Suivi_Marche')      { _fmtSuiviMarche(sheet);   done++; }
      else if (name === 'Suivi_Aliments')    { _fmtSuiviAliments(sheet); done++; }
    } catch(e) {
      Logger.log('Erreur sur "' + name + '" : ' + e.message);
    }
  });

  ui.alert('Mise en forme appliquée sur ' + done + ' onglet(s). ✓\n\nConsulte Affichage → Journaux pour voir les erreurs éventuelles.');
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function _header(range) {
  range.setBackground(COLOR.headerBg)
       .setFontColor(COLOR.headerText)
       .setFontWeight('bold')
       .setFontSize(10)
       .setHorizontalAlignment('center')
       .setVerticalAlignment('middle')
       .setWrap(true);
}

function _border(range) {
  range.setBorder(
    true, true, true, true, true, true,
    COLOR.borderColor, SpreadsheetApp.BorderStyle.SOLID
  );
}

function _stripes(sheet, firstRow, numRows, numCols) {
  if (numRows <= 0) return;
  for (var i = 0; i < numRows; i++) {
    var bg = (i % 2 === 0) ? COLOR.rowOdd : COLOR.rowEven;
    sheet.getRange(firstRow + i, 1, 1, numCols).setBackground(bg);
  }
}

function _widths(sheet, widths) {
  for (var i = 0; i < widths.length; i++) {
    sheet.setColumnWidth(i + 1, widths[i]);
  }
}

function _addCondRule(sheet, range, condition, bgColor, textColor) {
  var rule;
  if (condition === 'OUI') {
    rule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('OUI').setBackground(bgColor).setFontColor(textColor)
      .setRanges([range]).build();
  } else if (condition === '>0') {
    rule = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(0).setBackground(bgColor).setFontColor(textColor)
      .setRanges([range]).build();
  } else if (condition === '<=0') {
    rule = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThanOrEqualTo(0).setBackground(bgColor).setFontColor(textColor)
      .setRanges([range]).build();
  }
  if (rule) {
    var rules = sheet.getConditionalFormatRules();
    rules.push(rule);
    sheet.setConditionalFormatRules(rules);
  }
}

// ─── CONFIG_CYCLE ────────────────────────────────────────────────────────────
// ⚠ SPÉCIAL : la ligne 1 contient les DONNÉES (pas d'en-tête).
//   Ce bloc ne touche JAMAIS aux valeurs — mise en forme visuelle uniquement.
function _fmtConfigCycle(sheet) {
  var NCOLS = 18;
  var r1 = sheet.getRange(1, 1, 1, NCOLS);

  _header(r1);
  sheet.setRowHeight(1, 60);
  _border(r1);

  // Notes info-bulles sur chaque colonne (survol de la souris)
  var notes = [
    'A — Date Début du cycle (ISO : YYYY-MM-DD)',
    'B — Nombre de bêtes au départ',
    'C — Poids moyen départ (kg)',
    'D — Race (ex : Djakoré)',
    'E — Ration journalière / bête (kg/j)',
    'F — Capital investi (FCFA)',
    'G — Objectif prix vente (FCFA/kg poids vif)',
    'H — Budget santé total (FCFA)',
    'I — Nom du vétérinaire',
    'J — Lieu de vente / Foirail',
    'K — Commission vente (%)',
    'L — Contact urgence',
    'M — Fréquence des pesées (jours entre deux pesées)',
    'N — Liste des bêtes (JSON)',
    'O — Stock initial (JSON)',
    'P — Durée prévue du cycle (mois)',
    'Q — Charges simulées (JSON : loyer, salaire, transport, autres)',
    'R — Prix aliment mid-cycle (FCFA/kg)'
  ];
  for (var i = 0; i < notes.length; i++) {
    sheet.getRange(1, i + 1).setNote(notes[i]);
  }

  _widths(sheet, [120, 80, 130, 100, 110, 130, 150, 130, 130,
                  120, 110, 150, 120, 200, 200, 100, 200, 130]);
}

// ─── CONFIG_APP ──────────────────────────────────────────────────────────────
// Tableau clé-valeur — on formate les colonnes sans toucher aux données.
function _fmtConfigApp(sheet) {
  var lastRow = Math.max(sheet.getLastRow(), 1);

  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 340);

  // Colonne A (clés) : fond bleu pâle + gras
  sheet.getRange(1, 1, lastRow, 1)
       .setBackground(COLOR.keyBg)
       .setFontWeight('bold')
       .setFontColor(COLOR.keyText)
       .setFontSize(10);

  // Colonne B (valeurs) : fond blanc
  sheet.getRange(1, 2, lastRow, 1)
       .setBackground(COLOR.valBg)
       .setFontColor('#222222')
       .setFontSize(10);

  _border(sheet.getRange(1, 1, lastRow, 2));
}

// ─── HISTORIQUE_CYCLES ───────────────────────────────────────────────────────
function _fmtHistoCycles(sheet) {
  var NCOLS = 14;
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var dataRows = Math.max(lastRow - 1, 0);

  _header(sheet.getRange(1, 1, 1, NCOLS));
  sheet.setRowHeight(1, 45);
  sheet.setFrozenRows(1);

  _widths(sheet, [110, 90, 110, 100, 160, 90, 85, 65, 120, 110, 110, 130, 140, 140]);

  if (dataRows > 0) {
    _stripes(sheet, 2, dataRows, NCOLS);
    sheet.getRange(2, 1,  dataRows, 1).setNumberFormat('dd/mm/yyyy');
    sheet.getRange(2, 3,  dataRows, 1).setNumberFormat('0 "jours"');
    sheet.getRange(2, 9,  dataRows, 2).setNumberFormat('0.0 "kg"');
    sheet.getRange(2, 11, dataRows, 1).setNumberFormat('0.000 "kg/j"');
    sheet.getRange(2, 12, dataRows, 3).setNumberFormat('#,##0 "F"');

    // Marge/tête : vert si > 0, rouge si ≤ 0
    var margeRange = sheet.getRange(2, 14, dataRows, 1);
    _addCondRule(sheet, margeRange, '>0',  COLOR.greenPos, COLOR.greenText);
    _addCondRule(sheet, margeRange, '<=0', COLOR.redNeg,   COLOR.redText);
  }

  _border(sheet.getRange(1, 1, lastRow, NCOLS));
}

// ─── FICHE_QUOTIDIENNE ───────────────────────────────────────────────────────
function _fmtFicheQuot(sheet) {
  var NCOLS = 11;
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var dataRows = Math.max(lastRow - 1, 0);

  _header(sheet.getRange(1, 1, 1, NCOLS));
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);

  _widths(sheet, [100, 80, 80, 80, 110, 130, 230, 130, 80, 60, 80]);

  if (dataRows > 0) {
    _stripes(sheet, 2, dataRows, NCOLS);
    sheet.getRange(2, 1, dataRows, 1).setNumberFormat('dd/mm/yyyy');
  }

  _border(sheet.getRange(1, 1, lastRow, NCOLS));
}

// ─── SOP_CHECK ───────────────────────────────────────────────────────────────
function _fmtSOP(sheet) {
  var NCOLS = 10;
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var dataRows = Math.max(lastRow - 1, 0);

  _header(sheet.getRange(1, 1, 1, NCOLS));
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);

  _widths(sheet, [100, 100, 110, 110, 100, 100, 160, 70, 230, 130]);

  if (dataRows > 0) {
    _stripes(sheet, 2, dataRows, NCOLS);
    sheet.getRange(2, 1, dataRows, 1).setNumberFormat('dd/mm/yyyy');
  }

  _border(sheet.getRange(1, 1, lastRow, NCOLS));
}

// ─── PESEES ──────────────────────────────────────────────────────────────────
function _fmtPesees(sheet) {
  var NCOLS = 8;
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var dataRows = Math.max(lastRow - 1, 0);

  _header(sheet.getRange(1, 1, 1, NCOLS));
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);

  _widths(sheet, [100, 90, 110, 120, 130, 230, 80, 60]);

  if (dataRows > 0) {
    _stripes(sheet, 2, dataRows, NCOLS);
    sheet.getRange(2, 1, dataRows, 1).setNumberFormat('dd/mm/yyyy');
    sheet.getRange(2, 3, dataRows, 1).setNumberFormat('0.0 "kg"');
    sheet.getRange(2, 4, dataRows, 1).setNumberFormat('0.000 "kg/j"');
  }

  _border(sheet.getRange(1, 1, lastRow, NCOLS));
}

// ─── STOCK_NOURRITURE ────────────────────────────────────────────────────────
function _fmtStock(sheet) {
  var NCOLS = 9;
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var dataRows = Math.max(lastRow - 1, 0);

  _header(sheet.getRange(1, 1, 1, NCOLS));
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);

  _widths(sheet, [100, 150, 100, 130, 140, 140, 160, 210, 130]);

  if (dataRows > 0) {
    _stripes(sheet, 2, dataRows, NCOLS);
    sheet.getRange(2, 1, dataRows, 1).setNumberFormat('dd/mm/yyyy');
    sheet.getRange(2, 4, dataRows, 2).setNumberFormat('#,##0 "kg"');
    sheet.getRange(2, 6, dataRows, 1).setNumberFormat('#,##0 "F"');
  }

  _border(sheet.getRange(1, 1, lastRow, NCOLS));
}

// ─── INCIDENTS ───────────────────────────────────────────────────────────────
function _fmtIncidents(sheet) {
  var NCOLS = 9;
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var dataRows = Math.max(lastRow - 1, 0);

  _header(sheet.getRange(1, 1, 1, NCOLS));
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);

  _widths(sheet, [100, 90, 110, 270, 170, 270, 90, 110, 140]);

  if (dataRows > 0) {
    _stripes(sheet, 2, dataRows, NCOLS);
    sheet.getRange(2, 1, dataRows, 1).setNumberFormat('dd/mm/yyyy');
    sheet.getRange(2, 8, dataRows, 1).setNumberFormat('dd/mm/yyyy');
  }

  _border(sheet.getRange(1, 1, lastRow, NCOLS));
}

// ─── SANTE_MORTALITE ─────────────────────────────────────────────────────────
function _fmtSante(sheet) {
  var NCOLS = 9;
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var dataRows = Math.max(lastRow - 1, 0);

  _header(sheet.getRange(1, 1, 1, NCOLS));
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);

  _widths(sheet, [100, 90, 230, 230, 140, 110, 110, 130, 230]);

  if (dataRows > 0) {
    _stripes(sheet, 2, dataRows, NCOLS);
    sheet.getRange(2, 1, dataRows, 1).setNumberFormat('dd/mm/yyyy');
    sheet.getRange(2, 6, dataRows, 1).setNumberFormat('#,##0 "F"');

    // Colonne H (Décès OUI/NON) : fond rouge si OUI
    var decesRange = sheet.getRange(2, 8, dataRows, 1);
    _addCondRule(sheet, decesRange, 'OUI', COLOR.decesAlert, COLOR.decesText);
  }

  _border(sheet.getRange(1, 1, lastRow, NCOLS));
}

// ─── HEBDOMADAIRE ────────────────────────────────────────────────────────────
function _fmtHebdo(sheet) {
  var NCOLS = 11;
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var dataRows = Math.max(lastRow - 1, 0);

  _header(sheet.getRange(1, 1, 1, NCOLS));
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);

  _widths(sheet, [80, 100, 100, 80, 130, 90, 130, 130, 80, 270, 130]);

  if (dataRows > 0) {
    _stripes(sheet, 2, dataRows, NCOLS);
    sheet.getRange(2, 2, dataRows, 2).setNumberFormat('dd/mm/yyyy');
    sheet.getRange(2, 5, dataRows, 1).setNumberFormat('0.000 "kg/j"');
    sheet.getRange(2, 8, dataRows, 1).setNumberFormat('#,##0 "F"');
  }

  _border(sheet.getRange(1, 1, lastRow, NCOLS));
}

// ─── KPI_MENSUELS ────────────────────────────────────────────────────────────
function _fmtKPIMensuels(sheet) {
  var NCOLS = 10;
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var dataRows = Math.max(lastRow - 1, 0);

  _header(sheet.getRange(1, 1, 1, NCOLS));
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);

  _widths(sheet, [80, 100, 80, 130, 120, 150, 140, 160, 140, 230]);

  if (dataRows > 0) {
    _stripes(sheet, 2, dataRows, NCOLS);
    sheet.getRange(2, 2, dataRows, 1).setNumberFormat('dd/mm/yyyy');
    sheet.getRange(2, 4, dataRows, 1).setNumberFormat('0.000 "kg/j"');
    sheet.getRange(2, 6, dataRows, 3).setNumberFormat('#,##0 "F"');
    sheet.getRange(2, 9, dataRows, 1).setNumberFormat('#,##0 "F"');
  }

  _border(sheet.getRange(1, 1, lastRow, NCOLS));
}

// ─── KPI_HEBDO ───────────────────────────────────────────────────────────────
function _fmtKPIHebdo(sheet) {
  var NCOLS = 8;
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var dataRows = Math.max(lastRow - 1, 0);

  _header(sheet.getRange(1, 1, 1, NCOLS));
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);

  _widths(sheet, [80, 100, 110, 110, 80, 140, 110, 230]);

  if (dataRows > 0) {
    _stripes(sheet, 2, dataRows, NCOLS);
    sheet.getRange(2, 2, dataRows, 1).setNumberFormat('dd/mm/yyyy');
    sheet.getRange(2, 3, dataRows, 1).setNumberFormat('0.000 "kg/j"');
    sheet.getRange(2, 6, dataRows, 1).setNumberFormat('#,##0 "F"');
  }

  _border(sheet.getRange(1, 1, lastRow, NCOLS));
}

// ─── SUIVI_MARCHE ────────────────────────────────────────────────────────────
function _fmtSuiviMarche(sheet) {
  var NCOLS = 7;
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var dataRows = Math.max(lastRow - 1, 0);

  _header(sheet.getRange(1, 1, 1, NCOLS));
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);

  _widths(sheet, [100, 160, 150, 160, 150, 130, 230]);

  if (dataRows > 0) {
    _stripes(sheet, 2, dataRows, NCOLS);
    sheet.getRange(2, 1, dataRows, 1).setNumberFormat('dd/mm/yyyy');
    sheet.getRange(2, 3, dataRows, 3).setNumberFormat('#,##0 "F/kg"');
  }

  _border(sheet.getRange(1, 1, lastRow, NCOLS));
}

// ─── SUIVI_ALIMENTS ──────────────────────────────────────────────────────────
function _fmtSuiviAliments(sheet) {
  var NCOLS = 6;
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var dataRows = Math.max(lastRow - 1, 0);

  _header(sheet.getRange(1, 1, 1, NCOLS));
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);

  _widths(sheet, [100, 160, 140, 160, 160, 230]);

  if (dataRows > 0) {
    _stripes(sheet, 2, dataRows, NCOLS);
    sheet.getRange(2, 1, dataRows, 1).setNumberFormat('dd/mm/yyyy');
    sheet.getRange(2, 3, dataRows, 1).setNumberFormat('#,##0 "F/kg"');
  }

  _border(sheet.getRange(1, 1, lastRow, NCOLS));
}
