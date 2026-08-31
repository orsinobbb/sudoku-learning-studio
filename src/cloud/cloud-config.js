export const CLOUD_CONFIG = Object.freeze({
  firebase: Object.freeze({
    apiKey: '',
    authDomain: '',
    projectId: '',
    appId: ''
  }),
  lineProviderId: 'oidc.line'
});

export function cloudConfigStatus(config = CLOUD_CONFIG) {
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missing = required.filter((key) => !String(config?.firebase?.[key] || '').trim());
  return { ready: missing.length === 0, missing };
}
