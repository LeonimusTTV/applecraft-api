// Signs an Apple Music developer token (ES256 JWT) with the .p8 key.
// WebCrypto already returns the signature in the raw r||s format that JWT expects.

const b64url = (data: ArrayBuffer | Uint8Array | string): string => {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export async function importP8(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\\n/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

export async function signDeveloperToken(opts: {
  key: CryptoKey;
  teamId: string;
  keyId: string;
  ttlSeconds: number;
  origins?: string[];
}): Promise<{ token: string; expiresAt: number }> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + opts.ttlSeconds;
  const header = { alg: "ES256", kid: opts.keyId, typ: "JWT" };
  const payload: Record<string, unknown> = { iss: opts.teamId, iat, exp };
  if (opts.origins?.length) payload.origin = opts.origins;

  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    opts.key,
    new TextEncoder().encode(input),
  );
  return { token: `${input}.${b64url(sig)}`, expiresAt: exp };
}
