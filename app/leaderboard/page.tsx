'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Crown } from 'lucide-react'

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

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')

  async function load() {
    const playersData = await fetch('/api/players').then(r => r.json())
    const deptData = await fetch('/api/departments').then(r => r.json())

    setPlayers(playersData)
    setDepartments(deptData)
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000) // 🔄 Auto refresh
    return () => clearInterval(interval)
  }, [])

  const filteredPlayers =
    selectedDepartment === 'all'
      ? players
      : players.filter(
          p => p.department.id === Number(selectedDepartment)
        )

  const sortedPlayers = [...filteredPlayers].sort(
    (a, b) => b.points - a.points
  )

  // 🏢 Avdelingsranking (snittpoeng)
  const departmentRanking = departments.map(d => {
    const deptPlayers = players.filter(p => p.department.id === d.id)
    const avg =
      deptPlayers.length > 0
        ? deptPlayers.reduce((sum, p) => sum + p.points, 0) /
          deptPlayers.length
        : 0

    return {
      name: d.name,
      average: avg.toFixed(2)
    }
  }).sort((a, b) => Number(b.average) - Number(a.average))

  function getMedalColor(index: number) {
    if (index === 0) return 'text-yellow-400'
    if (index === 1) return 'text-gray-300'
    if (index === 2) return 'text-amber-600'
    return ''
  }

  return (
    <div className="space-y-12">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Trophy className="text-yellow-400" />
          Leaderboard
        </h1>

        <select
          value={selectedDepartment}
          onChange={e => setSelectedDepartment(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-lg"
        >
          <option value="all">Alle avdelingar</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* PLAYER LEADERBOARD */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
        <table className="w-full text-lg">
          <thead>
            <tr className="text-slate-400 border-b border-slate-800">
              <th className="text-left pb-3">Plass</th>
              <th className="text-left pb-3">Namn</th>
              <th className="text-left pb-3">Avdeling</th>
              <th className="text-right pb-3">Poeng</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((p, index) => (
              <motion.tr
                key={p.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className="border-b border-slate-800"
              >
                <td className={`py-3 font-bold ${getMedalColor(index)}`}>
                  {index === 0 && (
                    <Crown className="inline mr-2 text-yellow-400" size={18} />
                  )}
                  {index + 1}
                </td>
                <td className={getMedalColor(index)}>
                  {p.name}
                </td>
                <td>{p.department.name}</td>
                <td className="text-right text-blue-400 font-bold">
                  {p.points}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* AVDELINGSRANKING */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
        <h2 className="text-2xl font-semibold mb-6">
          🏢 Avdelingsranking (Snittpoeng)
        </h2>

        <div className="space-y-4">
          {departmentRanking.map((d, index) => (
            <div key={d.name}>
              <div className="flex justify-between text-lg">
                <span>{d.name}</span>
                <span className="text-blue-400 font-bold">
                  {d.average}
                </span>
              </div>

              {/* 📊 Enkel graf-bar */}
              <div className="h-3 bg-slate-800 rounded-full mt-2">
                <div
                  className="h-3 bg-blue-500 rounded-full"
                  style={{ width: `${Number(d.average) * 10}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
