import { prisma } from '@/lib/prisma'

const SWISS_PHASE = 'SWISS'
const KNOCKOUT_PHASE = 'KNOCKOUT'
const POINTS_PER_WIN = 3
const ADVANCE_WINS = 3
const ELIMINATION_LOSSES = 3

type SwissPlayer = {
  id: number
  wins: number
  losses: number
}

function shuffle<T>(array: T[]) {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = copy[i]
    copy[i] = copy[j]
    copy[j] = temp
  }
  return copy
}

function groupKey(player: SwissPlayer) {
  return `${player.wins}-${player.losses}`
}

function sortedGroupKeys(players: SwissPlayer[]) {
  const keys = new Set(players.map(groupKey))
  return Array.from(keys).sort((a, b) => {
    const [aw, al] = a.split('-').map(Number)
    const [bw, bl] = b.split('-').map(Number)
    if (bw !== aw) return bw - aw
    return al - bl
  })
}

async function createNextSwissRoundIfReady() {
  const openSwiss = await prisma.match.count({
    where: {
      phase: SWISS_PHASE,
      player2Id: { not: null },
      winnerId: null
    }
  })

  if (openSwiss > 0) return

  const activePlayers = await prisma.player.findMany({
    where: {
      wins: { lt: ADVANCE_WINS },
      losses: { lt: ELIMINATION_LOSSES }
    },
    select: {
      id: true,
      wins: true,
      losses: true
    },
    orderBy: [
      { wins: 'desc' },
      { losses: 'asc' },
      { id: 'asc' }
    ]
  })

  if (activePlayers.length < 2) return

  const lastRound = await prisma.match.aggregate({
    where: { phase: SWISS_PHASE },
    _max: { round: true }
  })
  const nextRound = (lastRound._max.round ?? 0) + 1

  const existingNextRound = await prisma.match.count({
    where: {
      phase: SWISS_PHASE,
      round: nextRound
    }
  })

  if (existingNextRound > 0) return

  const grouped: Record<string, SwissPlayer[]> = {}
  for (const player of activePlayers) {
    const key = groupKey(player)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(player)
  }

  const keys = sortedGroupKeys(activePlayers)
  const pairings: Array<{ player1Id: number; player2Id: number | null }> = []
  let carry: SwissPlayer | null = null

  for (const key of keys) {
    const group = shuffle(grouped[key])
    if (carry) group.unshift(carry)

    if (group.length % 2 === 1) {
      carry = group.pop() ?? null
    } else {
      carry = null
    }

    for (let i = 0; i < group.length; i += 2) {
      pairings.push({
        player1Id: group[i].id,
        player2Id: group[i + 1].id
      })
    }
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
}

async function createNextKnockoutRoundIfReady() {
  const knockoutMatches = await prisma.match.findMany({
    where: { phase: KNOCKOUT_PHASE },
    orderBy: [{ round: 'asc' }, { id: 'asc' }]
  })

  if (knockoutMatches.length === 0) return

  const currentRound = Math.max(...knockoutMatches.map((m) => m.round))
  const currentRoundMatches = knockoutMatches.filter((m) => m.round === currentRound)
  const hasOpenMatches = currentRoundMatches.some((m) => m.player2Id !== null && m.winnerId === null)

  if (hasOpenMatches) return

  const nextRound = currentRound + 1
  const nextRoundExists = knockoutMatches.some((m) => m.round === nextRound)
  if (nextRoundExists) return

  const winners = currentRoundMatches
    .map((m) => m.winnerId ?? (m.player2Id === null ? m.player1Id : null))
    .filter((id): id is number => id !== null)

  if (winners.length <= 1) return

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < winners.length; i += 2) {
      const player1Id = winners[i]
      const player2Id = winners[i + 1] ?? null

      await tx.match.create({
        data: {
          phase: KNOCKOUT_PHASE,
          round: nextRound,
          player1Id,
          player2Id,
          winnerId: player2Id === null ? player1Id : null
        }
      })
    }
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const matchId = Number(params.id)
  const { winnerId } = await req.json()
  const winner = Number(winnerId)

  if (!Number.isInteger(matchId) || !Number.isInteger(winner)) {
    return new Response('Invalid input', { status: 400 })
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId }
  })

  if (!match) return new Response('Match not found', { status: 404 })
  if (!match.player1Id || !match.player2Id) {
    return new Response('Cannot set winner on bye/TBA match', { status: 400 })
  }
  if (winner !== match.player1Id && winner !== match.player2Id) {
    return new Response('Winner must be one of the players in the match', { status: 400 })
  }

  if (match.phase === SWISS_PHASE) {
    const loser = winner === match.player1Id ? match.player2Id : match.player1Id
    const previousWinner = match.winnerId
    const previousLoser = previousWinner
      ? previousWinner === match.player1Id
        ? match.player2Id
        : match.player1Id
      : null

    await prisma.$transaction(async (tx) => {
      if (previousWinner && previousLoser) {
        await tx.player.update({
          where: { id: previousWinner },
          data: {
            points: { decrement: POINTS_PER_WIN },
            wins: { decrement: 1 }
          }
        })
        await tx.player.update({
          where: { id: previousLoser },
          data: { losses: { decrement: 1 } }
        })
      }

      await tx.player.update({
        where: { id: winner },
        data: {
          points: { increment: POINTS_PER_WIN },
          wins: { increment: 1 }
        }
      })
      await tx.player.update({
        where: { id: loser },
        data: { losses: { increment: 1 } }
      })

      await tx.match.update({
        where: { id: matchId },
        data: { winnerId: winner }
      })
    })

    await createNextSwissRoundIfReady()
  } else {
    await prisma.match.update({
      where: { id: matchId },
      data: { winnerId: winner }
    })

    if (match.phase === KNOCKOUT_PHASE) {
      await createNextKnockoutRoundIfReady()
    }
  }

  const updated = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      player1: true,
      player2: true,
      winner: true
    }
  })

  return Response.json(updated)
}
