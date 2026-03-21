"use client";
import React from 'react';

export default function StudentDashboard() {
  // In the future, we will fetch real data here like your test page did
  const studentName = "Juan Dela Cruz"; 

  return (
    <div className="min-h-screen bg-augustinian-gradient flex text-white font-sans overflow-hidden">
      
      {/* --- SIDEBAR --- */}
      <aside className="w-72 border-r border-white/10 bg-black/20 backdrop-blur-2xl hidden md:flex flex-col p-8">
        <div className="mb-12">
          <h1 className="text-2xl font-black tracking-tighter leading-none">PHARMATRACK</h1>
          <p className="text-[9px] text-[#f5dc8c] font-bold uppercase tracking-[0.3em] mt-2">Attendance Monitoring</p>
        </div>

        <nav className="space-y-3 flex-1">
          <NavItem icon="🏠" label="Home" active />
          <NavItem icon="📋" label="Attendance" />
          <NavItem icon="📅" label="Calendar" />
          <NavItem icon="📸" label="QR Code" />
          <NavItem icon="👤" label="Profile" />
        </nav>

        <div className="mt-auto pt-6 border-t border-white/10">
          <button className="text-[10px] font-bold opacity-40 hover:opacity-100 transition-all uppercase tracking-widest">
            ← Sign Out
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 p-10 overflow-y-auto">
        <header className="mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
          <p className="text-sm opacity-50 font-medium">Welcome back,</p>
          <h2 className="text-4xl font-black text-[#f5dc8c] tracking-tight">{studentName}</h2>
        </header>

        {/* --- ATTENDANCE SUMMARY --- */}
        <section className="glass-card p-8 mb-10 shadow-2xl border-t border-white/20">
          <div className="flex justify-between items-center mb-8">
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f5dc8c]">Attendance Summary</h3>
             <span className="text-[10px] opacity-40 font-bold uppercase">10 Events This Semester</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <StatBox label="Present" value="07" color="text-green-400" />
            <StatBox label="Late" value="01" color="text-orange-400" />
            <StatBox label="Absent" value="01" color="text-red-400" />
            <StatBox label="Incomplete" value="01" color="text-purple-300" />
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
          {/* --- UPCOMING EVENTS --- */}
          <div className="space-y-6">
            <div className="flex justify-between items-end px-2">
              <h3 className="text-lg font-bold tracking-tight">Upcoming Events</h3>
              <button className="text-[10px] text-[#f5dc8c] font-black uppercase tracking-widest hover:underline">View All</button>
            </div>
            <div className="space-y-4">
              <EventCard title="Pharmacy General Assembly" date="2026-03-22" time="3:00 PM" loc="Auditorium" />
              <EventCard title="Medication Awareness Seminar" date="2026-03-30" time="1:00 PM" loc="Room 301" />
            </div>
          </div>

          {/* --- RECENT ATTENDANCE --- */}
          <div className="space-y-6">
             <div className="flex justify-between items-end px-2">
              <h3 className="text-lg font-bold tracking-tight">Recent Attendance</h3>
              <button className="text-[10px] text-[#f5dc8c] font-black uppercase tracking-widest hover:underline">View History</button>
            </div>
            <div className="space-y-3">
              <RecentItem title="General Meeting" date="2026-03-10" status="Present" />
              <RecentItem title="Drug Seminar" date="2026-03-05" status="Incomplete" />
              <RecentItem title="Workshop" date="2026-03-01" status="Absent" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// --- REUSABLE COMPONENTS (Keeps code clean) ---

function NavItem({ icon, label, active = false }: { icon: string, label: string, active?: boolean }) {
  return (
    <div className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all cursor-pointer ${active ? 'bg-[#f5dc8c] text-[#2e063b] font-black shadow-[0_10px_20px_rgba(245,220,140,0.2)]' : 'hover:bg-white/5 opacity-50 hover:opacity-100'}`}>
      <span className="text-xl">{icon}</span>
      <span className="text-sm font-bold tracking-wide">{label}</span>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="flex flex-col border-l border-white/10 pl-6 first:border-0">
      <span className={`text-5xl font-black tracking-tighter ${color}`}>{value}</span>
      <span className="text-[9px] uppercase font-black tracking-widest opacity-40 mt-2">{label}</span>
    </div>
  );
}

function EventCard({ title, date, time, loc }: { title: string, date: string, time: string, loc: string }) {
  return (
    <div className="glass-card p-6 hover:bg-white/10 transition-all cursor-pointer group border-l-4 border-l-[#f5dc8c]">
      <h4 className="font-bold text-base mb-3 group-hover:text-[#f5dc8c] transition-colors">{title}</h4>
      <div className="flex flex-wrap gap-5 text-[10px] font-bold opacity-50 uppercase tracking-widest">
        <span>📅 {date}</span>
        <span>🕒 {time}</span>
        <span>📍 {loc}</span>
      </div>
    </div>
  );
}

function RecentItem({ title, date, status }: { title: string, date: string, status: string }) {
  const statusColors: any = {
    Present: "bg-green-500/20 text-green-400 border-green-500/20",
    Incomplete: "bg-purple-500/20 text-purple-300 border-purple-500/20",
    Absent: "bg-red-500/20 text-red-400 border-red-500/20"
  }
  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex justify-between items-center backdrop-blur-sm">
      <div>
        <h4 className="text-sm font-bold mb-1">{title}</h4>
        <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">{date}</p>
      </div>
      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusColors[status]}`}>
        {status}
      </span>
    </div>
  );
}