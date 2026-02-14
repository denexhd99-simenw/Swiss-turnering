'use client'

import { useEffect, useMemo, useState } from 'react'
import SwissBoard from '../components/SwissBoard'

type Player = {
  id: number
  name: string
  points: number
  wins: number
  losses: number
}

type Match = {
  id: number
  round: number
  phase: string
  winnerId: number | null
  player1: { id: number; name: string } | null
  player2: { id: number; name: string } | null
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [savingMatchId, setSavingMatchId] = useState<number | null>(null)
  const [startingKnockout, setStartingKnockout] = useState(false)
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)

  async function load() {
    const [playersData, matchesData] = await Promise.all([
      fetch('/api/players').then((r) => r.json()),
      fetch('/api/matches').then((r) => r.json())
    ])
    setPlayers(playersData)
    setMatches(matchesData)
  }

  useEffect(() => {
    if (!authenticated) return
    load()
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
  }, [authenticated])

  async function startSwiss() {
    await fetch('/api/swiss/start', { method: 'POST' })
    await load()
  }

  async function setWinner(matchId: number, winnerId: number) {
    setSavingMatchId(matchId)

    setMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, winnerId } : m))
    )

    await fetch(`/api/matches/${matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winnerId })
    })

    await load()
    setSavingMatchId(null)
  }

  async function startKnockout() {
    setStartingKnockout(true)
    await fetch('/api/knockout/start', { method: 'POST' })
    await load()
    setStartingKnockout(false)
  }

  const knockoutStarted = useMemo(
    () => matches.some((m) => m.phase === 'KNOCKOUT'),
    [matches]
  )

  const swissOpenMatches = useMemo(
    () => matches.filter((m) => m.phase === 'SWISS' && m.player2 && !m.winnerId),
    [matches]
  )

  const qualifiedPlayers = useMemo(
    () => players.filter((p) => p.wins >= 3),
    [players]
  )

  const canStartKnockout = useMemo(
    () => !knockoutStarted && swissOpenMatches.length === 0 && qualifiedPlayers.length >= 2,
    [knockoutStarted, swissOpenMatches.length, qualifiedPlayers.length]
  )

  const activeMatches = useMemo(() => {
    const openSwiss = matches.filter((m) => m.phase === 'SWISS' && m.player2 && !m.winnerId)
    const openKnockout = matches.filter((m) => m.phase === 'KNOCKOUT' && m.player2 && !m.winnerId)

    const selected = openSwiss.length > 0 ? openSwiss : openKnockout
    const rounds = selected.map((m) => m.round)
    const currentRound = rounds.length ? Math.min(...rounds) : null

    return {
      currentRound,
      phase: openSwiss.length > 0 ? 'SWISS' : openKnockout.length > 0 ? 'KNOCKOUT' : null,
      matches: currentRound ? selected.filter((m) => m.round === currentRound) : []
    }
  }, [matches])

  if (!authenticated) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="w-[420px] rounded-2xl border border-cyan-500/30 bg-slate-950/85 p-8">
          <h2 className="mb-5 text-2xl font-black tracking-wide text-cyan-200">Admin Login</h2>
          <input
            type="password"
            placeholder="Passord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 w-full rounded-lg border border-cyan-500/40 bg-[#07162f] px-4 py-3 text-white"
          />
          <button
            onClick={() => setAuthenticated(password === 'admin')}
            className="w-full rounded-lg bg-cyan-600 py-3 font-bold text-white hover:bg-cyan-500"
          >
            Logg inn
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-slate-950 via-[#0a2047] to-slate-950 p-6">
        <h1 className="text-4xl font-black tracking-wide text-cyan-200">Admin Swiss Kontroll</h1>
        <p className="mt-2 text-slate-300">Klikk direkte paa vinnaren i kvar kamp.</p>
        <button
          onClick={startSwiss}
          className="mt-5 rounded-lg bg-emerald-600 px-6 py-2 font-bold text-white hover:bg-emerald-500"
        >
          Start turnering
        </button>
        {canStartKnockout && (
          <button
            onClick={startKnockout}
            disabled={startingKnockout}
            className="ml-3 mt-5 rounded-lg bg-amber-500 px-6 py-2 font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
          >
            Start vinn-eller-forsvinn
          </button>
        )}
      </div>

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

      <div className="rounded-2xl border border-amber-500/40 bg-slate-950/75 p-6">
        <h2 className="mb-1 text-2xl font-black tracking-wide text-amber-300">Aktive kampar</h2>
        <p className="mb-5 text-slate-400">
          {activeMatches.currentRound
            ? `${activeMatches.phase === 'SWISS' ? 'Swiss' : 'Knockout'} runde ${activeMatches.currentRound}`
            : knockoutStarted
              ? 'Knockout ferdig, vinnar staar igjen.'
              : 'Ingen opne kampar akkurat no'}
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {activeMatches.matches.map((match) => (
            <div key={match.id} className="rounded-xl border border-amber-400/50 bg-[#0c1b33] p-4">
              <div className="mb-3 text-xs font-bold text-amber-300">Kamp #{match.id}</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={savingMatchId === match.id || !match.player1}
                  onClick={() => match.player1 && setWinner(match.id, match.player1.id)}
                  className={`rounded-lg px-3 py-3 text-left font-semibold transition ${
                    match.winnerId === match.player1?.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-100 hover:bg-emerald-700/70'
                  }`}
                >
                  {match.player1?.name ?? 'TBA'}
                </button>

                <button
                  disabled={savingMatchId === match.id || !match.player2}
                  onClick={() => match.player2 && setWinner(match.id, match.player2.id)}
                  className={`rounded-lg px-3 py-3 text-left font-semibold transition ${
                    match.winnerId === match.player2?.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-100 hover:bg-emerald-700/70'
                  }`}
                >
                  {match.player2?.name ?? 'TBA'}
                </button>
              </div>
            </div>
          ))}

          {activeMatches.matches.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">
              Ventar paa neste runde eller turnering er ferdig.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
