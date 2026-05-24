import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Prowider - Lead Distribution System',
  description: 'A modern lead distribution platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-blue-600">Prowider</h1>
              </div>
              <div className="flex items-center space-x-4">
                <a href="/" className="text-gray-600 hover:text-gray-900">Home</a>
                <a href="/request-service" className="text-gray-600 hover:text-gray-900">Request Service</a>
                <a href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</a>
                <a href="/test-tools" className="text-gray-600 hover:text-gray-900">Test Tools</a>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
