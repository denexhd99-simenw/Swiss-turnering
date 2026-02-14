'use client'

import { useEffect, useState } from 'react'

type Player = {
  id: number
  name: string
}

type Match = {
  id: number
  round: number
  player1: Player
  player2: Player
  winnerId?: number
}

export default function BracketPage() {
  const [matches, setMatches] = useState<Match[]>([])

  async function load() {
    const data = await fetch('/api/matches').then(r => r.json())
    setMatches(data)
  }

  useEffect(() => {
    load()
  }, [])

  const grouped = matches.reduce((acc: any, match) => {
    acc[match.round] = acc[match.round] || []
    acc[match.round].push(match)
    return acc
  }, {})

  return (
    <div className="space-y-10">
      <h1 className="text-4xl font-bold">🏆 Turnering Bracket</h1>

      <div className="flex gap-10">
        {Object.keys(grouped).map(round => (
          <div key={round} className="space-y-4">
            <h2 className="text-xl font-semibold">
              Runde {round}
            </h2>

            {grouped[round].map((match: Match) => (
              <div
                key={match.id}
                className="bg-slate-900 p-4 rounded-xl w-60"
              >
                <div className={
                  match.winnerId === match.player1.id
                    ? 'text-yellow-400'
                    : ''
                }>
                  {match.player1.name}
                </div>

                <div className={
                  match.winnerId === match.player2.id
                    ? 'text-yellow-400'
                    : ''
                }>
                  {match.player2.name}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
