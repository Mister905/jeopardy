'use client';

import { Provider } from 'react-redux';
import { store } from '@/store/store';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import './globals.css';
import '@/styles/main.scss';

// Note: Metadata cannot be exported from client components in Next.js App Router.
// Individual pages can use next/head or metadata will be handled via document title.
// Since this layout needs to be a client component for Redux Provider, metadata
// is handled at the page level or via document title.

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="app-root">
        <Provider store={store}>
          <Header />
          <main className="flex-grow container mx-auto px-4 py-8">
            {children}
          </main>
          <Footer />
        </Provider>
      </body>
    </html>
  );
}
