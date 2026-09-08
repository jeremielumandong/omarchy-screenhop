// Authentication transactions belong to one preview: OAuth state, one-time codes,
// and challenge tokens must never be replayed into another browser context.
export function isAuthUrl(value) {
  let url;
  try { url = new URL(value); } catch { return true; }
  if (!['http:', 'https:'].includes(url.protocol)) return true;
  if (/(?:^|\.)(?:accounts\.google\.com|login\.microsoftonline\.com|login\.live\.com|auth0\.com|okta\.com|oktapreview\.com)$/.test(url.hostname)) return true;
  const path = decodeURIComponentSafe(url.pathname).toLowerCase();
  if (/(?:^|\/)(?:oauth2?|oidc|connect|authorize|authorization|token|auth|authenticate|authentication|login|log-in|signin|sign-in|signout|sign-out|logout|log-out|sso|callback|callback-oidc|signin-oidc|signout-callback-oidc|account|accounts|identity|identityserver|challenge|mfa|otp|verify|verification|recover|recovery|reset-password)(?:[/._-]|$)/i.test(path)) return true;
  if (/\/cdn-cgi\//i.test(path) || /(?:^|\.)(?:challenges\.cloudflare\.com)$/i.test(url.hostname)) return true;
  const sensitive = /^(?:code|state|redirect_uri|response_type|response_mode|nonce|client_id|code_challenge|code_verifier|id_token|access_token|session_state|oauth_token|oauth_verifier|samlrequest|samlresponse|relaystate|returnurl|return_url|__cf.*|cf_chl.*)$/i;
  const fragment = new URLSearchParams(url.hash.slice(1).replace(/^.*?\?/, ''));
  return [...url.searchParams.keys(), ...fragment.keys()].some(key => sensitive.test(key));
}

function decodeURIComponentSafe(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

export function canSyncNavigation(sourcePreviousUrl, nextUrl) {
  if (isAuthUrl(sourcePreviousUrl) || isAuthUrl(nextUrl)) return false;
  try { return new URL(sourcePreviousUrl).origin === new URL(nextUrl).origin; }
  catch { return false; }
}
