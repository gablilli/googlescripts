function exportAllRevisionsById() {
  const docId = 'DOCID'; <-- PUT HERE DOC'S ID
  const docName = DriveApp.getFileById(docId).getName();

  const revisions = Drive.Revisions.list(docId).items;
  if (!revisions || revisions.length === 0) {
    Logger.log("No edits found");
    return;
  }

  revisions.sort((a, b) => new Date(a.modifiedDate) - new Date(b.modifiedDate));

  const token = ScriptApp.getOAuthToken();
  const folder = DriveApp.createFolder(`${docName}_edits`);

  let csvRows = [];
  csvRows.push("index,revisionId,modifiedDate,user");

  revisions.forEach((rev, index) => {
    const dateStr = rev.modifiedDate.replace(/[:\-T]/g, '_').slice(0,19);
    const user = rev.lastModifyingUserName ? rev.lastModifyingUserName.replace(/\s+/g, '_') : "unknown";
    csvRows.push(`${index+1},${rev.id},${rev.modifiedDate},${user}`);

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
          const filename = `${docName}_revision_${index + 1}_${dateStr}_${user}.docx`;
          folder.createFile(blob.setName(filename));
          Logger.log(`File saved: ${filename}`);
        } else {
          Logger.log(`HTTP error ${response.getResponseCode()} for edit ${rev.id}`);
        }
      } catch (e) {
        Logger.log(`Fetch error for edit ${rev.id}: ${e}`);
      }
      Utilities.sleep(7000); // just a sleep to avoid 429
    } else {
      Logger.log(`None exportLink DOCX for edit ${rev.id}`);
    }
  });

  try {
    const csvContent = csvRows.join("\n");
    const csvBlob = Utilities.newBlob(csvContent, 'text/csv', `${docName}_revisions.csv`);
    folder.createFile(csvBlob);
    Logger.log("CSV file saved successfully");
  } catch (e) {
    Logger.log("Error creating CSV: " + e);
  }

  Logger.log("Exportation complete. Check your drive folder.");
}
