# 📄 Google Docs Version Exporter

Export **all revisions** of a Google Docs file to your Google Drive folder, saving each version as a separate `.docx` file named with revision number, date, and reviser's name! 🚀

---

## ✨ Features

- Export **every** revision of a Google Doc  
- Save revisions as `.docx` files in a Drive folder  
- Filename includes last reviser's display name & modification date  
- Automatic delay between requests to avoid rate limiting (HTTP 429)  
- Logs progress and errors for easy debugging  

---

## 🛠 How to use

### From Google Apps Script UI

1. Open [Google Apps Script](https://script.google.com/) and create a new project.

2. Copy & paste the script into the editor.

3. Add from the services tab the Drive API (V2, do **not** use V3)

4. Replace these variables at the top of the script with your values:

```
const docId = 'YOUR_DOC_ID_HERE';     // Google Docs file ID
const delayMs = 7000; // Delay between requests (ms), increase if you get rate limit errors
```
Save the project (File → Save).

5. Click the ▶️ Run button to execute the exportNamedVersionsById function.

(The script will ask you to authorize access to your Drive and Docs data — just follow the prompts.)

6. After execution, check your specified Drive folder. 🎉

### How to find IDs 🔍
Google Docs file ID: Look at your Doc’s URL:
https://docs.google.com/document/d/DOC_ID/edit
The DOC_ID part is what you need.

Drive folder ID: Open the folder in Google Drive:
https://drive.google.com/drive/folders/FOLDER_ID
Copy FOLDER_ID.

### 📋 Notes & Tips
If you get HTTP 429 Too Many Requests, increase delayMs (e.g., 10,000 ms = 10 seconds)

Ensure you have edit access to the document and write access to the destination folder

The script logs progress and errors — check the Logs panel in the Apps Script editor (View → Logs)

You can run the script multiple times; it will export all revisions every time
