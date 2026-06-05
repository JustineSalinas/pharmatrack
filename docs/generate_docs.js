'use strict';
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, TabStopType,
} = require('docx');
const fs = require('fs');
const path = require('path');

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  deepIndigo : '1E1B4B',
  indigo     : '312E81',
  purple     : '4C1D95',
  violet     : '6D28D9',
  lavender   : 'C4B5FD',
  lightLav   : 'EDE9FE',
  superLight : 'F5F3FF',
  amber      : 'D97706',
  amberLight : 'FEF3C7',
  white      : 'FFFFFF',
  darkText   : '1F2937',
  gray       : '6B7280',
  borderGray : 'E5E7EB',
  lightGray  : 'F9FAFB',
  indigo200  : 'A5B4FC',
  indigo100  : 'E0E7FF',
};

// ── Page geometry (A4) ───────────────────────────────────────────────────────
const PW = 11906;  // page width DXA
const PH = 16838;  // page height DXA
const MG = 1440;   // 1-inch margin DXA
const CW = PW - MG * 2;  // content width = 9026

// ── Border presets ────────────────────────────────────────────────────────────
const nb = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NB = { top: nb, bottom: nb, left: nb, right: nb, insideH: nb, insideV: nb };
const thin = c => ({ style: BorderStyle.SINGLE, size: 1, color: c || C.borderGray });
const THIN = { top: thin(), bottom: thin(), left: thin(), right: thin() };
const leftAccent = c => ({
  top: nb, bottom: nb, right: nb,
  left: { style: BorderStyle.SINGLE, size: 12, color: c || C.violet },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function sp(before = 0, after = 200) {
  return { before, after };
}

/** Empty paragraph spacer */
function gap(before = 120, after = 0) {
  return new Paragraph({ spacing: { before, after }, children: [new TextRun({ text: '' })] });
}

function run(text, opts = {}) {
  return new TextRun({ text, font: 'Arial', size: opts.size || 20, color: opts.color || C.darkText,
    bold: opts.bold || false, italics: opts.italic || false, characterSpacing: opts.spacing });
}

function para(children, opts = {}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: sp(opts.before || 0, opts.after !== undefined ? opts.after : 160),
    border: opts.border,
    numbering: opts.numbering,
    tabStops: opts.tabStops,
    children,
  });
}

function body(text, opts = {}) {
  return para([run(text, { size: 20, color: opts.color || C.darkText, italic: opts.italic })],
    { before: opts.before || 0, after: opts.after !== undefined ? opts.after : 160 });
}

function bullet(text, opts = {}) {
  return para([run(text, { size: 20, bold: opts.bold })],
    { numbering: { reference: 'bullets', level: 0 }, before: 40, after: 40 });
}

/** Numbered section header: "01   TITLE" with violet bottom border */
function sectionHeader(num, title) {
  return new Paragraph({
    spacing: sp(480, 160),
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.violet, space: 4 } },
    children: [
      run(`${num}   `, { bold: true, size: 28, color: C.amber }),
      run(title.toUpperCase(), { bold: true, size: 28, color: C.deepIndigo }),
    ],
  });
}

function subHead(text) {
  return new Paragraph({
    spacing: sp(280, 100),
    children: [run(text, { bold: true, size: 22, color: C.purple })],
  });
}

/** Full-width single-column table with colored left border (callout box) */
function callout(text, opts = {}) {
  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: [CW],
    rows: [new TableRow({ children: [
      new TableCell({
        borders: leftAccent(opts.border || C.violet),
        shading: { fill: opts.bg || C.superLight, type: ShadingType.CLEAR },
        width: { size: CW, type: WidthType.DXA },
        margins: { top: 120, bottom: 120, left: 240, right: 240 },
        children: [para([run(text, { size: 20, color: C.deepIndigo, italic: true })])],
      }),
    ] })],
  });
}

/** Standard data table */
function dataTable(headers, rows, colWidths) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  const hRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      borders: THIN,
      width: { size: colWidths[i], type: WidthType.DXA },
      shading: { fill: C.lightLav, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 160, right: 160 },
      children: [para([run(h, { bold: true, size: 18, color: C.deepIndigo })])],
    })),
  });
  const dRows = rows.map((row, ri) => new TableRow({
    children: row.map((cell, ci) => new TableCell({
      borders: THIN,
      width: { size: colWidths[ci], type: WidthType.DXA },
      shading: { fill: ri % 2 === 0 ? C.white : C.superLight, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 160, right: 160 },
      children: [para([run(cell, { size: 18 })])],
    })),
  }));
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: colWidths, rows: [hRow, ...dRows] });
}

/** Step-list table with colored left number column */
function stepTable(steps, headerColor) {
  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: [900, CW - 900],
    rows: steps.map(([label, text]) => new TableRow({ children: [
      new TableCell({
        borders: NB,
        shading: { fill: headerColor, type: ShadingType.CLEAR },
        width: { size: 900, type: WidthType.DXA },
        verticalAlign: VerticalAlign.TOP,
        margins: { top: 120, bottom: 120, left: 80, right: 80 },
        children: [para([run(label, { bold: true, size: 18, color: C.amber })], { align: AlignmentType.CENTER })],
      }),
      new TableCell({
        borders: { top: nb, bottom: thin(C.borderGray), left: nb, right: nb },
        width: { size: CW - 900, type: WidthType.DXA },
        margins: { top: 120, bottom: 120, left: 200, right: 120 },
        children: [para([run(text, { size: 18 })])],
      }),
    ] })),
  });
}

/** Cover banner: big indigo block with title and caption */
function coverBanner(subtitle) {
  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: [CW],
    borders: NB,
    rows: [
      // top padding
      new TableRow({ children: [new TableCell({
        borders: NB, shading: { fill: C.deepIndigo, type: ShadingType.CLEAR },
        width: { size: CW, type: WidthType.DXA }, margins: { top: 720, bottom: 0, left: 360, right: 360 },
        children: [para([run('', { size: 4 })])],
      })] }),
      // PHARMATRACK
      new TableRow({ children: [new TableCell({
        borders: NB, shading: { fill: C.deepIndigo, type: ShadingType.CLEAR },
        width: { size: CW, type: WidthType.DXA }, margins: { top: 0, bottom: 0, left: 360, right: 360 },
        children: [para([run('PHARMATRACK', { bold: true, size: 80, color: C.amber, spacing: 120 })])],
      })] }),
      // subtitle
      new TableRow({ children: [new TableCell({
        borders: NB, shading: { fill: C.deepIndigo, type: ShadingType.CLEAR },
        width: { size: CW, type: WidthType.DXA }, margins: { top: 80, bottom: 0, left: 360, right: 360 },
        children: [para([run(subtitle, { size: 32, color: C.indigo100 })])],
      })] }),
      // caption
      new TableRow({ children: [new TableCell({
        borders: NB, shading: { fill: C.deepIndigo, type: ShadingType.CLEAR },
        width: { size: CW, type: WidthType.DXA }, margins: { top: 80, bottom: 0, left: 360, right: 360 },
        children: [para([run('University of San Agustín — College of Pharmacy', { size: 22, color: C.indigo200, italic: true })])],
      })] }),
      // bottom padding
      new TableRow({ children: [new TableCell({
        borders: NB, shading: { fill: C.deepIndigo, type: ShadingType.CLEAR },
        width: { size: CW, type: WidthType.DXA }, margins: { top: 0, bottom: 720, left: 360, right: 360 },
        children: [para([run('', { size: 4 })])],
      })] }),
    ],
  });
}

/** Cover metadata table */
function metaTable(rows) {
  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: [2400, CW - 2400],
    borders: { top: nb, bottom: nb, left: nb, right: nb, insideH: thin(C.borderGray), insideV: nb },
    rows: rows.map(r => new TableRow({ children: [
      new TableCell({
        borders: NB, shading: { fill: C.superLight, type: ShadingType.CLEAR },
        width: { size: 2400, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 160, right: 160 },
        children: [para([run(r.label, { size: 18, bold: true, color: C.gray })])],
      }),
      new TableCell({
        borders: NB, width: { size: CW - 2400, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 160, right: 160 },
        children: [para([run(r.value, { size: 18 })])],
      }),
    ] })),
  });
}

/** Header with right-aligned brand line */
function makeHeader(docTitle) {
  return new Header({ children: [
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.violet, space: 4 } },
      spacing: { after: 0 },
      tabStops: [{ type: TabStopType.RIGHT, position: CW }],
      children: [
        run('PHARMATRACK', { bold: true, size: 18, color: C.deepIndigo }),
        run(`   |   ${docTitle}`, { size: 18, color: C.gray }),
        run('\t', { size: 18 }),
        run('Cascade Development Group', { size: 18, color: C.gray }),
      ],
    }),
  ] });
}

function makeFooter() {
  return new Footer({ children: [
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.lightLav, space: 4 } },
      alignment: AlignmentType.CENTER,
      children: [
        run('Confidential — Cascade Development Group × USA College of Pharmacy   |   Page ', { size: 16, color: C.gray }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.gray, font: 'Arial' }),
      ],
    }),
  ] });
}

/** Signature block for two parties */
function sigBlock() {
  const half = Math.floor((CW - 300) / 2);
  function sigCell(name, role) {
    return new TableCell({
      borders: NB,
      shading: { fill: C.superLight, type: ShadingType.CLEAR },
      width: { size: half, type: WidthType.DXA },
      margins: { top: 160, bottom: 160, left: 240, right: 240 },
      children: [
        para([run(name, { bold: true, size: 20, color: C.deepIndigo })]),
        para([run(role, { size: 18, color: C.gray, italic: true })], { after: 0 }),
        new Paragraph({ spacing: sp(720, 80), border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.deepIndigo, space: 2 } }, children: [run('')] }),
        para([run('Authorized Signature', { size: 16, color: C.gray })]),
        new Paragraph({ spacing: sp(360, 80), border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.deepIndigo, space: 2 } }, children: [run('')] }),
        para([run('Name & Title', { size: 16, color: C.gray })]),
        new Paragraph({ spacing: sp(360, 80), border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.deepIndigo, space: 2 } }, children: [run('')] }),
        para([run('Date', { size: 16, color: C.gray })]),
      ],
    });
  }
  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: [half, 300, half],
    rows: [new TableRow({ children: [
      sigCell('CASCADE DEVELOPMENT GROUP', 'Technology Partner'),
      new TableCell({ borders: NB, width: { size: 300, type: WidthType.DXA }, children: [para([run('')])]}),
      sigCell('UNIVERSITY OF SAN AGUSTÍN', 'College of Pharmacy — Authorized Representative'),
    ] })],
  });
}

// ── NUMBERING CONFIG (shared) ────────────────────────────────────────────────
const NUMBERING = {
  config: [{
    reference: 'bullets',
    levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
  }],
};

const STYLES = {
  default: { document: { run: { font: 'Arial', size: 20, color: C.darkText } } },
};

const PAGE_PROPS = { size: { width: PW, height: PH }, margin: { top: MG, right: MG, bottom: MG, left: MG } };

// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENT 1 — Partnership Proposal & Service Agreement
// ══════════════════════════════════════════════════════════════════════════════
function buildProposal() {
  const cover = {
    properties: { page: PAGE_PROPS },
    children: [
      coverBanner('Partnership Proposal & Service Agreement'),
      gap(360),
      metaTable([
        { label: 'Prepared by',    value: 'Cascade Development Group' },
        { label: 'Prepared for',   value: 'University of San Agustín — College of Pharmacy' },
        { label: 'Date',           value: 'June 2025' },
        { label: 'Document Type',  value: 'Confidential — Partnership Agreement' },
        { label: 'Current URL',    value: 'https://v0-attendance-monitoring-web-app.vercel.app/' },
        { label: 'Future Domain',  value: 'pharmatrackph.com' },
      ]),
    ],
  };

  const content = {
    properties: { page: PAGE_PROPS },
    headers: { default: makeHeader('Partnership Proposal & Service Agreement') },
    footers: { default: makeFooter() },
    children: [

      // 01 — About This Partnership
      sectionHeader('01', 'About This Partnership'),
      gap(),
      body('We believe great technology is built on trust, not transactions. At Cascade Development Group, every project is a shared investment in the people it serves. PharmaTrack was not simply commissioned — it was designed collaboratively with the specific needs of the University of San Agustín College of Pharmacy at its core.'),
      gap(80),
      body('This document formalizes our partnership — outlining what has been built, what we are committing to as your ongoing technology partners, and the investment required to keep PharmaTrack running, improving, and growing alongside your department.'),
      gap(120),
      callout('PharmaTrack is not a product handoff. It is the foundation of a continuing partnership.', { bg: C.superLight, border: C.amber }),
      gap(240),

      // 02 — What We Built Together
      sectionHeader('02', 'What We Built Together'),
      gap(),
      body('PharmaTrack is an enterprise-grade attendance verification platform built exclusively for the USA College of Pharmacy. It replaces manual paper-based attendance with a secure, real-time digital system powered by QR code technology.'),
      gap(160),
      subHead('System Features'),
      gap(80),
      dataTable(
        ['Feature', 'Description'],
        [
          ['Secure QR Access Pass',     'Each student receives a permanent unique QR code tied to their student number, acting as a digital ID badge.'],
          ['Self Check-In Scan',         'Students scan dynamic session QR codes generated by facilitators to mark themselves present instantly.'],
          ['Facilitator Scanner Panel',  'Council members and instructors scan student QR passes via live webcam and export attendance records.'],
          ['Automated Attendance Status','The system categorizes arrivals as Present, Late, or Absent automatically per event-configured rules.'],
          ['Admin Control Panel',        'Superusers manage user approvals, configure global thresholds, and audit all system activity.'],
          ['Real-Time Analytics',        'Attendance ring charts, status counters, and upcoming event highlights on every dashboard.'],
          ['PDF / Excel Exports',        'Facilitators export filtered attendance records by event, student, or status at any time.'],
          ['Self-Profile Repair',        'Students with incomplete profiles can re-verify and regenerate their QR credentials inline.'],
        ],
        [2800, CW - 2800],
      ),
      gap(160),
      subHead('Technology & Infrastructure'),
      gap(80),
      dataTable(
        ['Component', 'Details'],
        [
          ['Frontend',        'Next.js (React) — deployed and hosted on Vercel'],
          ['Database & Auth', 'Supabase (PostgreSQL) with Row-Level Security'],
          ['QR Engine',       'Static & dynamic QR code generation with configurable expiry'],
          ['Current URL',     'https://v0-attendance-monitoring-web-app.vercel.app/'],
          ['Future Domain',   'pharmatrackph.com (USD 11.08/year — coordinated with your team)'],
        ],
        [2600, CW - 2600],
      ),
      gap(240),

      // 03 — Investment Summary
      sectionHeader('03', 'Investment Summary'),
      gap(),
      body('The following reflects the total investment for PharmaTrack — covering the complete system build and the ongoing partnership retainer that keeps it maintained, supported, and continuously improving.'),
      gap(160),
      dataTable(
        ['Item', 'Type', 'Amount'],
        [
          ['PharmaTrack System Build',           'One-time',         '₱25,000.00'],
          ['Monthly Partnership Retainer',        'Monthly (ongoing)', '₱5,000.00 / month'],
          ['Custom Domain (pharmatrackph.com)',   'Annual (optional)', 'USD 11.08 / year'],
        ],
        [4000, 2400, CW - 6400],
      ),
      gap(160),
      callout('The base investment of ₱25,000 covers the complete system as documented. The ₱5,000 monthly retainer secures your dedicated partnership support, maintenance, and continuous improvement.', { bg: C.amberLight, border: C.amber }),
      gap(240),

      // 04 — Retainer Coverage
      sectionHeader('04', 'Retainer Coverage — Your Ongoing Partnership'),
      gap(),
      body('The ₱5,000 monthly retainer is not a maintenance fee — it is your direct line to Cascade Development Group. Here is what every month includes:'),
      gap(160),
      dataTable(
        ['Benefit', 'Details'],
        [
          ['Priority Technical Support',     'Direct access to your dedicated developer. Response within 24 hours; same-day for critical system issues.'],
          ['System Maintenance & Monitoring','Proactive uptime, database health, and security monitoring. Issues resolved before they reach you.'],
          ['Bug Fixes',                      'All identified bugs resolved at no additional charge throughout the retainer period.'],
          ['Minor Enhancements',             'Small improvements within agreed scope included monthly at no extra cost.'],
          ['Monthly System Health Report',   'A summary of system activity, uptime record, and all improvements made that month.'],
          ['Roadmap Consultations',          'Monthly touchpoint to discuss upcoming needs, enhancements, or evolving requirements.'],
          ['User Management Assistance',     'Support with student and facilitator onboarding, QR resets, and account issues.'],
        ],
        [3000, CW - 3000],
      ),
      gap(240),

      // 05 — Payment Terms
      sectionHeader('05', 'Payment Terms'),
      gap(),
      dataTable(
        ['Term', 'Details'],
        [
          ['Base Investment',     '₱25,000.00 due upon signing of this agreement'],
          ['Retainer Start',      '₱5,000.00/month begins on the system go-live date'],
          ['Retainer Billing',    'Billed at the start of each calendar month'],
          ['Domain (if availed)', 'USD 11.08/year billed separately upon domain registration'],
          ['Payment Method',      'To be confirmed upon signing (GCash / Bank Transfer)'],
        ],
        [2800, CW - 2800],
      ),
      gap(240),

      // 06 — Partnership Commitments
      sectionHeader('06', 'Partnership Commitments'),
      gap(),
      subHead('Cascade Development Group commits to:'),
      bullet('Maintain PharmaTrack as a dedicated, high-availability system throughout the retainer period'),
      bullet('Provide timely, transparent communication on all system changes and updates'),
      bullet('Deliver monthly health reports and proactive improvement suggestions'),
      bullet('Treat all departmental data with the highest standard of care and confidentiality'),
      bullet('Be a responsive, accountable partner — not just a service provider'),
      gap(160),
      subHead('University of San Agustín — College of Pharmacy commits to:'),
      bullet('Designate at least one system administrator from the department'),
      bullet('Provide timely feedback on system behavior, issues, or change requests'),
      bullet('Ensure student enrollment data accuracy for QR registration'),
      bullet('Honor the agreed payment schedule to maintain uninterrupted service'),
      gap(240),

      // 07 — Signatures
      sectionHeader('07', 'Acceptance & Signatures'),
      gap(),
      body('By signing below, both parties agree to the terms of this Partnership Proposal and Service Agreement and commit to the responsibilities outlined herein.'),
      gap(240),
      sigBlock(),
    ],
  };

  return new Document({ numbering: NUMBERING, styles: STYLES, sections: [cover, content] });
}

// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENT 2 — Partnership Welcome & Deployment Brief
// ══════════════════════════════════════════════════════════════════════════════
function buildWelcome() {
  const cover = {
    properties: { page: PAGE_PROPS },
    children: [
      coverBanner('Partnership Welcome & Deployment Brief'),
      gap(360),
      metaTable([
        { label: 'Prepared by',    value: 'Cascade Development Group' },
        { label: 'Prepared for',   value: 'University of San Agustín — College of Pharmacy' },
        { label: 'Date',           value: 'June 2025' },
        { label: 'Document Type',  value: 'Confidential — Partnership Brief' },
        { label: 'Current URL',    value: 'https://v0-attendance-monitoring-web-app.vercel.app/' },
        { label: 'Future Domain',  value: 'pharmatrackph.com' },
      ]),
    ],
  };

  const content = {
    properties: { page: PAGE_PROPS },
    headers: { default: makeHeader('Partnership Welcome & Deployment Brief') },
    footers: { default: makeFooter() },
    children: [

      // 01 — Letter
      sectionHeader('01', 'A Letter from Your Technology Partner'),
      gap(),
      body('To the University of San Agustín College of Pharmacy,'),
      gap(120),
      body('Welcome to PharmaTrack.'),
      gap(120),
      body('What started as a conversation about improving attendance management has grown into something we are genuinely proud of. PharmaTrack was not designed as a generic tool — it was built around the specific rhythms, roles, and realities of your department.'),
      gap(80),
      body('We built it with three things in mind: simplicity for your students, reliability for your facilitators, and control for your administrators. Every decision — from QR pass design to attendance logging rules — was made with your team in mind.'),
      gap(80),
      body('This brief is your guide to everything PharmaTrack — how to access it, how each role interacts with it, and how we stay by your side as it grows.'),
      gap(120),
      body('We are not handing this off. We are handing this over to you — together.', { italic: true, color: C.purple }),
      gap(120),
      body('Warmly,'),
      body('Cascade Development Group', { color: C.deepIndigo }),
      gap(240),

      // 02 — At a Glance
      sectionHeader('02', 'PharmaTrack at a Glance'),
      gap(),
      dataTable(
        ['Detail', 'Information'],
        [
          ['System Name',   'PharmaTrack — Unified Attendance Management & Verification System'],
          ['Built For',     'University of San Agustín — College of Pharmacy'],
          ['Built By',      'Cascade Development Group'],
          ['Technology',    'Next.js (React), Supabase (PostgreSQL), hosted on Vercel'],
          ['Current URL',   'https://v0-attendance-monitoring-web-app.vercel.app/'],
          ['Future Domain', 'pharmatrackph.com (migration coordinated with your team)'],
          ['User Roles',    'System Administrator • Facilitator (Council & Instructor) • Student'],
        ],
        [2800, CW - 2800],
      ),
      gap(240),

      // 03 — Roles
      sectionHeader('03', 'Your Team & Roles'),
      gap(),
      body('PharmaTrack is designed around three distinct roles. Each has their own dashboard, permissions, and responsibilities within the system.'),
      gap(160),
      dataTable(
        ['Role', 'Who', 'Core Capabilities'],
        [
          ['System Administrator', 'Designated dept. admin officer', 'User approvals & rejections, global settings (late thresholds, registration mode), full audit logs and system oversight'],
          ['Facilitator',          'Council officers & instructors',  'Event scheduling, QR session generation, live webcam scanner for attendance recording, student roster management, PDF/Excel exports'],
          ['Student',              'Enrolled Pharmacy students',      'QR access pass, self check-in scanning, attendance history & standing, upcoming event calendar'],
        ],
        [2000, 2200, CW - 4200],
      ),
      gap(240),

      // 04 — Getting Started
      sectionHeader('04', 'Getting Started'),
      gap(),

      subHead('04A — For System Administrators'),
      gap(80),
      body('The System Administrator is the foundation of PharmaTrack. Here is how to get started:'),
      gap(80),
      stepTable([
        ['Step 1', 'Log in at the PharmaTrack URL using your administrator credentials.'],
        ['Step 2', 'Navigate to the Registration Logs panel to review pending student and facilitator accounts.'],
        ['Step 3', 'Approve registered users to grant them system access, or reject invalid registrations with a note.'],
        ['Step 4', 'Configure global settings: set the default late threshold (in minutes) and toggle registration mode (open or invite-only).'],
        ['Step 5', 'Periodically audit the event log and attendance records to ensure data integrity across the department.'],
        ['Step 6', 'Contact Cascade Development Group directly for any system-level changes, credential resets, or support requests.'],
      ], C.deepIndigo),
      gap(240),

      subHead('04B — For Facilitators'),
      gap(80),
      body('Facilitators are the primary operators of PharmaTrack on the ground. Two check-in flows are available per event:'),
      gap(80),
      stepTable([
        ['Step 1',   'Log in to the Facilitator Panel using your approved credentials.'],
        ['Step 2',   'Go to Events and create a new event. Set the name, location, check-in start time, late threshold, and check-in end time.'],
        ['Step 3A',  '(Static Flow) Click “Scan Student” to launch the live webcam scanner. Ask the student to open their full-screen QR pass and present it for scanning.'],
        ['Step 3B',  '(Dynamic Flow) Click “Generate QR Session” to create a timed QR code (expires in 10 minutes). Display it on screen so students can self-scan with their own devices.'],
        ['Step 4',   'Monitor the live attendance list as students check in. Filter by status (Present, Late, Absent) in real time.'],
        ['Step 5',   'Export the event’s attendance report as PDF or Excel for records or departmental submission.'],
      ], C.purple),
      gap(240),

      subHead('04C — For Students'),
      gap(80),
      body('Students interact with PharmaTrack to manage their attendance with minimal friction:'),
      gap(80),
      stepTable([
        ['Step 1', 'Visit the PharmaTrack URL and register using your student number and university email.'],
        ['Step 2', 'Wait for an administrator to approve your account. You will be able to log in once approved.'],
        ['Step 3', 'From your Student Dashboard, your unique QR Access Pass is automatically generated and ready.'],
        ['Step 4A','(Facilitator scans you) Tap “Check In” → your QR pass opens full-screen at high brightness. Present it to your facilitator or council member for scanning.'],
        ['Step 4B','(You scan a session) Tap “Go to Scanner” → scan the facilitator’s displayed session QR code using your device camera.'],
        ['Step 5', 'Track your attendance history, present/late/absent totals, and upcoming events from your dashboard at any time.'],
      ], C.violet),
      gap(240),

      // 05 — How Attendance Works
      sectionHeader('05', 'How Attendance Works'),
      gap(),
      body('Each event is configured with three time markers. The system maps arrival timestamps to attendance status automatically:'),
      gap(160),
      dataTable(
        ['Status', 'Rule', 'Meaning'],
        [
          ['PRESENT', 'Check-in Starts ≤ Arrival < Mark Late At', 'Student arrived on time within the check-in window'],
          ['LATE',    'Mark Late At ≤ Arrival < Check-in Ends',   'Student arrived after the grace period but before close'],
          ['ABSENT',  'Arrival ≥ Check-in Ends OR No Scan Record','Student did not check in within the event window'],
        ],
        [1600, 4000, CW - 5600],
      ),
      gap(160),
      callout('All status assignments are handled automatically. Facilitators only need to configure event times once — PharmaTrack does the rest.', { bg: C.superLight, border: C.violet }),
      gap(240),

      // 06 — Support
      sectionHeader('06', 'Support & Your Retainer'),
      gap(),
      body('As your technology partners, Cascade Development Group is always available. Here is how to reach us and what your ₱5,000 monthly retainer covers:'),
      gap(160),
      dataTable(
        ['Support Type', 'Coverage'],
        [
          ['Dedicated Contact',          'Direct access to your Cascade Development Group developer at all times'],
          ['Critical Issues',            'Same-day response for system outages, data errors, or security concerns'],
          ['General Support',            '24-hour response for non-urgent questions, requests, or minor fixes'],
          ['Bug Fixes',                  'All identified bugs resolved under the retainer at no additional charge'],
          ['Minor Enhancements',         'Small improvements within agreed scope delivered monthly'],
          ['Monthly Health Report',      'System activity summary, uptime record, and improvement log every month'],
          ['Roadmap Check-In',           'Monthly consultation on upcoming features or evolving departmental needs'],
          ['User Management Assistance', 'QR credential resets, account issues, and enrollment onboarding support'],
        ],
        [3200, CW - 3200],
      ),
      gap(160),
      callout('Your ₱5,000/month retainer keeps PharmaTrack healthy, evolving, and always in capable hands. It is the commitment that turns a software delivery into a lasting partnership.', { bg: C.amberLight, border: C.amber }),
      gap(240),

      // 07 — System Access
      sectionHeader('07', 'System Access & Resources'),
      gap(),
      dataTable(
        ['Resource', 'Details'],
        [
          ['Current System URL',   'https://v0-attendance-monitoring-web-app.vercel.app/'],
          ['Future Domain',        'pharmatrackph.com — migration to be coordinated with your team'],
          ['Admin Credentials',    'To be provided to the designated administrator separately and securely'],
          ['Technical Partner',    'Cascade Development Group — ajsalinas005@gmail.com'],
          ['Support Channel',      'Direct message / email — details confirmed upon go-live'],
        ],
        [3000, CW - 3000],
      ),
      gap(240),
      callout('This document is confidential and intended solely for the University of San Agustín College of Pharmacy and Cascade Development Group.', { bg: C.superLight, border: C.borderGray }),
    ],
  };

  return new Document({ numbering: NUMBERING, styles: STYLES, sections: [cover, content] });
}

// ── Write both files ─────────────────────────────────────────────────────────
const OUT = __dirname;

Promise.all([
  Packer.toBuffer(buildProposal()).then(buf => {
    const p = path.join(OUT, 'PharmaTrack_Partnership_Proposal.docx');
    fs.writeFileSync(p, buf);
    console.log('Created:', p);
  }),
  Packer.toBuffer(buildWelcome()).then(buf => {
    const p = path.join(OUT, 'PharmaTrack_Welcome_Brief.docx');
    fs.writeFileSync(p, buf);
    console.log('Created:', p);
  }),
]).catch(err => { console.error(err); process.exit(1); });
