import { prisma } from '@/lib/prisma'

export async function GET() {
  return Response.json(await prisma.department.findMany())
}

export async function POST(req: Request) {
  const body = await req.json()

  if (!body.name) {
    return new Response('Missing name', { status: 400 })
  }

  const department = await prisma.department.create({
    data: { name: body.name }
  })

  return Response.json(department)
}

export async function DELETE(req: Request) {
  const body = await req.json()
  const departmentId = Number(body.departmentId)

  if (!Number.isInteger(departmentId)) {
    return new Response('Missing departmentId', { status: 400 })
  }

  const department = await prisma.department.findUnique({
    where: { id: departmentId }
  })

  if (!department) {
    return new Response('Department not found', { status: 404 })
  }

  const playersInDepartment = await prisma.player.findMany({
    where: { departmentId },
    select: { id: true, name: true }
  })

  if (playersInDepartment.length === 0) {
    await prisma.department.delete({
      where: { id: departmentId }
    })

    return Response.json({ success: true })
  }

  const reassignments = Array.isArray(body.reassignments) ? body.reassignments : []
  const byPlayer = new Map<number, number>()

  for (const item of reassignments) {
    const playerId = Number(item.playerId)
    const newDepartmentId = Number(item.departmentId)

    if (Number.isInteger(playerId) && Number.isInteger(newDepartmentId)) {
      byPlayer.set(playerId, newDepartmentId)
    }
  }

  const missing = playersInDepartment.some((player) => !byPlayer.has(player.id))
  if (missing) {
    return Response.json(
      { error: 'All players must be reassigned before deletion' },
      { status: 400 }
    )
  }

  const targetDepartmentIds = Array.from(new Set(Array.from(byPlayer.values())))
  if (targetDepartmentIds.some((id) => id === departmentId)) {
    return Response.json(
      { error: 'Cannot reassign to the department being deleted' },
      { status: 400 }
    )
  }

  const validTargets = await prisma.department.findMany({
    where: { id: { in: targetDepartmentIds } },
    select: { id: true }
  })
  const validSet = new Set(validTargets.map((d) => d.id))

  if (targetDepartmentIds.some((id) => !validSet.has(id))) {
    return Response.json(
      { error: 'One or more target departments do not exist' },
      { status: 400 }
    )
  }

  await prisma.$transaction(async (tx) => {
    for (const player of playersInDepartment) {
      await tx.player.update({
        where: { id: player.id },
        data: { departmentId: byPlayer.get(player.id)! }
      })
    }

    await tx.department.delete({
      where: { id: departmentId }
    })
  })

  return Response.json({ success: true })
}
