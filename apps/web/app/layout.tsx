import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RepositoryProvider } from '../lib/db/RepositoryProvider';
import { TabBar } from '../components/TabBar';
import { Sidebar } from '../components/Sidebar';
import { SyncIndicator } from '../components/SyncIndicator';

export const metadata: Metadata = {
  title: 'Training for Climbing',
  description: 'Your personal climbing training companion — assess, plan, train, and track.',
  applicationName: 'Training for Climbing',
  appleWebApp: {
    capable: true,
    title: 'Climbing',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f1115',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RepositoryProvider>
          <div className="flex min-h-dvh">
            <Sidebar />
            <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
              {/*
              Installed on iOS, `viewport-fit=cover` plus the black-translucent
              status bar puts the web view *behind* the clock and battery, so
              content starts under them. The inset goes here rather than on the
              flex column so it doesn't fight `min-h-dvh`, and rather than on
              each Screen so the background still bleeds to the top edge. The
              TabBar already does the same for the home indicator.
            */}
              <main className="mx-auto w-full max-w-2xl flex-1 pt-[env(safe-area-inset-top)]">
                {children}
              </main>
              <TabBar />
            </div>
          </div>
          <SyncIndicator />
        </RepositoryProvider>
      </body>
    </html>
  );
}
