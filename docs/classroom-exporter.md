# 📚 Google Classroom Export Script

[![Google Apps Script](https://img.shields.io/badge/Language-Google%20Apps%20Script-blue)](https://developers.google.com/apps-script)  
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

A Google Apps Script to export all data from a Google Classroom course into Google Drive.  
Includes users, topics, materials, coursework, announcements, and student submissions — with attachments. 🚀

---

## ✨ Features

- 👥 **Users** (`users.json`): list of students and teachers (ID → full name)  
- 🗂 **Topics** (`topics.json`) of the course  
- 📄 **Materials** (`materials.json` + `materials_files` folder)  
- 📝 **Coursework** (`coursework.json` + `coursework_files` folder)  
- 📢 **Announcements** (`announcements.json` + `announcements_files` folder) including comments  
- 🏫 **Submissions** (`submissions.json` + `submissions_files` folder) including private comments  
      > Only if you are teacher
- 🗃 Exports Google Docs, Sheets, and Slides to `.docx`, `.xlsx`, `.pptx`  
- 🔗 Saves links, YouTube videos, and Google Forms as reference objects

---

## ⚙️ Requirements

- Google account with access to the course  
- Classroom API and Drive API v2 enabled  
- Permissions to read Classroom data and write to Drive

---

## 🛠 Setup

### 1. Edit the script constants:

```
const EXPORT_FOLDER_ID = 'YOUR_DRIVE_FOLDER_ID';
const COURSE_ID = 'YOUR_CLASSROOM_COURSE_ID';
```

> to get the drive folder id, you just copy the string after the /folder/
> (e.g. https://drive.google.com/drive/u/0/folders/STRINGTHATYOUNEED)

> you can get the course id from [this](https://github.com/gablilli/googlescripts/blob/main/classroom/courses-ids.gs) script.

### 2. Add APIs
In order to correctly use the script, you need to add, in the services tab, **Drive API** and **Classroom API**.

> Note: Drive API must be v2, otherwise the script won't work.

### 3. Grant Access
Grant access to the script via the tab that will open.

### 4. Run the main function:

exportClassroomData();

### 5. You're done!
All data will be exported into a folder named after the course inside your target folder 📂.

## 📁 File Structure

- users.json – user ID → full name mapping

- topics.json – course topics

- materials.json – materials info + attachments

- coursework.json – assignments info + attachments

- announcements.json – announcements + attachments + comments

- submissions.json – student submissions + attachments + private comments

### Folders:

- coursework_files – coursework attachments

- materials_files – materials attachments

- announcements_files – announcement attachments

- submissions_files – student submission attachments

## 📝 Notes

- Google file attachments are exported to Office-compatible formats

- Links, YouTube videos, and Forms are exported as reference objects

- Errors during export are logged via Logger.log() without stopping the script ⚠️

## ✅ Logging

After a successful export:

✅ Export completed in folder: CourseName

## 📌 License

MIT License

