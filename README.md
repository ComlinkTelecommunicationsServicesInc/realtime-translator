# realtime-translator

This application demonstates the use of the jambonz [dub verb](https://www.jambonz.org/docs/webhooks/dub/) to create an application where each party on the call is receiving two distinct audio tracks:

- one from the remote party
- one from a translator that is listening in on the call

The scenario is intended to mimic a contact center staffed with English-speaking agents would use the services of an automated translator to handle calls from Vietnamese-speaking callers

## Install
This is a jambonz Node.js websocket application that uses environment variables to configure the choice of languages.  Additionally, you will need a google json key file to use the google translate service.

The example below starts the application listening on port 3000 with languages set according to the scenario described above.
```
npm ci

WS_PORT=3000 \
GOOGLE_APPLICATION_CREDENTIALS='path-to-your-key.json' \
CALLER_LANGUAGE_NAME='Vietnamese' \
CALLER_LANGUAGE_CODE='vi-VN' \
CALLER_TTS_VENDOR='microsoft' \
CALLER_TTS_VOICE='vi-VN-NamMinhNeural' \
CALLER_STT_VENDOR='microsoft' \
CALLED_LANGUAGE_NAME='English' \
CALLED_LANGUAGE_CODE='en-US' \
CALLED_TTS_VENDOR='microsoft' \
CALLED_TTS_VOICE='en-US-AndrewMultilingualNeural' \
CALLED_STT_VENDOR='deepgram'
npm start
```

On the jambonz server, create an application with url `wss://jambonz-apps.drachtio.org/translator`.