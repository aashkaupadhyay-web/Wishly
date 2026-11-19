/** Client-safe: share tokens are 32 random bytes, base64url (43 chars). */
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
