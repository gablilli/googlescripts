function exportAllRevisionsById() {
  const docId = 'TOKEN'; <--- put here your token, you can find it in the url string, after /d/
  const docName = 'name'; <--- put here the doc's name
  const revisions = Drive.Revisions.list(docId).items;
  if (!revisions || revisions.length === 0) {
    Logger.log("No edits found");
    return;
  }
  const token = ScriptApp.getOAuthToken();
  const folder = DriveApp.createFolder(`${docName}_edits`);

  revisions.forEach((rev, index) => {
  Logger.log(`Exporting revision ${index + 1} id=${rev.id} modifiedDate=${rev.modifiedDate}`);
  if (rev.exportLinks && rev.exportLinks['application/vnd.openxmlformats-officedocument.wordprocessingml.document']) {
    const url = rev.exportLinks['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    try {
      const response = UrlFetchApp.fetch(url, {
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true
      });
      if (response.getResponseCode() === 200) {
        const blob = response.getBlob();
        const user = rev.lastModifyingUserName ? rev.lastModifyingUserName.replace(/\s+/g, '_') : "unknown";
        const filename = `${docName}_revision_${index + 1}_${rev.modifiedDate.replace(/[:\-T]/g, '_').slice(0,19)}_${user}.docx`;
        folder.createFile(blob.setName(filename));
        Logger.log(`File saved: ${filename}`);
      } else {
        Logger.log(`HTTP error ${response.getResponseCode()} for edit ${rev.id}`);
      }
    } catch (e) {
      Logger.log(`Fetch error for edit ${rev.id}: ${e}`);
    }
    Utilities.sleep(7000); // just a pause to avoid 429
  } else {
    Logger.log(`None exportLink DOCX for edit ${rev.id}`);
  }
});

  Logger.log("Exportation complete. Check your drive folder.");
}
