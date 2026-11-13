import { BottomNav } from "@/components/layout/BottomNav";

export default function AppLayout({ children }: LayoutProps<"/">): React.JSX.Element {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-background">
      <header className="shrink-0 bg-brand px-4 pt-[env(safe-area-inset-top)] text-on-brand">
        <div className="flex items-center justify-between py-3">
          <span className="text-base font-semibold tracking-tight">FinSight-AI</span>
          <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-on-primary">
            Synthetic demo data
          </span>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
      <BottomNav />
    </div>
  );
}
