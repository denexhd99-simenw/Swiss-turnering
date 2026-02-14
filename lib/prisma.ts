import { db } from '@/lib/firebase-admin'

type Department = {
  id: number
  name: string
}

type Player = {
  id: number
  name: string
  points: number
  wins: number
  losses: number
  departmentId: number
}

type Match = {
  id: number
  round: number
  phase: string
  player1Id: number | null
  player2Id: number | null
  winnerId: number | null
  createdAt: string
}

type AnyObject = Record<string, any>

const META_COLLECTION = '__meta'
const COUNTERS_DOC = 'counters'

async function nextId(counterKey: string) {
  const ref = db.collection(META_COLLECTION).doc(COUNTERS_DOC)

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const current = snap.exists ? (snap.data()?.[counterKey] ?? 0) : 0
    const next = Number(current) + 1

    tx.set(ref, { [counterKey]: next }, { merge: true })
    return next
  })
}

async function listDepartments() {
  const snapshot = await db.collection('departments').get()
  return snapshot.docs.map((doc: any) => doc.data() as Department)
}

async function listPlayers() {
  const snapshot = await db.collection('players').get()
  return snapshot.docs.map((doc: any) => doc.data() as Player)
}

async function listMatches() {
  const snapshot = await db.collection('matches').get()
  return snapshot.docs.map((doc: any) => doc.data() as Match)
}

function applyWhere<T extends AnyObject>(items: T[], where?: AnyObject): T[] {
  if (!where) return items

  return items.filter((item) => {
    for (const [field, condition] of Object.entries(where)) {
      const value = (item as AnyObject)[field]

      if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
        if (Object.prototype.hasOwnProperty.call(condition, 'not')) {
          if (value === condition.not) return false
        }
        if (Object.prototype.hasOwnProperty.call(condition, 'lt')) {
          if (!(value < condition.lt)) return false
        }
        if (Object.prototype.hasOwnProperty.call(condition, 'lte')) {
          if (!(value <= condition.lte)) return false
        }
        if (Object.prototype.hasOwnProperty.call(condition, 'gt')) {
          if (!(value > condition.gt)) return false
        }
        if (Object.prototype.hasOwnProperty.call(condition, 'gte')) {
          if (!(value >= condition.gte)) return false
        }
        if (Object.prototype.hasOwnProperty.call(condition, 'in')) {
          const arr = Array.isArray(condition.in) ? condition.in : []
          if (!arr.includes(value)) return false
        }
      } else if (value !== condition) {
        return false
      }
    }

    return true
  })
}

function applyOrderBy<T extends AnyObject>(items: T[], orderBy?: AnyObject | AnyObject[]): T[] {
  if (!orderBy) return [...items]
  const criteria = Array.isArray(orderBy) ? orderBy : [orderBy]

  return [...items].sort((a, b) => {
    for (const c of criteria) {
      const field = Object.keys(c)[0]
      const dir = c[field] === 'desc' ? -1 : 1
      const av = (a as AnyObject)[field]
      const bv = (b as AnyObject)[field]

      if (av === bv) continue
      if (av === null || av === undefined) return -1 * dir
      if (bv === null || bv === undefined) return 1 * dir
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
    }

    return 0
  })
}

function applyTake<T>(items: T[], take?: number): T[] {
  if (typeof take !== 'number') return items
  return items.slice(0, take)
}

function applySelect<T extends AnyObject>(item: T, select?: AnyObject) {
  if (!select) return item
  const result: AnyObject = {}
  for (const [key, enabled] of Object.entries(select)) {
    if (enabled) result[key] = (item as AnyObject)[key]
  }
  return result
}

function applyUpdate<T extends AnyObject>(item: T, data: AnyObject): T {
  const copy: AnyObject = { ...item }

  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (typeof value.increment === 'number') {
        copy[key] = Number(copy[key] ?? 0) + value.increment
        continue
      }
      if (typeof value.decrement === 'number') {
        copy[key] = Number(copy[key] ?? 0) - value.decrement
        continue
      }
    }
    copy[key] = value
  }

  return copy as T
}

async function withDepartment(players: AnyObject[]) {
  const departments = await listDepartments()
  const byId = new Map(departments.map((d) => [d.id, d]))
  return players.map((p) => ({ ...p, department: byId.get(p.departmentId) ?? null }))
}

async function withMatchIncludes(matches: AnyObject[], include?: AnyObject) {
  if (!include) return matches
  const players = await listPlayers()
  const byId = new Map(players.map((p) => [p.id, p]))

  return matches.map((m) => ({
    ...m,
    player1: include.player1 ? (m.player1Id ? byId.get(m.player1Id) ?? null : null) : undefined,
    player2: include.player2 ? (m.player2Id ? byId.get(m.player2Id) ?? null : null) : undefined,
    winner: include.winner ? (m.winnerId ? byId.get(m.winnerId) ?? null : null) : undefined
  }))
}

const player = {
  async findMany(args: AnyObject = {}) {
    let items = await listPlayers()
    items = applyWhere(items, args.where)
    items = applyOrderBy(items, args.orderBy)
    items = applyTake(items, args.take)

    let result: any[] = items
    if (args.include?.department) {
      result = await withDepartment(result)
    }
    if (args.select) {
      result = result.map((item) => applySelect(item, args.select))
    }
    return result
  },

  async create(args: AnyObject) {
    const id = await nextId('players')
    const data = args.data ?? {}
    const item: Player = {
      id,
      name: data.name,
      points: data.points ?? 0,
      wins: data.wins ?? 0,
      losses: data.losses ?? 0,
      departmentId: Number(data.departmentId)
    }
    await db.collection('players').doc(String(id)).set(item)
    return item
  },

  async delete(args: AnyObject) {
    const id = Number(args.where?.id)
    await db.collection('players').doc(String(id)).delete()
    return { id }
  },

  async update(args: AnyObject) {
    const id = Number(args.where?.id)
    const ref = db.collection('players').doc(String(id))
    const snap = await ref.get()
    if (!snap.exists) throw new Error('Player not found')

    const current = snap.data() as Player
    const updated = applyUpdate(current, args.data ?? {})
    await ref.set(updated)
    return updated
  },

  async updateMany(args: AnyObject) {
    const all = await listPlayers()
    const filtered = applyWhere(all, args.where)
    let count = 0

    for (const p of filtered) {
      const updated = applyUpdate(p, args.data ?? {})
      await db.collection('players').doc(String(p.id)).set(updated)
      count += 1
    }

    return { count }
  }
}

const department = {
  async findMany(args: AnyObject = {}) {
    let items = await listDepartments()
    items = applyWhere(items, args.where)
    items = applyOrderBy(items, args.orderBy)
    items = applyTake(items, args.take)

    if (args.select) {
      return items.map((item) => applySelect(item, args.select))
    }

    return items
  },

  async findUnique(args: AnyObject) {
    const id = Number(args.where?.id)
    const snap = await db.collection('departments').doc(String(id)).get()
    if (!snap.exists) return null
    return snap.data() as Department
  },

  async create(args: AnyObject) {
    const id = await nextId('departments')
    const item: Department = {
      id,
      name: args.data?.name
    }
    await db.collection('departments').doc(String(id)).set(item)
    return item
  },

  async delete(args: AnyObject) {
    const id = Number(args.where?.id)
    await db.collection('departments').doc(String(id)).delete()
    return { id }
  }
}

const match = {
  async findMany(args: AnyObject = {}) {
    let items = await listMatches()
    items = applyWhere(items, args.where)
    items = applyOrderBy(items, args.orderBy)
    items = applyTake(items, args.take)

    let result: any[] = items
    if (args.include) {
      result = await withMatchIncludes(result, args.include)
    }
    if (args.select) {
      result = result.map((item) => applySelect(item, args.select))
    }
    return result
  },

  async findUnique(args: AnyObject) {
    const id = Number(args.where?.id)
    const snap = await db.collection('matches').doc(String(id)).get()
    if (!snap.exists) return null

    const base = snap.data() as Match
    if (!args.include) return base
    const included = await withMatchIncludes([base], args.include)
    return included[0]
  },

  async findFirst(args: AnyObject = {}) {
    const list = await this.findMany(args)
    return list[0] ?? null
  },

  async count(args: AnyObject = {}) {
    const items = await listMatches()
    return applyWhere(items, args.where).length
  },

  async aggregate(args: AnyObject = {}) {
    const items = applyWhere(await listMatches(), args.where)
    if (args._max?.round) {
      const max = items.length ? Math.max(...items.map((m) => Number(m.round ?? 0))) : null
      return { _max: { round: max } }
    }
    return { _max: {} }
  },

  async create(args: AnyObject) {
    const id = await nextId('matches')
    const data = args.data ?? {}
    const item: Match = {
      id,
      round: Number(data.round ?? 1),
      phase: data.phase ?? 'SWISS',
      player1Id: data.player1Id ?? null,
      player2Id: data.player2Id ?? null,
      winnerId: data.winnerId ?? null,
      createdAt: data.createdAt ?? new Date().toISOString()
    }

    await db.collection('matches').doc(String(id)).set(item)
    return item
  },

  async createMany(args: AnyObject) {
    const data = Array.isArray(args.data) ? args.data : []
    let count = 0
    for (const item of data) {
      await this.create({ data: item })
      count += 1
    }
    return { count }
  },

  async update(args: AnyObject) {
    const id = Number(args.where?.id)
    const ref = db.collection('matches').doc(String(id))
    const snap = await ref.get()
    if (!snap.exists) throw new Error('Match not found')

    const current = snap.data() as Match
    const updated = applyUpdate(current, args.data ?? {})
    await ref.set(updated)
    return updated
  },

  async delete(args: AnyObject) {
    const id = Number(args.where?.id)
    await db.collection('matches').doc(String(id)).delete()
    return { id }
  },

  async deleteMany(args: AnyObject = {}) {
    const all = await listMatches()
    const filtered = applyWhere(all, args.where)
    let count = 0

    for (const m of filtered) {
      await db.collection('matches').doc(String(m.id)).delete()
      count += 1
    }

    return { count }
  }
}

export const prisma: any = {
  player,
  department,
  match,
  async $transaction(callback: (tx: any) => Promise<any>) {
    return callback(prisma)
  }
}
