const axios = require("axios");
const functions = require('firebase-functions');

exports.sendTelegramMessage = async function (text, number, replyId = null) {
  data = {
    chat_id: number,
    text: text,
  }
  if (replyId) {
    data.reply_to_message_id = replyId;
  }
  const response = await axios({
    method: "POST", // Required, HTTP method, a string, e.g. POST, GET
    url:
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    data: data,
    headers: {
      "Content-Type": "application/json",
    },
  }).catch((error) => {
    functions.logger.log(error.response);
    throw ("error with sending telegram message");
  });
  return response;
}