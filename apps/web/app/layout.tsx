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
              <main className="mx-auto w-full max-w-2xl flex-1">{children}</main>
              <TabBar />
            </div>
          </div>
          <SyncIndicator />
        </RepositoryProvider>
      </body>
    </html>
  );
}
