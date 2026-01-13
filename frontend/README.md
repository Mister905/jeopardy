# Jeopardy Frontend

Next.js frontend application for the Jeopardy game.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```bash
cp .env.local.example .env.local
```

3. Update `.env.local` with your Supabase credentials and backend API URL:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Development

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Build

Build for production:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## Architecture

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Authentication**: Supabase Auth
- **API Client**: Custom fetch-based client with JWT token handling

## Key Principles

- Frontend is a thin client - no business logic
- All game state comes from backend API
- UI reflects backend state exactly
- No optimistic updates
- All validations enforced by backend
