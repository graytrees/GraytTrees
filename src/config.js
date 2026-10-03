// Project settings. These identify Nathan's Firebase project; they are not secrets.
// Access is controlled by the Firestore security rules (firestore.rules), which only
// allow the owner's Google account to read or write anything.
export const firebaseConfig = {
  apiKey: '__API_KEY__',
  authDomain: '__AUTH_DOMAIN__',
  projectId: '__PROJECT_ID__',
  storageBucket: '__STORAGE_BUCKET__',
  messagingSenderId: '__SENDER_ID__',
  appId: '__APP_ID__',
};

// OAuth web client used to ask for Google Drive access (photos + backups).
// Firebase creates it automatically: Authentication → Sign-in method → Google → Web SDK configuration.
export const googleClientId = '__WEB_CLIENT_ID__';

// The only Google account allowed in. Matches firestore.rules.
export const ownerEmail = 'graytshotz@gmail.com';

// Folder created in the owner's Google Drive.
export const driveFolderName = 'Graytrees';
