export const CLOUD_CONFIG = Object.freeze({
  firebase: Object.freeze({
    apiKey: 'AIzaSyApboX_fYn0CcROBXdAM6UHRzLEVE31Ns8',
    authDomain: 'sudoku-learning-studio.firebaseapp.com',
    projectId: 'sudoku-learning-studio',
    appId: '1:916529303476:web:6a4d7d86a12e0419372ce1'
  }),
  lineProviderId: 'oidc.line'
});

export function cloudConfigStatus(config = CLOUD_CONFIG) {
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missing = required.filter((key) => !String(config?.firebase?.[key] || '').trim());
  return { ready: missing.length === 0, missing };
}
