# Get Going
1. At this point, you should have your OPENAI_API_KEY, and MODEL_NAME. These will be secrets in this application.
2. Create a Telegram bot on [@Botfather](https://telegram.me/BotFather)
3. Note your TELEGRAM_BOT_TOKENS
4. Install firebase CLI
   ```
   npm install -g firebase-tools
   ```
5. CD into the functions folder
   ```
   cd functions
   npm install firebase-functions@latest firebase-admin@latest --save
   ```

6. Set `const hasAccessControl = false` in handler.js line 19, unless you want to implement access control to the bot. If so, you need to create another Telegram bot and set its webhook to the /accessHandler/Telegram endpoint. I reccommend you don't.
   
7. Remember to add your secrets (OPENAI_API_KEY, TELEGRAM_BOT_TOKEN, MODEL_NAME) in a secrets.local file for local deployment, and on Google Cloud secret manager before production deployment.
  
8. Follow the instructions at https://firebase.google.com/docs/functions/get-started#emulate-execution-of-your-functions to run a local emulator or https://firebase.google.com/docs/functions/get-started#deploy-functions-to-a-production-environment to deploy in prod.
   
9.  The firebase CLI should output the URL for the HTTP function endpoints, e.g. https://us-central1-MY_PROJECT.cloudfunctions.net/handler. Take note of this. Append /telegram behind - this is your URL to add to the telegram webhook, e.g. https://us-central1-MY_PROJECT.cloudfunctions.net/handler/telegram

10. Set your telegram webhook to the above url (https://core.telegram.org/bots/api#setwebhook)
    
11. You can now start chatting with your bot!!