import { prisma } from '@/lib/prisma'
import { buildPairsByPriority } from '@/lib/swiss-pairing'

const SWISS_PHASE = 'SWISS'
const POINTS_PER_WIN = 3

export async function POST() {
  const players = (await prisma.player.findMany({
    orderBy: { id: 'asc' }
  })) as any[]

  if (players.length < 4) {
    return new Response('Minimum 4 players required', { status: 400 })
  }

  const { pairs, carry } = buildPairsByPriority(players, new Map())

  await prisma.$transaction(async (tx) => {
    await tx.match.deleteMany()
    await tx.player.updateMany({
      data: {
        points: 0,
        wins: 0,
        losses: 0
      }
    })

    for (const pair of pairs) {
      await tx.match.create({
        data: {
          phase: SWISS_PHASE,
          round: 1,
          player1Id: pair.player1Id,
          player2Id: pair.player2Id
        }
      })
    }

    if (carry) {
      await tx.match.create({
        data: {
          phase: SWISS_PHASE,
          round: 1,
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

  return Response.json({ success: true, message: 'Swiss round 1 started' })
}
