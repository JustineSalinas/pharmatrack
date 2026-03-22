import Sidebar from "@/components/Sidebar";

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dash-layout">
      <Sidebar
        role="faculty"
        userName="Dr. Maria Reyes"
        userSub="Faculty · Pharmacology"
        avatarInitials="DR"
      />
      <main className="main-content page-enter">{children}</main>
    </div>
  );
}
