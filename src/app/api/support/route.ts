export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getBackendUser } from "@/lib/auth";
import { getTransporter, renderEmailShell, renderDetailsPanel } from "@/lib/email";

const SUPPORT_EMAIL = "cdg.solutionsph@gmail.com";

export async function POST(req: NextRequest) {
  const user = await getBackendUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { category, description, userName, userRole } = await req.json();

  if (!description?.trim()) {
    return NextResponse.json({ error: "Description is required." }, { status: 400 });
  }

  const transporter = getTransporter();
  if (!transporter) {
    return NextResponse.json({ error: "Email service is not configured." }, { status: 503 });
  }

  const subject = `PharmaTrack Support: ${category || "General"} — ${userName}`;

  const bodyHtml = `
    <p>A support request has been submitted via the PharmaTrack portal.</p>
    ${renderDetailsPanel([
      { label: "Name", value: userName || "Unknown" },
      { label: "Role", value: userRole || "Unknown" },
      { label: "Email", value: user.email || "Unknown" },
      { label: "Category", value: category || "Not specified" },
    ])}
    <p style="font-weight: bold; margin-bottom: 6px;">Description</p>
    <div style="background: #f7f7f9; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">
      ${description.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}
    </div>
  `;

  const html = renderEmailShell({ eyebrow: "Support Request", bodyHtml });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "PharmaTrack <notifications@usa.edu.ph>",
    to: SUPPORT_EMAIL,
    replyTo: user.email,
    subject,
    html,
  });

  return NextResponse.json({ ok: true });
}
