"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const Typewriter = () => {
  const [text, setText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(100);

  const phrases = [
    "\"Maayong adlaw, future Pharmacists!\"",
    "\"Malipayon nga pag-abot sa PharmaTrack!\"",
    "\"Padayon, mga Augustinians!\""
  ];

  useEffect(() => {
    let timer = setTimeout(() => {
      handleType();
    }, typingSpeed);
    return () => clearTimeout(timer);
  }, [text, isDeleting, typingSpeed]);

  const handleType = () => {
    const i = loopNum % phrases.length;
    const fullText = phrases[i];

    setText(isDeleting ? fullText.substring(0, text.length - 1) : fullText.substring(0, text.length + 1));

    setTypingSpeed(isDeleting ? 40 : 80);

    if (!isDeleting && text === fullText) {
      setTimeout(() => setIsDeleting(true), 2500);
      setTypingSpeed(2500);
    } else if (isDeleting && text === "") {
      setIsDeleting(false);
      setLoopNum(loopNum + 1);
      setTypingSpeed(500);
    }
  };

  return (
    <div className="typewriter-container">
      <span className="typewriter-text">{text}</span>
      <span className="cursor">|</span>
    </div>
  );
};

export default function LandingPage() {
  return (
    <>
      {/* ANIMATED BACKGROUND */}
      <div className="animated-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
        <div className="hero-dark-spot"></div>
      </div>

      <div className="landing page-enter">
        {/* NAV */}
        <nav className="land-nav fade-in">
          <div className="logo-row">
            <img src="/pham-logo.png" alt="Pharmacy Logo" style={{ height: "40px", width: "auto", objectFit: "contain" }} />
            <span style={{ fontWeight: "800", letterSpacing: "1px" }}>PHARMATRACK</span>
          </div>
          <div className="nav-btns">
            <Link href="/login" className="btn btn-gold pulse-btn">Log In</Link>
            <Link href="/register" className="btn btn-outline">Sign Up</Link>
          </div>
        </nav>

        {/* HERO */}
        <section className="hero fade-in delay-1" style={{ paddingTop: "12vh" }}>
          <div className="hero-badge">Official Pharmacy Attendance Management System</div>
          
          <h1 className="hero-title">PHARMATRACK</h1>
          <h2 className="attendance-title">Professional Attendance Monitoring</h2>
          
          <div style={{ minHeight: "60px", marginBottom: "30px" }}>
            <Typewriter />
          </div>

          <p style={{ maxWidth: "600px", margin: "0 auto 40px", fontSize: "1.1rem", color: "var(--white-shade)", lineHeight: "1.6" }}>
            Seamlessly track student and faculty attendance with high-precision QR scanning and real-time dashboard analytics.
          </p>

          <div className="hero-cta">
            <Link href="/login" className="btn btn-gold pulse-btn" style={{ padding: "18px 48px", fontSize: "1.1rem" }}>
              Get Started Now
            </Link>
            <Link href="/register" className="btn btn-outline" style={{ padding: "18px 48px", fontSize: "1.1rem" }}>
              Create Account
            </Link>
          </div>
        </section>

      {/* SCROLL INDICATOR */}
      <div className="scroll-indicator fade-in delay-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="bounce">
          <path d="M12 5v14M19 12l-7 7-7-7"/>
        </svg>
      </div>

      {/* CARDS */}
      <div className="cards-row fade-in delay-3">
        <div className="card how-it-works-card">
          <h3 className="section-title">How PharmaTrack System works</h3>
          <div className="steps-row">
            {[
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                ),
                step: "1. REGISTER",
                desc: "Create your profile with official credentials.",
                hClass: "static-color-register"
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                  </svg>
                ),
                step: "2. SCAN",
                desc: "Scan a secure QR code to mark your presence.",
                hClass: "static-color-scan"
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/>
                  </svg>
                ),
                step: "3. TRACK",
                desc: "View real-time attendance history and trends.",
                hClass: "static-color-track"
              },
            ].map((s) => (
              <div className={`step-col ${s.hClass}`} key={s.step}>
                <div className="step-icon-box">
                  {s.icon}
                </div>
                <strong>{s.step}</strong>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Key Features</h3>
          {[
            { 
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              ), 
              title: "Automated Reporting", 
              desc: "Generate ready-to-use analysis.",
              hClass: "static-color-auto"
            },
            { 
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              ), 
              title: "Real-time Data", 
              desc: "Up-to-the-minute tracking.",
              hClass: "static-color-live"
            },
            { 
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
              ), 
              title: "Precision and Accuracy", 
              desc: "Error-free records.",
              hClass: "static-color-exact"
            },
          ].map((f) => (
            <div className={`feat-item ${f.hClass}`} key={f.title}>
              <div className="feat-icon">{f.icon}</div>
              <div><h4>{f.title}</h4><p>{f.desc}</p></div>
            </div>
          ))}
        </div>

        {/* CUSTOM QR SCANNER MOCKUP */}
        <div className="card qr-mockup-card">
          <div className="qr-scanner-frame">
            <div className="qr-scan-line"></div>
            <svg xmlns="http://www.w3.org/2000/svg" className="qr-code-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
              <rect x="6" y="6" width="1" height="1"></rect>
              <rect x="17" y="6" width="1" height="1"></rect>
              <rect x="17" y="17" width="1" height="1"></rect>
              <rect x="6" y="17" width="1" height="1"></rect>
            </svg>
          </div>
          <div className="qr-info">
            <h3 className="qr-text">Secure Verification</h3>
            <p className="qr-sub">Scan your official USA ID to instantly log your attendance with absolute precision.</p>
          </div>
        </div>
      </div>

      <footer className="land-footer">
        <span style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "600", color: "var(--white)" }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
            <rect x="6" y="6" width="1" height="1"></rect>
            <rect x="17" y="6" width="1" height="1"></rect>
            <rect x="17" y="17" width="1" height="1"></rect>
            <rect x="6" y="17" width="1" height="1"></rect>
          </svg>
          USA - Attendance System
        </span>
        <span>© 2026 University of San Agustin - Pharmacy Department. All rights reserved.</span>
      </footer>
    </div>
    </>
  );
}
