// Google Apps Script to import topics, materials, coursework, announcements, and submissions into Google Classroom
// including attachments (files, links, videos, Google Docs converted to .docx, etc.) from a structured Drive folder

const IMPORT_FOLDER_ID = '1WeIs5tSR3Hx4u987Y96Fhf9bRem79Zb4'; // Drive folder containing exported data
const COURSE_ID = '791354743660'; // Target Google Classroom course ID

function importClassroomData() {
  const root = DriveApp.getFolderById(IMPORT_FOLDER_ID);

  const allFolders = getAllSubfolders(root);
  allFolders.unshift(root); // include the main folder

  let dataFolder = null;

  for (const folder of allFolders) {
    const filenames = ["topics.json", "materials.json", "coursework.json", "announcements.json", "submissions.json"];
    const hasFile = filenames.some(name => folder.getFilesByName(name).hasNext());
    if (hasFile) {
      dataFolder = folder;
      break;
    }
  }

  if (!dataFolder) {
    Logger.log("❌ No folder containing JSON files found.");
    return;
  }

  Logger.log("📁 Folder containing JSON files found: " + dataFolder.getName());

  const topicMap = importTopics(COURSE_ID, dataFolder);
  const courseworkMap = loadCourseworkMap(dataFolder);

  importMaterials(dataFolder, topicMap);
  importCoursework(dataFolder, topicMap);
  importAnnouncements(dataFolder, topicMap);
  importSubmissionsAsMaterials(dataFolder, courseworkMap);
}

function getAllSubfolders(folder) {
  const folders = [];
  const subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    const sub = subfolders.next();
    folders.push(sub);
    folders.push(...getAllSubfolders(sub)); // recursive call
  }
  return folders;
}

function importTopics(courseId, folder) {
  const file = folder.getFilesByName('topics.json');
  if (!file.hasNext()) {
    Logger.log('⚠️ topics.json file not found.');
    return [];
  }
  const json = JSON.parse(file.next().getBlob().getDataAsString());

  const createdTopics = [];
  json.forEach(t => {
    try {
      const topic = Classroom.Courses.Topics.create({ name: t.name }, courseId);
      createdTopics.push({ oldId: t.topicId || t.id, newId: topic.topicId || topic.id });
    } catch (e) {
      Logger.log(`❌ Error creating topic ${t.name}: ${e.message}`);
    }
  });

  return createdTopics;
}

function importMaterials(folder, topicMap) {
  const files = folder.getFilesByName('materials.json');
  if (!files.hasNext()) {
    Logger.log('⚠️ materials.json file not found.');
    return;
  }
  const materials = JSON.parse(files.next().getBlob().getDataAsString());

  let filesFolder;
  try {
    filesFolder = folder.getFoldersByName('materials_files').next();
  } catch (_) {
    Logger.log('⚠️ materials_files subfolder not found');
  }

  materials.forEach(mat => {
    try {
      const material = {
        title: mat.title,
        description: mat.description,
        materials: convertToMaterials(mat.materials, filesFolder),
        topicId: getMappedTopicId(mat.topicId, topicMap)
      };
      try {
        Classroom.Courses.CourseWorkMaterials.create(material, COURSE_ID);
      } catch (e) {
        if (e.message && e.message.includes('@AttachmentNotVisible')) {
          Logger.log(`⚠️ Skipped material due to invisible attachment: ${mat.title}`);
        } else {
          throw e;
        }
      }
    } catch (e) {
      Logger.log(`❌ Error importing material ${mat.title}: ${e.message}`);
    }
  });
}

function importCoursework(folder, topicMap) {
  const files = folder.getFilesByName('coursework.json');
  if (!files.hasNext()) {
    Logger.log('⚠️ coursework.json file not found.');
    return;
  }
  const courseworks = JSON.parse(files.next().getBlob().getDataAsString());

  let filesFolder;
  try {
    filesFolder = folder.getFoldersByName('coursework_files').next();
  } catch (_) {
    Logger.log('⚠️ coursework_files subfolder not found');
  }

  courseworks.forEach(cw => {
    try {
      const assignment = {
        title: cw.title,
        description: cw.description,
        materials: convertToMaterials(cw.materials, filesFolder),
        state: 'DRAFT',
        workType: cw.workType,
        topicId: getMappedTopicId(cw.topicId, topicMap)
      };
      Classroom.Courses.CourseWork.create(assignment, COURSE_ID);
    } catch (e) {
      Logger.log(`❌ Error importing assignment ${cw.title}: ${e.message}`);
    }
  });
}

function importAnnouncements(folder, topicMap) {
  const files = folder.getFilesByName('announcements.json');
  if (!files.hasNext()) {
    Logger.log('⚠️ announcements.json file not found.');
    return;
  }
  const announcements = JSON.parse(files.next().getBlob().getDataAsString());

  announcements.forEach(a => {
    try {
      const ann = {
        text: `[${a.date || ''}] ${a.author || ''}\n${a.text}`,
        materials: a.materials || [],
      };
      const created = Classroom.Courses.Announcements.create(ann, COURSE_ID);

      if (a.comments && a.comments.length) {
        a.comments.forEach(c => {
          try {
            Classroom.Courses.Announcements.Comments.create({ text: c.text }, COURSE_ID, created.id);
          } catch (e) {
            Logger.log(`⚠️ Error adding comment to announcement ${created.id}: ${e.message}`);
          }
        });
      }
    } catch (e) {
      Logger.log(`❌ Error importing announcement: ${e.message}`);
    }
  });
}

function importSubmissionsAsMaterials(folder, courseworkMap) {
  const files = folder.getFilesByName('submissions.json');
  if (!files.hasNext()) {
    Logger.log('⚠️ submissions.json file not found.');
    return;
  }

  let raw = files.next().getBlob().getDataAsString();
  raw = raw.replace(/[\x00-\x1F\x7F]/g, " "); // sanitize invalid characters

  let submissionsData;
  try {
    submissionsData = JSON.parse(raw);
  } catch (e) {
    Logger.log(`❌ Error parsing submissions.json: ${e.message}`);
    return;
  }

  let filesFolder;
  try {
    filesFolder = folder.getFoldersByName('submissions_files').next();
  } catch (_) {
    Logger.log('⚠️ submissions_files subfolder not found');
  }

  submissionsData.submissions.forEach(sub => {
    try {
      let description = "";
      if (sub.privateComments && sub.privateComments.length) {
        description += "Private comments:\n";
        sub.privateComments.forEach(c => {
          description += `[${c.date}] ${c.author ? c.author + ': ' : ''}${c.text}\n`;
        });
      }

      const cwTitle = courseworkMap[sub.courseWorkId || sub.assignmentId] || "Unknown assignment";
      const title = `${cwTitle} (submission from ${sub.userName || sub.userId})`;

      const material = {
        title: title,
        description: description,
        materials: convertToMaterials(sub.files, filesFolder),
      };

      Classroom.Courses.CourseWorkMaterials.create(material, COURSE_ID);
    } catch (e) {
      Logger.log(`❌ Error importing submission from ${sub.userName || sub.userId}: ${e.message}`);
    }
  });
}

function convertToMaterials(materials, folder) {
  return (materials || []).map(m => {
    if (m.type === 'docx' || m.type?.includes('application')) {
      try {
        const file = folder?.getFilesByName(m.name)?.next();
        return { driveFile: { driveFile: { id: file.getId() }, shareMode: 'VIEW' } };
      } catch (e) {
        Logger.log(`⚠️ File not found or inaccessible: ${m.name}`);
        return null;
      }
    } else if (m.type === 'link') {
      return { link: { url: m.url, title: m.title || '' } };
    } else if (m.type === 'youtube') {
      const videoId = extractYouTubeId(m.url);
      if (videoId) {
        return { youtubeVideo: { id: videoId, title: m.title || '' } };
      } else {
        Logger.log(`⚠️ Unable to extract video ID from URL: ${m.url}`);
        return null;
      }
    } else if (m.type === 'form') {
      return { form: { formUrl: m.url, title: m.title || '' } };
    }
    return null;
  }).filter(m => m !== null);
}

function extractYouTubeId(url) {
  try {
    const match = url.match(/[?&]v=([^&#]+)/) || url.match(/youtu\.be\/([^?]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function getMappedTopicId(oldId, topicMap) {
  if (!oldId) return null;
  const found = topicMap.find(t => t.oldId === oldId);
  return found ? found.newId : null;
}

function loadCourseworkMap(folder) {
  const files = folder.getFilesByName('coursework.json');
  if (!files.hasNext()) {
    Logger.log('⚠️ coursework.json file not found.');
    return {};
  }
  const coursework = JSON.parse(files.next().getBlob().getDataAsString());
  const map = {};
  coursework.forEach(cw => {
    map[cw.id || cw.courseWorkId] = cw.title;
  });
  return map;
}

