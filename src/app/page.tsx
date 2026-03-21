"use client";
import { useState } from "react";
import Scanner from "@/components/Scanner";

export default function StudentPortal() {
  const [studentId, setStudentId] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/student/profile?id=${studentId}`);
      const data = await res.json();
      
      if (res.ok) {
        setProfile(data);
      } else {
        setError(data.error || "Access Denied");
      }
    } catch (err) {
      setError("Server connection failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--usa-neutral)]">
      {!profile ? (
        /* --- SIGN-IN VIEW --- */
        <div className="card-premium max-w-md w-full shadow-xl border-t-4 border-t-[var(--usa-purple-dark)] animate-in fade-in slide-in-from-bottom-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[var(--usa-purple-dark)] tracking-tight">PHARMATRACK</h1>
            <p className="text-xs text-slate-500 font-bold uppercase mt-1">Student Portal Access</p>
          </div>

          <form onSubmit={handleLookup} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2 ml-1">Student ID Number</label>
              <input 
                className="input-field" 
                placeholder="2024-XXXXX-USA"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                required
              />
              {error && <p className="text-red-500 text-[10px] mt-2 font-bold ml-1 italic">⚠️ {error}</p>}
            </div>

            <button disabled={loading} className="btn-primary w-full py-4 text-lg">
              {loading ? "Verifying Identity..." : "Sign In to Portal"}
            </button>
          </form>
        </div>
      ) : (
        /* --- AUTHENTICATED VIEW (Profile + Scanner) --- */
        <div className="space-y-6 w-full max-w-md animate-in zoom-in-95 duration-300">
          <div className="card-premium text-center border-t-4 border-t-[var(--usa-purple-dark)]">
            <div className="w-12 h-12 bg-[var(--usa-gold)] rounded-full mx-auto mb-3 flex items-center justify-center shadow-inner">
              <span className="text-xl">🎓</span>
            </div>
            <h2 className="text-xl font-bold text-slate-800">Welcome, {profile.full_name}</h2>
            <p className="text-sm text-slate-500 italic mb-1">{profile.department}</p>
            <p className="text-[10px] font-mono text-slate-400">{profile.student_id}</p>
          </div>

          {/* This is the Scanner you worked on earlier! */}
          <Scanner eventId="GA-2026-LIVE" />
          
          <button onClick={() => { setProfile(null); setStudentId(""); }} className="btn-accent w-full font-bold">
            Sign Out
          </button>
        </div>
      )}

      <footer className="mt-10 text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
        USA CPMT • PharmaTrack v1.0
      </footer>
    </main>
  );
}