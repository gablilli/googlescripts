const EXPORT_FOLDER_ID = 'FOLDERID';
const COURSE_ID = 'COURSEID';

function exportClassroomData() {
  const exportRoot = DriveApp.getFolderById(EXPORT_FOLDER_ID);

  const usersMap = exportUsersMap(exportRoot);
  exportTopics(exportRoot);
  exportMaterials(exportRoot, usersMap);
  exportCoursework(exportRoot, usersMap);
  exportAnnouncements(exportRoot, usersMap);
  exportSubmissions(exportRoot, usersMap);

  Logger.log("✅ Esportazione completata.");
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
    materials: exportAttachments(m.materials, materialsFolder)
  }));

  folder.createFile('materials.json', JSON.stringify(exported, null, 2), MimeType.PLAIN_TEXT);
}

// ---------------- COURSEWORK ----------------
function exportCoursework(folder, usersMap) {
  const courseworkFolder = folder.createFolder('_files');
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

function exportAnnouncementComments(announcementId) {
  try {
    const comments = Classroom.Courses.Announcements.Comments.list(COURSE_ID, announcementId).comments || [];
    return comments.map(c => ({
      date: c.updateTime || c.creationTime,
      author: c.creatorUserId || null,
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
        submissions: subs.map(sub => {
          const entry = {
            id: sub.id,
            userId: sub.userId,
            userName: usersMap[sub.userId] || '[studente sconosciuto]',
            materials: [],
            privateComments: exportPrivateComments(cw.id, sub.id, usersMap)
          };

          // tenta esportazione file allegati
          try {
            if (sub.assignmentSubmission && sub.assignmentSubmission.attachments) {
              const subFolder = submissionsFolder.createFolder(sub.id);
              entry.materials = exportAttachments(sub.assignmentSubmission.attachments, subFolder);
            }
          } catch (err) {
            Logger.log(`⚠️ File submission ${sub.id} non accessibile: ${err.message}`);
            entry.materials = []; // potrai riempire manualmente
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

// ---------------- ATTACHMENTS EXPORT ----------------
function exportAttachments(materials, targetFolder) {
  if (!materials) return [];
  return materials.map(mat => {
    try {
      if (mat.driveFile?.driveFile?.id) {
        const file = DriveApp.getFileById(mat.driveFile.driveFile.id);
        if (file.getMimeType().startsWith('application/vnd.google-apps')) {
          const converted = file.getAs(MimeType.MICROSOFT_WORD);
          const saved = targetFolder.createFile(converted).setName(file.getName() + ".docx");
          return { name: saved.getName(), type: 'docx' };
        } else {
          const saved = file.makeCopy(file.getName(), targetFolder);
          return { name: saved.getName(), type: file.getMimeType() };
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
