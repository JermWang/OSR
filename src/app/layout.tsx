import type { Metadata, Viewport } from 'next';
import './globals.css';
import WalletContext from '@/components/providers/WalletContext';

export const metadata: Metadata = {
  title: 'OSR — Oil Strategic Reserve',
  description:
    'Deploy oil rigs and mining shafts, equip rarity components, open crates, and compound your operation on Solana devnet.',
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
        <WalletContext>{children}</WalletContext>
      </body>
    </html>
  );
}
