'use client'

import { useEffect, useMemo, useState } from 'react'
import SwissBoard from './components/SwissBoard'

type Player = {
  id: number
  name: string
  wins: number
  losses: number
  points: number
}

type Match = {
  id: number
  round: number
  phase: string
  winnerId: number | null
  player1: { id: number; name: string } | null
  player2: { id: number; name: string } | null
}

function phaseLabel(match: Match) {
  if (match.phase !== 'SWISS') return match.phase
  return `Runde ${match.round}`
}

export default function HomePage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)

  async function load() {
    const [p, m] = await Promise.all([
      fetch('/api/players').then((r) => r.json()),
      fetch('/api/matches').then((r) => r.json())
    ])
    setPlayers(p)
    setMatches(m)
  }

  useEffect(() => {
    load()
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      load()
    }, 20000)
    return () => clearInterval(timer)
  }, [])

  const filteredMatches = useMemo(() => {
    if (!selectedPlayerId) return matches
    return matches.filter(
      (m) => m.player1?.id === selectedPlayerId || m.player2?.id === selectedPlayerId
    )
  }, [matches, selectedPlayerId])

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-cyan-500/30 bg-slate-950/60 p-4">
        <label className="mb-2 block text-sm font-semibold text-cyan-300">Marker spelar</label>
        <select
          value={selectedPlayerId ?? ''}
          onChange={(e) => setSelectedPlayerId(e.target.value ? Number(e.target.value) : null)}
          className="w-full rounded-lg border border-cyan-500/40 bg-[#07162f] px-4 py-2 text-white md:w-[340px]"
        >
          <option value="">Vis alle</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <SwissBoard players={players} matches={matches} selectedPlayerId={selectedPlayerId} />

      <div className="rounded-2xl border border-cyan-500/30 bg-slate-950/70 p-6">
        <h2 className="mb-4 text-xl font-black tracking-wide text-cyan-200">Kampar</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredMatches.map((match) => (
            <div key={match.id} className="rounded-xl border border-slate-700 bg-[#081326] p-4">
              <div className="mb-3 text-xs font-bold text-cyan-300">{phaseLabel(match)}</div>
              <div className={match.winnerId === match.player1?.id ? 'text-emerald-300' : 'text-slate-100'}>
                {match.player1?.name ?? 'TBA'}
              </div>
              <div className="my-1 text-xs text-slate-500">vs</div>
              <div className={match.winnerId === match.player2?.id ? 'text-emerald-300' : 'text-slate-100'}>
                {match.player2?.name ?? 'TBA'}
              </div>
            </div>
          ))}
          {filteredMatches.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">
              Ingen kampar for dette filteret.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
