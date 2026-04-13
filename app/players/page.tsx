'use client'

import { Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

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
  const [name, setName] = useState('')
  const [departmentId, setDepartmentId] = useState<number | ''>('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [message, setMessage] = useState('')

  async function loadData() {
    const data = await fetch('/api/overview').then((r) => r.json())
    setPlayers(data.players)
    setDepartments(data.departments)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 py-12 text-white">
      <div className="mx-auto max-w-5xl space-y-10 px-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Bordtennis-turnering</h1>
          <p className="mt-2 text-slate-400">Intern raadhus-konkurranse</p>
        </div>

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
              onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Vel avdeling</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>

            <button className="w-full rounded-xl bg-blue-600 py-3 text-lg font-semibold transition hover:bg-blue-700">
              Registrer
            </button>

            {message && <p className="text-red-400">{message}</p>}
            {departments.length === 0 && (
              <p className="text-sm text-amber-300">
                Ingen avdelingar er tilgjengelege enno. Kontakt admin for aa opprette ei avdeling.
              </p>
            )}
          </form>
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
                {players.map((player) => (
                  <tr key={player.id} className="border-b border-slate-700 transition hover:bg-slate-700/40">
                    <td className="py-3">{player.name}</td>
                    <td>{player.department.name}</td>
                    <td className="text-right font-semibold text-blue-400">{player.points}</td>
                    <td className="text-right">
                      <button
                        onClick={() => setDeletePlayerId(player.id)}
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
    </div>
  )
}
