# Database on Vercel (PostgreSQL)

The build runs **`prisma migrate deploy`** before `next build`, which creates tables (`User`, `Account`, etc.) in your production database.

## Required

1. **Vercel → Project → Settings → Environment Variables**
   - `DATABASE_URL` — PostgreSQL connection string (same DB for Production / Preview as needed).
   - Must be available at **build time** (Prisma runs migrations during `npm run build`).

2. Redeploy after adding `DATABASE_URL` or changing migrations.

## If tables are still missing

Run migrations once against production (with your real URL):

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

Use the connection string from Vercel or your host (Neon, Supabase, Vercel Postgres, etc.).
