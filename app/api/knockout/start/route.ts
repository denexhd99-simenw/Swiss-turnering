import { prisma } from '@/lib/prisma'

const SWISS_PHASE = 'SWISS'
const KNOCKOUT_PHASE = 'KNOCKOUT'

export async function POST() {
  const openSwissMatches = await prisma.match.count({
    where: {
      phase: SWISS_PHASE,
      player2Id: { not: null },
      winnerId: null
    }
  })

  if (openSwissMatches > 0) {
    return new Response('Swiss is not finished yet', { status: 400 })
  }

  const existingKnockout = await prisma.match.count({
    where: { phase: KNOCKOUT_PHASE }
  })

  if (existingKnockout > 0) {
    return new Response('Knockout already started', { status: 400 })
  }

  const qualified = await prisma.player.findMany({
    where: { wins: { gte: 3 } },
    orderBy: [
      { points: 'desc' },
      { wins: 'desc' },
      { losses: 'asc' },
      { id: 'asc' }
    ],
    select: { id: true }
  })

  if (qualified.length < 2) {
    return new Response('Need at least two qualified players', { status: 400 })
  }

  const seeds = qualified.map((p) => p.id)
  const pairings: Array<{ player1Id: number; player2Id: number | null }> = []

  let left = 0
  let right = seeds.length - 1

  while (left < right) {
    pairings.push({
      player1Id: seeds[left],
      player2Id: seeds[right]
    })
    left += 1
    right -= 1
  }

  if (left === right) {
    pairings.push({
      player1Id: seeds[left],
      player2Id: null
    })
  }

  await prisma.$transaction(async (tx) => {
    for (const pairing of pairings) {
      await tx.match.create({
        data: {
          phase: KNOCKOUT_PHASE,
          round: 1,
          player1Id: pairing.player1Id,
          player2Id: pairing.player2Id,
          winnerId: pairing.player2Id === null ? pairing.player1Id : null
        }
      })
    }
  })

  return Response.json({ success: true, created: pairings.length })
}
