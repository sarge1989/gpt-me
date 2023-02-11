// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
const functions = require('firebase-functions');
// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
const express = require('express');
const axios = require("axios");
const { Timestamp } = require('firebase-admin/firestore');
const { Configuration, OpenAIApi } = require("openai");
const { sendTelegramMessage } = require("./sendTelegramMessage");

admin.initializeApp();

const app = express();
const stopSequence = "<END>";
const meToken = "Me:";
const theyToken = "They:";
const newConvoElapsedTime = 3600;
const promptMaxChar = 1400;
const hasAccessControl = true;

app.post("/telegram", async (req, res) => {
  const db = admin.firestore();
  if (
    req.body &&
    req.body.message &&
    req.body.message.from &&
    req.body.message.from.id
  ) {
    const message = req.body.message
    const userId = message.from.id;
    if (!message.text) {
      sendTelegramMessage("<Info> Only text messages allowed, this message will be ignored", userId, message?.message_id);
      res.sendStatus(200);
      return;
    }
    const text = message.text;
    const messageTimestamp = new Timestamp(parseInt(message.date), 0);

    const personRef = db.collection("people").doc(`${userId}`);
    let personSnap = await personRef.get();

    if (!personSnap.exists) {
      if (hasAccessControl) {
        //i've implemented a separate access control mechanism. Thus, just set hasAccessControl to false above
        jsonString = JSON.stringify({
          id: userId,
          name: message.from.first_name,
        })
        const resp = await sendTelegramMessage(jsonString, userId)
        sleep(1000);
        sendTelegramMessage("You currently don't have access. Please forward this message to my creator to receive access", userId, resp.data.result.message_id);
        res.sendStatus(200);
        return;
      } else {
        await personRef.set({
          name: person.name,
          newConversationRequested: true,
        })
      }
    }

    const messagesRef = personRef.collection("messages");

    switch (text.toLowerCase()) {
      case "x": //trigger model
        //get the most recent conversation start
        const latestConvStartSnap = await messagesRef.where("convStart", "==", true).orderBy("timestamp", "desc").limit(1).get();
        if (latestConvStartSnap.empty) {
          sendTelegramMessage("<Info> Please type in some messages first", userId, message?.message_id)
          res.sendStatus(200);
          return;
        }
        //get all messages after the most recent conversatio start and arrange them in ascending order
        const convoStartTime = await latestConvStartSnap.docs[0].get("timestamp");
        const convoQuerySnap = await messagesRef.where("timestamp", ">=", convoStartTime).orderBy("timestamp").get();

        //compose prompt
        let prompt = "";
        convoQuerySnap.forEach(doc => {
          const message = doc.data();
          const prefix = message.from === "me" ? meToken : theyToken
          prompt += `${prefix}${message.text}\n`
        })
        prompt += `${meToken}`;
        prompt = truncatePrompt(prompt);

        const gptResponse = await callGpt(prompt, stopSequence);

        await handleResponse(gptResponse, messagesRef, userId);
        break;

      case "/reset":
        // effectively remove the previous history from prompt
        await personRef.update({
          newConversationRequested: true
        });
        sendTelegramMessage("<Info> Your conversation has been reset. Send in at least 1 new message before triggering with X", userId, message?.message_id);
        break;

      case "/start":
        // start handler
        sendTelegramMessage("Go ahead! Send in any number of messages, then when you are ready, send in an X! To reset the convo, send in /reset", userId, message?.message_id);
        break;

      default:
        const latestSnap = await messagesRef.where("from", "==", "me").orderBy("timestamp", "desc").limit(1).get();
        const newConversationRequested = personSnap.get('newConversationRequested');
        let convStart
        if (!latestSnap.empty) {
          convStart = newConversationRequested || (messageTimestamp.seconds - latestSnap.docs[0].get("timestamp").seconds) > newConvoElapsedTime;
        } else {
          convStart = newConversationRequested;
        };
        await messagesRef.doc(`${message.message_id}`).set({
          timestamp: messageTimestamp,
          from: "them",
          text: text,
          convStart: convStart,
        });
        await personRef.update({
          newConversationRequested: false
        });
        break;
    }
    res.sendStatus(200);
  } else if (
    req.body &&
    req.body.edited_message
  ) {
    try {
      const editedMessage = req.body.edited_message;
      const userId = editedMessage.from.id;
      const updateMessageRef = db.collection("people").doc(`${userId}`).collection("messages").doc(`${editedMessage.message_id}`);
      await updateMessageRef.update({
        text: editedMessage.text
      });
    } catch (error) {
      functions.logger.log(error);
    }
    res.sendStatus(200);
  }
  else {
    res.sendStatus(404);
  }
  return;
});

function truncatePrompt(prompt) {
  //truncates prompt to a max char length
  let truncatedPrompt = prompt;
  if (truncatedPrompt.length > promptMaxChar) {
    truncatedPrompt = truncatedPrompt.slice(-promptMaxChar);
  }
  const indexOfFirstMeToken = truncatedPrompt.indexOf(meToken);
  const indexOfFirstTheyToken = truncatedPrompt.indexOf(theyToken);
  const newStartIndex = Math.min(indexOfFirstMeToken, indexOfFirstTheyToken);
  return truncatedPrompt.slice(newStartIndex);
}

async function handleResponse(gptResponse, messagesRef, number) {
  //handle responses
  if (!!gptResponse) {
    let truncatedResponse = gptResponse.split(theyToken)[0];
    let replies = truncatedResponse.split(`${meToken}`);
    for (reply of replies) {
      const res = await sendTelegramMessage(reply, number);
      const messageTimestamp = new Timestamp(parseInt(res.data.result.date), 0);
      const messageId = res.data.result.message_id;
      //add message sent to history
      await messagesRef.doc(`${messageId}`).set({
        timestamp: messageTimestamp,
        from: "me",
        text: reply.trim(),
        convStart: false,
      })
      await sleep(2000); //more humanlike to wait a few seconds before each msg
    }
  }
}

async function callGpt(prompt, stopSequence) {
  //function to call the GPT API with a prompt.
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);
  const completion = await openai.createCompletion({
    model: process.env.MODEL_NAME,
    prompt: prompt,
    temperature: 0.5,
    max_tokens: 100,
    frequency_penalty: 0.8,
    presence_penalty: 0.8,
    stop: stopSequence,
  });
  return completion.data.choices[0].text
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

exports.handler = functions
  .region("asia-southeast1")
  .runWith({ secrets: ["OPENAI_API_KEY", "TELEGRAM_BOT_TOKEN", "MODEL_NAME"] })
  .https.onRequest(app);