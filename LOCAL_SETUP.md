# Local Development Setup Guide

## Step 1: Install PostgreSQL

### For Windows:
1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. Run the installer
3. **Important**: Remember the password you set for the "postgres" user
4. Keep default settings:
   - Port: 5432
   - Install pgAdmin: Yes (helpful for database management)
5. Complete installation

### For Mac:
```bash
# Using Homebrew (recommended)
brew install postgresql@15
brew services start postgresql@15
```

### For Linux (Ubuntu/Debian):
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start
```

---

## Step 2: Verify PostgreSQL Installation

### Windows (PowerShell):
```powershell
# Check if PostgreSQL is running
# Look in Windows Services for "postgresql-x64-15" or similar
# Or test the connection:
psql -U postgres -h localhost -c "SELECT version();"
```

When prompted for password, enter the password you set during installation.

### Mac/Linux:
```bash
psql -U postgres -c "SELECT version();"
```

---

## Step 3: Create the Database

### Windows (PowerShell):
```powershell
# Connect to PostgreSQL
psql -U postgres -h localhost

# In the psql prompt, run:
CREATE DATABASE prowider_db;
\l
# Should list prowider_db

# Exit
\q
```

### Mac/Linux:
```bash
createdb -U postgres prowider_db
psql -U postgres -l
# Should show prowider_db in the list
```

---

## Step 4: Update Your .env.local

Edit `g:\BookMyPacker\.env.local` and update with your actual PostgreSQL credentials:

```env
# Database URL - Replace with your PostgreSQL credentials
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/prowider_db"

# Keep these as-is for local development
NEXT_PUBLIC_API_URL="http://localhost:3000"
NEXT_PUBLIC_WS_URL="ws://localhost:3000"
NODE_ENV="development"
```

**Replace `YOUR_PASSWORD`** with the password you set during PostgreSQL installation.

---

## Step 5: Run Database Migrations

```bash
cd g:\BookMyPacker

# Apply database migrations
npx prisma migrate dev --name init

# You should see output like:
# ✔ Prisma schema loaded from prisma\schema.prisma
# ✔ Database created successfully
# ✔ Successfully created 8 tables in your database
```

---

## Step 6: Seed the Database

```bash
# Add initial data (3 services, 8 providers)
npx prisma db seed

# You should see:
# Database has been seeded successfully
# Services: Service 1, Service 2, Service 3
# Providers: Provider 1, Provider 2, ..., Provider 8
```

---

## Step 7: Start the Development Server

```bash
# From the project directory
npm run dev

# You should see:
# ▲ Next.js 16.0.0
# - Local: http://localhost:3000
# - Environments: .env.local
# ✓ Ready in 2.5s
```

Open http://localhost:3000 in your browser!

---

## Testing the Setup

1. **Home Page**: http://localhost:3000
   - Should show "Welcome to Prowider"
   
2. **Request Service**: http://localhost:3000/request-service
   - Submit a test lead
   
3. **Dashboard**: http://localhost:3000/dashboard
   - Should show providers and their leads
   
4. **Test Tools**: http://localhost:3000/test-tools
   - Test concurrency and webhooks

---

## Troubleshooting

### "psql: command not found"
- **Windows**: PostgreSQL not added to PATH
  - Solution: Add PostgreSQL bin folder to PATH
  - Or use full path: `"C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres`

### "password authentication failed"
- Check your DATABASE_URL in .env.local
- Verify the password matches what you set during installation
- Try connecting directly: `psql -U postgres -h localhost`

### "database does not exist"
```bash
# Create it manually
psql -U postgres -h localhost -c "CREATE DATABASE prowider_db;"
```

### "Prisma can't find the database"
- Make sure PostgreSQL is actually running
- Windows: Check Services (services.msc) for postgresql service
- Mac: `brew services list` should show postgresql running
- Linux: `sudo service postgresql status`

### "Port 5432 already in use"
- Another PostgreSQL instance is running
- Or change the port in DATABASE_URL if needed

---

## Quick Reference Commands

```bash
# Database commands
psql -U postgres -h localhost          # Connect to PostgreSQL
psql -U postgres -l                    # List all databases
npx prisma studio                       # Open GUI database viewer
npx prisma migrate status              # Check migration status

# Application commands
npm run dev                            # Start development server
npm run build                          # Build for production
npm run lint                           # Check code style

# Troubleshooting
npx prisma db push                     # Sync schema with database
npx prisma migrate reset               # Reset database (destructive!)
```

---

## Next Steps After Setup

1. ✅ Install PostgreSQL
2. ✅ Create database
3. ✅ Update .env.local
4. ✅ Run migrations
5. ✅ Seed database
6. ✅ Start dev server
7. Test all features locally
8. Run tests from /test-tools page
9. Deploy to production when ready

Good luck! 🚀
