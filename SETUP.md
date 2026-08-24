# Iron Mule Quote v2 Setup

## 1. Update GitHub Pages
Replace the files in the root of your `Iron-Mule-Quote` repository with:
- `index.html`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- `icon-192.png`
- `icon-512.png`

Do NOT publish the `worker` folder as your API key backend. It is source code for the separate secure Worker.

## 2. Create the secure AI backend with Cloudflare Workers
GitHub Pages is static, so an OpenAI API key must never be stored in `app.js`, `index.html`, a GitHub Secret that is copied into frontend JavaScript, or any public repository file.

1. Create/login to a Cloudflare account.
2. Go to **Workers & Pages** and create a Worker named `iron-mule-ai`.
3. Paste the contents of `worker/worker.js` into the Worker editor and deploy.
4. In Worker **Settings > Variables and Secrets**, add a SECRET named `OPENAI_API_KEY` containing your OpenAI API key.
5. Add a normal variable named `ALLOWED_ORIGIN` with value:
   `https://hidude58.github.io`
6. Deploy again.
7. Copy the Worker URL, for example:
   `https://iron-mule-ai.YOUR-SUBDOMAIN.workers.dev`
8. Open Iron Mule Quote > **Settings** > paste that URL into **AI Worker URL**.

The app sends compressed photos to your Worker. The Worker calls the OpenAI Responses API using `gpt-5.6-luna`, then returns only the estimate JSON. Your API key stays server-side.

## 3. Test
1. Open the app on your phone.
2. Upload/take 1–5 junk photos.
3. Tap **Analyze Photos with AI**.
4. Confirm that load %, estimated weight range, labor difficulty, detected items, labor time, and special-fee suggestion populate.
5. Review mileage and dump fee, then save the quote.
6. Open the **Jobs** tab to see the saved quote.

## Notes
- Job history is currently stored only in that browser/device with localStorage.
- Photos themselves are not stored in history.
- AI image estimates are advisory; dense material and disposal-sensitive items should be manually verified.
