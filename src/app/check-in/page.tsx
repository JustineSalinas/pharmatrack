"use client";
import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Loader2, QrCode } from "lucide-react";

export default function CheckInPage() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchQR() {
      try {
        const u = await getCurrentUser();
        if (!u) {
          router.push("/login");
          return;
        }

        if (u.account_type === "admin") {
          router.push("/dashboard/admin");
          return;
        }

        const profile = u.student_profiles?.[0];
        if (profile?.qr_code_id) {
          setQrCode(profile.qr_code_id);
        } else {
          // fetch directly if not populated
          const { data } = await supabase
            .from("student_profiles")
            .select("qr_code_id")
            .eq("user_id", u.id)
            .single();
          if (data) setQrCode(data.qr_code_id);
        }
      } catch (err) {
        console.error("Failed to load QR code", err);
      } finally {
        setLoading(false);
      }
    }
    fetchQR();
  }, [router]);

  return (
    <div className="page-enter fade-in" style={{ padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <h2 style={{ fontSize: "2rem", color: "var(--gold)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "10px", justifyContent: "center" }}>
          <QrCode size={32} /> Code Presenter
        </h2>
        <p style={{ color: "var(--muted)", maxWidth: "400px", margin: "0 auto", lineHeight: 1.6 }}>
          Present this unique QR Code to a Council Administrator to register your attendance for any active event.
        </p>
      </div>

      <div className="card" style={{ padding: "40px", background: "var(--surface)", border: "1px solid var(--gold)", textAlign: "center", borderRadius: "24px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
        {loading ? (
          <div style={{ padding: "80px", display: "flex", justifyContent: "center" }}>
            <Loader2 className="animate-spin" size={48} color="var(--gold)" />
          </div>
        ) : qrCode ? (
          <div style={{ background: "white", padding: "20px", borderRadius: "16px", display: "inline-block" }}>
            <QRCodeSVG 
              value={qrCode} 
              size={240}
              level="H"
              includeMargin={false}
            />
          </div>
        ) : (
          <div style={{ padding: "60px", color: "var(--danger)" }}>
            QR Code could not be found. Please contact support.
          </div>
        )}
        
        {qrCode && (
          <div style={{ marginTop: "24px", fontFamily: "monospace", fontSize: "1.2rem", letterSpacing: "2px", color: "var(--gold)" }}>
            {qrCode}
          </div>
        )}
      </div>
      
      <style jsx>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
