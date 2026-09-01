# ThatGuyPB — Streamer Page

Static streamer page built for **Cloudflare Pages** with a Pages Functions API proxy for Twitch.

## File structure

```
/
├── site.html                        ← the page (rename to index.html before deploying)
├── _headers                         ← Cloudflare security headers
├── _redirects                       ← Cloudflare redirects
└── functions/
    └── api/
        └── twitch/
            └── [[path]].js          ← Pages Function: Twitch API proxy
```

## Deploy to Cloudflare Pages

1. **Rename** `site.html` → `index.html`
2. **Push** the folder to a GitHub/GitLab repo
3. In the **Cloudflare Dashboard** → Pages → Create a project → Connect to Git
4. Build settings:
   - Build command: *(leave empty — no build step needed)*
   - Output directory: `/` (root)
5. **Environment variables** (Settings → Environment variables):
   | Variable | Value |
   |---|---|
   | `TWITCH_CLIENT_ID` | Your Twitch app client ID |
   | `TWITCH_CLIENT_SECRET` | Your Twitch app client secret |

## Getting Twitch credentials

1. Go to https://dev.twitch.tv/console
2. Register a new application
3. Set OAuth Redirect URL to `https://your-domain.pages.dev`
4. Copy the **Client ID** and generate a **Client Secret**

## Customising the page

- Open `site.html` (or `index.html`)
- Find `const CHANNEL_LOGIN = 'ThatGuyPB'` near the bottom — swap for your real username
- Update all `href="https://twitch.tv/ThatGuyPB"` links to your channel URL
- Replace placeholder sponsor names, Discord link, and social URLs

## Live-only sections

These elements are hidden when offline and shown automatically when the Twitch API reports a live stream:
- Red announcement bar at the top
- "LIVE NOW" banner below the hero
- Twitch embed player + chat
- "LIVE RIGHT NOW" CTA heading override
- Live chat feed section (below clips)

The page polls the stream status every 60 seconds so it updates automatically without a refresh.
