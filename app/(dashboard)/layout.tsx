import { DashboardNav } from "@/components/dashboard-nav";
import { SiteFooter } from "@/components/site-footer";
import { ContextMenuGuard } from "@/components/context-menu-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DashboardNav />
      <ContextMenuGuard>
        <main className="mx-auto max-w-6xl flex-1 px-4 py-8">{children}</main>
        <SiteFooter />
      </ContextMenuGuard>
    </>
  );
}
