import { Toaster } from 'sonner';

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
      <Toaster richColors position="top-right" />
    </div>
  );
}