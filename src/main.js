import './styles.css';
import { onUser, signIn, signOut } from './firebase.js';
import { start } from './store.js';
import { startApp } from './app.js';
import { ownerEmail } from './config.js';
import { registerSW } from 'virtual:pwa-register';

const main = document.getElementById('main');
const gate = html => { document.body.classList.add('gated'); main.innerHTML = `<div class="gate"><div class="seal big" aria-hidden="true">GT</div><h1>GraytTrees Bonsai</h1>${html}</div>`; };

let started = false;
// a photo link that no longer works (e.g. an old Care App link) just hides instead of showing a broken icon
document.addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.classList.add('broken'); }, true);
onUser(async user => {
  if (!user) {
    gate(`<p class="muted">Your private bonsai records.</p><button class="btn" id="signin">Sign in with Google</button><p class="err" id="gateErr"></p>`);
    document.getElementById('signin').onclick = () => signIn().catch(e => { document.getElementById('gateErr').textContent = e.code === 'auth/popup-closed-by-user' ? '' : 'Sign-in failed: ' + e.message; });
    return;
  }
  if (user.email !== ownerEmail) {
    gate(`<p>This app is private. ${user.email} doesn't have access.</p><button class="btn ghost" id="out">Use a different account</button>`);
    document.getElementById('out').onclick = () => signOut();
    return;
  }
  if (started) return; started = true;
  document.body.classList.remove('gated');
  start(user.uid);
  startApp();
});

// Installable + offline. A new version shows a small banner instead of interrupting.
const updateSW = registerSW({
  onNeedRefresh() {
    const b = document.createElement('button');
    b.className = 'toast update'; b.textContent = 'Update available – tap to refresh';
    b.onclick = () => updateSW(true);
    document.body.appendChild(b);
  },
});
