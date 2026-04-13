import { prisma } from '@/lib/prisma'

const KNOCKOUT_PHASE = 'KNOCKOUT'
const POINTS_PER_WIN = 3

type KnockoutPlayer = {
  id: number
}

function shufflePlayers<T>(items: T[]) {
  const shuffled = [...items]

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled
}

export async function POST() {
  const players = (await prisma.player.findMany({
    orderBy: { id: 'asc' }
  })) as KnockoutPlayer[]

  if (players.length < 2) {
    return new Response('Minimum 2 players required', { status: 400 })
  }

  const shuffledPlayers = shufflePlayers(players)

  await prisma.$transaction(async (tx) => {
    await tx.match.deleteMany()
    await tx.player.updateMany({
      data: {
        points: 0,
        wins: 0,
        losses: 0
      }
    })

    for (let i = 0; i < shuffledPlayers.length; i += 2) {
      const player1 = shuffledPlayers[i]
      const player2 = shuffledPlayers[i + 1] ?? null

      await tx.match.create({
        data: {
          phase: KNOCKOUT_PHASE,
          round: 1,
          player1Id: player1.id,
          player2Id: player2?.id ?? null,
          winnerId: player2 ? null : player1.id
        }
      })

      if (!player2) {
        await tx.player.update({
          where: { id: player1.id },
          data: {
            wins: { increment: 1 },
            points: { increment: POINTS_PER_WIN }
          }
        })
      }
    }
  })

  return Response.json({
    success: true,
    message: 'Knockout-turnering starta'
  })
}
