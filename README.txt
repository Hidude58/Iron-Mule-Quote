IRON MULE QUOTE V3

Upload these files to the ROOT of your GitHub repository, replacing the older files:
- index.html
- app.js
- manifest.webmanifest
- sw.js
- icon-192.png
- icon-512.png

No OpenAI key, Cloudflare Worker, paid AI API, or home computer is required.

Photo analysis uses a free on-device TensorFlow.js / COCO-SSD model loaded by the phone browser. The first analysis requires internet access to download the model. Estimates are approximate and are designed to produce a fair starting range, with onsite verification before loading.

CUSTOMER EXPORTS
- Share Estimate: uses the phone's share sheet when supported; otherwise downloads a text estimate.
- Customer Report: opens a professional report with job photos and estimate reasoning. Use Print / Save as PDF to create a PDF for the customer.
- Final Quote can also be shared after onsite confirmation.

IMPORTANT
After uploading a new version, an installed PWA may briefly show cached files. Close/reopen it or refresh the website. The service worker version is changed so the new app will replace the old cache.
