import type { ReactNode } from 'react';
import { Header } from './Header';
import { NotificationStack } from '../ui/NotificationStack';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      <Header />
      <main className="flex-1 overflow-hidden">{children}</main>
      <NotificationStack />
    </div>
  );
}
