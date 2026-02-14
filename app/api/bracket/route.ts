import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    const players = await prisma.player.findMany()

    if (players.length < 2) {
      return NextResponse.json(
        { error: "Not enough players" },
        { status: 400 }
      )
    }

    // Fjern gamle kamper
    await prisma.match.deleteMany()

    // Runde 1 pairing (enkel versjon)
    const shuffled = players.sort(() => Math.random() - 0.5)

    for (let i = 0; i < shuffled.length; i += 2) {
      const p1 = shuffled[i]
      const p2 = shuffled[i + 1]

      await prisma.match.create({
        data: {
          player1Id: p1.id,
          player2Id: p2 ? p2.id : null,
          round: 1,
          phase: "SWISS",
        },
      })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    )
  }
}
