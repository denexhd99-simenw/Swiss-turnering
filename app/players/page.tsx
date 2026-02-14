'use client'

import { Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

type Department = {
  id: number
  name: string
}

type Player = {
  id: number
  name: string
  points: number
  department: Department
}

export default function PlayersPage() {
  const [deletePlayerId, setDeletePlayerId] = useState<number | null>(null)
  const [deleteDepartmentId, setDeleteDepartmentId] = useState<number | null>(null)
  const [departmentReassignments, setDepartmentReassignments] = useState<Record<number, number | ''>>({})

  const [name, setName] = useState('')
  const [departmentId, setDepartmentId] = useState<number | ''>('')
  const [newDepartment, setNewDepartment] = useState('')

  const [departments, setDepartments] = useState<Department[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [message, setMessage] = useState('')
  const [departmentMessage, setDepartmentMessage] = useState('')

  async function loadData() {
    const [playersRes, departmentsRes] = await Promise.all([
      fetch('/api/players'),
      fetch('/api/departments')
    ])

    setPlayers(await playersRes.json())
    setDepartments(await departmentsRes.json())
  }

  useEffect(() => {
    loadData()
  }, [])

  async function confirmDeletePlayer() {
    if (!deletePlayerId) return

    await fetch('/api/players', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deletePlayerId })
    })

    setDeletePlayerId(null)
    loadData()
  }

  async function createDepartment() {
    if (!newDepartment.trim()) return

    await fetch('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newDepartment.trim() })
    })

    setNewDepartment('')
    setDepartmentMessage('')
    loadData()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!name || !departmentId) {
      setMessage('Fyll inn namn og vel avdeling')
      return
    }

    const res = await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, departmentId })
    })

    if (!res.ok) {
      setMessage('Noko gjekk gale')
      return
    }

    setName('')
    setDepartmentId('')
    loadData()
  }

  function openDeleteDepartmentModal(id: number) {
    setDepartmentMessage('')
    setDeleteDepartmentId(id)

    const affectedPlayers = players.filter((p) => p.department.id === id)
    const alternatives = departments.filter((d) => d.id !== id)
    const initial: Record<number, number | ''> = {}

    for (const player of affectedPlayers) {
      initial[player.id] = alternatives[0]?.id ?? ''
    }

    setDepartmentReassignments(initial)
  }

  async function confirmDeleteDepartment() {
    if (!deleteDepartmentId) return

    const affectedPlayers = players.filter((p) => p.department.id === deleteDepartmentId)
    const alternatives = departments.filter((d) => d.id !== deleteDepartmentId)

    if (affectedPlayers.length > 0 && alternatives.length === 0) {
      setDepartmentMessage('Du maa ha minst ei anna avdeling for aa flytte spelarane.')
      return
    }

    const reassignments = affectedPlayers.map((player) => ({
      playerId: player.id,
      departmentId: Number(departmentReassignments[player.id])
    }))

    if (affectedPlayers.length > 0 && reassignments.some((r) => !Number.isInteger(r.departmentId))) {
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
    loadData()
  }

  const departmentToDelete = useMemo(
    () => departments.find((d) => d.id === deleteDepartmentId) ?? null,
    [deleteDepartmentId, departments]
  )

  const affectedPlayers = useMemo(
    () => players.filter((p) => p.department.id === deleteDepartmentId),
    [players, deleteDepartmentId]
  )

  const availableDepartments = useMemo(
    () => departments.filter((d) => d.id !== deleteDepartmentId),
    [departments, deleteDepartmentId]
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 py-12 text-white">
      <div className="mx-auto max-w-5xl space-y-10 px-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Bordtennis-turnering</h1>
          <p className="mt-2 text-slate-400">Intern raadhus-konkurranse</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-6 shadow-xl backdrop-blur">
            <h2 className="mb-4 text-2xl font-semibold">Meld deg paa</h2>

            <form onSubmit={submit} className="space-y-4">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ditt namn"
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Vel avdeling</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <button className="w-full rounded-xl bg-blue-600 py-3 text-lg font-semibold transition hover:bg-blue-700">
                Registrer
              </button>

              {message && <p className="text-red-400">{message}</p>}
            </form>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-6 shadow-xl backdrop-blur">
            <h2 className="mb-4 text-2xl font-semibold">Ny avdeling</h2>

            <div className="flex gap-3">
              <input
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                placeholder="Skriv namn paa avdeling"
                className="flex-1 rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={createDepartment}
                className="rounded-xl bg-blue-600 px-5 py-3 font-medium transition hover:bg-blue-700"
              >
                Legg til
              </button>
            </div>

            <div className="mt-6 space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Avdelingar</h3>
              {departments.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2"
                >
                  <span>{d.name}</span>
                  <button
                    onClick={() => openDeleteDepartmentModal(d.id)}
                    className="text-red-500 transition hover:text-red-400"
                    title="Slett avdeling"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-6 shadow-xl backdrop-blur">
          <h2 className="mb-6 text-2xl font-semibold">Deltakarar</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-lg">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="pb-3 text-left">Namn</th>
                  <th className="pb-3 text-left">Avdeling</th>
                  <th className="pb-3 text-right">Poeng</th>
                  <th className="pb-3 text-right">Slett</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id} className="border-b border-slate-700 transition hover:bg-slate-700/40">
                    <td className="py-3">{p.name}</td>
                    <td>{p.department.name}</td>
                    <td className="text-right font-semibold text-blue-400">{p.points}</td>
                    <td className="text-right">
                      <button
                        onClick={() => setDeletePlayerId(p.id)}
                        className="text-red-500 transition hover:text-red-400"
                      >
                        <Trash2 size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {deletePlayerId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="w-[400px] rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl"
            >
              <h3 className="mb-4 text-2xl font-bold text-red-500">Slett spelar</h3>
              <p className="mb-6 text-slate-300">
                Er du sikker paa at du vil slette denne spelaren?
                <br />
                Dette kan ikkje angrast.
              </p>
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setDeletePlayerId(null)}
                  className="rounded-lg bg-slate-700 px-4 py-2 hover:bg-slate-600"
                >
                  Avbryt
                </button>
                <button
                  onClick={confirmDeletePlayer}
                  className="rounded-lg bg-red-600 px-4 py-2 hover:bg-red-700"
                >
                  Ja, slett
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                          {availableDepartments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
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
