'use client'

type Player = {
  id: number
  name: string
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

type SwissBoardProps = {
  players: Player[]
  matches: Match[]
  selectedPlayerId?: number | null
}

const stageColumns = [
  { title: 'Start', rounds: [1] },
  { title: 'Runde 2', rounds: [2] },
  { title: 'Runde 3', rounds: [3] },
  { title: 'Runde 4', rounds: [4] },
  { title: 'Runde 5', rounds: [5] }
]

const advanceGroups = ['3-0', '3-1', '3-2']
const eliminatedGroups = ['0-3', '1-3', '2-3']

function rowClass(playerId?: number, selectedPlayerId?: number | null, isWinner?: boolean) {
  const classes = ['rounded-md px-2 py-1 text-sm']

  if (isWinner) {
    classes.push('bg-emerald-600/35 text-emerald-100')
  } else {
    classes.push('bg-slate-900/90 text-slate-100')
  }

  if (selectedPlayerId && playerId === selectedPlayerId) {
    classes.push('ring-2 ring-cyan-300 shadow-[0_0_0_1px_rgba(103,232,249,.45)]')
  }

  return classes.join(' ')
}

function matchCardClass(match: Match, selectedPlayerId?: number | null, tone: 'cyan' | 'amber' = 'cyan') {
  const isSelectedMatch =
    !!selectedPlayerId &&
    (match.player1?.id === selectedPlayerId || match.player2?.id === selectedPlayerId)

  if (!isSelectedMatch) {
    return tone === 'amber'
      ? 'rounded-xl border border-amber-400/45 bg-[#0c1b33] p-3 shadow-[0_0_0_1px_rgba(251,191,36,.15)]'
      : 'rounded-xl border border-cyan-500/50 bg-[#07162f] p-3 shadow-[0_0_0_1px_rgba(34,211,238,.15)]'
  }

  return tone === 'amber'
    ? 'rounded-xl border border-cyan-300 bg-[#102445] p-3 ring-2 ring-cyan-300 shadow-[0_0_0_1px_rgba(103,232,249,.45)]'
    : 'rounded-xl border border-cyan-300 bg-[#0d2243] p-3 ring-2 ring-cyan-300 shadow-[0_0_0_1px_rgba(103,232,249,.45)]'
}

function playersByRecord(players: Player[]) {
  const grouped: Record<string, Player[]> = {}
  for (const p of players) {
    const key = `${p.wins}-${p.losses}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(p)
  }
  return grouped
}

export default function SwissBoard({ players, matches, selectedPlayerId }: SwissBoardProps) {
  const groupedPlayers = playersByRecord(players)
  const swissMatches = matches.filter((m) => m.phase === 'SWISS')
  const knockoutMatches = matches.filter((m) => m.phase === 'KNOCKOUT')
  const knockoutStarted = knockoutMatches.length > 0
  const knockoutRounds = Array.from(new Set(knockoutMatches.map((m) => m.round))).sort((a, b) => a - b)
  const championMatch = knockoutRounds.length
    ? knockoutMatches.find((m) => m.round === knockoutRounds[knockoutRounds.length - 1])
    : null
  const championId =
    championMatch && championMatch.winnerId
      ? championMatch.winnerId
      : championMatch && championMatch.player2 === null
        ? championMatch.player1?.id ?? null
        : null
  const champion = championId ? players.find((p) => p.id === championId) : null

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        {knockoutStarted ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-400/45 bg-[#0b1730] px-4 py-3 text-sm font-bold text-amber-300">
              VINN ELLER FORSVINN
            </div>

            <div className="grid min-w-[1200px] grid-cols-5 gap-4">
              {knockoutRounds.map((round) => {
                const roundMatches = knockoutMatches
                  .filter((m) => m.round === round)
                  .sort((a, b) => a.id - b.id)

                return (
                  <div key={round} className="space-y-3">
                    <div className="rounded-lg border border-amber-400/45 bg-slate-950/90 px-3 py-2 text-center text-sm font-bold text-amber-200">
                      Runde {round}
                    </div>

                    {roundMatches.map((match) => (
                      <div key={match.id} className={matchCardClass(match, selectedPlayerId, 'amber')}>
                        <div className="mb-2 text-[11px] font-bold tracking-wider text-amber-300">
                          Kamp #{match.id}
                        </div>
                        <div className="space-y-2">
                          <div className={rowClass(match.player1?.id, selectedPlayerId, match.winnerId === match.player1?.id)}>
                            {match.player1?.name ?? 'TBA'}
                          </div>
                          <div className="text-center text-[10px] font-bold text-slate-500">VS</div>
                          <div className={rowClass(match.player2?.id, selectedPlayerId, match.winnerId === match.player2?.id)}>
                            {match.player2?.name ?? 'TBA'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}

              <div className="space-y-3">
                <div className="rounded-lg border border-emerald-400/60 bg-emerald-900/30 px-3 py-2 text-center text-sm font-bold text-emerald-300">
                  Vinnar
                </div>
                <div className="rounded-xl border border-emerald-400/60 bg-emerald-950/40 p-3">
                  <div className="mb-2 text-xs font-bold tracking-wider text-emerald-300">Champion</div>
                  <div className="rounded-md bg-emerald-600/30 px-2 py-2 text-sm text-emerald-100">
                    {champion?.name ?? 'Ikkje avgjort enno'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid min-w-[1200px] grid-cols-7 gap-4">
            {stageColumns.map((column) => {
              const columnMatches = swissMatches
                .filter((m) => column.rounds.includes(m.round))
                .sort((a, b) => a.id - b.id)

              return (
                <div key={column.title} className="space-y-3">
                  <div className="rounded-lg border border-cyan-500/40 bg-slate-950/90 px-3 py-2 text-center text-sm font-bold text-cyan-200">
                    {column.title}
                  </div>

                  {columnMatches.map((match) => (
                    <div key={match.id} className={matchCardClass(match, selectedPlayerId, 'cyan')}>
                      <div className="mb-2 text-[11px] font-bold tracking-wider text-cyan-300">
                        Kamp #{match.id}
                      </div>
                      <div className="space-y-2">
                        <div className={rowClass(match.player1?.id, selectedPlayerId, match.winnerId === match.player1?.id)}>
                          {match.player1?.name ?? 'TBA'}
                        </div>
                        <div className="text-center text-[10px] font-bold text-slate-500">VS</div>
                        <div className={rowClass(match.player2?.id, selectedPlayerId, match.winnerId === match.player2?.id)}>
                          {match.player2?.name ?? 'TBA'}
                        </div>
                      </div>
                    </div>
                  ))}

                  {columnMatches.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-700 bg-[#07162f] p-3 text-xs text-slate-500">
                      Ingen kampar
                    </div>
                  )}
                </div>
              )
            })}

            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-400/60 bg-emerald-900/30 px-3 py-2 text-center text-sm font-bold text-emerald-300">
                Vidare
              </div>
              {advanceGroups.map((record) => (
                <div key={record} className="rounded-xl border border-emerald-400/60 bg-emerald-950/40 p-3">
                  <div className="mb-2 text-xs font-bold tracking-wider text-emerald-300">{record}</div>
                  <div className="space-y-2">
                    {(groupedPlayers[record] ?? []).map((player) => (
                      <div
                        key={player.id}
                        className={`rounded-md px-2 py-1 text-sm ${rowClass(player.id, selectedPlayerId, false)}`}
                      >
                        {player.name}
                      </div>
                    ))}
                    {(groupedPlayers[record] ?? []).length === 0 && (
                      <div className="rounded-md border border-dashed border-emerald-800 px-2 py-2 text-xs text-emerald-700">
                        Ingen
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-rose-400/60 bg-rose-900/30 px-3 py-2 text-center text-sm font-bold text-rose-300">
                Ute
              </div>
              {eliminatedGroups.map((record) => (
                <div key={record} className="rounded-xl border border-rose-400/60 bg-rose-950/40 p-3">
                  <div className="mb-2 text-xs font-bold tracking-wider text-rose-300">{record}</div>
                  <div className="space-y-2">
                    {(groupedPlayers[record] ?? []).map((player) => (
                      <div
                        key={player.id}
                        className={`rounded-md px-2 py-1 text-sm ${rowClass(player.id, selectedPlayerId, false)}`}
                      >
                        {player.name}
                      </div>
                    ))}
                    {(groupedPlayers[record] ?? []).length === 0 && (
                      <div className="rounded-md border border-dashed border-rose-800 px-2 py-2 text-xs text-rose-700">
                        Ingen
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
