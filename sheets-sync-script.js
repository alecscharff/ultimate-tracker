/**
 * Wedgwood Marmots - Ultimate Tracker Results Sync
 *
 * HOW TO INSTALL:
 * 1. Open your Google Sheet
 * 2. Click Extensions > Apps Script
 * 3. Delete everything in the editor and paste this entire file
 * 4. Click Save (floppy disk icon)
 * 5. Click Deploy > New deployment
 * 6. Click the gear icon next to "Type" and select "Web app"
 * 7. Set "Execute as" to "Me"
 * 8. Set "Who has access" to "Anyone"
 * 9. Click Deploy, then authorize when prompted
 * 10. Copy the Web app URL and paste it into the Ultimate Tracker app (Roster > Script URL)
 *
 * This creates two tabs in your sheet:
 *   "Game Results" - one row per game
 *   "Player Stats"  - one row per player per game
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // --- Game Results tab ---
    let resultsSheet = ss.getSheetByName('Game Results');
    if (!resultsSheet) {
      resultsSheet = ss.insertSheet('Game Results');
      resultsSheet.appendRow(['Date', 'Opponent', 'Field', 'Our Score', 'Their Score', 'Result', 'Total Points']);
      resultsSheet.getRange(1, 1, 1, 7).setFontWeight('bold');
    }
    resultsSheet.appendRow([
      data.date,
      data.opponent,
      data.field,
      data.ourScore,
      data.theirScore,
      data.result,
      data.totalPoints,
    ]);

    // --- Player Stats tab ---
    let statsSheet = ss.getSheetByName('Player Stats');
    if (!statsSheet) {
      statsSheet = ss.insertSheet('Player Stats');
      statsSheet.appendRow(['Date', 'Opponent', 'Name', 'Gender', 'Grade', 'Points Played', '+/-', 'Goals', 'Assists', 'Ds', 'Great Throws']);
      statsSheet.getRange(1, 1, 1, 11).setFontWeight('bold');
    }
    (data.playerStats || []).forEach(p => {
      statsSheet.appendRow([
        data.date,
        data.opponent,
        p.name,
        p.gender,
        p.grade,
        p.pointsPlayed,
        p.plusMinus,
        p.scores,
        p.assists,
        p.ds,
        p.greatThrows,
      ]);
    });

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
