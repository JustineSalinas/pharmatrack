export default function FacilitatorLayout({ children }: { children: React.ReactNode }) {
  // Let the root dashboard/layout.tsx handle the Sidebar and auth
  return <>{children}</>;
}
