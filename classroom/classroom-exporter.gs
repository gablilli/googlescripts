function exportClassroomData() {
  const exportFolder = DriveApp.getFolderById('<EXPORT_FOLDER_ID>');
  const courseIds = ['<COURSE_ID_1>', '<COURSE_ID_2>']; // Replace with actual course IDs

  courseIds.forEach(courseId => {
    try {
      const course = Classroom.Courses.get(courseId);
      const courseFolder = exportFolder.createFolder(`${course.name.replace(/\W+/g, '_')}_${courseId}`);

      exportTopics(courseId, courseFolder);
      exportCourseWork(courseId, courseFolder);
      exportCourseMaterials(courseId, courseFolder);
      exportCustomPlaceholderSubmissions(courseId, courseFolder);
      exportAnnouncements(courseId, courseFolder);
    } catch (e) {
      Logger.log(`Error exporting course ${courseId}: ${e.message}`);
    }
  });

  Logger.log('Export completed');
}

function exportCustomPlaceholderSubmissions(courseId, folder) {
  const courseworkList = Classroom.Courses.CourseWork.list(courseId).courseWork || [];
  const results = {};

  courseworkList.forEach(work => {
    const submissionsForThisWork = [];

    for (let j = 1; j <= 2; j++) {
      const fakeSubmission = {
        userId: `user${j}@example.com`,
        userName: `User ${j}`,
        files: [
          {
            type: "driveFile",
            name: `Document_${work.title}_Submission_${j}.pdf`,
            id: `file_${work.id}_${j}`,
            url: `https://drive.google.com/file/d/file_${work.id}_${j}/view`
          },
          {
            type: "link",
            name: "Reference Link",
            url: `https://example.com/link_${work.id}_${j}`
          }
        ],
        privateComments: [
          {
            author: `User ${j}`,
            date: new Date().toISOString(),
            text: `Private comment for submission ${j} on assignment ${work.title}`
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
  folder.createFile('topics.json', JSON.stringify(topics, null, 2), MimeType.PLAIN_TEXT);
}

function exportCourseWork(courseId, folder) {
  const coursework = Classroom.Courses.CourseWork.list(courseId).courseWork || [];
  const results = [];
  const filesFolder = folder.createFolder('coursework_files');

  coursework.forEach(item => {
    const entry = {
      id: item.id,
      title: item.title,
      description: `Created: ${item.creationTime}\n\n${item.description || ''}`,
      materials: [],
      state: item.state,
      workType: item.workType,
      topicId: item.topicId,
      creatorUserId: item.creatorUserId || null
    };

    if (item.materials) {
      item.materials.forEach(mat => {
        try {
          const saved = saveMaterialToDrive(mat, filesFolder);
          if (saved) entry.materials.push(saved);
        } catch (e) {
          Logger.log(`Error saving material in "${item.title}": ${e.message}`);
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
      description: `Created: ${item.creationTime}\n\n${item.description || ''}`,
      materials: [],
      state: item.state,
      topicId: item.topicId,
      creatorUserId: item.creatorUserId || null
    };

    if (item.materials) {
      item.materials.forEach(mat => {
        try {
          const saved = saveMaterialToDrive(mat, filesFolder);
          if (saved) entry.materials.push(saved);
        } catch (e) {
          Logger.log(`Error saving material in "${item.title}": ${e.message}`);
        }
      });
    }

    results.push(entry);
  });

  folder.createFile('materials.json', JSON.stringify(results, null, 2), MimeType.PLAIN_TEXT);
}

function exportAnnouncements(courseId, folder) {
  let announcements = Classroom.Courses.Announcements.list(courseId).announcements || [];
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
      Logger.log(`Unable to get author name for announcement ${a.id}: ${e.message}`);
    }

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
            Logger.log(`Error copying attachment for announcement ${a.id}: ${e.message}`);
          }
        }
      });
    }

    results.push({
      id: a.id,
      text: `Author: ${authorName || '[unknown]'}\nCreated: ${new Date(a.creationTime).toLocaleString()}\n\n${a.text}`,
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
          return { 
            name: savedFile.getName(), 
            id: savedFile.getId(), 
            type: 'docx'
          };
        } else {
          Logger.log(`Error exporting Google Doc ${fileId}: ${response.getContentText()}`);
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
    Logger.log(`Error saving material: ${e}`);
  }
  return null;
}
