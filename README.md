# AppleCraft API

Cloudflare Worker that signs Apple Music **developer tokens** for the [AppleCraft mod](https://github.com/LeonimusTTV).

The MusicKit private key (`.p8`) must never ship inside the mod: anyone could extract it from the jar. Instead, it lives here as a Worker secret, and the player page served by the mod asks this Worker for a short-lived token (JWT, ES256).

```
GET /token   → { "token": "<JWT>", "expiresAt": <unix seconds> }
GET /health  → { "ok": true }
```

```
src/index.ts      Worker: CORS, caching, /token
src/jwt.ts        ES256 signing with WebCrypto (no dependencies)
src/jwt.test.ts   signature tests with a throwaway key
```

## 1. Get a MusicKit key from Apple

1. developer.apple.com → Certificates, IDs & Profiles → **Identifiers** → `+` → **Media IDs** → create one (e.g. `media.dev.leonimus.applecraft`) with MusicKit enabled.
2. **Keys** → `+` → name it "AppleCraft" → enable **Media Services (MusicKit…)** → configure it with your Media ID → download `AuthKey_XXXXXXXXXX.p8`. **Apple only lets you download it once.**
3. Write down the **Key ID** (the 10 characters in the file name) and your **Team ID** (top right of the portal, or under Membership).

## 2. Run locally

```bash
npm i
bun test                       # checks JWT signing with a throwaway key

# .dev.vars (never committed, see .gitignore)
cat > .dev.vars <<VARS
APPLE_PRIVATE_KEY="$(awk '{printf "%s\\n", $0}' AuthKey_XXXXXXXXXX.p8)"
APPLE_TEAM_ID="YOURTEAMID"
APPLE_KEY_ID="XXXXXXXXXX"
VARS

npm run dev                    # → http://localhost:8787/token
```

By default the mod uses `http://localhost:8787` (`workerUrl` in `config/applecraft.json`), so this is all you need for development.

## 3. Deploy

```bash
npx wrangler secret put APPLE_PRIVATE_KEY < AuthKey_XXXXXXXXXX.p8
npx wrangler secret put APPLE_TEAM_ID
npx wrangler secret put APPLE_KEY_ID
npm run deploy
```

Then set the deployed URL as the default `workerUrl` in the mod (`BridgeConfig.java`) before publishing it.

## Configuration (`wrangler.toml`)

| Variable | Default | |
|---|---|---|
| `TOKEN_TTL_SECONDS` | `86400` | Token lifetime (24 h). |
| `ALLOWED_ORIGINS` | `http://localhost:7531`, `127.0.0.1:7531`, `localhost:7532`, `localhost:7533` | Origins allowed to call `/token` (CORS). Also written into the JWT `origin` claim. 7532/7533 are the mod's fallback ports. |

## Notes

- Tokens are short-lived and carry an `origin` claim limited to the mod's local player page, so a leaked token is of little use on another website.
- The Worker caches the signed token per isolate and only re-signs when less than an hour is left.
- `/token` is public. If it ever gets abused, add Cloudflare rate limiting in front of it.
- Never commit the `.p8` key or `.dev.vars` (both are in `.gitignore`). Once the key is stored with `wrangler secret put`, keep it somewhere safe outside the project.

## License

[PolyForm Noncommercial 1.0.0](LICENSE). In short:

- ✅ Use it, modify it, share it, for any **noncommercial** purpose.
- ❌ No commercial use (selling it, putting it behind a paywall, using it in a paid product or service…) **without asking first**. Open an issue or contact [LeonimusTTV](https://github.com/LeonimusTTV) and we'll talk about it.
- When you share it (modified or not), keep the `LICENSE` file, including its `Required Notice:` line.

This summary is not legal advice; the [LICENSE](LICENSE) text is what applies.
