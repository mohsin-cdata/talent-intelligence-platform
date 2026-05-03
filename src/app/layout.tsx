import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeSync } from '@/components/ui/ThemeSync';

export const metadata: Metadata = {
  title: 'Talent Intelligence Platform | Powered by CData Connect AI',
  description: 'AI-powered recruiting intelligence with natural language queries across 350+ data sources',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface dark:bg-gray-900 dark:text-gray-100 transition-colors">
        <AuthProvider>
          <ThemeSync />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
