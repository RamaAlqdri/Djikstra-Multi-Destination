import './globals.css';

export const metadata = {
  title: 'Sistem Informasi Depot Air',
  description: 'Dashboard depot air untuk pelanggan, pengantaran, dan perbandingan algoritma.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
