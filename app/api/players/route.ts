import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const players = await prisma.player.findMany({
    include: { department: true }
  })
  return Response.json(players)
}

export async function POST(req: Request) {
  const body = await req.json()

  if (!body.name || !body.departmentId) {
    return new Response('Missing fields', { status: 400 })
  }

  const player = await prisma.player.create({
    data: {
      name: body.name,
      departmentId: Number(body.departmentId)
    }
  })

  return Response.json(player)
}


export async function DELETE(req: Request) {
  const { id } = await req.json()
  const playerId = Number(id)

  if (!Number.isInteger(playerId)) {
    return new Response('Missing id', { status: 400 })
  }

  const relatedMatches = await prisma.match.findMany({
    where: { player1Id: playerId }
  })
  const relatedMatchesAsPlayer2 = await prisma.match.findMany({
    where: { player2Id: playerId }
  })
  const relatedWins = await prisma.match.findMany({
    where: { winnerId: playerId }
  })

  if (relatedMatches.length > 0 || relatedMatchesAsPlayer2.length > 0 || relatedWins.length > 0) {
    return Response.json(
      {
        error: 'Spelaren kan ikkje slettast medan han er registrert i turneringskampar. Rydd turneringa først.'
      },
      { status: 400 }
    )
  }

  await prisma.player.delete({
    where: { id: playerId }
  })

  return Response.json({ success: true })
}
