# PharmaTrack | Attendance System

*Version:* 1.0.0-Beta   
*Institution:* University of San Agustin - Iloilo City  

Welcome to the development branch. This system is designed to automate attendance for 700+ CPMT students using encrypted QR codes and Supabase Real-Time tracking.

---

## System Architecture

- *Frontend:* Next.js 15 (App Router)
- *Styling:* Tailwind CSS
- *Database:* Supabase (PostgreSQL)
- *Authentication:* Supabase Auth
- *Scanner:* Html5-Qrcode (Browser-based)

---

## Team Roles & Responsibilities

### Adrian Salinas (Project Manager / Lead Backend)
- *Primary Task:* Develop the **Project Infrastructure & Security Oversight.**.
- *Focus:* Maintain the main branch, manage **GitHub repository permissions**, and resolve merge conflicts.**
- *Logic:* Architect the relational database schema in Supabase and enforce **Row Level Security (RLS)** to protect student data privacy.

### Matthew Tabat (Frontend Lead)
- *Primary Task:* Build the **Student Dashboard**.
- *Focus:* Create the UI in `src/app/dashboard/page.tsx`.
- *Logic:* Fetch `full_name` and `qr_code_string` from the `profiles` table and render the QR code using `react-qr-code`.

### Alexander Tolosa (Scanner & Integration)
- **Primary Task:* Build the **Admin Scanner**.
- *Focus:* Develop the logic in `src/components/Scanner.tsx`.
- *Logic:* Implement the camera feed. On a successful scan, trigger a function that inserts a row into the `attendance` table.

### Tways & Herminio (Backend & Analytics)
- *Primary Task:* **Attendance Logic & Reporting**.
- *Focus:* Create a "Live Event View" for the Council Officers.
- *Logic:* Use **Supabase Real-Time** to show a live count of students who have checked in. Calculate "Late" status based on the `grace_period_minutes` in the `events` table.

---
Figma Wireframe and Design: https://www.figma.com/site/ckOv3NzIUmG1V0aljtXAFD/Untitled?node-id=0-1&t=yMDFdrphBjwnLn36-1

## Getting Started

### 1. Prerequisites
Ensure you have the following installed:
- **Node.js** (v20 or higher)
- **Git**
- **VS Code** (Extensions: ESLint, Tailwind CSS, Prettier)

### 2. Initial Setup
```bash
# Clone the repository
git clone [https://github.com/JustineSalinas/pharmatrack.git](https://github.com/JustineSalinas/pharmatrack.git)

# Install dependencies
npm install
