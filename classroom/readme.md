📜 README 
# Google Classroom Importer Script
## 🚀 What This Script Does
This Google Apps Script automates the import of:

- Topics

- Materials

- Assignments (Coursework)

- Announcements (with optional comments)

- Submissions (as materials, for archiving)

...into a specific Google Classroom course, using JSON metadata and associated files stored in a Google Drive folder.

## 🧩 Required Google APIs
Before running the script, enable these services:

### ✅ Classroom API

In Apps Script: Services > + Add a service > Google Classroom

### ✅ Drive API

In Apps Script: Resources > Cloud Platform Project > View API Console, then enable Google Drive API

## 📂 Folder Structure Example
The Drive folder (by ID) should look like this:

MainImportFolder/
├── topics.json
├── materials.json
├── materials_files/
│   ├── file1.pdf
│   └── doc1.docx
├── coursework.json
├── coursework_files/
│   ├── assignment1.docx
├── announcements.json
├── submissions.json
├── submissions_files/
│   ├── submission1.pdf

## ⚙️ Configuration
At the top of the script, replace the placeholders with your own:

const IMPORT_FOLDER_ID = 'YOUR_DRIVE_FOLDER_ID';
const COURSE_ID = 'YOUR_GOOGLE_CLASSROOM_COURSE_ID';
IMPORT_FOLDER_ID – the Drive folder containing the exported files

COURSE_ID – the target Google Classroom course ID (you can get it from the course URL)

## ▶️ How to Run
1. Open Google Apps Script.

2. Create a new script project.

3. Copy-paste the entire script.

4. Replace IMPORT_FOLDER_ID and COURSE_ID.

5. Enable the required APIs (see above).

6. Run importClassroomData from the Apps Script editor.

7. You will be prompted to authorize access the first time.

## 📄 Data File Format (Example JSON)

### topics.json

[
  { "id": "t1", "name": "Introduction" },
  { "id": "t2", "name": "Week 1" }
]

### materials.json

[
  {
    "title": "Syllabus",
    "description": "Course outline",
    "topicId": "t1",
    "materials": [
      { "type": "docx", "name": "syllabus.docx" },
      { "type": "link", "url": "https://example.com", "title": "External Link" }
    ]
  }
]

### coursework.json

[
  {
    "id": "cw1",
    "title": "Assignment 1",
    "description": "First assignment",
    "topicId": "t2",
    "workType": "ASSIGNMENT",
    "materials": [
      { "type": "docx", "name": "assignment1.docx" }
    ]
  }
]

### announcements.json

[
  {
    "text": "Welcome to the course!",
    "date": "2025-08-01",
    "author": "Prof. Smith",
    "comments": [
      { "text": "Looking forward!", "date": "2025-08-02", "author": "Student A" }
    ]
  }
]

### submissions.json

{
  "submissions": [
    {
      "userId": "12345",
      "userName": "Student A",
      "assignmentId": "cw1",
      "privateComments": [
        { "text": "Here is my work", "date": "2025-08-03", "author": "Student A" }
      ],
      "files": [
        { "type": "docx", "name": "submission1.docx" }
      ]
    }
  ]
}
## 🔒 Permissions
When you run the script for the first time, you’ll need to grant authorization to:

Read and manage your Google Classroom data.

Access Google Drive files and folders.

## 📌 Notes
Files referenced must be located inside the appropriate subfolders (*_files).

The script handles invalid or missing files gracefully, logging warnings.

All coursework is imported as draft by default. You can publish them manually later.


