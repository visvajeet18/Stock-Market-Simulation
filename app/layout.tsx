import { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StockX - Market Simulation',
  description: 'A premium stock market simulation competition for students.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
