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

function matchCardClass(match: Match, selectedPlayerId?: number | null) {
  const isSelectedMatch =
    !!selectedPlayerId &&
    (match.player1?.id === selectedPlayerId || match.player2?.id === selectedPlayerId)

  if (!isSelectedMatch) {
    return 'rounded-xl border border-amber-400/45 bg-[#0c1b33] p-3 shadow-[0_0_0_1px_rgba(251,191,36,.15)]'
  }

  return 'rounded-xl border border-cyan-300 bg-[#102445] p-3 ring-2 ring-cyan-300 shadow-[0_0_0_1px_rgba(103,232,249,.45)]'
}

export default function SwissBoard({ players, matches, selectedPlayerId }: SwissBoardProps) {
  const knockoutMatches = matches.filter((match) => match.phase === 'KNOCKOUT')
  const knockoutRounds = Array.from(new Set(knockoutMatches.map((match) => match.round))).sort((a, b) => a - b)
  const finalMatch = knockoutRounds.length
    ? knockoutMatches.find((match) => match.round === knockoutRounds[knockoutRounds.length - 1])
    : null
  const championId =
    finalMatch && finalMatch.winnerId
      ? finalMatch.winnerId
      : finalMatch && finalMatch.player2 === null
        ? finalMatch.player1?.id ?? null
        : null
  const champion = championId ? players.find((player) => player.id === championId) : null

  if (knockoutMatches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-6 text-sm text-slate-400">
        Turneringa er ikkje starta enno.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-400/45 bg-[#0b1730] px-4 py-3 text-sm font-bold text-amber-300">
            VINN ELLER FORSVINN
          </div>

          <div
            className="grid min-w-[900px] gap-4"
            style={{ gridTemplateColumns: `repeat(${knockoutRounds.length + 1}, minmax(180px, 1fr))` }}
          >
            {knockoutRounds.map((round) => {
              const roundMatches = knockoutMatches
                .filter((match) => match.round === round)
                .sort((a, b) => a.id - b.id)

              return (
                <div key={round} className="space-y-3">
                  <div className="rounded-lg border border-amber-400/45 bg-slate-950/90 px-3 py-2 text-center text-sm font-bold text-amber-200">
                    Runde {round}
                  </div>

                  {roundMatches.map((match) => (
                    <div key={match.id} className={matchCardClass(match, selectedPlayerId)}>
                      <div className="mb-2 text-[11px] font-bold tracking-wider text-amber-300">
                        Kamp #{match.id}
                      </div>
                      <div className="space-y-2">
                        <div className={rowClass(match.player1?.id, selectedPlayerId, match.winnerId === match.player1?.id)}>
                          {match.player1?.name ?? 'TBA'}
                        </div>
                        <div className="text-center text-[10px] font-bold text-slate-500">VS</div>
                        <div className={rowClass(match.player2?.id, selectedPlayerId, match.winnerId === match.player2?.id)}>
                          {match.player2?.name ?? 'Walkover'}
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
      </div>
    </div>
  )
}
