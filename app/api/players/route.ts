import { prisma } from '@/lib/prisma'

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

  if (!id) {
    return new Response('Missing id', { status: 400 })
  }

  await prisma.player.delete({
    where: { id }
  })

  return Response.json({ success: true })
}
