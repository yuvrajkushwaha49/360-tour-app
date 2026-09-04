/**
 * Share Security & Tamper-Proof Cryptographic Verification Utility
 * Protects share links with SHA-256 HMAC-style signatures to prevent
 * unauthorized tampering of expiration timestamps (exp parameter).
 */

const SHARE_SECURITY_SALT = 'kalaakchar_virtual_360_secure_salt_2026';
const MAX_SHARE_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // Max allowable share duration: 30 days

// Fast, zero-dependency, deterministic SHA-256 implementation
function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  let i = 0, j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  words[(asciiBitLength >> 5)] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < ascii.length; i++) {
    const charCode = ascii.charCodeAt(i);
    words[i >> 2] |= charCode << ((3 - (i % 4)) * 8);
  }

  for (i = 0; i < words.length; i += 16) {
    const w = words.slice(i, i + 16);
    for (j = 0; j < 16; j++) {
      if (!w[j]) w[j] = 0;
    }
    for (j = 16; j < 64; j++) {
      const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + (w[j - 7] || 0) + s1) | 0;
    }

    let a = hash[0], b = hash[1], c = hash[2], d = hash[3];
    let e = hash[4], f = hash[5], g = hash[6], h = hash[7];

    for (j = 0; j < 64; j++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h + S1 + ch + k[j] + (w[j] || 0)) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  for (i = 0; i < 8; i++) {
    result += ('00000000' + (hash[i] >>> 0).toString(16)).slice(-8);
  }
  return result;
}

/**
 * Generates a tamper-proof 16-character cryptographic signature
 * bound to a specific tourId, expiration timestamp, and server salt.
 */
export function generateShareSignature(tourId: string, exp: number | string): string {
  const payload = `${tourId}:${exp}:${SHARE_SECURITY_SALT}`;
  return sha256(payload).slice(0, 16);
}

/**
 * Constructs a fully signed share URL.
 */
export function createShareUrl(tourId: string, minutes: number, customBaseUrl?: string): string {
  const base = customBaseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');
  if (minutes <= 0) {
    return `${base}/?tourId=${encodeURIComponent(tourId)}`;
  }
  const expiresAt = Date.now() + minutes * 60 * 1000;
  const sig = generateShareSignature(tourId, expiresAt);
  return `${base}/?tourId=${encodeURIComponent(tourId)}&exp=${expiresAt}&sig=${sig}`;
}

export interface ShareVerificationResult {
  isExpiring: boolean;
  isValid: boolean;
  isExpired: boolean;
  remainingSeconds: number | null;
  reason?: string;
}

/**
 * Verifies the validity and expiration of a shared tour URL parameters.
 * If someone modifies even 1 digit of exp (like appending 0), the signature check fails immediately.
 */
export function verifyShareParams(
  tourId: string,
  exp: string | null,
  sig: string | null
): ShareVerificationResult {
  if (!exp) {
    return {
      isExpiring: false,
      isValid: true,
      isExpired: false,
      remainingSeconds: null
    };
  }

  const cleanExp = exp.trim();
  const cleanSig = (sig || '').trim().toLowerCase();

  // 1. Signature must be present
  if (!cleanSig) {
    return {
      isExpiring: true,
      isValid: false,
      isExpired: true,
      remainingSeconds: 0,
      reason: 'MISSING_SIGNATURE'
    };
  }

  // 2. Validate cryptographic signature
  const expectedSig = generateShareSignature(tourId, cleanExp).toLowerCase();
  if (cleanSig !== expectedSig) {
    return {
      isExpiring: true,
      isValid: false,
      isExpired: true,
      remainingSeconds: 0,
      reason: 'TAMPERED_SIGNATURE'
    };
  }

  // 3. Validate timestamp format and positive number
  const expTimestamp = Number(cleanExp);
  if (isNaN(expTimestamp) || !isFinite(expTimestamp) || expTimestamp <= 0) {
    return {
      isExpiring: true,
      isValid: false,
      isExpired: true,
      remainingSeconds: 0,
      reason: 'INVALID_EXPIRATION_TIMESTAMP'
    };
  }

  const now = Date.now();

  // 4. Check if expired
  if (now >= expTimestamp) {
    return {
      isExpiring: true,
      isValid: true,
      isExpired: true,
      remainingSeconds: 0,
      reason: 'LINK_EXPIRED'
    };
  }

  // 5. Enforce upper bound on expiration duration to prevent anomalies
  if (expTimestamp - now > MAX_SHARE_DURATION_MS) {
    return {
      isExpiring: true,
      isValid: false,
      isExpired: true,
      remainingSeconds: 0,
      reason: 'EXCEEDS_MAX_DURATION'
    };
  }

  const remainingSeconds = Math.max(0, Math.floor((expTimestamp - now) / 1000));
  return {
    isExpiring: true,
    isValid: true,
    isExpired: false,
    remainingSeconds
  };
}
