import { prisma } from '@/lib/prisma'

const SWISS_PHASE = 'SWISS'
const KNOCKOUT_PHASE = 'KNOCKOUT'
const LAST_CHANCE_PHASE = 'LAST_CHANCE'
const BRACKET_SIZES = [4, 8, 16, 32]

type PlayerSeed = {
  id: number
  wins: number
  losses: number
  points: number
}

function sortSeeds(players: PlayerSeed[]) {
  return [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.wins !== a.wins) return b.wins - a.wins
    if (a.losses !== b.losses) return a.losses - b.losses
    return a.id - b.id
  })
}

async function createKnockoutRoundOne(participants: PlayerSeed[]) {
  const seeds = sortSeeds(participants).map((p) => p.id)
  const pairings: Array<{ player1Id: number; player2Id: number }> = []

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

  await prisma.$transaction(async (tx: any) => {
    for (const pairing of pairings) {
      await tx.match.create({
        data: {
          phase: KNOCKOUT_PHASE,
          round: 1,
          player1Id: pairing.player1Id,
          player2Id: pairing.player2Id,
          winnerId: null
        }
      })
    }
  })
}

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

  const allPlayers = (await prisma.player.findMany({
    select: { id: true, wins: true, losses: true, points: true }
  })) as PlayerSeed[]

  const qualified = sortSeeds(allPlayers.filter((p) => p.wins >= 3))

  const lastChanceMatches = await prisma.match.findMany({
    where: { phase: LAST_CHANCE_PHASE },
    orderBy: { id: 'asc' }
  })

  if (lastChanceMatches.length > 0) {
    const openLastChance = lastChanceMatches.filter((m: any) => m.winnerId === null && m.player2Id !== null)
    if (openLastChance.length > 0) {
      return new Response('Last chance matches are not finished yet', { status: 400 })
    }

    const winners = Array.from(
      new Set(
        lastChanceMatches
          .map((m: any) => m.winnerId)
          .filter((id: number | null): id is number => id !== null)
      )
    )

    const participantIds = Array.from(new Set([...qualified.map((p) => p.id), ...winners]))
    if (!BRACKET_SIZES.includes(participantIds.length)) {
      return new Response('Last chance result does not produce a valid knockout size (4/8/16/32)', {
        status: 400
      })
    }

    const participants = participantIds
      .map((id) => allPlayers.find((p) => p.id === id))
      .filter((p): p is PlayerSeed => !!p)

    await createKnockoutRoundOne(participants)
    return Response.json({
      success: true,
      phase: KNOCKOUT_PHASE,
      participants: participants.length
    })
  }

  const targetSize = BRACKET_SIZES.find((size) => size >= qualified.length && size <= allPlayers.length)
  if (!targetSize) {
    return new Response('Unable to create valid knockout size from current player count', { status: 400 })
  }

  const extraSlotsNeeded = targetSize - qualified.length

  if (extraSlotsNeeded === 0) {
    await createKnockoutRoundOne(qualified)

    return Response.json({
      success: true,
      phase: KNOCKOUT_PHASE,
      participants: qualified.length
    })
  }

  const candidates = sortSeeds(allPlayers.filter((p) => p.wins < 3))
  const requiredCandidates = extraSlotsNeeded * 2

  if (candidates.length < requiredCandidates) {
    return new Response('Not enough players to run last chance for a valid knockout size', { status: 400 })
  }

  const selected = candidates.slice(0, requiredCandidates)

  await prisma.$transaction(async (tx: any) => {
    for (let i = 0; i < selected.length; i += 2) {
      await tx.match.create({
        data: {
          phase: LAST_CHANCE_PHASE,
          round: 1,
          player1Id: selected[i].id,
          player2Id: selected[i + 1].id,
          winnerId: null
        }
      })
    }
  })

  return Response.json({
    success: true,
    phase: LAST_CHANCE_PHASE,
    message: 'Last chance round created. Complete these matches before starting knockout.',
    neededWinners: extraSlotsNeeded
  })
}
