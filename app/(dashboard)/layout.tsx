import { DashboardNav } from "@/components/dashboard-nav";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { SiteFooter } from "@/components/site-footer";
import { ContextMenuGuard } from "@/components/context-menu-guard";
import { ToastProvider } from "@/components/toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <DashboardNav />
      <ContextMenuGuard>
        <main className="mx-auto max-w-6xl flex-1 px-4 py-6 pb-24 md:py-8 md:pb-8">
          {children}
        </main>
        <SiteFooter className="hidden md:block" />
        <MobileBottomNav />
      </ContextMenuGuard>
    </ToastProvider>
  );
}
