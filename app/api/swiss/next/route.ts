import { prisma } from '@/lib/prisma'
import { buildOpponentMap, buildPairsByPriority, shuffle } from '@/lib/swiss-pairing'

const SWISS_PHASE = 'SWISS'
const POINTS_PER_WIN = 3
const ADVANCE_WINS = 3
const ELIMINATION_LOSSES = 3

type SwissPlayer = {
  id: number
  wins: number
  losses: number
  departmentId: number
}

function sortedGroupKeys(players: SwissPlayer[]) {
  const keys = new Set(players.map((p) => `${p.wins}-${p.losses}`))
  return Array.from(keys).sort((a, b) => {
    const [aw, al] = a.split('-').map(Number)
    const [bw, bl] = b.split('-').map(Number)
    if (bw !== aw) return bw - aw
    return al - bl
  })
}

export async function POST() {
  const openSwiss = await prisma.match.count({
    where: {
      phase: SWISS_PHASE,
      player2Id: { not: null },
      winnerId: null
    }
  })

  if (openSwiss > 0) {
    return new Response('Current Swiss round is not finished', { status: 400 })
  }

  const activePlayers = await prisma.player.findMany({
    where: {
      wins: { lt: ADVANCE_WINS },
      losses: { lt: ELIMINATION_LOSSES }
    },
    select: { id: true, wins: true, losses: true, departmentId: true },
    orderBy: [
      { wins: 'desc' },
      { losses: 'asc' },
      { id: 'asc' }
    ]
  })

  if (activePlayers.length < 2) {
    return Response.json({ success: true, message: 'Swiss stage finished' })
  }

  const lastRound = await prisma.match.aggregate({
    where: { phase: SWISS_PHASE },
    _max: { round: true }
  })
  const nextRound = (lastRound._max.round ?? 0) + 1

  const alreadyCreated = await prisma.match.count({
    where: {
      phase: SWISS_PHASE,
      round: nextRound
    }
  })
  if (alreadyCreated > 0) {
    return Response.json({ success: true, round: nextRound, message: 'Round already exists' })
  }

  const playedMatches = await prisma.match.findMany({
    where: {
      phase: SWISS_PHASE,
      player1Id: { not: null },
      player2Id: { not: null }
    },
    select: {
      player1Id: true,
      player2Id: true
    }
  })
  const opponents = buildOpponentMap(playedMatches)

  const grouped: Record<string, SwissPlayer[]> = {}
  for (const player of activePlayers) {
    const key = `${player.wins}-${player.losses}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(player)
  }

  const keys = sortedGroupKeys(activePlayers)
  const pairings: Array<{ player1Id: number; player2Id: number | null }> = []
  let carry: SwissPlayer | null = null

  for (const key of keys) {
    const group = shuffle(grouped[key])
    if (carry) group.unshift(carry)

    const groupedPairs = buildPairsByPriority(group, opponents)
    carry = groupedPairs.carry
    pairings.push(...groupedPairs.pairs)
  }

  await prisma.$transaction(async (tx) => {
    for (const pairing of pairings) {
      await tx.match.create({
        data: {
          phase: SWISS_PHASE,
          round: nextRound,
          player1Id: pairing.player1Id,
          player2Id: pairing.player2Id
        }
      })
    }

    if (carry) {
      await tx.match.create({
        data: {
          phase: SWISS_PHASE,
          round: nextRound,
          player1Id: carry.id,
          player2Id: null,
          winnerId: carry.id
        }
      })
      await tx.player.update({
        where: { id: carry.id },
        data: {
          wins: { increment: 1 },
          points: { increment: POINTS_PER_WIN }
        }
      })
    }
  })

  return Response.json({ success: true, round: nextRound })
}
