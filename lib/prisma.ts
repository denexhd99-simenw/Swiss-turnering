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

  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref)
    const current = snap.exists ? (snap.data()?.[counterKey] ?? 0) : 0
    const next = Number(current) + 1

    tx.set(ref, { [counterKey]: next }, { merge: true })
    return next
  })
}

function normalizeOrderBy(orderBy?: AnyObject | AnyObject[]) {
  if (!orderBy) return []
  return Array.isArray(orderBy) ? orderBy : [orderBy]
}

function applyWhereInMemory<T extends AnyObject>(items: T[], where?: AnyObject): T[] {
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

function applyOrderByInMemory<T extends AnyObject>(items: T[], orderBy?: AnyObject | AnyObject[]) {
  const criteria = normalizeOrderBy(orderBy)
  if (criteria.length === 0) return [...items]

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

async function fetchDocs(collection: string, args: AnyObject = {}) {
  let query: any = db.collection(collection)
  let inequalityField: string | null = null

  const where = args.where ?? {}
  for (const [field, condition] of Object.entries(where)) {
    if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
      const cond = condition as AnyObject
      if (Object.prototype.hasOwnProperty.call(condition, 'in')) {
        query = query.where(field, 'in', cond.in)
        continue
      }
      if (Object.prototype.hasOwnProperty.call(condition, 'not')) {
        query = query.where(field, '!=', cond.not)
        inequalityField = inequalityField ?? field
        continue
      }
      if (Object.prototype.hasOwnProperty.call(condition, 'lt')) {
        query = query.where(field, '<', cond.lt)
        inequalityField = inequalityField ?? field
        continue
      }
      if (Object.prototype.hasOwnProperty.call(condition, 'lte')) {
        query = query.where(field, '<=', cond.lte)
        inequalityField = inequalityField ?? field
        continue
      }
      if (Object.prototype.hasOwnProperty.call(condition, 'gt')) {
        query = query.where(field, '>', cond.gt)
        inequalityField = inequalityField ?? field
        continue
      }
      if (Object.prototype.hasOwnProperty.call(condition, 'gte')) {
        query = query.where(field, '>=', cond.gte)
        inequalityField = inequalityField ?? field
        continue
      }
      throw new Error(`Unsupported where condition for ${field}`)
    } else {
      query = query.where(field, '==', condition)
    }
  }

  const criteria = normalizeOrderBy(args.orderBy)
  if (inequalityField && !criteria.some((c) => Object.keys(c)[0] === inequalityField)) {
    query = query.orderBy(inequalityField, 'asc')
  }
  for (const c of criteria) {
    const field = Object.keys(c)[0]
    const dir = c[field] === 'desc' ? 'desc' : 'asc'
    query = query.orderBy(field, dir)
  }

  if (typeof args.take === 'number') {
    query = query.limit(args.take)
  }

  try {
    const snapshot = await query.get()
    return snapshot.docs.map((doc: any) => doc.data())
  } catch {
    const fallback = await db.collection(collection).get()
    let rows = fallback.docs.map((doc: any) => doc.data())
    rows = applyWhereInMemory(rows, args.where)
    rows = applyOrderByInMemory(rows, args.orderBy)
    if (typeof args.take === 'number') rows = rows.slice(0, args.take)
    return rows
  }
}

async function getDepartmentsByIds(ids: number[]) {
  const unique = Array.from(new Set(ids.filter((id) => Number.isInteger(id))))
  if (unique.length === 0) return new Map<number, Department>()

  const chunks: number[][] = []
  for (let i = 0; i < unique.length; i += 10) chunks.push(unique.slice(i, i + 10))

  const rows: Department[] = []
  for (const chunk of chunks) {
    const docs = await fetchDocs('departments', { where: { id: { in: chunk } } })
    rows.push(...(docs as Department[]))
  }
  return new Map(rows.map((d) => [d.id, d]))
}

async function getPlayersByIds(ids: number[]) {
  const unique = Array.from(new Set(ids.filter((id) => Number.isInteger(id))))
  if (unique.length === 0) return new Map<number, Player>()

  const chunks: number[][] = []
  for (let i = 0; i < unique.length; i += 10) chunks.push(unique.slice(i, i + 10))

  const rows: Player[] = []
  for (const chunk of chunks) {
    const docs = await fetchDocs('players', { where: { id: { in: chunk } } })
    rows.push(...(docs as Player[]))
  }
  return new Map(rows.map((p) => [p.id, p]))
}

async function withDepartment(players: AnyObject[]) {
  const map = await getDepartmentsByIds(players.map((p) => p.departmentId))
  return players.map((p) => ({ ...p, department: map.get(p.departmentId) ?? null }))
}

async function withMatchIncludes(matches: AnyObject[], include?: AnyObject) {
  if (!include) return matches
  const ids: number[] = []
  if (include.player1) ids.push(...matches.map((m) => m.player1Id).filter(Boolean))
  if (include.player2) ids.push(...matches.map((m) => m.player2Id).filter(Boolean))
  if (include.winner) ids.push(...matches.map((m) => m.winnerId).filter(Boolean))
  const playersById = await getPlayersByIds(ids as number[])

  return matches.map((m) => ({
    ...m,
    player1: include.player1 ? (m.player1Id ? playersById.get(m.player1Id) ?? null : null) : undefined,
    player2: include.player2 ? (m.player2Id ? playersById.get(m.player2Id) ?? null : null) : undefined,
    winner: include.winner ? (m.winnerId ? playersById.get(m.winnerId) ?? null : null) : undefined
  }))
}

const player = {
  async findMany(args: AnyObject = {}) {
    let result: any[] = await fetchDocs('players', args)
    if (args.include?.department) result = await withDepartment(result)
    if (args.select) result = result.map((item) => applySelect(item, args.select))
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
    const filtered = (await fetchDocs('players', args)) as Player[]
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
    let result: any[] = await fetchDocs('departments', args)
    if (args.select) result = result.map((item) => applySelect(item, args.select))
    return result
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
    let result: any[] = await fetchDocs('matches', args)
    if (args.include) result = await withMatchIncludes(result, args.include)
    if (args.select) result = result.map((item) => applySelect(item, args.select))
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
    const list = await this.findMany({ ...args, take: args.take ?? 1 })
    return list[0] ?? null
  },

  async count(args: AnyObject = {}) {
    try {
      let query: any = db.collection('matches')
      const where = args.where ?? {}

      for (const [field, condition] of Object.entries(where)) {
        if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
          const cond = condition as AnyObject
          if (Object.prototype.hasOwnProperty.call(condition, 'in')) {
            query = query.where(field, 'in', cond.in)
          } else if (Object.prototype.hasOwnProperty.call(condition, 'not')) {
            query = query.where(field, '!=', cond.not)
          } else if (Object.prototype.hasOwnProperty.call(condition, 'lt')) {
            query = query.where(field, '<', cond.lt)
          } else if (Object.prototype.hasOwnProperty.call(condition, 'lte')) {
            query = query.where(field, '<=', cond.lte)
          } else if (Object.prototype.hasOwnProperty.call(condition, 'gt')) {
            query = query.where(field, '>', cond.gt)
          } else if (Object.prototype.hasOwnProperty.call(condition, 'gte')) {
            query = query.where(field, '>=', cond.gte)
          } else {
            throw new Error('unsupported-count-where')
          }
        } else {
          query = query.where(field, '==', condition)
        }
      }

      const agg = await query.count().get()
      return agg.data().count
    } catch {
      const items = await fetchDocs('matches', args)
      return items.length
    }
  },

  async aggregate(args: AnyObject = {}) {
    if (args._max?.round) {
      const rows = await fetchDocs('matches', {
        where: args.where,
        orderBy: { round: 'desc' },
        take: 1
      })
      const top = rows[0] as Match | undefined
      return { _max: { round: top ? Number(top.round) : null } }
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
    const filtered = (await fetchDocs('matches', args)) as Match[]
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
