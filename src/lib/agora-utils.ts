// Base URL for Agora token server (can be configured via environment)
const BASE_URL = process.env.NEXT_PUBLIC_AGORA_TOKEN_SERVER_URL || 'https://webdemo-for-agora-io.agora.io';

interface TokenConfig {
  uid: string | number;
  channel: string;
  appid?: string;
  certificate?: string;
}

interface TokenResponseData {
  token?: string;
  appid?: string;
}

interface TokenResponse {
  code: number;
  data?: TokenResponseData;
  message?: string;
}

// Generate UUID for tracing
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Get options from localStorage or environment
function getOptionsFromLocal() {
  if (typeof window === 'undefined') {
    return {
      appid: process.env.NEXT_PUBLIC_AGORA_APP_ID || '',
      certificate: process.env.NEXT_PUBLIC_AGORA_APP_CERTIFICATE || ''
    };
  }

  return {
    appid: localStorage.getItem('agora_app_id') || process.env.NEXT_PUBLIC_AGORA_APP_ID || '',
    certificate: localStorage.getItem('agora_app_certificate') || process.env.NEXT_PUBLIC_AGORA_APP_CERTIFICATE || ''
  };
}

// Get encrypted credentials from URL (for demo server)
function getEncryptFromUrl() {
  if (typeof window === 'undefined') {
    return { encryptedId: null, encryptedSecret: null };
  }

  const urlParams = new URLSearchParams(window.location.search);
  return {
    encryptedId: urlParams.get('encryptedId'),
    encryptedSecret: urlParams.get('encryptedSecret')
  };
}

/**
 * Get Agora app data and token
 * Supports both encrypted demo server and direct app certificate usage
 */
export async function agoraGetAppData(config: TokenConfig): Promise<string | null> {
  const { uid, channel } = config;
  const { appid, certificate } = getOptionsFromLocal();
  const res = getEncryptFromUrl();
  const encryptedId = res.encryptedId;
  const encryptedSecret = res.encryptedSecret;
  let data: Record<string, unknown> = {};
  let url = "";

  // Use encrypted demo server if credentials are in URL
  if (encryptedId && encryptedSecret) {
    url = `${BASE_URL}/v1/webdemo/encrypted/token`;
    data = {
      channelName: channel,
      encryptedId,
      encryptedSecret,
      traceId: generateUUID(),
      src: "webdemo",
    };
  } else {
    // Use direct app certificate
    if (!certificate) {
      console.warn('No app certificate available for token generation');
      return null;
    }

    url = `${BASE_URL}/v2/token/generate`;
    data = {
      appId: appid,
      appCertificate: certificate,
      channelName: channel,
      expire: 7200,
      src: "web",
      types: [1, 2], // RTC and RTM
      uid: uid,
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const resp: TokenResponse = await response.json();

    if (resp.code !== 0) {
      const msg = resp.message || "Generate token error, please check your appid and appcertificate parameters";
      console.error(msg);
      throw new Error(msg);
    }

    const respData: TokenResponseData = resp.data || {};

    // Update appid in config if provided by server
    if (respData.appid && config.appid !== respData.appid) {
      config.appid = respData.appid;
    }

    return respData.token || null;
  } catch (error) {
    console.error('Failed to generate token:', error);
    throw error;
  }
}

/**
 * Generate token using backend API endpoint
 */
export async function generateTokenFromBackend(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: string | number = 0,
  role: 'publisher' | 'audience' = 'audience',
  expireTimeInSeconds: number = 3600
): Promise<string> {
  try {
    const response = await fetch('/api/agora/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appId,
        appCertificate,
        channelName,
        uid,
        role,
        expireTimeInSeconds
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Backend token generation failed:', error);
    throw error;
  }
}

/**
 * Generate token using server with frontend-provided credentials
 */
export async function generateTokenFromServer(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: string | number = 0,
  role: 'publisher' | 'audience' = 'audience'
): Promise<string> {
  try {
    const params = new URLSearchParams({
      appId,
      appCertificate,
      channel: channelName,
      uid: uid.toString(),
      role
    });

    const response = await fetch(`/api/agora/token?${params}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(data.message || 'Token generation failed');
    }

    return data.data.token;
  } catch (error) {
    console.error('Server token generation failed:', error);
    throw error;
  }
}

/**
 * Validate token format
 */
export function validateAgoraToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // Agora tokens start with version identifier (006 or 007)
  const versionPattern = /^00[67]/;
  if (!versionPattern.test(token)) {
    return false;
  }

  // Basic length check (tokens are typically much longer)
  return token.length > 50;
}

/**
 * Save Agora credentials to localStorage
 */
export function saveAgoraCredentials(appId: string, appCertificate?: string): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem('agora_app_id', appId);
  if (appCertificate) {
    localStorage.setItem('agora_app_certificate', appCertificate);
  }
}

/**
 * Load Agora credentials from localStorage
 */
export function loadAgoraCredentials(): { appId: string; appCertificate: string } {
  const { appid, certificate } = getOptionsFromLocal();
  return {
    appId: appid,
    appCertificate: certificate
  };
}