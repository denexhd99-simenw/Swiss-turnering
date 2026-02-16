export type PairingPlayer = {
  id: number
  departmentId: number
}

type SwissMatchLike = {
  player1Id: number | null
  player2Id: number | null
}

export type OpponentMap = Map<number, Set<number>>

export function shuffle<T>(array: T[]) {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = copy[i]
    copy[i] = copy[j]
    copy[j] = temp
  }
  return copy
}

export function buildOpponentMap(matches: SwissMatchLike[]): OpponentMap {
  const map: OpponentMap = new Map()

  for (const match of matches) {
    if (!match.player1Id || !match.player2Id) continue

    if (!map.has(match.player1Id)) map.set(match.player1Id, new Set())
    if (!map.has(match.player2Id)) map.set(match.player2Id, new Set())

    map.get(match.player1Id)!.add(match.player2Id)
    map.get(match.player2Id)!.add(match.player1Id)
  }

  return map
}

function hasPlayed(opponents: OpponentMap, p1: number, p2: number) {
  return opponents.get(p1)?.has(p2) ?? false
}

function pickPartnerIndex<T extends PairingPlayer>(queue: T[], player: T, opponents: OpponentMap) {
  const best = queue.findIndex(
    (candidate) => !hasPlayed(opponents, player.id, candidate.id) && candidate.departmentId !== player.departmentId
  )
  if (best !== -1) return best

  const noRematch = queue.findIndex((candidate) => !hasPlayed(opponents, player.id, candidate.id))
  if (noRematch !== -1) return noRematch

  const otherDepartment = queue.findIndex((candidate) => candidate.departmentId !== player.departmentId)
  if (otherDepartment !== -1) return otherDepartment

  return 0
}

export function buildPairsByPriority<T extends PairingPlayer>(players: T[], opponents: OpponentMap) {
  const queue = shuffle(players)
  const pairs: Array<{ player1Id: number; player2Id: number }> = []

  while (queue.length > 1) {
    const player1 = queue.shift()!
    const partnerIndex = pickPartnerIndex(queue, player1, opponents)
    const player2 = queue.splice(partnerIndex, 1)[0]

    pairs.push({
      player1Id: player1.id,
      player2Id: player2.id
    })
  }

  return {
    pairs,
    carry: queue[0] ?? null
  }
}
