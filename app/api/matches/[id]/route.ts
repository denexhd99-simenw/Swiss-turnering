import { prisma } from '@/lib/prisma'

const KNOCKOUT_PHASE = 'KNOCKOUT'
const POINTS_PER_WIN = 3

async function createNextKnockoutRoundIfReady() {
  const knockoutMatches = await prisma.match.findMany({
    where: { phase: KNOCKOUT_PHASE },
    orderBy: [{ round: 'asc' }, { id: 'asc' }]
  })

  if (knockoutMatches.length === 0) return

  const currentRound = Math.max(...knockoutMatches.map((match) => match.round))
  const currentRoundMatches = knockoutMatches.filter((match) => match.round === currentRound)
  const hasOpenMatches = currentRoundMatches.some(
    (match) => match.player2Id !== null && match.winnerId === null
  )

  if (hasOpenMatches) return

  const nextRound = currentRound + 1
  if (knockoutMatches.some((match) => match.round === nextRound)) return

  const winners = currentRoundMatches
    .map((match) => match.winnerId ?? (match.player2Id === null ? match.player1Id : null))
    .filter((playerId): playerId is number => playerId !== null)

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

      if (player2Id === null) {
        await tx.player.update({
          where: { id: player1Id },
          data: {
            wins: { increment: 1 },
            points: { increment: POINTS_PER_WIN }
          }
        })
      }
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
          wins: { decrement: 1 },
          points: { decrement: POINTS_PER_WIN }
        }
      })
      await tx.player.update({
        where: { id: previousLoser },
        data: {
          losses: { decrement: 1 }
        }
      })
    }

    await tx.player.update({
      where: { id: winner },
      data: {
        wins: { increment: 1 },
        points: { increment: POINTS_PER_WIN }
      }
    })
    await tx.player.update({
      where: { id: loser },
      data: {
        losses: { increment: 1 }
      }
    })

    await tx.match.update({
      where: { id: matchId },
      data: { winnerId: winner }
    })
  })

  if (match.phase === KNOCKOUT_PHASE) {
    await createNextKnockoutRoundIfReady()
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
