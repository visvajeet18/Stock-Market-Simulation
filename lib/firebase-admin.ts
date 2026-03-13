import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    if (privateKey) {
        // Vercel / Production with explicit credentials
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID || 'stockxkrct',
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey.replace(/\\n/g, '\n'),
            }),
        });
    } else {
        // Local or Firebase Environment with ADC
        admin.initializeApp({
            projectId: 'stockxkrct'
        });
    }
}

export const db = admin.firestore();
