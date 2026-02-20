import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Project Demo • Renewvia',
  description:
    'Live demo & interactive showcase – Solar Mini-Grid Powerline Optimization',
  icons: { icon: '/favicon.ico' },
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}