# Free-tier production deployment

This deployment is separate from the local Docker Compose, Kubernetes, and Helm
configuration. The root [`render.yaml`](./render.yaml) blueprint creates one
Render service:

- `crewrescue-api`: Node.js web service running the Express API and WebSocket server

## Render checklist

1. Create a MongoDB Atlas database and copy its application connection string.
   In the Render dashboard, set `MONGO_URI` on the API service. Allow Render
   traffic in the Atlas network access rules (for a quick free-tier deployment,
   `0.0.0.0/0` with database-user authentication; restrict this later if
   possible).
2. Create a Redis Cloud database and copy its connection URL. Set `REDIS_URL`
   on the API service. Prefer the TLS `rediss://...` URL when Redis Cloud
   provides one.
3. Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to two different,
   high-entropy values. The blueprint generates these for the API.
4. Set `CORS_ORIGINS` on the API to the exact Vercel origin, for example
   `https://crewrescue.vercel.app`. Separate multiple origins with commas and
   do not add a trailing slash.
5. Set `GEMINI_API_KEY` if AI features are enabled. Keep all secrets as
   Render environment variables and never commit them.
6. Deploy the blueprint from the repository root. Confirm the API responds at
   `https://<render-api-host>/health` before deploying the frontend.

The API uses Render's assigned `PORT` automatically. Do not hard-code a
production port in the blueprint.

Render's free plan does not provide a background-worker service. The API
deployment therefore does not start `backend/api/src/workers/optimizationWorker.js`;
BullMQ optimization jobs require a separately hosted worker or a paid Render
worker service. Do not run the worker as a second long-lived process inside the
web service, because that can interfere with HTTP health checks and graceful
scaling.

## Vercel frontend settings

Create a separate Vercel project for the `frontend/web` app:

1. Import the same repository and set **Root Directory** to `frontend/web`.
2. Select the Vite framework preset. Use the default install command, set the
   build command to `npm run build`, and set the output directory to `dist`.
3. Add the Vercel environment variable
   `VITE_API_URL=https://<render-api-host>/api` for the Production
   environment. Keep `/api` in the value and omit a trailing slash.
4. Deploy or redeploy the frontend, then replace the placeholder in Render's
   API `CORS_ORIGINS` with the final Vercel production URL.
5. If Vercel creates preview deployments that should call the API, add their
   exact preview origin(s) as comma-separated CORS origins or use a separate
   preview environment value.

The frontend reads `VITE_API_URL` at build time, so a Vercel redeploy is
required after changing it.
