import { prisma } from '@/lib/prisma'

export async function GET() {
  const [players, matches, departments] = await Promise.all([
    prisma.player.findMany({
      include: { department: true }
    }),
    prisma.match.findMany({
      include: {
        player1: true,
        player2: true,
        winner: true
      },
      orderBy: [{ round: 'asc' }, { createdAt: 'asc' }]
    }),
    prisma.department.findMany()
  ])

  return Response.json({
    players,
    matches,
    departments
  })
}
