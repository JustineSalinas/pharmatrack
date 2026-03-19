# PharmaTrack |Attendance System

*Version:* 1.0.0-Beta   
*Institution:* University of San Agustin - Iloilo City  

Welcome to the development branch. This system is designed to automate attendance for 700+ CPMT students using encrypted QR codes and Supabase Real-Time tracking.

---

## 🛠️ System Architecture

- *Frontend:* Next.js 15 (App Router)
- *Styling:* Tailwind CSS
- *Database:* Supabase (PostgreSQL)
- *Authentication:* Supabase Auth
- *Scanner:* Html5-Qrcode (Browser-based)

---

## 👥 Team Roles & Responsibilities

### Matthew (Frontend Lead)
- *Primary Task:* Build the **Student Dashboard**.
- *Focus:* Create the UI in `src/app/dashboard/page.tsx`.
- *Logic:* Fetch `full_name` and `qr_code_string` from the `profiles` table and render the QR code using `react-qr-code`.

### Alex (Scanner & Integration)
- **Primary Task:* Build the **Admin Scanner**.
- *Focus:* Develop the logic in `src/components/Scanner.tsx`.
- *Logic:* Implement the camera feed. On a successful scan, trigger a function that inserts a row into the `attendance` table.

### Tways & Herminio (Backend & Analytics)
- *Primary Task:* **Attendance Logic & Reporting**.
- *Focus:* Create a "Live Event View" for the Council Officers.
- *Logic:* Use **Supabase Real-Time** to show a live count of students who have checked in. Calculate "Late" status based on the `grace_period_minutes` in the `events` table.

---

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
