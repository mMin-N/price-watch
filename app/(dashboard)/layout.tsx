import { DashboardNav } from "@/components/dashboard-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
