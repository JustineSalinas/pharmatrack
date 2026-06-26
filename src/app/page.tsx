"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function AuthErrorRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const errorCode = searchParams.get("error_code")
      || new URLSearchParams(window.location.hash.slice(1)).get("error_code");
    if (errorCode === "otp_expired") {
      router.replace("/forgot-password?expired=true");
    }
  }, [searchParams, router]);
  return null;
}

export default function LandingPage() {
  return (
    <>
      <Suspense fallback={null}><AuthErrorRedirect /></Suspense>
    <div className="page-wrapper">
      {/* ANIMATED BACKGROUND */}
      <div className="animated-bg">
        <div className="hero-watermark"></div>
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
        <div className="hero-dark-spot"></div>
      </div>

      <div className="landing page-enter">
        {/* NAV */}
        <nav className="land-nav fade-in">
          <div className="logo-row">
            <img src="/pham-logo.png" alt="Pharmacy Logo" style={{ height: "46px", width: "auto", objectFit: "contain", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }} />
            <span style={{ fontWeight: "800", letterSpacing: "1px" }}>PHARMATRACK</span>
          </div>
          <div className="nav-btns">
            <Link href="/login" className="btn btn-outline" style={{ width: "auto", padding: "9px 30px" }}>Log In</Link>
            <Link href="/register" className="btn btn-gold" style={{ width: "auto", padding: "9px 30px" }}>Sign Up</Link>
          </div>
        </nav>

        {/* HERO */}
        <section className="hero fade-in delay-1" style={{ paddingTop: "6vh" }}>
          <div className="hero-badge">University of San Agustin — Pharmacy Dept.</div>

          <h1 className="hero-title">PHARMA<span className="hero-title-accent">TRACK</span></h1>
          <h2 className="attendance-title">QR Attendance, done right.</h2>

          <p style={{ maxWidth: "480px", margin: "0 auto 40px", fontSize: "0.98rem", color: "rgba(255,255,255,0.72)", lineHeight: "1.8" }}>
            No clipboards, no manual rollcalls. Students scan in seconds — facilitators see who's present, late, or absent in real time.
          </p>

          <div className="hero-cta">
            <Link href="/register" className="btn btn-gold pulse-btn" style={{ padding: "18px 48px", fontSize: "1.1rem" }}>
              Create Student Account
            </Link>
            <Link href="/login" className="btn btn-outline" style={{ padding: "18px 48px", fontSize: "1.1rem" }}>
              Log In
            </Link>
          </div>

          <div className="hero-status-strip">
            <span className="hss-dot" />
            <span className="hss-item"><strong>800+</strong> Students</span>
            <span className="hss-sep">·</span>
            <span className="hss-item"><strong>&lt;1s</strong> Scan Time</span>
            <span className="hss-sep">·</span>
            <span className="hss-item">Live Dashboard</span>
          </div>

          {/* SCROLL INDICATOR */}
          <div className="scroll-indicator fade-in delay-2">
            <div 
              className="scroll-circle" 
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 13l5 5 5-5M7 6l5 5 5-5"/>
              </svg>
            </div>
          </div>
        </section>

        {/* CARDS */}
        <div id="how-it-works" className="cards-row fade-in delay-3">
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
                  step: "REGISTER",
                  desc: "Sign up with your USA student ID to get your personal QR code.",
                  hClass: "static-color-register"
                },
                {
                  icon: (
                    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                    </svg>
                  ),
                  step: "SCAN",
                  desc: "Present your QR at any event — logged in under a second.",
                  hClass: "static-color-scan"
                },
                {
                  icon: (
                    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/>
                    </svg>
                  ),
                  step: "TRACK",
                  desc: "See your full attendance history and event reports instantly.",
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
          
          <div id="key-features" className="card">
            <h3>Key Features</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                {
                  icon: (
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  ),
                  title: "Automated Reporting",
                  desc: "Export per-event and per-student reports for 800+ students in one click.",
                  hClass: "static-color-auto"
                },
                {
                  icon: (
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  ),
                  title: "Real-time Dashboard",
                  desc: "Facilitators see live scan data the moment a QR is read — no refresh needed.",
                  hClass: "static-color-live"
                },
                {
                  icon: (
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                  ),
                  title: "Tamper-proof Records",
                  desc: "Each scan is tied to a unique student QR — no buddy-punching, no manual errors.",
                  hClass: "static-color-exact"
                },
              ].map((f) => (
                <div className={`feat-item ${f.hClass}`} key={f.title}>
                  <div className="feat-icon">{f.icon}</div>
                  <div><h4>{f.title}</h4><p>{f.desc}</p></div>
                </div>
              ))}
            </div>
          </div>

          <div id="secure-verification" className="card qr-mockup-card">
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
              <p className="qr-sub">Your student QR is unique and permanent. Show it, get scanned, done — no app required.</p>
            </div>
          </div>
        </div>

        <footer className="land-footer">
          <span className="land-footer-brand">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
              <rect x="6" y="6" width="1" height="1"></rect>
              <rect x="17" y="6" width="1" height="1"></rect>
              <rect x="17" y="17" width="1" height="1"></rect>
              <rect x="6" y="17" width="1" height="1"></rect>
            </svg>
            USA — Attendance System
          </span>
          <span className="land-footer-copy">© 2026 University of San Agustin · Pharmacy Department. All rights reserved.</span>
        </footer>
      </div>
    </div>
    </>
  );
}
