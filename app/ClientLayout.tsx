'use client';

import { StorageProvider } from '@/components/StorageProvider';
import Sidebar from '@/components/Sidebar';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <StorageProvider>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </StorageProvider>
  );
}
