# Setup Instructions for Prowider Lead Distribution System

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (locally or cloud-hosted)
- Git

## Local Development Setup

### Step 1: Clone Repository

```bash
git clone <your-repo-url>
cd BookMyPacker
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/prowider_db"
```

Example for PostgreSQL locally:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/prowider_db"
```

For cloud-hosted PostgreSQL (e.g., Vercel):
```bash
DATABASE_URL="postgresql://[user]:[password]@[host]:[port]/[database]?schema=public"
```

### Step 4: Create Database

```bash
# Using psql
createdb prowider_db

# Or if using PostgreSQL container
docker run --name postgres -e POSTGRES_PASSWORD=postgres -d postgres
```

### Step 5: Set Up Database Schema

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database with initial data (8 providers, 3 services)
npm run db:seed
```

### Step 6: Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Testing the System

### 1. Customer Service Request Form
- Navigate to `http://localhost:3000/request-service`
- Fill in customer details (name, phone, city, service, description)
- Submit the form
- The lead will be automatically assigned to 3 providers

### 2. Provider Dashboard
- Navigate to `http://localhost:3000/dashboard`
- Select different providers from the sidebar
- View assigned leads and quota usage
- Dashboard updates in real-time when new leads are assigned

### 3. Testing Tools
- Navigate to `http://localhost:3000/test-tools`

**Test 1: Reset Quota**
- Select a provider
- Click "Reset Quota to 10"
- Verify quota is reset and dashboard updates

**Test 2: Webhook Idempotency**
- Click "Test Idempotency"
- Webhook is called 3 times with same key
- Only first call should process the reset

**Test 3: Concurrent Lead Generation**
- Click "Generate 10 Leads"
- 10 leads are created simultaneously
- System should allocate them fairly without conflicts

## Production Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel:
   - `DATABASE_URL`: Your PostgreSQL connection string
4. Deploy

### Other Deployment Options

#### Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t prowider .
docker run -p 3000:3000 -e DATABASE_URL=<your-db-url> prowider
```

#### Manual Server Deployment

1. Build the application:
```bash
npm run build
```

2. Start the server:
```bash
npm start
```

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Check database is running and accessible
- Ensure PostgreSQL is properly configured

### Seed Data Issues

```bash
# Recreate migrations if needed
npm run prisma:migrate reset

# Then seed
npm run db:seed
```

### Build Issues

```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

### Port Already in Use

```bash
# Use a different port
npm run dev -- -p 3001
```

## Architecture

- **Frontend**: Next.js 16 with React 19
- **Backend**: Next.js API Routes with Prisma ORM
- **Database**: PostgreSQL
- **Real-time Updates**: Server-Sent Events (SSE)
- **Lead Allocation**: Round-robin with persisted cursor

## File Structure

```
app/
  ├── api/
  │   ├── dashboard/      # Provider dashboard data
  │   ├── events/         # SSE endpoint for real-time updates
  │   ├── leads/          # Lead creation with allocation logic
  │   ├── providers/      # Provider list endpoint
  │   ├── services/       # Service list endpoint
  │   ├── webhook/        # Webhook idempotency handler
  │   └── ws.ts           # SSE client management
  ├── dashboard/          # Provider dashboard page
  ├── request-service/    # Customer form page
  ├── test-tools/         # Testing panel page
  └── layout.tsx          # Root layout with navigation

components/
  └── DashboardContent.tsx # Reusable dashboard component

prisma/
  ├── schema.prisma       # Database schema
  ├── seed.ts            # Seed script
  └── migrations/         # Database migrations

lib/
  └── prisma.ts          # Prisma client singleton
```

## Key Features

1. **Automatic Lead Allocation**: Leads are assigned to 3 providers instantly
2. **Fair Distribution**: Round-robin algorithm with quota respect
3. **Real-time Updates**: SSE pushes updates to connected dashboards
4. **Webhook Safety**: Idempotent quota reset with transaction support
5. **Concurrency Safe**: All operations use database transactions
6. **Duplicate Prevention**: Database constraints prevent duplicate leads

## Performance

- **Lead Allocation**: O(n) where n = pool size (max 8)
- **Dashboard**: Lightweight SSE for real-time updates
- **Database**: Indexed queries on phone, serviceId, providerId
- **Concurrent Handling**: Transaction-based with row-level locking
