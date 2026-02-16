/* eslint-disable @typescript-eslint/no-var-requires */
const admin = require('firebase-admin')

function normalize(value?: string) {
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function getPrivateKey() {
  const key = normalize(process.env.FIREBASE_PRIVATE_KEY)
  if (!key) return undefined
  return key.replace(/\\n/g, '\n')
}

function getServiceAccount() {
  const projectId =
    normalize(process.env.FIREBASE_PROJECT_ID) ??
    normalize(process.env.GOOGLE_CLOUD_PROJECT) ??
    normalize(process.env.GCLOUD_PROJECT)
  const clientEmail = normalize(process.env.FIREBASE_CLIENT_EMAIL)
  const privateKey = getPrivateKey()

  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey
    }
  }

  return undefined
}

function createApp() {
  const serviceAccount = getServiceAccount()

  if (serviceAccount) {
    return admin.initializeApp({
      projectId: serviceAccount.projectId,
      credential: admin.credential.cert(serviceAccount)
    })
  }

  return admin.initializeApp({
    projectId:
      normalize(process.env.FIREBASE_PROJECT_ID) ??
      normalize(process.env.GOOGLE_CLOUD_PROJECT) ??
      normalize(process.env.GCLOUD_PROJECT),
    credential: admin.credential.applicationDefault()
  })
}

const app = admin.apps.length ? admin.apps[0] : createApp()

export const db = admin.firestore(app)
