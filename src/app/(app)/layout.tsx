import { ChatDock } from "@/components/chat/ChatDock";
import { ChatDockProvider } from "@/components/chat/ChatDockProvider";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav, SideNav } from "@/components/layout/BottomNav";
import { NotificationPrompt } from "@/components/notifications/NotificationPrompt";
import { OverviewProvider } from "@/components/providers/OverviewProvider";

/**
 * The signed-in area waits for the account state (and the terms being accepted) before it
 * renders anything of the customer's, so its pages are deliberately not instant.
 */
export const instant = false;

/**
 * The app shell. It fills the viewport exactly (so nothing depends on how a browser measures
 * its toolbars) and adapts to the screen: a bottom bar on phones, a side rail on tablets, a
 * full sidebar on desktops. The page content is centred and grows with the space available.
 */
export default function AppLayout({ children }: LayoutProps<"/">): React.JSX.Element {
  return (
    <OverviewProvider>
      <ChatDockProvider>
        <div className="fixed inset-0 flex bg-background">
          <SideNav />
          <div className="flex min-w-0 flex-1 flex-col">
            <AppHeader />
            <main className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain">
              <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col md:max-w-3xl xl:max-w-6xl">
                {children}
              </div>
            </main>
            <BottomNav />
            <NotificationPrompt />
          </div>
        </div>
        <ChatDock />
      </ChatDockProvider>
    </OverviewProvider>
  );
}
