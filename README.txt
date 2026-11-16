CATCH-UP CLUB - YEAR 8 REVISION

The site covers all 18 subjects in the supplied First Term 2026/2027 Year 8 scheme: French, Physics, Social & Citizenship Studies, Home Economics, Art & Design, Design & Technology, English Studies, Agricultural Science, Music, Igbo, Mathematics, Business Studies, Computer Science, History, PHE, Biology, Chemistry and Yoruba. It includes the week-by-week schemes, study notes, explanatory visual flows, flashcards, challenge quizzes and a printable guide.

The Biology, Chemistry and Yoruba schedules were transcribed from year-8-scheme-of-work.pdf. The Chemistry source repeats Week 10 and Week 11 numbering in its extracted text. The site separates the listed topics into Week 10 energy reactions, Week 11 examination, Week 12 metal reactions and Week 13 reactivity/displacement to make the sequence usable; check the printed school schedule if your teacher uses a different numbering.

Some source weeks are assessments, examinations, breaks or closing activities rather than teaching topics. For these, use your class notes and teacher's directions. Yoruba and Igbo topic headings do not include full vocabulary lists in the source, so the site does not invent translations.

ONLINE PLAY SETUP

Brainwave Battle supports up to 10 players across devices. The host invites up to nine usernames, and friends can join in the same browser-based site without installing an app. The site is not connected to a shared online database yet. To enable cross-device usernames and live rooms, configure Firebase and publish over HTTPS:

1. Create a Firebase project and a Web app in the Firebase console.
2. Enable Authentication > Sign-in method > Anonymous, then create a Cloud Firestore database.
3. Copy the Web app configuration into firebase-config.js, replacing null with the configuration object shown in that file.
4. Deploy the included Firestore rules with the Firebase CLI (`firebase use --add`, then `firebase deploy --only firestore:rules`).
5. Publish the site files using Firebase Hosting or GitHub Pages. If using GitHub Pages, add its hostname (for example, `yourname.github.io`) to Firebase Authentication's authorized domains.
6. Share the HTTPS website URL with friends.

GitHub Pages serves the website files; Firebase Authentication and Firestore share usernames, invites and quiz rooms. Until Firebase is configured, usernames and XP stay in the current browser and online quizzes are unavailable.

FILES

year8-study-guide.pdf is the revised printable guide with all 18 schedules, selected deeper notes and challenge questions with answers. year-8-scheme-of-work.pdf is the original school source document; keep it available for verifying the official schedule.
