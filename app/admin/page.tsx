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

const KNOCKOUT_PHASE = 'KNOCKOUT'

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [savingMatchId, setSavingMatchId] = useState<number | null>(null)
  const [startingTournament, setStartingTournament] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusError, setStatusError] = useState('')
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
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      load()
    }, 15000)
    return () => clearInterval(timer)
  }, [authenticated])

  async function startTournament() {
    setStartingTournament(true)
    setStatusMessage('')
    setStatusError('')

    const res = await fetch('/api/swiss/start', { method: 'POST' })
    const raw = await res.text()
    let payload: any = null

    try {
      payload = raw ? JSON.parse(raw) : null
    } catch {
      payload = null
    }

    if (!res.ok) {
      setStatusError(payload?.error ?? payload?.message ?? raw ?? 'Kunne ikkje starte turneringa.')
      setStartingTournament(false)
      return
    }

    setStatusMessage(payload?.message ?? 'Turneringa er starta.')
    await load()
    setStartingTournament(false)
  }

  async function setWinner(matchId: number, winnerId: number) {
    setSavingMatchId(matchId)

    setMatches((prev) => prev.map((match) => (match.id === matchId ? { ...match, winnerId } : match)))

    await fetch(`/api/matches/${matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winnerId })
    })

    await load()
    setSavingMatchId(null)
  }

  const knockoutStarted = useMemo(
    () => matches.some((match) => match.phase === KNOCKOUT_PHASE),
    [matches]
  )

  const activeMatches = useMemo(() => {
    const openKnockout = matches.filter(
      (match) => match.phase === KNOCKOUT_PHASE && match.player2 && !match.winnerId
    )
    const rounds = openKnockout.map((match) => match.round)
    const currentRound = rounds.length ? Math.min(...rounds) : null

    return {
      currentRound,
      matches: currentRound ? openKnockout.filter((match) => match.round === currentRound) : []
    }
  }, [matches])

  const editableMatches = useMemo(
    () =>
      [...matches]
        .filter((match) => !!match.player1 && !!match.player2)
        .sort((a, b) => b.id - a.id)
        .slice(0, 30),
    [matches]
  )

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
        <h1 className="text-4xl font-black tracking-wide text-cyan-200">Admin Knockout Kontroll</h1>
        <p className="mt-2 text-slate-300">
          Start ei rein vinn-eller-forsvinn-turnering og klikk direkte paa vinnaren i kvar kamp.
        </p>
        <button
          onClick={startTournament}
          disabled={startingTournament}
          className="mt-5 rounded-lg bg-emerald-600 px-6 py-2 font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {knockoutStarted ? 'Start turnering paanytt' : 'Start turnering'}
        </button>
        {statusMessage && <p className="mt-3 text-sm text-emerald-300">{statusMessage}</p>}
        {statusError && <p className="mt-3 text-sm text-rose-300">{statusError}</p>}
      </div>

      <div className="rounded-2xl border border-cyan-500/30 bg-slate-950/60 p-4">
        <label className="mb-2 block text-sm font-semibold text-cyan-300">Marker spelar</label>
        <select
          value={selectedPlayerId ?? ''}
          onChange={(e) => setSelectedPlayerId(e.target.value ? Number(e.target.value) : null)}
          className="w-full rounded-lg border border-cyan-500/40 bg-[#07162f] px-4 py-2 text-white md:w-[340px]"
        >
          <option value="">Vis alle</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
      </div>

      <SwissBoard players={players} matches={matches} selectedPlayerId={selectedPlayerId} />

      <div className="rounded-2xl border border-amber-500/40 bg-slate-950/75 p-6">
        <h2 className="mb-1 text-2xl font-black tracking-wide text-amber-300">Aktive kampar</h2>
        <p className="mb-5 text-slate-400">
          {activeMatches.currentRound
            ? `Knockout runde ${activeMatches.currentRound}`
            : knockoutStarted
              ? 'Knockout ferdig, vinnaren staar igjen.'
              : 'Turneringa er ikkje starta enno.'}
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
              Ventar paa neste runde eller at turneringa skal bli starta.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-cyan-500/35 bg-slate-950/75 p-6">
        <h2 className="mb-1 text-2xl font-black tracking-wide text-cyan-200">Endre vinnar (siste 30 kampar)</h2>
        <p className="mb-5 text-slate-400">Bruk denne dersom du har trykt feil vinnar.</p>

        <div className="grid gap-4 md:grid-cols-2">
          {editableMatches.map((match) => (
            <div key={match.id} className="rounded-xl border border-cyan-400/45 bg-[#0c1b33] p-4">
              <div className="mb-3 text-xs font-bold text-cyan-300">
                Kamp #{match.id} - {match.phase} - Runde {match.round}
              </div>
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

          {editableMatches.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">
              Ingen redigerbare kampar enno.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
