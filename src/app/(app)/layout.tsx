import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { OverviewProvider } from "@/components/providers/OverviewProvider";

export default function AppLayout({ children }: LayoutProps<"/">): React.JSX.Element {
  return (
    <OverviewProvider>
      <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-background">
        <AppHeader />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
        <BottomNav />
      </div>
    </OverviewProvider>
  );
}
