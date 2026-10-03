const user = { uid: 'u1', email: 'graytshotz@gmail.com' };
export const getAuth = () => ({ currentUser: user });
export class GoogleAuthProvider { setCustomParameters() {} }
export const signInWithPopup = async () => ({ user });
export const onAuthStateChanged = (a, cb) => { setTimeout(() => cb(user), 0); return () => {}; };
export const signOut = async () => {};
