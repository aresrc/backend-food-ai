import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

var serviceAccount = require("./private-key.json");

dotenv.config();

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
});

export const db = admin.firestore();