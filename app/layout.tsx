import './globals.css'
import Link from 'next/link'
import { Trophy, Users, LayoutDashboard, Shield } from 'lucide-react'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="no">
      <body className="bg-gradient-to-br from-slate-950 to-blue-950 text-white">
        <div className="min-h-screen">

          {/* NAVBAR */}
          <nav className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
            <div className="max-w-[83rem] mx-auto px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3 text-xl font-bold">
                <Trophy className="text-blue-500" />
                Bordtennis Dashboard
              </div>

              <div className="flex gap-6 text-slate-300">
                <Link href="/" className="hover:text-white flex items-center gap-2">
                  <LayoutDashboard size={18} />
                  Oversikt
                </Link>
                <Link href="/players" className="hover:text-white flex items-center gap-2">
                  <Users size={18} />
                  Påmelding
                </Link>
                <Link href="/leaderboard" className="hover:text-white flex items-center gap-2">
                  <Trophy size={18} />
                  Leaderboard
                </Link>
                <Link href="/admin" className="hover:text-white flex items-center gap-2">
                  <Shield size={18} />
                  Admin
                </Link>
              </div>
            </div>
          </nav>

          <main className="max-w-[83rem] mx-auto px-6 py-10">
            {children}
          </main>

        </div>
      </body>
    </html>
  )
}
