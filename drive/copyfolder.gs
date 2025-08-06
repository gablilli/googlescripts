function copySharedFolder() {
  const sourceFolderId = 'FOLDERID'; // <-- CHANGE HERE
  const sourceFolder = DriveApp.getFolderById(sourceFolderId);
  const targetRoot = DriveApp.createFolder(sourceFolder.getName() + ' (Copy)');
  
  copyFolderContents(sourceFolder, targetRoot);
  Logger.log('Copy completed in ' + targetRoot.getUrl());
}

function copyFolderContents(source, target) {
  const files = source.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    try {
      const copiedFile = file.makeCopy(file.getName(), target);
    } catch (e) {
      Logger.log('Errore con file: ' + file.getName() + ' → ' + e.message);
    }
  }
  
  const folders = source.getFolders();
  while (folders.hasNext()) {
    const subFolder = folders.next();
    const newSubFolder = target.createFolder(subFolder.getName());
    copyFolderContents(subFolder, newSubFolder);
  }
}
