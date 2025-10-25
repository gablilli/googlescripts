const IMPORT_ROOT_ID = 'FOLDERID'; <-- CHANGE HERE
const COURSE_ID = 'COURSEID'; <-- CHANGE HERE

function importClassroomData() {
  const courseFolder = DriveApp.getFolderById(IMPORT_ROOT_ID);
  const courseName = courseFolder.getName();
  Logger.log("Import nel corso: " + courseName + " (" + COURSE_ID + ")");

  // --- load jsons ---
  const usersMap = readJsonFile(courseFolder, 'users.json');
  const topics = readJsonFile(courseFolder, 'topics.json');
  const materials = readJsonFile(courseFolder, 'materials.json');
  const coursework = readJsonFile(courseFolder, 'coursework.json');
  const announcements = readJsonFile(courseFolder, 'announcements.json');
  const submissions = readJsonFile(courseFolder, 'submissions.json');

  // --- create aarguments ---
  const topicIdMap = {};
  topics.forEach(t => {
    const created = Classroom.Courses.Topics.create({ name: t.name }, COURSE_ID);
    topicIdMap[t.topicId || t.id] = created.topicId;
  });

  // topic for orphan sumbissions
  const submissionTopic = Classroom.Courses.Topics.create({ name: "Submissions" }, COURSE_ID);

  // --- importa materials ---
  const materialsFolder = findSubfolder(courseFolder, 'materials_files');
  if (materialsFolder) {
    importMaterials(COURSE_ID, materials, materialsFolder, topicIdMap);
  }

  // --- import coursework ---
  const courseworkFolder = findSubfolder(courseFolder, 'coursework_files');
  if (courseworkFolder) {
    importCoursework(COURSE_ID, coursework, courseworkFolder, topicIdMap);
  }

  // --- import annuncements ---
  const announcementsFolder = findSubfolder(courseFolder, 'announcements_files');
  if (announcementsFolder) {
    importAnnouncements(COURSE_ID, announcements, announcementsFolder, topicIdMap);
  }

  // --- import submissions ---
  const submissionsFolder = findSubfolder(courseFolder, 'submissions_files');
  if (submissionsFolder) {
    importSubmissions(COURSE_ID, submissions, submissionsFolder, topicIdMap, submissionTopic.topicId);
  }

  Logger.log("✅ Importation complete in: " + courseName);
}

// --------- UTILS ----------
function readJsonFile(folder, name) {
  const files = folder.getFilesByName(name);
  if (!files.hasNext()) return [];
  const content = files.next().getBlob().getDataAsString();
  return JSON.parse(content);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const pad = n => (n < 10 ? '0' + n : n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildDescription(desc, author, date) {
  const dateFormatted = date ? `\n[Data: ${formatDate(date)}]` : '';
  const authorStr = author ? `\n[Autore: ${author}]` : '';
  return (desc || '') + authorStr + dateFormatted;
}

function findSubfolder(parentFolder, nameFragment) {
  const folders = parentFolder.getFolders();
  const target = nameFragment.toLowerCase().trim();
  while (folders.hasNext()) {
    const f = folders.next();
    if (f.getName().toLowerCase().trim() === target) {
      return f;
    }
  }
  return null;
}

// --- import with order ---
function importMaterials(courseId, mats, filesFolder, topicIdMap) {
  // Usa creationTime o createTime se presente
  mats.sort((a, b) => new Date(a.creationTime || a.createTime) - new Date(b.creationTime || b.createTime));
  mats.forEach(m => {
    const date = m.creationTime || m.createTime;
    Classroom.Courses.CourseWorkMaterials.create({
      title: m.title,
      description: buildDescription(m.description, m.author, date),
      topicId: topicIdMap[m.topicId] || null,
      materials: rebuildMaterials(m.materials, filesFolder)
    }, courseId);
  });
}

function importCoursework(courseId, works, filesFolder, topicIdMap) {
  works.sort((a, b) => new Date(a.creationTime || a.createTime) - new Date(b.creationTime || b.createTime));
  works.forEach(cw => {
    const date = cw.creationTime || cw.createTime;
    Classroom.Courses.CourseWork.create({
      title: cw.title,
      description: buildDescription(cw.description, cw.creatorName, date),
      topicId: topicIdMap[cw.topicId] || null,
      workType: cw.workType || 'ASSIGNMENT',
      state: 'DRAFT',
      maxPoints: cw.maxPoints || 100,
      materials: rebuildMaterials(cw.materials, filesFolder)
    }, courseId);
  });
}

function importAnnouncements(courseId, anns, filesFolder, topicIdMap) {
  anns.sort((a, b) => new Date(a.date) - new Date(b.date));
  anns.forEach(a => {
    Classroom.Courses.Announcements.create({
      text: buildDescription(a.text, a.author, a.date),
      state: 'PUBLISHED',
      materials: rebuildMaterials(a.materials, filesFolder)
    }, courseId);
  });
}

function importSubmissions(courseId, subsMap, filesFolder, topicIdMap, fallbackTopicId) {
  Object.values(subsMap).forEach(cw => {
    const topicId = topicIdMap[cw.topicId] || fallbackTopicId;
    cw.submissions.sort((a, b) => new Date(a.updateTime || a.creationTime) - new Date(b.updateTime || b.creationTime));
    cw.submissions.forEach(s => {
      const subFolder = findSubfolder(filesFolder, s.id);
      const date = s.updateTime || s.creationTime;
      Classroom.Courses.CourseWorkMaterials.create({
        title: `${cw.title} - Submission di ${s.userName}`,
        description: buildDescription(
          `Stato: ${s.state}\nPunti: ${s.assignedGrade || s.draftGrade || ''}`,
          s.userName, date),
        topicId,
        materials: subFolder ? rebuildMaterials(s.materials, subFolder) : []
      }, courseId);
    });
  });
}

function rebuildMaterials(list, folder) {
  if (!list) return [];
  const seen = new Set();
  return list.map(m => {
    let material = null;
    if (m.type === 'link') {
      if (seen.has(m.url)) return null;
      material = { link: { url: m.url, title: m.title } };
      seen.add(m.url);
    } else if (m.type === 'youtube') {
      const id = m.url.split('/').pop();
      if (seen.has(id)) return null;
      material = { youtubeVideo: { id, title: m.title } };
      seen.add(id);
    } else if (m.type === 'form') {
      if (seen.has(m.url)) return null;
      material = { form: { formUrl: m.url, title: m.title } };
      seen.add(m.url);
    } else if (m.name) {
      const files = folder.getFilesByName(m.name);
      if (files.hasNext()) {
        const file = files.next();
        if (seen.has(file.getId())) return null;
        material = { driveFile: { driveFile: { id: file.getId(), title: file.getName() } } };
        seen.add(file.getId());
      }
    }
    return material;
  }).filter(Boolean);
}
