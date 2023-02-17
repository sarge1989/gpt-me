// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
const functions = require('firebase-functions');
// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
const express = require('express');
const { sendTelegramMessage } = require("./sendTelegramMessage");

const app = express();
if (!admin.apps.length) {
  admin.initializeApp();
}

app.post("/telegram", async (req, res) => {
  const db = admin.firestore();
  if (
    req.body &&
    req.body.message &&
    req.body.message.from &&
    req.body.message.from.id &&
    req.body.message.text &&
    req.body.message.from.id === parseInt(process.env.MY_TELEGRAM_ID)
  ) {
    const text = req.body.message.text
    const person = JSON.parse(text);
    await db.collection("people").doc(`${person.id}`).set({
      name: person.name,
      newConversationRequested: true,
    })
    sendTelegramMessage("You have been granted access. Go ahead, send in any number of messages, then when you are ready, send in an X! To reset the convo, send in /reset", person.id)
    res.sendStatus(200);
  }
  else {
    res.sendStatus(200);
  }
});

exports.accessHandler = functions
  .region("asia-southeast1")
  .runWith({ secrets: ["TELEGRAM_BOT_TOKEN", "MY_TELEGRAM_ID"] })
  .https.onRequest(app);