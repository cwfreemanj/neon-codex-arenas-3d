# Neon Codex Arenas 3D — backend

```
backend/
  server/   Railway co-op relay (Node + ws)  -> goes in your GitHub repo, deploys to Railway
  wix/      Wix Velo code for Star Shop payments -> see wix/README.md
```

## 1. Deploy the co-op server on Railway

1. Copy the **contents of `server/`** (`index.js`, `package.json`, `.gitignore`) into your GitHub repository
   (a folder like `/server` or the repo root — your choice).
2. Railway -> **New Project -> Deploy from GitHub repo** -> pick the repo.
   If the files are in a sub-folder, open the service **Settings -> Root Directory** and set it (e.g. `/server`).
3. Railway detects Node and runs `npm start`. No variables are required.
   Optional: `ORIGINS` = comma separated allow-list, e.g. `https://yourname.github.io,https://www.yoursite.com`
   (leave empty while testing).
4. **Settings -> Networking -> Generate Domain.** You get `something.up.railway.app`.
5. Open that URL in a browser — you should see a small JSON status (`ok: true`, rooms, players).
6. In the game file find `const COOP_DEFAULT_URL='wss://YOUR-RAILWAY-APP.up.railway.app'` and put your domain in
   (keep `wss://`, no trailing slash). Re-upload the game to GitHub Pages.
   Quick test without editing: add `?coop=wss://your-app.up.railway.app` to the game URL, or use
   *Co-op -> Server address* inside the game.

## How co-op works
* Host creates a room -> gets a 4-letter code. Friends use **Join code**. Anyone can use **Quick match**
  (public rooms; auto-starts when full or ~15 s after the second player joins; late join allowed).
* The host can press **Start** at any time. Max 4 players.
* The host's browser runs the enemies and waves; everyone else mirrors them and sends their hits to the host.
  The server only relays messages (cheap, ~1 small instance handles hundreds of players).
* Enemy count and health scale with the number of players. Downed players are revived at the next wave.
* If the host leaves mid-match the room closes.

## Limits worth knowing
* Pausing (Esc) as host freezes the enemies for everyone until you resume.
* Skins are not synced — teammates appear in each character's default look.
