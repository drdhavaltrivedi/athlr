import type { Metadata } from 'next';
import './globals.css';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Athlr — Track every mile. Own every stat.',
  description:
    'Athlr is the privacy-first fitness tracker. GPS recording, health sync, and a community feed — your data stays on your device until you choose to share it. Free forever.',
  openGraph: {
    title: 'Athlr — Track every mile. Own every stat.',
    description:
      'The privacy-first fitness tracker. GPS recording, health sync, community feed. Free forever.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
