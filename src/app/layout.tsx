import type { Metadata, Viewport } from 'next';
import './globals.css';
import PrivyAppProvider from '@/components/providers/PrivyAppProvider';

export const metadata: Metadata = {
  title: 'OSR — Oil Strategic Reserve',
  description:
    'Deploy oil rigs and mining shafts, equip rarity components, open crates, and compound your operation on Robinhood Chain.',
  icons: { icon: '/logo.jpg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b0e14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <PrivyAppProvider>{children}</PrivyAppProvider>
      </body>
    </html>
  );
}
