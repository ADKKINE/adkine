# ADKINE — Setup

All free. Do these once, then you never touch anything but the admin panel.

---

## 1. GitHub — put the site online
1. Go to github.com → **New repository** → name it `adkine` → **Private** is fine → Create.
2. Upload every file from this folder (drag the whole folder into the upload box).

## 2. Cloudflare Pages — hosting
1. dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick the `adkine` repo.
3. Build command: **leave empty**. Output directory: **leave empty** (or `/`).
4. Deploy. You get `adkine.pages.dev` — the site is live.

## 3. Login for the admin panel
1. Open https://github.com/sveltia/sveltia-cms-auth → click the **Deploy to Cloudflare** button → deploy.
2. Copy the worker URL it gives you (looks like `https://sveltia-cms-auth.xxxx.workers.dev`).
3. GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App.
   - Homepage URL: your `pages.dev` address
   - Callback URL: `<worker URL>/callback`
   - Create → copy the **Client ID**, then **Generate a client secret** and copy that too.
4. Back in Cloudflare → your worker → Settings → **Variables** → add:
   - `GITHUB_CLIENT_ID` = the client ID
   - `GITHUB_CLIENT_SECRET` = the secret (mark as secret)

## 4. Point the admin at your repo
Open `admin/config.yml` and change the two marked lines:

```yaml
repo: YOUR-GITHUB-USERNAME/adkine
base_url: https://sveltia-cms-auth.xxxx.workers.dev
```

Save. Done.

---

## Using it

Go to **yoursite.pages.dev/admin** → Login with GitHub.

Everything on the site is editable there: text, colours, menu, projects, photos, services, stats, contact. Press **Save** — live in about 30 seconds.

**Photos:** upload straight in the admin.

**Videos:** upload to YouTube or Vimeo (free, real 4K), copy the **embed** URL, paste it into a project's *Video URL* field.
- YouTube embed looks like: `https://www.youtube.com/embed/VIDEO_ID`
- Vimeo embed looks like: `https://player.vimeo.com/video/VIDEO_ID`

**Custom domain** (optional, ~$10/yr): Cloudflare Pages → your project → Custom domains.
