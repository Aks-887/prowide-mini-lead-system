# Quick Start Guide

## Local Development (Windows/Mac/Linux)

### 1. Prerequisites
- Node.js 18+ (https://nodejs.org)
- PostgreSQL 12+ (https://www.postgresql.org/download)

### 2. Install Dependencies
```bash
cd g:\BookMyPacker  # or your project directory
npm install
```

### 3. Setup PostgreSQL Database

**On Windows (PowerShell):**
```powershell
# Using PostgreSQL command line
psql -U postgres
CREATE DATABASE prowider_db;
\q
```

**On Mac/Linux:**
```bash
createdb prowider_db
```

### 4. Configure Environment
Create `.env.local` file in project root:

```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/prowider_db"
NEXT_PUBLIC_API_URL="http://localhost:3000"
NEXT_PUBLIC_WS_URL="ws://localhost:3000"
NODE_ENV="development"
```

Replace `your_password` with your PostgreSQL password.

### 5. Initialize Database
```bash
# Create tables and run migrations
npx prisma migrate dev --name init

# Seed with initial data (services and providers)
npx prisma db seed
```

### 6. Start Development Server
```bash
npm run dev
```

Server will start at: **http://localhost:3000**

### 7. Verify Setup
- Open http://localhost:3000 in your browser
- Should see: "Welcome to Prowider"
- Check Database: 
  ```bash
  npx prisma studio  # Opens Prisma Studio to inspect database
  ```

---

## Deployment to Production

### Option 1: Deploy to Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to https://vercel.com
   - Click "New Project"
   - Import your GitHub repository
   - Configure settings:
     - Framework: Next.js
     - Root Directory: ./

3. **Set Environment Variables**
   In Vercel Project Settings → Environment Variables:
   ```
   DATABASE_URL: postgresql://username:password@host:port/database
   NEXT_PUBLIC_API_URL: https://your-app-name.vercel.app
   NEXT_PUBLIC_WS_URL: wss://your-app-name.vercel.app
   NODE_ENV: production
   ```

4. **Create PostgreSQL Database**
   - Sign up for PostgreSQL at:
     - https://railway.app (Recommended - Free tier available)
     - https://www.heroku.com
     - https://www.elephantsql.com
   
   Get the connection string and set as `DATABASE_URL`

5. **Deploy**
   - Vercel auto-deploys on push to main
   - View live URL: `https://your-app-name.vercel.app`

### Option 2: Deploy to Railway (Full Stack)

1. **Create Railway Account**
   - Go to https://railway.app
   - Sign in with GitHub

2. **Create Database**
   - Click "New Project"
   - Add PostgreSQL
   - Copy DATABASE_URL

3. **Deploy Application**
   - Connect your GitHub repo
   - Set environment variables (same as above)
   - Railway auto-deploys from main branch

4. **Live URL**
   - View deployment at: `https://<project>.up.railway.app`

### Option 3: Deploy to Docker

1. **Create Dockerfile**
   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   RUN npm run build
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Build and Run**
   ```bash
   docker build -t prowider-lead-system .
   docker run -p 3000:3000 --env-file .env.local prowider-lead-system
   ```

---

## Environment Variables Explained

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `NEXT_PUBLIC_API_URL` | Frontend API URL (public) | `https://yourdomain.com` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL (public) | `wss://yourdomain.com` |
| `NODE_ENV` | Environment | `production` or `development` |

---

## Troubleshooting

### 1. "Cannot find module '@prisma/client'"
```bash
npm install @prisma/client
npx prisma generate
```

### 2. "Database connection failed"
- Check `DATABASE_URL` is correct
- Verify PostgreSQL is running
- Test connection: `psql "your-connection-string"`

### 3. "WebSocket not connecting"
- Ensure NEXT_PUBLIC_WS_URL is set correctly
- Check if WebSocket is supported by your hosting provider
- Try polling fallback (should work automatically)

### 4. "Build fails in Vercel"
- Check build logs in Vercel dashboard
- Ensure all environment variables are set
- Run `npm run build` locally to test

---

## Development Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (with hot reload) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx prisma studio` | Open Prisma database GUI |
| `npx prisma migrate dev` | Create new migration |
| `npx prisma db seed` | Run seed script |

---

## Database Monitoring

### View Database in Prisma Studio
```bash
npx prisma studio
# Opens at http://localhost:5555
```

### Query Database Directly
```bash
psql "postgresql://user:password@localhost:5432/prowider_db"

# Useful commands:
\dt                          # List all tables
SELECT * FROM "Provider";    # View providers
SELECT * FROM "Lead";        # View leads
SELECT * FROM "LeadAssignment"; # View assignments
```

---

## Monitoring & Logs

### Local Development
- Server logs appear in terminal
- Check browser console for frontend errors (F12)

### Production (Vercel)
- View logs: Project → Deployments → Logs
- Real-time logs: Project → Settings → Environment

### Production (Railway)
- View logs: Project → Deployments
- Real-time logs in project dashboard

---

## Performance Tips

1. **Database Indexes**: Already optimized in schema
2. **Caching**: Implement on `/api/providers` if needed
3. **WebSocket**: Falls back to polling automatically
4. **Load Testing**: Use `/test-tools` to simulate load

---

## Security

- [ ] Set strong PostgreSQL password
- [ ] Use environment variables for all secrets
- [ ] Enable HTTPS (automatic on Vercel/Railway)
- [ ] Validate all user input (already done)
- [ ] Rate limit webhook endpoint (if public)
- [ ] Audit webhook logs regularly

---

## Next Steps

1. Test all features locally first
2. Create test leads and verify allocation
3. Check real-time updates work
4. Test webhook idempotency
5. Deploy to production
6. Monitor logs and performance
7. Set up automated backups

---

## Support

For issues:
1. Check error messages in terminal/logs
2. Verify DATABASE_URL is correct
3. Ensure PostgreSQL is running
4. Check that all migrations ran: `npx prisma migrate status`
5. Clear .next folder and rebuild: `rm -rf .next && npm run build`

Good luck! 🚀
