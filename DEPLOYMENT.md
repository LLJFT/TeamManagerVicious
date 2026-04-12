# Deployment Guide — The Vicious Esports Platform

## Replit Deployment (Recommended)

The app is pre-configured for Replit's Autoscale deployment:

1. Click **Deploy** in the Replit workspace
2. Choose **Autoscale**
3. The platform handles build, TLS, and health checks automatically
4. Build command: `npm run build`
5. Run command: `npm run start`

---

## Vercel + Neon (Free Tier) Deployment

### Step 1: Create a Free Neon PostgreSQL Database

1. Go to [neon.tech](https://neon.tech) and sign up (free tier available)
2. Create a new project (e.g., "vicious-esports")
3. Copy the connection string — it looks like:
   ```
   postgresql://user:password@ep-xxx.region.neon.tech/dbname?sslmode=require
   ```

### Step 2: Set Up Vercel Project

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) and import the GitHub repo
3. Set the **Framework Preset** to "Other"
4. Set **Build Command**: `npm run build`
5. Set **Output Directory**: `dist/public`
6. Set **Install Command**: `npm install`

### Step 3: Configure Environment Variables

Add these environment variables in Vercel's project settings:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Random string for session encryption (generate with `openssl rand -hex 32`) |
| `NODE_ENV` | Yes | Set to `production` |
| `TEAM_ID` | No | Fixed team ID (auto-generated if not set) |

### Step 4: Deploy

1. Click **Deploy** in Vercel
2. The first deploy will auto-run database migrations and create the default admin user
3. Default login: **Username:** `Admin` / **Password:** `admin`
4. Change the admin password immediately after first login

### Step 5: Verify

1. Visit your Vercel URL (e.g., `https://your-app.vercel.app`)
2. Log in with the default admin credentials
3. Navigate to a game to verify data loads correctly

---

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | (Replit auto-provides) | PostgreSQL connection string |
| `SESSION_SECRET` | `default-secret-change-me` | Session encryption key — **change in production** |
| `NODE_ENV` | `development` | Set to `production` for deployed apps |
| `TEAM_ID` | Auto-generated UUID | Org-level tenant ID |
| `PORT` | `5000` | Server port (Replit sets to 5000) |

---

## File Uploads

Uploaded files (logos, game icons, chat attachments) are stored on the local filesystem under `./uploads/`. On Vercel's serverless environment, these files are **ephemeral** — they will be lost on redeployment.

For persistent file storage in production:
- Use Replit's Object Storage (pre-configured)
- Or configure an S3-compatible bucket and update the upload routes

---

## Database Migrations

All migrations run automatically on server startup via `runMigrations()` in `server/auth.ts`. They use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` patterns, making them safe to run repeatedly. No manual migration steps are needed.

---

## Fresh Remix / Clone Behavior

When someone remixes or clones this project:
1. Upload directories are auto-created on first startup
2. Database migrations run automatically
3. A default admin user is created (if no users exist)
4. Default rosters (First Team, Academy, Women) are created per game on first access
5. Per-roster defaults are seeded: availability slots, roles, event categories, staff, chat channels
