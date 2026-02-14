import { prisma } from '@/lib/prisma'

const SWISS_PHASE = 'SWISS'
const POINTS_PER_WIN = 3

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

export async function POST() {
  const players = (await prisma.player.findMany({
    orderBy: { id: 'asc' }
  })) as any[]

  if (players.length < 4) {
    return new Response('Minimum 4 players required', { status: 400 })
  }

  const shuffled = shuffle(players)

  await prisma.$transaction(async (tx) => {
    await tx.match.deleteMany()
    await tx.player.updateMany({
      data: {
        points: 0,
        wins: 0,
        losses: 0
      }
    })

    for (let i = 0; i < shuffled.length; i += 2) {
      const p1 = shuffled[i]
      const p2 = shuffled[i + 1]

      if (!p2) {
        await tx.match.create({
          data: {
            phase: SWISS_PHASE,
            round: 1,
            player1Id: p1.id,
            player2Id: null,
            winnerId: p1.id
          }
        })
        await tx.player.update({
          where: { id: p1.id },
          data: {
            wins: { increment: 1 },
            points: { increment: POINTS_PER_WIN }
          }
        })
        continue
      }

      await tx.match.create({
        data: {
          phase: SWISS_PHASE,
          round: 1,
          player1Id: p1.id,
          player2Id: p2.id
        }
      })
    }
  })

  return Response.json({ success: true, message: 'Swiss round 1 started' })
}
