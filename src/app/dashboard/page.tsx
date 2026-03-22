import Link from "next/link";

export default function Dashboard() {
  return (
    <div className="fade-in" style={{ minHeight: "100vh", paddingBottom: "40px" }}>
      {/* Dashboard Sticky Nav */}
      <nav className="land-nav" style={{ maxWidth: "1200px", margin: "0 auto", top: "20px" }}>
        <div className="logo-row">
          <img src="/usa.png" alt="USA Logo" style={{ height: "46px", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }} />
          <span>PORTAL</span>
        </div>
        <div className="nav-btns">
          <span style={{ color: "var(--muted)", marginRight: "20px", display: "flex", alignItems: "center" }}>
            Juan Dela Cruz (Student)
          </span>
          <Link href="/" className="btn btn-outline" style={{ padding: "8px 16px" }}>Sign Out</Link>
        </div>
      </nav>

      {/* Dashboard Content */}
      <div style={{ maxWidth: "1200px", margin: "60px auto 0", padding: "0 20px" }}>
        <h2 style={{ fontSize: "2.5rem", color: "var(--white)", marginBottom: "40px" }}>
          Welcome back, <span style={{ color: "var(--gold)" }}>Juan</span>
        </h2>
        
        <div className="cards-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          
          {/* Stat Card */}
          <div className="card" style={{ alignItems: "center", textAlign: "center", justifyContent: "center" }}>
             <h3 style={{ fontSize: "1.4rem", color: "var(--muted)" }}>Classes Attended</h3>
             <div style={{ fontSize: "4rem", color: "var(--success)", fontWeight: "800", fontFamily: "Montserrat, sans-serif" }}>42</div>
             <p style={{ color: "var(--success)", marginTop: "10px" }}>↑ 100% Perfect Attendance</p>
          </div>
          
          {/* Action Card */}
          <div className="card" style={{ border: "2px dashed var(--gold)", alignItems: "center", textAlign: "center", background: "linear-gradient(180deg, rgba(232, 200, 74, 0.05), transparent)" }}>
             <h3 style={{ fontSize: "1.4rem", color: "var(--gold)" }}>Log Attendance</h3>
             <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "20px 0" }}>
               <rect x="3" y="3" width="7" height="7"></rect>
               <rect x="14" y="3" width="7" height="7"></rect>
               <rect x="14" y="14" width="7" height="7"></rect>
               <rect x="3" y="14" width="7" height="7"></rect>
             </svg>
             <button className="btn btn-gold pulse-btn" style={{ padding: "14px 28px", width: "100%" }}>Open QR Scanner</button>
          </div>
          
          {/* Recent Activity Card */}
          <div className="card" style={{ justifyContent: "center" }}>
             <h3 style={{ fontSize: "1.4rem", color: "var(--muted)", textAlign: "center", marginBottom: "20px" }}>Recent Activity</h3>
             <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
               <div style={{ padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", borderLeft: "4px solid var(--success)" }}>
                 <strong style={{ display: "block", color: "var(--white)" }}>Pharmacology 101</strong>
                 <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Today, 9:00 AM • Logged via Scanner</span>
               </div>
               <div style={{ padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", borderLeft: "4px solid var(--success)" }}>
                 <strong style={{ display: "block", color: "var(--white)" }}>Organic Chemistry</strong>
                 <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Yesterday, 1:30 PM • Logged manually</span>
               </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
