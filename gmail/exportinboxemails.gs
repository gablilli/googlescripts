function exportReceivedInboxOnlyBlock0() {
  const folderName = "YOURFOLDERNAME";
  const start = 0; <--- put here from where should the script start
  const count = 100; <--- put here how many email do you want (note: do **not** go over 500, otherwise you'll get a 429)

  const threads = GmailApp.getInboxThreads(start, count);

  const folder = DriveApp.getFoldersByName(folderName).hasNext()
    ? DriveApp.getFoldersByName(folderName).next()
    : DriveApp.createFolder(folderName);

  const userEmail = Session.getActiveUser().getEmail();

  for (const thread of threads) {
    const messages = thread.getMessages();
    for (const message of messages) {
      if (message.getTo().indexOf(userEmail) !== -1 || message.getCc().indexOf(userEmail) !== -1 || message.getBcc().indexOf(userEmail) !== -1) {
        const emlRaw = message.getRawContent().replace(/\r?\n/g, "\r\n");
        const subject = message.getSubject().replace(/[^\w\d]/g, "_").substring(0, 50) || "without_object";
        const date = Utilities.formatDate(message.getDate(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
        const filename = `${date}_${subject}.eml`;

        folder.createFile(filename, emlRaw, MimeType.PLAIN_TEXT);
      }
    }
  }

  Logger.log(`Exported inbox emails from ${start} (${count} thread).`);
}
