import { db } from '@/lib/firebase-admin'

function maskEmail(email?: string) {
  if (!email) return null
  const [name, domain] = email.split('@')
  if (!name || !domain) return 'invalid'
  const visible = name.slice(0, 3)
  return `${visible}***@${domain}`
}

export async function GET() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  const env = {
    FIREBASE_PROJECT_ID: !!projectId,
    FIREBASE_CLIENT_EMAIL: !!clientEmail,
    FIREBASE_PRIVATE_KEY: !!privateKey
  }

  let firestore: {
    canRead: boolean
    details: string
  } = {
    canRead: false,
    details: 'not-tested'
  }

  try {
    // Read-only probe to verify Firestore connectivity from Vercel runtime.
    await db.collection('__meta').doc('counters').get()
    firestore = {
      canRead: true,
      details: 'ok'
    }
  } catch (error: any) {
    firestore = {
      canRead: false,
      details: error?.message ?? 'unknown-error'
    }
  }

  const ok = env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY && firestore.canRead

  return Response.json({
    ok,
    env,
    config: {
      projectId: projectId ?? null,
      clientEmail: maskEmail(clientEmail)
    },
    firestore
  })
}
