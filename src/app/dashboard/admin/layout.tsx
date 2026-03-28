export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // We remove the nested dash-layout and Sidebar here so it relies on the root dashboard/layout.tsx
  return <>{children}</>;
}
