const ANTHROPIC_AUTH_URL = 'https://console.anthropic.com/oauth/authorize';
const ANTHROPIC_TOKEN_URL = 'https://console.anthropic.com/oauth/token';
const STORAGE_KEY = 'anthropic_auth';

export async function getAuthToken() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const auth = data[STORAGE_KEY];

  if (!auth) return null;

  if (auth.type === 'api_key') {
    return auth.key;
  }

  if (auth.type === 'oauth') {
    if (Date.now() < auth.expires) {
      return auth.access;
    }
    const refreshed = await refreshOAuthToken(auth.refresh);
    if (refreshed) {
      return refreshed.access;
    }
    return null;
  }

  return null;
}

export async function isAuthenticated() {
  const token = await getAuthToken();
  return !!token;
}

export async function saveApiKey(apiKey) {
  const isValid = await validateApiKey(apiKey);
  if (!isValid) {
    throw new Error('Invalid API key');
  }

  await chrome.storage.local.set({
    [STORAGE_KEY]: {
      type: 'api_key',
      key: apiKey
    }
  });

  return true;
}

export async function validateApiKey(apiKey) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20250929',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      })
    });

    return response.ok || response.status === 400;
  } catch {
    return false;
  }
}

export async function logout() {
  await chrome.storage.local.remove(STORAGE_KEY);
}

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

function base64UrlEncode(buffer) {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function initiateOAuth() {
  const redirectUrl = chrome.identity.getRedirectURL('callback');
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  await chrome.storage.session.set({ oauth_verifier: codeVerifier });

  const authUrl = new URL(ANTHROPIC_AUTH_URL);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUrl);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('scope', 'user:profile');

  try {
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    });

    const url = new URL(responseUrl);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }

    if (!code) {
      throw new Error('No authorization code received');
    }

    const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUrl);
    return tokens;
  } catch (error) {
    console.error('OAuth failed:', error);
    throw error;
  }
}

async function exchangeCodeForTokens(code, codeVerifier, redirectUri) {
  const response = await fetch(ANTHROPIC_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokens = await response.json();

  await chrome.storage.local.set({
    [STORAGE_KEY]: {
      type: 'oauth',
      access: tokens.access_token,
      refresh: tokens.refresh_token,
      expires: Date.now() + (tokens.expires_in * 1000)
    }
  });

  return tokens;
}

async function refreshOAuthToken(refreshToken) {
  try {
    const response = await fetch(ANTHROPIC_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      await logout();
      return null;
    }

    const tokens = await response.json();

    await chrome.storage.local.set({
      [STORAGE_KEY]: {
        type: 'oauth',
        access: tokens.access_token,
        refresh: tokens.refresh_token || refreshToken,
        expires: Date.now() + (tokens.expires_in * 1000)
      }
    });

    return tokens;
  } catch {
    await logout();
    return null;
  }
}
