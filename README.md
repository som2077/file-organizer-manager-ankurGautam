# File Organizer Manager

Ek full-stack file management application jisme users apni files (images, documents, etc.) upload, search, filter, download aur delete kar sakte hain.

## Features

- **User Authentication** - Email/Password signup aur login
- **File Upload** - Drag & drop ya click karke files upload karo
- **File Download** - Apni uploaded files download karo
- **File Delete** - Files delete karo jab zaroorat na ho
- **Search** - File name se search karo
- **Filter** - File type (image, pdf, etc.) se filter karo
- **Grid/List View** - Files ko grid ya list mein dekho
- **Dark/Light Theme** - Theme toggle karo
- **OAuth Login** - Third-party login support

## Tech Stack

| Layer           | Technology                 |
| --------------- | -------------------------- |
| Frontend        | React 19 + Vite            |
| Styling         | Tailwind CSS 4 + shadcn/ui |
| Backend         | Express.js + tRPC          |
| Database        | Supabase (PostgreSQL)      |
| File Storage    | Supabase Storage           |
| Auth            | JWT (jose)                 |
| ORM             | Drizzle ORM (types)        |
| Package Manager | pnpm                       |

## Prerequisites

- **Node.js** 20+
- **pnpm** 10+
- **Supabase** account ([supabase.com](https://supabase.com))

## Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd file-organizer-manager
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Supabase setup

Apne Supabase project mein tables aur storage bucket create karo:

1. Supabase Dashboard → **SQL Editor** kholo
2. `supabase-migration.sql` ka content copy-paste karo
3. **Run** button dabao

### 4. Environment variables

`.env` file create karo ya update karo:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
JWT_SECRET=your-secret-key
VITE_APP_ID=file-organizer-manager
```

### 5. Run the app

```bash
pnpm dev
```

App `http://localhost:3000` pe chalega.

## Available Scripts

| Command       | Description                   |
| ------------- | ----------------------------- |
| `pnpm dev`    | Development server start karo |
| `pnpm build`  | Production build banao        |
| `pnpm start`  | Production server start karo  |
| `pnpm check`  | TypeScript type check karo    |
| `pnpm test`   | Tests run karo                |
| `pnpm format` | Code format karo              |

## Project Structure

```
file-organizer-manager/
├── api/                    # Vercel serverless function
│   └── index.ts
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Pages (Login, FileManager)
│   │   ├── lib/            # Utilities
│   │   ├── contexts/       # React contexts
│   │   └── hooks/          # Custom hooks
│   └── index.html
├── server/                 # Express backend
│   ├── _core/              # Core utilities (auth, trpc, vite)
│   ├── db.ts               # Supabase database operations
│   └── routers.ts          # tRPC routes
├── drizzle/                # Database schema (types)
│   └── schema.ts
├── shared/                 # Shared code (client + server)
├── supabase-migration.sql  # Database migration SQL
├── vercel.json             # Vercel deployment config
├── .env                    # Environment variables
└── package.json
```

## Deployment (Vercel)

1. GitHub pe push karo
2. [vercel.com](https://vercel.com) pe project import karo
3. Environment Variables add karo:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `VITE_APP_ID`
4. **Deploy** click karo

## Database Tables

### users

| Column       | Type         | Description               |
| ------------ | ------------ | ------------------------- |
| id           | SERIAL       | Primary key               |
| openId       | VARCHAR(64)  | OAuth identifier (unique) |
| name         | TEXT         | User name                 |
| email        | VARCHAR(320) | Email address             |
| loginMethod  | VARCHAR(64)  | Login method              |
| password     | TEXT         | Hashed password           |
| role         | VARCHAR(16)  | user / admin              |
| createdAt    | TIMESTAMPTZ  | Created timestamp         |
| updatedAt    | TIMESTAMPTZ  | Updated timestamp         |
| lastSignedIn | TIMESTAMPTZ  | Last login timestamp      |

### files

| Column       | Type         | Description           |
| ------------ | ------------ | --------------------- |
| id           | SERIAL       | Primary key           |
| userId       | INTEGER      | Foreign key to users  |
| originalName | VARCHAR(255) | Original file name    |
| fileName     | VARCHAR(255) | Stored file name      |
| fileType     | VARCHAR(100) | MIME type             |
| fileSize     | INTEGER      | File size in bytes    |
| filePath     | VARCHAR(512) | Supabase Storage path |
| uploadedAt   | TIMESTAMPTZ  | Upload timestamp      |
| createdAt    | TIMESTAMPTZ  | Created timestamp     |
| updatedAt    | TIMESTAMPTZ  | Updated timestamp     |

## License

MIT
