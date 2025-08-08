// Google Apps Script per esportare materiali, compiti, argomenti e messaggi da Google Classroom
// con allegati (file, link, video, Google Docs convertiti in .docx, ecc.) in una cartella condivisa

const EXPORT_FOLDER_ID = 'TOKENDRIVE'; // Cartella condivisa su Drive
const COURSE_IDS = ['IDCORSO']; // ID corsi da esportare

function exportClassroomData() {
  const exportFolder = DriveApp.getFolderById(EXPORT_FOLDER_ID);

  COURSE_IDS.forEach(courseId => {
    try {
      const course = Classroom.Courses.get(courseId);
      const courseFolder = exportFolder.createFolder(`${course.name.replace(/\W+/g, '_')}_${courseId}`);
      Logger.log(`✅ Esportazione corso: ${course.name}`);

      exportTopics(courseId, courseFolder);
      exportCourseWork(courseId, courseFolder);
      exportCourseMaterials(courseId, courseFolder);
      exportCustomPlaceholderSubmissions(courseId, courseFolder);
      exportAnnouncements(courseId, courseFolder); // senza commenti

    } catch (e) {
      Logger.log(`❌ Errore esportando il corso ${courseId}: ${e.message}`);
    }
  });

  Logger.log('✅✅ Esportazione completata!');
}

function exportCustomPlaceholderSubmissions(courseId, folder) {
  const courseworkList = Classroom.Courses.CourseWork.list(courseId).courseWork || [];
  const results = {};

  courseworkList.forEach((work, i) => {
    // Creiamo submissions diverse per ogni compito (esempio 2 per compito)
    const submissionsForThisWork = [];

    for (let j = 1; j <= 2; j++) {
      const fakeSubmission = {
        userId: `user${j}@example.com`,
        userName: `User ${j}`,
        files: [
          {
            type: "driveFile",
            name: `Documento_${work.title}_Submission_${j}.pdf`,
            id: `file_${work.id}_${j}`,
            url: `https://drive.google.com/file/d/file_${work.id}_${j}/view`
          },
          {
            type: "link",
            name: "Link di riferimento",
            url: `https://example.com/link_${work.id}_${j}`
          }
        ],
        privateComments: [
          {
            author: `User ${j}`,
            date: new Date().toISOString(),
            text: `Commento privato submission ${j} per compito ${work.title}`
          }
        ]
      };
      submissionsForThisWork.push(fakeSubmission);
    }

    results[work.id] = {
      courseWorkId: work.id,
      title: work.title,
      submissions: submissionsForThisWork
    };
  });

  folder.createFile('submissions.json', JSON.stringify(results, null, 2), MimeType.PLAIN_TEXT);
}

function exportTopics(courseId, folder) {
  const topics = Classroom.Courses.Topics.list(courseId).topic || [];
  const json = JSON.stringify(topics, null, 2);
  folder.createFile('topics.json', json, MimeType.PLAIN_TEXT);
}

function exportCourseWork(courseId, folder) {
  const coursework = Classroom.Courses.CourseWork.list(courseId).courseWork || [];
  const results = [];
  const filesFolder = folder.createFolder('coursework_files');

  coursework.forEach(item => {
    const entry = {
      id: item.id,
      title: item.title,
      description: `📅 ${item.creationTime}\n\n${item.description || ''}`,
      materials: [],
      state: item.state,
      workType: item.workType,
      topicId: item.topicId,
      // submissions rimossi per accesso studente
      creatorUserId: item.creatorUserId || null // ✅ aggiunto solo questo
    };

    if (item.materials) {
      item.materials.forEach(mat => {
        try {
          const saved = saveMaterialToDrive(mat, filesFolder);
          if (saved) entry.materials.push(saved);
        } catch (e) {
          Logger.log(`⚠️ Errore salvando un materiale in "${item.title}": ${e.message}`);
        }
      });
    }

    results.push(entry);
  });

  folder.createFile('coursework.json', JSON.stringify(results, null, 2), MimeType.PLAIN_TEXT);
}

function exportCourseMaterials(courseId, folder) {
  const materials = Classroom.Courses.CourseWorkMaterials.list(courseId).courseWorkMaterial || [];
  const results = [];
  const filesFolder = folder.createFolder('materials_files');

  materials.forEach(item => {
    const entry = {
      id: item.id,
      title: item.title,
      description: `📅 ${item.creationTime}\n\n${item.description || ''}`,
      materials: [],
      state: item.state,
      topicId: item.topicId,
      creatorUserId: item.creatorUserId || null // ✅ AGGIUNTO SOLO QUESTO
    };

    if (item.materials) {
      item.materials.forEach(mat => {
        try {
          const saved = saveMaterialToDrive(mat, filesFolder);
          if (saved) entry.materials.push(saved);
        } catch (e) {
          Logger.log(`⚠️ Errore salvando un materiale in "${item.title}": ${e.message}`);
        }
      });
    }

    results.push(entry);
  });

  folder.createFile('materials.json', JSON.stringify(results, null, 2), MimeType.PLAIN_TEXT);
}

function exportAnnouncements(courseId, folder) {
  let announcements = Classroom.Courses.Announcements.list(courseId).announcements || [];

  // ⬇️ Ordina per data decrescente (dal più recente al più vecchio)
  announcements.sort((a, b) => new Date(b.creationTime) - new Date(a.creationTime));

  const announcementsFolder = folder.createFolder("announcements_files");
  const results = [];

  announcements.forEach(a => {
    let authorName = '';
    try {
      if (a.creatorUserId) {
        const user = Classroom.UserProfiles.get(a.creatorUserId);
        authorName = `${user.name.fullName}`;
      }
    } catch (e) {
      Logger.log(`⚠️ Impossibile ottenere il nome dell'autore per annuncio ${a.id}: ${e.message}`);
    }

    // 🔁 Copia allegati se presenti
    if (a.materials) {
      a.materials.forEach((material, idx) => {
        if (material.driveFile && material.driveFile.driveFile.id) {
          try {
            const originalFile = DriveApp.getFileById(material.driveFile.driveFile.id);
            const copiedFile = originalFile.makeCopy(`${a.id}_attachment_${idx}`, announcementsFolder);
            copiedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

            material.driveFile.driveFile.id = copiedFile.getId();
            material.driveFile.driveFile.title = copiedFile.getName();
          } catch (e) {
            Logger.log(`❌ Errore copiando allegato annuncio ${a.id}: ${e.message}`);
          }
        }
      });
    }

    results.push({
      id: a.id,
      text: `👤 ${authorName || '[autore sconosciuto]'}\n📅 ${new Date(a.creationTime).toLocaleString()}\n\n${a.text}`,
      creationTime: a.creationTime,
      updateTime: a.updateTime,
      materials: a.materials || [],
      assigneeMode: a.assigneeMode,
      individualStudentsOptions: a.individualStudentsOptions || null,
      creatorUserId: a.creatorUserId || null
    });
  });

  folder.createFile('announcements.json', JSON.stringify(results, null, 2), MimeType.PLAIN_TEXT);
}

function saveMaterialToDrive(mat, folder) {
  try {
    if (mat.driveFile) {
      const fileId = mat.driveFile.driveFile.id;
      const file = DriveApp.getFileById(fileId);
      const mimeType = file.getMimeType();

      if (mimeType === MimeType.GOOGLE_DOCS) {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document`;
        const token = ScriptApp.getOAuthToken();
        const response = UrlFetchApp.fetch(url, {
          headers: { Authorization: 'Bearer ' + token },
          muteHttpExceptions: true
        });

        if (response.getResponseCode() === 200) {
          const blob = response.getBlob().setName(`${file.getName()}.docx`);
          const savedFile = folder.createFile(blob);

          // 🔁 Esporta le revisioni in uno ZIP
          const revisions = Drive.Revisions.list(fileId).revisions || [];
          const zipFolder = DriveApp.createFolder(`tmp_${fileId}_${new Date().getTime()}`);
          const zipBlobs = [];

          revisions.forEach((rev, idx) => {
            try {
              const revUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document&revisionId=${rev.id}`;
              const revResp = UrlFetchApp.fetch(revUrl, {
                headers: { Authorization: 'Bearer ' + token },
                muteHttpExceptions: true
              });
              if (revResp.getResponseCode() === 200) {
                const revBlob = revResp.getBlob().setName(`rev_${idx + 1}.docx`);
                zipBlobs.push(revBlob);
              }
            } catch (e) {
              Logger.log(`⚠️ Errore esportando revisione ${rev.id} del file ${fileId}: ${e.message}`);
            }
          });

          if (zipBlobs.length > 0) {
            const zip = Utilities.zip(zipBlobs, `${file.getName()}_revisions.zip`);
            const zipFile = folder.createFile(zip);
            return [
              { name: savedFile.getName(), id: savedFile.getId(), type: 'docx' },
              { name: zipFile.getName(), id: zipFile.getId(), type: 'zip' }
            ];
          } else {
            return { name: savedFile.getName(), id: savedFile.getId(), type: 'docx' };
          }
        } else {
          Logger.log(`Errore esportando Google Doc ${fileId}: ${response.getContentText()}`);
        }
      } else {
        const copied = file.makeCopy(folder);
        return { name: copied.getName(), id: copied.getId(), type: mimeType };
      }
    } else if (mat.link) {
      return { url: mat.link.url, title: mat.link.title, type: 'link' };
    } else if (mat.youtubeVideo) {
      return { url: mat.youtubeVideo.alternateLink, title: mat.youtubeVideo.title, type: 'youtube' };
    } else if (mat.form) {
      return { url: mat.form.formUrl, title: mat.form.title, type: 'form' };
    }
  } catch (e) {
    Logger.log(`Errore salvando materiale: ${e}`);
  }
  return null;
}
