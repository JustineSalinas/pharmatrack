"use client";
import { useState } from "react";
import Scanner from "@/components/Scanner";

export default function PharmaTrackPortal() {
  const [studentId, setStudentId] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/student/profile?id=${studentId}`);
      const data = await res.json();
      if (res.ok) setProfile(data);
      else setError(data.error || "Student not found");
    } catch (err) {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-augustinian-gradient flex flex-col items-center justify-center p-6 text-white font-sans">
      
      {!profile ? (
        /* --- FIGMA LOGIN VIEW --- */
        <div className="glass-card max-w-md w-full p-10 animate-in fade-in zoom-in duration-500">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-black tracking-tighter mb-2">PHARMATRACK</h1>
            <p className="text-[#f5dc8c] text-xs font-bold uppercase tracking-[0.3em]">Attendance Monitoring</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest opacity-60 ml-1">Student ID Number</label>
              <input 
                className="w-full bg-white/10 border border-white/20 rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#f5dc8c]/50 transition-all placeholder:text-white/20"
                placeholder="2024-XXXXX-USA"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                required
              />
              {error && <p className="text-red-400 text-[10px] font-bold animate-pulse">⚠️ {error}</p>}
            </div>

            <button disabled={loading} className="btn-gold w-full flex items-center justify-center gap-2">
              {loading ? "Verifying..." : "Log In"}
            </button>
          </form>

          <p className="text-center mt-8 text-[10px] opacity-40 uppercase tracking-widest">
            University of San Agustin • CPMT
          </p>
        </div>
      ) : (
        /* --- FIGMA SUCCESS / SIGN OUT VIEW --- */
        <div className="space-y-6 w-full max-w-md animate-in slide-in-from-bottom-8 duration-500">
          <div className="glass-card p-10 text-center border-t-4 border-t-[#f5dc8c]">
             <div className="w-20 h-20 bg-[#f5dc8c] rounded-full mx-auto mb-6 flex items-center justify-center shadow-2xl">
                <span className="text-4xl">🎓</span>
             </div>
             <h2 className="text-2xl font-bold mb-1">Welcome Back,</h2>
             <h3 className="text-3xl font-black text-[#f5dc8c] mb-2 uppercase tracking-tight">{profile.full_name}</h3>
             <p className="text-sm opacity-60 italic mb-4">{profile.department || "Pharmacy Student"}</p>
             <div className="text-[10px] font-mono bg-black/20 py-2 rounded-lg opacity-50 tracking-widest">
                ID: {profile.student_id}
             </div>
          </div>

          {/* Scanner Component for Week 2 */}
          <div className="glass-card p-6 overflow-hidden">
             <Scanner eventId="GA-2026-LIVE" />
          </div>
          
          <button 
            onClick={() => { setProfile(null); setStudentId(""); }} 
            className="w-full py-4 rounded-xl border border-white/20 font-bold hover:bg-white/5 transition-colors uppercase tracking-widest text-xs"
          >
            Sign Out
          </button>
        </div>
      )}
    </main>
  );
}