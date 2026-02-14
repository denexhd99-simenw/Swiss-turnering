import { prisma } from '@/lib/prisma'

const DEFAULT_PHASE = 'SWISS'

export async function GET() {
  const matches = await prisma.match.findMany({
    include: {
      player1: true,
      player2: true,
      winner: true
    },
    orderBy: [
      { round: 'asc' },
      { createdAt: 'asc' }
    ]
  })

  return Response.json(matches)
}

export async function POST(req: Request) {
  const body = await req.json()
  const player1Id = Number(body.player1Id)
  const player2Id = Number(body.player2Id)
  const round = Number(body.round ?? 1)
  const phase = typeof body.phase === 'string' ? body.phase : DEFAULT_PHASE

  if (!Number.isInteger(player1Id) || !Number.isInteger(player2Id)) {
    return new Response('Missing players', { status: 400 })
  }

  if (player1Id === player2Id) {
    return new Response('Player cannot play against themselves', { status: 400 })
  }

  const match = await prisma.match.create({
    data: {
      round,
      phase,
      player1Id,
      player2Id
    }
  })

  return Response.json(match)
}

export async function DELETE(req: Request) {
  const { matchId } = await req.json()
  const id = Number(matchId)

  if (!Number.isInteger(id)) {
    return new Response('Missing matchId', { status: 400 })
  }

  const match = await prisma.match.findUnique({
    where: { id }
  })

  if (!match) {
    return new Response('Match not found', { status: 404 })
  }

  if (match.winnerId) {
    const loserId = match.player1Id === match.winnerId ? match.player2Id : match.player1Id

    await prisma.player.update({
      where: { id: match.winnerId },
      data: {
        points: { decrement: 3 },
        wins: { decrement: 1 }
      }
    })

    if (loserId) {
      await prisma.player.update({
        where: { id: loserId },
        data: { losses: { decrement: 1 } }
      })
    }
  }

  await prisma.match.delete({
    where: { id }
  })

  return Response.json({ success: true })
}
