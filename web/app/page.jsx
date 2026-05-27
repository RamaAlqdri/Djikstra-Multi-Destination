'use client';

import dynamic from 'next/dynamic';

const Dashboard = dynamic(() => import('./dashboard'), {
  ssr: false,
  loading: () => <main className="app-shell">Memuat dashboard...</main>,
});

export default function Page() {
  return <Dashboard />;
}
