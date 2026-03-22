PharmaTrack — Attendance Monitoring System

QR-based attendance tracking for the University of San Agustin Pharmacy Department.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                        # Landing page
│   ├── layout.tsx                      # Root layout
│   ├── globals.css                     # Design system & global styles
│   ├── login/page.tsx                  # Student/Faculty login
│   ├── register/page.tsx               # Registration (Student & Faculty)
│   ├── check-in/page.tsx               # QR check-in page (student)
│   ├── dashboard/
│   │   ├── layout.tsx                  # Student dashboard layout (sidebar)
│   │   ├── page.tsx                    # Student overview
│   │   ├── records/page.tsx            # Attendance history
│   │   ├── schedule/page.tsx           # Class schedule
│   │   ├── profile/page.tsx            # Student profile
│   │   ├── notifications/page.tsx      # Notifications
│   │   ├── faculty/
│   │   │   ├── layout.tsx              # Faculty sidebar layout
│   │   │   ├── page.tsx                # Faculty overview
│   │   │   ├── generate/page.tsx       # QR code generator
│   │   │   ├── students/page.tsx       # Student management
│   │   │   └── reports/page.tsx        # Reports & analytics
│   │   └── admin/
│   │       ├── layout.tsx              # Admin sidebar layout
│   │       ├── page.tsx                # Admin dashboard
│   │       ├── users/page.tsx          # User management
│   │       ├── attendance/page.tsx     # Attendance logs
│   │       ├── reports/page.tsx        # Analytics
│   │       └── settings/page.tsx       # System settings
│   └── api/
│       ├── auth/[...all]/route.ts      # Auth API (login/register/logout)
│       └── student/profile/route.ts   # Student profile & attendance API
├── components/
│   ├── Scanner.tsx                     # QR scanner component
│   └── Sidebar.tsx                     # Role-aware sidebar nav
└── lib/
    ├── schema.ts                       # TypeScript DB types
    ├── supabase.ts                     # Supabase client
    ├── auth.ts                         # Server-side auth helpers
    ├── auth-client.ts                  # Client-side auth utilities
    └── validations.ts                  # Zod validation schemas
```

---

## Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `schema.sql` (included in this repo)
3. Copy your project URL and keys

### 3. Configure environment
```bash
cp .env.example .env.local
```
Fill in your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Run the dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## User Roles

| Role | Access |
|------|--------|
| **Student** | Check-in via QR, view own attendance records & schedule |
| **Faculty** | Generate QR sessions, view class attendance, manage students, export reports |
| **Admin** | Full system access, user management, system-wide analytics |

---

## Flow

1. **Faculty** creates a timed QR session for a subject/section
2. **Students** scan the QR code (or enter the session code manually)
3. Attendance is recorded automatically with timestamp
4. Late arrivals (after 7:35 AM) are marked as **LATE**
5. Faculty & Admin can view reports and export CSV/PDF

---

## Tech Stack

- **Next.js 14** (App Router)
- **Supabase** (Auth + PostgreSQL)
- **TypeScript**
- **Zod** (validation)
- **Custom CSS** (no Tailwind — full design system in `globals.css`)
