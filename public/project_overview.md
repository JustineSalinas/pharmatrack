# PharmaTrack: Project Overview & Scope

PharmaTrack is a specialized management system designed for pharmaceutical education and event tracking. It leverages modern web technologies to provide real-time attendance, reporting, and user management.

## 🏗️ Project Architecture

The project follows a modern **Next.js (App Router)** structure integrated with **Supabase** for backend services and authentication.

### Core Folder Structure & Meanings

| Folder/File | Meaning & Purpose |
| :--- | :--- |
| `src/app` | **Routing & Pages**: Contains all the functional views and API routes of the application. |
| `src/app/api` | **Server-side Logic**: Custom API endpoints for handling sensitive operations or data mutations. |
| `src/app/dashboard` | **Main Application Shell**: The authenticated area of the app with role-based views. |
| `src/app/dashboard/admin` | **Admin Control Panel**: Restricted area for administrators to manage the system. |
| `src/app/dashboard/faculty` | **Faculty Dashboard**: Specialized views for faculty members to monitor progress. |
| `src/app/check-in` | **QR Check-in Portal**: The public-facing entry point for students to scan their QR codes. |
| `src/components` | **Reusable UI Components**: Shared elements like the `Sidebar`, `Scanner`, and specialized layout blocks. |
| `src/lib` | **Infrastructure & Utilities**: Core logic for authentication, database interaction, and data validation. |
| `public` | **Static Assets**: Images, icons, and public resources (e.g., logos, university seals). |
| `scripts` | **Developer Tools**: Utility scripts for data seeding (using Faker) or maintenance tasks. |

---

## 🚀 Key Features & Functionalities

### 1. Advanced Authentication & Role Management
- **Supabase Integration**: Secure login and registration using Supabase Auth.
- **RBAC (Role-Based Access Control)**: Distinct permissions for **Students**, **Faculty**, and **Admins**.
- **User Approval Flow**: Admins can approve or reject new registrations (status: `pending`, `approved`, `rejected`).

### 2. QR-Based Attendance Tracking
- **Automatic QR Generation**: Each student is assigned a unique `qr_code_id`.
- **Real-time Scanning**: Integrated `html5-qrcode` scanner in [src/components/Scanner.tsx](file:///c:/Users/ASUS/Downloads/NEW/pharmatrack/src/components/Scanner.tsx) for fast entry/exit recording.
- **Automated Logging**: Records `time_in`, `time_out`, and calculates status (`present`, `late`, `absent`).

### 3. Event & Schedule Management
- **Dynamic Event Creation**: Admins can create events with specific check-in/late/end time windows.
- **Location Tracking**: Specify event venues and dates.
- **Automated Windows**: The system automatically determines if a student is "Late" based on the `check_in_late` timestamp.

### 4. Reporting & Analytics
- **Attendance Summary View**: A database view (`student_attendance_summary`) that calculates attendance rates in real-time.
- **Admin Reports**: Dedicated module (`dashboard/admin/reports`) for generating data exports and visual snapshots.
- **Performance Monitoring**: Tracks student engagement across multiple events.

### 5. Profile & Record Management
- **Student Profiles**: Detailed information including student ID numbers, sections, and year levels.
- **Attendance History**: Personal records for students to view their own attendance logs.

---

## 💎 Critical Success Factors (The "Why it Matters")

As a Project Manager, these are the architectural decisions and features that represent the "Critical Path" for PharmaTrack:

### 1. The QR "Digital Handshake" ([src/components/Scanner.tsx](file:///c:/Users/ASUS/Downloads/NEW/pharmatrack/src/components/Scanner.tsx))
**Why it's important:** This is the primary interface between the physical world and the digital database. The reliability of this component determines the user's perception of the entire system. It eliminates manual entry errors and speeds up large-scale event processing.

### 2. Database-Level Security (Supabase RLS)
**Why it's important:** Your [schema.sql](file:///c:/Users/ASUS/Downloads/NEW/pharmatrack/schema.sql) uses **Row Level Security (RLS)**. This means security isn't just in the code; it's baked into the database. A student *physically cannot* query another student's attendance records, even if they bypassed the frontend. This is crucial for privacy compliance.

### 3. Automated Time Windows (`src/app/dashboard/admin/events`)
**Why it's important:** The logic that differentiates between `Present`, `Late`, and `Absent` is central to the project's academic integrity. By setting `check_in_late` and `check_in_end` timestamps, the system removes human bias from attendance reporting.

### 4. Live Analytics (Database View: `student_attendance_summary`)
**Why it's important:** Instead of expensive real-time calculations on the frontend, the project uses a **Postgres View**. This ensures that as soon as a student scans their QR code, the Admin's report is updated instantly with zero extra processing power required.

---

## 🛠️ Technical Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (React)
- **Database/Auth**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Styling**: Vanilla CSS (Premium Dark/Purple Theme)
- **Validation**: [Zod](https://zod.dev/)
- **QR Engine**: `html5-qrcode` & `qrcode.react`
- **Icons**: [Lucide React](https://lucide.dev/)

---

## 🏛️ Governance & Longevity (PM Recommendations)

For the long-term success of PharmaTrack, the **Department Head** should be the primary approver of accounts, not the developer. 

### Why the Department Head?
*   **Authority & Context**: Only the department knows which faculty members are authorized to manage events. A developer would have to "ask permission" anyway, adding a redundant step.
*   **Security**: It prevents "Shadow IT" or unauthorized access. If a facilitator leaves the school, the department head can immediately **Suspend** their account directly from the dashboard.
*   **Sustainability**: If you (the developer) move on to other projects, the system remains fully operational because the department owns the administrative flow.

### The "Seed" Process (First Time Global Admin)
To start this cycle:
1.  The developer manually sets **one** account (the Department Head) to `status: 'approved'` in the Supabase dashboard.
2.  From that point forward, that person can approve all other facilitators.

### Should the Developer have an account? (Recommended: No)
*   **Production Privacy**: Developers should generally NOT have access to real student data or attendance records in a "Live" environment.
*   **Principle of Least Privilege**: Only those who *need* access to perform their job should have accounts.
*   **Troubleshooting**: If a developer needs to fix something, they should do it in a **Development Environment** (with fake data) rather than on the production site.
*   **Deactivation**: If you briefly created an account for testing during setup, it should be **Deleted or Suspended** once the Department Head takes over.

The database is structured to ensure data integrity and security:
- **`users`**: Central table for all account types.
- **`student_profiles`**: Linked to `users`, stores QR-specific and academic data.
- **`events`**: Stores configuration for pharmaceutical classes/seminars.
- **`attendance_records`**: Junction table mapping students to events with timestamps.
- **Row Level Security (RLS)**: Policies ensure students can only see their own data, while admins have full visibility.
