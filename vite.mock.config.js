import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
const r = p => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  base: '/', server: { port: 5199 },
  resolve: { alias: [
    { find: 'firebase/app', replacement: r('./test/mocks/app.js') },
    { find: 'firebase/auth', replacement: r('./test/mocks/auth.js') },
    { find: 'firebase/firestore', replacement: r('./test/mocks/firestore.js') },
    { find: /^\.\/drive\.js$/, replacement: r('./test/mocks/drive.js') },
    { find: 'virtual:pwa-register', replacement: r('./test/mocks/pwa.js') },
  ] },
});
