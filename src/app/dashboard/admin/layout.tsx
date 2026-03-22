import Sidebar from "@/components/Sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dash-layout">
      <Sidebar
        role="admin"
        userName="Administrator"
        userSub="System Admin"
        avatarInitials="A"
      />
      <main className="main-content page-enter">{children}</main>
    </div>
  );
}
