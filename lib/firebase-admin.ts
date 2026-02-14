/* eslint-disable @typescript-eslint/no-var-requires */
const admin = require('firebase-admin')

function getPrivateKey() {
  const key = process.env.FIREBASE_PRIVATE_KEY
  if (!key) return undefined
  return key.replace(/\\n/g, '\n')
}

function getServiceAccount() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
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
      credential: admin.credential.cert(serviceAccount)
    })
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault()
  })
}

const app = admin.apps.length ? admin.apps[0] : createApp()

export const db = admin.firestore(app)
