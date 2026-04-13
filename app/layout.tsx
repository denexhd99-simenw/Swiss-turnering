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
          <nav className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
            <div className="mx-auto flex max-w-[83rem] items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3 text-xl font-bold">
                <Trophy className="text-blue-500" />
                Velkommen til Rådhuset sin råaste bordtenniskonkurranse
              </div>

              <div className="flex gap-6 text-slate-300">
                <Link href="/" className="flex items-center gap-2 hover:text-white">
                  <LayoutDashboard size={18} />
                  Oversikt
                </Link>
                <Link href="/players" className="flex items-center gap-2 hover:text-white">
                  <Users size={18} />
                  Påmelding
                </Link>
                <Link href="/leaderboard" className="flex items-center gap-2 hover:text-white">
                  <Trophy size={18} />
                  Leaderboard
                </Link>
                <Link href="/admin" className="flex items-center gap-2 hover:text-white">
                  <Shield size={18} />
                  Admin
                </Link>
              </div>
            </div>
          </nav>

          <main className="mx-auto max-w-[83rem] px-6 py-10">{children}</main>
        </div>
      </body>
    </html>
  )
}
