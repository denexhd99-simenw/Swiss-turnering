# Pingpong Turnering - Vercel + Firebase

Denne appen er no satt opp for:
- Hosting: Vercel
- Backend database: Firebase Firestore (via server-side `firebase-admin`)

## Kvifor databasen feila på Vercel
Du brukte Prisma + SQLite (`file:./dev.db`). På Vercel er filsystemet ephemeral, så SQLite-fila blir ikkje stabil database i produksjon.

## Kva som er endra
- API-rutene bruker no Firestore gjennom `lib/prisma.ts` (Firestore-wrapper).
- Firebase Admin init er lagt i `lib/firebase-admin.ts`.
- `firebase.json` peikar no til `firestore.rules`.
- Firestore rules er låst ned (`allow false`) sidan appen bruker server-side admin-SDK.

## 1) Opprett Firebase Service Account
I Firebase Console:
1. Project Settings
2. Service accounts
3. Generate new private key

## 2) Legg miljøvariablar i Vercel
I Vercel Project Settings -> Environment Variables:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

For `FIREBASE_PRIVATE_KEY`:
- lim inn heile private key
- behold line breaks som `\n` (Vercel string)

Eksempel:
`-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n`

## 3) Installer dependencies lokalt og push på nytt
Køyr:

```bash
npm install
```

Deretter push til GitHub så Vercel bygger ny versjon.

## 4) Deploy Firestore rules/indexes (valfritt, men anbefalt)
Hvis du bruker Firebase CLI:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Merknad
Prisma-filer ligg framleis i repo, men runtime-database i appen er no Firestore.
