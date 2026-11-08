import { test, expect } from "bun:test";
import { generateKeyPairSync } from "node:crypto";
import { importP8, signDeveloperToken } from "./jwt";

test("produces a valid ES256 JWT with the expected claims", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  const key = await importP8(pem);
  const { token, expiresAt } = await signDeveloperToken({
    key, teamId: "TEAM123456", keyId: "KEY1234567", ttlSeconds: 3600,
    origins: ["http://localhost:7531"],
  });

  const [h, p, s] = token.split(".");
  const header = JSON.parse(Buffer.from(h, "base64url").toString());
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  expect(header).toEqual({ alg: "ES256", kid: "KEY1234567", typ: "JWT" });
  expect(payload.iss).toBe("TEAM123456");
  expect(payload.exp).toBe(expiresAt);
  expect(payload.exp - payload.iat).toBe(3600);
  expect(payload.origin).toEqual(["http://localhost:7531"]);

  const pub = await crypto.subtle.importKey(
    "spki", publicKey.export({ type: "spki", format: "der" }),
    { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" }, pub,
    Buffer.from(s, "base64url"), new TextEncoder().encode(`${h}.${p}`));
  expect(ok).toBe(true);
});

test("accepts a .p8 key pasted with literal \\n", async () => {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString().replace(/\n/g, "\\n");
  await importP8(pem);
});
