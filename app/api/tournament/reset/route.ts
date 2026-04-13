import { prisma } from '@/lib/prisma'

export async function POST() {
  await prisma.$transaction(async (tx) => {
    await tx.match.deleteMany()
    await tx.player.updateMany({
      data: {
        points: 0,
        wins: 0,
        losses: 0
      }
    })
  })

  return Response.json({
    success: true,
    message: 'Tidlegare turnering er fjerna'
  })
}
