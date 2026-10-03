// Project settings. These identify Nathan's Firebase project; they are not secrets.
// Access is controlled by the Firestore security rules (firestore.rules), which only
// allow the owner's Google account to read or write anything.
export const firebaseConfig = {
  apiKey: 'AIzaSyCoqteuOP5q_WKmk3xyfYfbCfJciVDooaQ',
  authDomain: 'graytrees.firebaseapp.com',
  projectId: 'graytrees',
  storageBucket: 'graytrees.firebasestorage.app',
  messagingSenderId: '924620275504',
  appId: '1:924620275504:web:7e1674b58e302a7a02d2f5',
};

// OAuth web client used to ask for Google Drive access (photos + backups).
// Firebase creates it automatically: Authentication → Sign-in method → Google → Web SDK configuration.
export const googleClientId = '__WEB_CLIENT_ID__';

// The only Google account allowed in. Matches firestore.rules.
export const ownerEmail = 'graytshotz@gmail.com';

// Folder created in the owner's Google Drive.
export const driveFolderName = 'Graytrees';
