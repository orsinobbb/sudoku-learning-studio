import { CLOUD_CONFIG, cloudConfigStatus } from './cloud-config.js';
import { mergeProgress } from '../learning/storage.js';

const FIREBASE_VERSION = '12.18.0';
const sdk = (name) => `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-${name}.js`;

export async function createCloudAccount({
  config = CLOUD_CONFIG,
  readLocalProgress,
  writeLocalProgress,
  onMerged = () => {},
  onStatus = () => {}
} = {}) {
  const availability = cloudConfigStatus(config);
  if (!availability.ready) {
    const status = { available: false, phase: 'guest', user: null, message: '雲端登入尚未完成站方設定；訪客模式可完整使用。' };
    onStatus(status);
    return {
      ...status,
      signIn: async () => { throw new Error(status.message); },
      signOut: async () => {},
      deleteAccount: async () => {},
      syncNow: async () => false,
      queueSync: () => {}
    };
  }

  onStatus({ available: true, phase: 'loading', user: null, message: '正在連接安全登入服務…' });
  try {
    const [{ initializeApp }, authSdk, storeSdk] = await Promise.all([
      import(sdk('app')),
      import(sdk('auth')),
      import(sdk('firestore'))
    ]);
    const app = initializeApp(config.firebase);
    const auth = authSdk.getAuth(app);
    const database = storeSdk.getFirestore(app);
    await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
    let activeUser = null;
    let syncTimer = null;

    const progressRef = (uid) => storeSdk.doc(database, 'users', uid, 'private', 'progress');
    const publicUser = (user) => user ? {
      uid: user.uid,
      displayName: user.displayName || '',
      email: user.email || '',
      photoURL: user.photoURL || '',
      providerId: user.providerData?.[0]?.providerId || ''
    } : null;

    async function syncNow(progress = readLocalProgress()) {
      if (!activeUser) return false;
      const reference = progressRef(activeUser.uid);
      const snapshot = await storeSdk.getDoc(reference);
      const merged = mergeProgress(progress, snapshot.exists() ? snapshot.data().progress : {});
      writeLocalProgress(merged);
      await storeSdk.setDoc(reference, {
        schemaVersion: 8,
        progress: merged,
        updatedAt: storeSdk.serverTimestamp()
      }, { merge: true });
      onMerged(merged);
      onStatus({ available: true, phase: 'signed-in', user: publicUser(activeUser), message: '進度已安全同步。', lastSyncedAt: new Date().toISOString() });
      return true;
    }

    function queueSync(progress) {
      if (!activeUser) return;
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => syncNow(progress).catch((error) => {
        onStatus({ available: true, phase: 'error', user: publicUser(activeUser), message: `同步失敗：${error.message}` });
      }), 900);
    }

    authSdk.onAuthStateChanged(auth, async (user) => {
      activeUser = user;
      if (!user) {
        onStatus({ available: true, phase: 'guest', user: null, message: '目前以訪客模式使用；資料只保存在這個裝置。' });
        return;
      }
      onStatus({ available: true, phase: 'syncing', user: publicUser(user), message: '正在合併本機與雲端進度…' });
      try { await syncNow(); }
      catch (error) { onStatus({ available: true, phase: 'error', user: publicUser(user), message: `登入成功，但同步失敗：${error.message}` }); }
    });

    async function signIn(providerName) {
      const provider = providerName === 'google'
        ? new authSdk.GoogleAuthProvider()
        : new authSdk.OAuthProvider(config.lineProviderId || 'oidc.line');
      if (providerName === 'google') provider.setCustomParameters({ prompt: 'select_account' });
      else {
        provider.addScope('openid');
        provider.addScope('profile');
        provider.setCustomParameters({ prompt: 'consent' });
      }
      await authSdk.signInWithPopup(auth, provider);
    }

    async function deleteAccount() {
      if (!activeUser) return;
      const user = activeUser;
      await storeSdk.deleteDoc(progressRef(user.uid));
      await authSdk.deleteUser(user);
    }

    return {
      available: true,
      signIn,
      signOut: () => authSdk.signOut(auth),
      deleteAccount,
      syncNow,
      queueSync
    };
  } catch (error) {
    const status = { available: false, phase: 'error', user: null, message: `雲端服務載入失敗：${error.message}` };
    onStatus(status);
    return { ...status, signIn: async () => { throw error; }, signOut: async () => {}, deleteAccount: async () => {}, syncNow: async () => false, queueSync: () => {} };
  }
}
