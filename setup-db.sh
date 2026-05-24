#!/bin/bash
# PostgreSQL Setup Script for Prowider

# Database name
DB_NAME="prowider_db"
DB_USER="postgres"
DB_PASSWORD="postgres"

echo "Setting up PostgreSQL database for Prowider..."

# Create database
psql -U $DB_USER -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || psql -U $DB_USER -c "CREATE DATABASE $DB_NAME"

echo "Database '$DB_NAME' created successfully!"
echo ""
echo "Next steps:"
echo "1. Update .env.local with your database URL"
echo "2. Run: npm run prisma:migrate"
echo "3. Run: npm run db:seed"
echo "4. Run: npm run dev"
