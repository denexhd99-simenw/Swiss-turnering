'use client'

import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import SwissBoard from '../components/SwissBoard'

type Department = {
  id: number
  name: string
}

type Player = {
  id: number
  name: string
  points: number
  wins: number
  losses: number
  department?: Department
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
  const [departments, setDepartments] = useState<Department[]>([])
  const [newDepartment, setNewDepartment] = useState('')
  const [departmentMessage, setDepartmentMessage] = useState('')
  const [deleteDepartmentId, setDeleteDepartmentId] = useState<number | null>(null)
  const [departmentReassignments, setDepartmentReassignments] = useState<Record<number, number | ''>>({})
  const [savingMatchId, setSavingMatchId] = useState<number | null>(null)
  const [startingTournament, setStartingTournament] = useState(false)
  const [clearingTournament, setClearingTournament] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusError, setStatusError] = useState('')
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)

  async function load() {
    const data = await fetch('/api/overview').then((r) => r.json())
    setPlayers(data.players)
    setMatches(data.matches)
    setDepartments(data.departments)
  }

  useEffect(() => {
    if (!authenticated) return
    load()
  }, [authenticated])

  async function createDepartment() {
    if (!newDepartment.trim()) return

    const res = await fetch('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newDepartment.trim() })
    })

    if (!res.ok) {
      setDepartmentMessage('Kunne ikkje opprette avdeling.')
      return
    }

    setNewDepartment('')
    setDepartmentMessage('')
    await load()
  }

  function openDeleteDepartmentModal(id: number) {
    setDepartmentMessage('')
    setDeleteDepartmentId(id)

    const affectedPlayers = players.filter((player) => player.department?.id === id)
    const alternatives = departments.filter((department) => department.id !== id)
    const initial: Record<number, number | ''> = {}

    for (const player of affectedPlayers) {
      initial[player.id] = alternatives[0]?.id ?? ''
    }

    setDepartmentReassignments(initial)
  }

  async function confirmDeleteDepartment() {
    if (!deleteDepartmentId) return

    const affectedPlayers = players.filter((player) => player.department?.id === deleteDepartmentId)
    const alternatives = departments.filter((department) => department.id !== deleteDepartmentId)

    if (affectedPlayers.length > 0 && alternatives.length === 0) {
      setDepartmentMessage('Du maa ha minst ei anna avdeling for aa flytte spelarane.')
      return
    }

    const reassignments = affectedPlayers.map((player) => ({
      playerId: player.id,
      departmentId: Number(departmentReassignments[player.id])
    }))

    if (affectedPlayers.length > 0 && reassignments.some((item) => !Number.isInteger(item.departmentId))) {
      setDepartmentMessage('Vel ny avdeling for alle spelarane.')
      return
    }

    const res = await fetch('/api/departments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        departmentId: deleteDepartmentId,
        reassignments
      })
    })

    if (!res.ok) {
      const maybeJson = await res.json().catch(() => null)
      setDepartmentMessage(maybeJson?.error ?? 'Kunne ikkje slette avdeling.')
      return
    }

    setDeleteDepartmentId(null)
    setDepartmentReassignments({})
    setDepartmentMessage('')
    await load()
  }

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

  async function clearTournament() {
    setClearingTournament(true)
    setStatusMessage('')
    setStatusError('')

    const res = await fetch('/api/tournament/reset', { method: 'POST' })
    const raw = await res.text()
    let payload: any = null

    try {
      payload = raw ? JSON.parse(raw) : null
    } catch {
      payload = null
    }

    if (!res.ok) {
      setStatusError(payload?.error ?? payload?.message ?? raw ?? 'Kunne ikkje rydde turneringa.')
      setClearingTournament(false)
      return
    }

    setStatusMessage(payload?.message ?? 'Tidlegare turnering er fjerna.')
    await load()
    setClearingTournament(false)
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

  const departmentToDelete = useMemo(
    () => departments.find((department) => department.id === deleteDepartmentId) ?? null,
    [deleteDepartmentId, departments]
  )

  const affectedPlayers = useMemo(
    () => players.filter((player) => player.department?.id === deleteDepartmentId),
    [players, deleteDepartmentId]
  )

  const availableDepartments = useMemo(
    () => departments.filter((department) => department.id !== deleteDepartmentId),
    [departments, deleteDepartmentId]
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
          disabled={startingTournament || clearingTournament}
          className="mt-5 rounded-lg bg-emerald-600 px-6 py-2 font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {knockoutStarted ? 'Start turnering paanytt' : 'Start turnering'}
        </button>
        <button
          onClick={clearTournament}
          disabled={startingTournament || clearingTournament}
          className="ml-3 mt-5 rounded-lg bg-rose-600 px-6 py-2 font-bold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Fjern tidlegare turnering
        </button>
        {statusMessage && <p className="mt-3 text-sm text-emerald-300">{statusMessage}</p>}
        {statusError && <p className="mt-3 text-sm text-rose-300">{statusError}</p>}
      </div>

      <div className="rounded-2xl border border-cyan-500/35 bg-slate-950/75 p-6">
        <h2 className="mb-1 text-2xl font-black tracking-wide text-cyan-200">Avdelingar</h2>
        <p className="mb-5 text-slate-400">Berre admin kan opprette og slette avdelingar.</p>

        <div className="flex gap-3">
          <input
            value={newDepartment}
            onChange={(e) => setNewDepartment(e.target.value)}
            placeholder="Skriv namn paa avdeling"
            className="flex-1 rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            onClick={createDepartment}
            className="rounded-xl bg-cyan-600 px-5 py-3 font-medium transition hover:bg-cyan-500"
          >
            Legg til
          </button>
        </div>

        {departmentMessage && !deleteDepartmentId && (
          <p className="mt-3 text-sm text-rose-300">{departmentMessage}</p>
        )}

        <div className="mt-6 space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Avdelingar</h3>
          {departments.map((department) => (
            <div
              key={department.id}
              className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2"
            >
              <span>{department.name}</span>
              <button
                onClick={() => openDeleteDepartmentModal(department.id)}
                className="text-red-500 transition hover:text-red-400"
                title="Slett avdeling"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          {departments.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-sm text-slate-400">
              Ingen avdelingar oppretta enno.
            </div>
          )}
        </div>
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

      <AnimatePresence>
        {deleteDepartmentId && departmentToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          >
            <motion.div
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.92 }}
              className="w-[560px] rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl"
            >
              <h3 className="mb-3 text-2xl font-bold text-red-500">Slett avdeling</h3>
              <p className="mb-5 text-slate-300">
                Du slettar <span className="font-semibold text-white">{departmentToDelete.name}</span>.
              </p>

              {affectedPlayers.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-300">
                    Vel ny avdeling for kvar spelar i denne avdelinga:
                  </p>

                  <div className="max-h-[260px] space-y-3 overflow-y-auto pr-1">
                    {affectedPlayers.map((player) => (
                      <div key={player.id} className="grid grid-cols-[1fr_1fr] gap-3">
                        <div className="rounded-lg bg-slate-800 px-3 py-2 text-sm">{player.name}</div>
                        <select
                          value={departmentReassignments[player.id] ?? ''}
                          onChange={(e) =>
                            setDepartmentReassignments((prev) => ({
                              ...prev,
                              [player.id]: e.target.value ? Number(e.target.value) : ''
                            }))
                          }
                          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
                        >
                          <option value="">Vel ny avdeling</option>
                          {availableDepartments.map((department) => (
                            <option key={department.id} value={department.id}>
                              {department.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-300">Ingen spelarar er knytte til denne avdelinga.</p>
              )}

              {departmentMessage && <p className="mt-4 text-sm text-red-400">{departmentMessage}</p>}

              <div className="mt-6 flex justify-end gap-4">
                <button
                  onClick={() => {
                    setDeleteDepartmentId(null)
                    setDepartmentReassignments({})
                    setDepartmentMessage('')
                  }}
                  className="rounded-lg bg-slate-700 px-4 py-2 hover:bg-slate-600"
                >
                  Avbryt
                </button>
                <button
                  onClick={confirmDeleteDepartment}
                  className="rounded-lg bg-red-600 px-4 py-2 hover:bg-red-700"
                >
                  Slett avdeling
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
