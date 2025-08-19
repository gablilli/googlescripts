const EXPORT_FOLDER_ID = 'FOLDERID'; <--- CHANGE THIS
const COURSE_ID = 'COURSEID'; <--- CHANGE THIS

function exportClassroomData() {
  const exportRoot = DriveApp.getFolderById(EXPORT_FOLDER_ID);

  const course = Classroom.Courses.get(COURSE_ID);
  const courseFolderName = course.name || `course_${COURSE_ID}`;

  let courseFolder;
  const folders = exportRoot.getFoldersByName(courseFolderName);
  if (folders.hasNext()) {
    courseFolder = folders.next();
  } else {
    courseFolder = exportRoot.createFolder(courseFolderName);
  }

  const usersMap = exportUsersMap(courseFolder);
  exportTopics(courseFolder);
  exportMaterials(courseFolder, usersMap);
  exportCoursework(courseFolder, usersMap);
  exportAnnouncements(courseFolder, usersMap);
  exportSubmissions(courseFolder, usersMap);

  Logger.log("✅ Esportazione completata in cartella: " + courseFolderName);
}

// ---------------- USERS MAP ----------------
function exportUsersMap(folder) {
  const students = Classroom.Courses.Students.list(COURSE_ID).students || [];
  const teachers = Classroom.Courses.Teachers.list(COURSE_ID).teachers || [];
  const usersMap = {};

  students.forEach(s => usersMap[s.userId] = s.profile.name.fullName);
  teachers.forEach(t => usersMap[t.userId] = t.profile.name.fullName);

  folder.createFile('users.json', JSON.stringify(usersMap, null, 2), MimeType.PLAIN_TEXT);
  return usersMap;
}

// ---------------- TOPICS ----------------
function exportTopics(folder) {
  const topics = Classroom.Courses.Topics.list(COURSE_ID).topic || [];
  folder.createFile('topics.json', JSON.stringify(topics, null, 2), MimeType.PLAIN_TEXT);
}

// ---------------- MATERIALS ----------------
function exportMaterials(folder, usersMap) {
  const materialsFolder = folder.createFolder('materials_files');
  const mats = Classroom.Courses.CourseWorkMaterials.list(COURSE_ID).courseWorkMaterial || [];

  const exported = mats.map(m => ({
    title: m.title,
    description: m.description,
    authorUserId: m.creatorUserId,
    author: usersMap[m.creatorUserId] || '[autore sconosciuto]',
    topicId: m.topicId,
    creationTime: m.creationTime || null,  // aggiunto
    updateTime: m.updateTime || null,      // aggiunto
    materials: exportAttachments(m.materials, materialsFolder)
  }));

  folder.createFile('materials.json', JSON.stringify(exported, null, 2), MimeType.PLAIN_TEXT);
}

// ---------------- COURSEWORK ----------------
function exportCoursework(folder, usersMap) {
  const courseworkFolder = folder.createFolder('coursework_files');
  const works = Classroom.Courses.CourseWork.list(COURSE_ID).courseWork || [];

  const exported = works.map(cw => ({
    id: cw.id,
    title: cw.title,
    description: cw.description,
    creatorUserId: cw.creatorUserId,
    creatorName: usersMap[cw.creatorUserId] || '[autore sconosciuto]',
    topicId: cw.topicId,
    workType: cw.workType,
    assigneeMode: cw.assigneeMode,
    individualStudentsOptions: cw.individualStudentsOptions,
    creationTime: cw.creationTime || null,
    updateTime: cw.updateTime || null,
    dueDate: cw.dueDate || null,
    dueTime: cw.dueTime || null,
    maxPoints: cw.maxPoints || null,
    materials: exportAttachments(cw.materials, courseworkFolder)
  }));

  folder.createFile('coursework.json', JSON.stringify(exported, null, 2), MimeType.PLAIN_TEXT);
}

// ---------------- ANNOUNCEMENTS ----------------
function exportAnnouncements(folder, usersMap) {
  const announcementsFolder = folder.createFolder('announcements_files');
  const anns = Classroom.Courses.Announcements.list(COURSE_ID).announcements || [];

  const exported = anns.map(a => ({
    id: a.id,
    date: a.updateTime || a.creationTime,
    text: a.text,
    authorUserId: a.creatorUserId,
    author: usersMap[a.creatorUserId] || '[autore sconosciuto]',
    materials: exportAttachments(a.materials, announcementsFolder),
    comments: exportAnnouncementComments(a.id)
  }));

  folder.createFile('announcements.json', JSON.stringify(exported, null, 2), MimeType.PLAIN_TEXT);
}

function exportAnnouncementComments(announcementId, usersMap) {
  try {
    const comments = Classroom.Courses.Announcements.Comments.list(COURSE_ID, announcementId).comments || [];
    return comments.map(c => ({
      date: c.updateTime || c.creationTime,
      authorId: c.creatorUserId || null,
      author: usersMap[c.creatorUserId] || '[autore sconosciuto]',
      text: c.text
    }));
  } catch (e) {
    Logger.log(`⚠️ Impossibile esportare commenti per annuncio ${announcementId}: ${e.message}`);
    return [];
  }
}

// ---------------- SUBMISSIONS ----------------
function exportSubmissions(folder, usersMap) {
  const submissionsFolder = folder.createFolder('submissions_files');
  const courseworkList = Classroom.Courses.CourseWork.list(COURSE_ID).courseWork || [];
  const result = {};

  courseworkList.forEach(cw => {
    try {
      const subs = Classroom.Courses.CourseWork.StudentSubmissions.list(COURSE_ID, cw.id).studentSubmissions || [];

      result[cw.id] = {
        courseWorkId: cw.id,
        title: cw.title,
        maxPoints: cw.maxPoints || null,
        submissions: subs.map(sub => {
          const entry = {
            id: sub.id,
            userId: sub.userId,
            userName: usersMap[sub.userId] || '[studente sconosciuto]',
            state: sub.state,
            assignedGrade: sub.assignedGrade || null,
            draftGrade: sub.draftGrade || null,
            creationTime: sub.creationTime || null, // aggiunto
            updateTime: sub.updateTime || null,     // aggiunto
            materials: [],
            privateComments: exportPrivateComments(cw.id, sub.id, usersMap)
          };

          try {
            if (sub.assignmentSubmission && sub.assignmentSubmission.attachments) {
              const subFolder = submissionsFolder.createFolder(sub.id);

              entry.materials = sub.assignmentSubmission.attachments.map(mat => {
                try {
                  // ---------------- DRIVE FILE ----------------
                  if (mat.driveFile) {
                    const fileId = mat.driveFile.driveFile?.id || mat.driveFile.id;
                    if (fileId) {
                      const file = DriveApp.getFileById(fileId);
                      const title = file.getName();
                      const mimeType = file.getMimeType();

                      const googleTypes = {
                        'application/vnd.google-apps.document': 'docx',
                        'application/vnd.google-apps.spreadsheet': 'xlsx',
                        'application/vnd.google-apps.presentation': 'pptx'
                      };

                      let saved;
                      if (googleTypes[mimeType]) {
                        saved = file.makeCopy(title + '.' + googleTypes[mimeType], subFolder);
                        return { name: saved.getName(), type: googleTypes[mimeType] };
                      } else {
                        saved = file.makeCopy(title, subFolder);
                        return { name: saved.getName(), type: mimeType };
                      }
                    }

                  // ---------------- LINK ----------------
                  } else if (mat.link?.url) {
                    return { type: 'link', url: mat.link.url, title: mat.link.title || '' };

                  // ---------------- YOUTUBE ----------------
                  } else if (mat.youtubeVideo?.id) {
                    return { type: 'youtube', url: `https://youtu.be/${mat.youtubeVideo.id}`, title: mat.youtubeVideo.title || '' };

                  // ---------------- FORM ----------------
                  } else if (mat.form?.formUrl) {
                    return { type: 'form', url: mat.form.formUrl, title: mat.form.title || '' };

                  } else {
                    return null;
                  }
                } catch (e) {
                  Logger.log(`⚠️ Allegato submission non esportato (${sub.id}): ${e.message}`);
                  return null;
                }
              }).filter(Boolean);
            }
          } catch (e) {
            Logger.log(`⚠️ Impossibile esportare submission ${sub.id}: ${e.message}`);
          }

          return entry;
        })
      };
    } catch (e) {
      Logger.log(`⚠️ Impossibile esportare submissions per compito ${cw.id}: ${e.message}`);
    }
  });

  folder.createFile('submissions.json', JSON.stringify(result, null, 2), MimeType.PLAIN_TEXT);
}

function exportPrivateComments(courseWorkId, submissionId, usersMap) {
  try {
    const comments = Classroom.Courses.CourseWork.StudentSubmissions.Comments.list(
      COURSE_ID, courseWorkId, submissionId
    ).comments || [];

    return comments.map(c => ({
      date: c.updateTime || c.creationTime,
      author: usersMap[c.creatorUserId] || '[autore sconosciuto]',
      text: c.text
    }));
  } catch (e) {
    Logger.log(`⚠️ Commenti privati non accessibili per submission ${submissionId}`);
    return [];
  }
}

function exportGoogleFileAs(fileId, mimeType, name, targetFolder) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(mimeType)}`;
  const token = ScriptApp.getOAuthToken();
  const response = UrlFetchApp.fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(`Export fallito: ${response.getContentText()}`);
  }

  const blob = response.getBlob().setName(name);
  return targetFolder.createFile(blob);
}

// ---------------- ATTACHMENTS EXPORT ----------------
function exportAttachments(materials, targetFolder) {
  if (!materials) return [];
  return materials.map(mat => {
    try {
      if (mat.driveFile?.driveFile?.id) {
        const fileId = mat.driveFile.driveFile.id;
        const fileMeta = Drive.Files.get(fileId);

        if (fileMeta.mimeType === 'application/vnd.google-apps.document') {
          const saved = exportGoogleFileAs(fileId,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            fileMeta.title + ".docx",
            targetFolder
          );
          return { name: saved.getName(), type: 'docx' };

        } else if (fileMeta.mimeType === 'application/vnd.google-apps.spreadsheet') {
          const saved = exportGoogleFileAs(fileId,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            fileMeta.title + ".xlsx",
            targetFolder
          );
          return { name: saved.getName(), type: 'xlsx' };

        } else if (fileMeta.mimeType === 'application/vnd.google-apps.presentation') {
          const saved = exportGoogleFileAs(fileId,
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            fileMeta.title + ".pptx",
            targetFolder
          );
          return { name: saved.getName(), type: 'pptx' };

        } else {
          const saved = DriveApp.getFileById(fileId).makeCopy(fileMeta.title, targetFolder);
          return { name: saved.getName(), type: fileMeta.mimeType };
        }
        
      } else if (mat.link?.url) {
        return { type: 'link', url: mat.link.url, title: mat.link.title || '' };
      } else if (mat.youtubeVideo?.id) {
        return { type: 'youtube', url: `https://youtu.be/${mat.youtubeVideo.id}`, title: mat.youtubeVideo.title || '' };
      } else if (mat.form?.formUrl) {
        return { type: 'form', url: mat.form.formUrl, title: mat.form.title || '' };
      }
    } catch (e) {
      Logger.log(`⚠️ Allegato non esportato: ${e.message}`);
    }
    return null;
  }).filter(Boolean);
}
