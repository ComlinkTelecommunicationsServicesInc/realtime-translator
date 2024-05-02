const assert = require('assert');
const translateText = require('../utils/translate');
const { TARGET_AGENT } = require('../utils/config');


const service = ({logger, makeService}) => {
  const svc = makeService({path: '/translator'});

  svc.on('session:new', async(session) => {
    session.locals = {
      logger: logger.child({call_sid: session.call_sid}),
      recognizer_a: {
        language: 'en-US',
        vendor: 'default'
      },
      recognizer_b: {
        language: 'en-US',
        vendor: 'default'
      },
      synthesizer_a: {
        language: 'en-US',
        vendor: 'default',
        voice: 'default'
      },
      synthesizer_b: {
        language: 'en-US',
        vendor: 'default',
        voice: 'en-US-Standard-C'
      }
    };
    session.locals.logger.info({session}, `new incoming call: ${session.call_sid}`);

    session
      .on('/transcription-a', onTranscribeALeg.bind(null, session))
      .on('/transcription-b', onTranscribeBLeg.bind(null, session))
      .on('/selectLanguage', onSelectLanguage.bind(null, session))
      .on('call:status', onCallStatus.bind(null, session))
      .on('close', onClose.bind(null, session))
      .on('error', onError.bind(null, session));

    session
      // answer the call
      .answer()
      // gather caller langauge
      .gather({
        actionHook: '/selectLanguage',
        input: ['digits'],
        dtmfBargein: false,
        timeout: 20,
        minDigits: 1,
        numDigits: 1,
        say: {
          text: 'Thank you for calling Comlink Suport Center,' +
          'We are having only one english agent with real time translator' +
          'Please select your speaking language by 1 for' +
          'Hindi, 2 for Marathi, 3 for  Tamil, 4 for Telugu, 5 for  Gujarati, 6 for Vietnamese',
        },
      })
      .send();


  });
};

const onClose = (session, code, reason) => {
  const {logger} = session.locals;
  logger.info({session, code, reason}, `session ${session.call_sid} closed`);
};

const onError = (session, err) => {
  const {logger} = session.locals;
  logger.info({err}, `session ${session.call_sid} received error`);
};

const onSelectLanguage = (session, evt) => {
  const {logger, recognizer_a, recognizer_b, synthesizer_a} = session.locals;
  let language_code;
  let voice;
  switch (evt.digits) {
    case '1':
      language_code = 'hi-IN';
      voice = 'hi-IN-SwaraNeural';
      break;
    case '2':
      language_code = 'mr-IN';
      voice = 'mr-IN-AarohiNeural';
      break;
    case '3':
      language_code = 'ta-IN';
      voice = 'ta-IN-PallaviNeural';
      break;
    case '4':
      language_code = 'te-IN';
      voice = 'te-IN-ShrutiNeural';
      break;
    case '5':
      language_code = 'gu-IN';
      voice = 'gu-IN-DhwaniNeural';
      break;
    case '6':
      language_code = 'vi-VN';
      voice = 'vi-VN-HoaiMyNeural';
      break;
    default:
      language_code = 'en-US';
      voice = 'en-US-AvaMultilingualNeural';
      break;
  }
  recognizer_a.language = language_code;
  synthesizer_a.language = language_code;
  synthesizer_a.voice = voice;
  logger.info({evt, ...recognizer_a}, 'onSelectLanguage');

  /**
   * Outdial and set up translation on both legs.
   * Create an additional audio track on both legs for the translated speech.
   * Each party will hear the untranslated speech of the other party, followed by the translation.
   */
  session
    // turn down the volume of the remote party, to make the translator's voice the focus
    // also enable transcriptions of the caller's speech
    .config({
      boostAudioSignal: '-10 dB',
      recognizer: recognizer_a,
      transcribe: {
        enable: true,
        transcriptionHook: '/transcription-a'
      }
    })

    // add an additional audio track to the call, which will carry the translator's voice
    .dub({
      action: 'addTrack',
      track: 'a'
    })

    // dial the called party, and set similar options on that leg of the call
    .dial({
      target: TARGET_AGENT,
      boostAudioSignal: '-20 dB',
      transcribe: {
        transcriptionHook: '/transcription-b',
        channel: 2,
        recognizer: {
          ...recognizer_b,
        }
      },
      dub:(
        [
          {
            action: 'addTrack',
            track: 'b',
          }
        ]
      ),
    })

    // hangup if dial fails, or when it completes
    .hangup()
    .reply();

};

const onCallStatus = (session, evt) => {
  const {logger} = session.locals;
  logger.info({evt}, 'call status');
  if (!session.locals.call_sid_b && evt.direction === 'outbound') {
    session.locals.call_sid_b = evt.call_sid;
    logger.info(`call_sid for b leg is ${session.locals.call_sid_b}`);
  }
};

const onTranscribeALeg = (session, evt) => {
  const {logger, call_sid_b, recognizer_a, recognizer_b, synthesizer_b} = session.locals;
  const {speech} = evt;
  const transcript = speech.alternatives[0].transcript;
  logger.info({speech}, 'transcription received for channel 1');

  session.reply();

  assert.ok(speech.is_final, 'expecting only final transcriptions');

  if (call_sid_b) {
    translateText(logger, transcript, recognizer_a.language, recognizer_b.language)
      .then((translation) => {
        if (!translation) return;
        logger.info({translation},
          `translated text, now sending dub command: ${translation} for call_sid_b ${call_sid_b}`);

        /* speak the translation to the b party */
        session.injectCommand('dub', {
          action: 'sayOnTrack',
          track: 'b',
          say: {
            text: translation,
            synthesizer: synthesizer_b
          }
        }, call_sid_b);
        return;
      })
      .catch((err) => logger.error({err}, 'Error translating text'));
  }
  else {
    logger.info('no call_sid_b, not sending dub command');
  }
};

const onTranscribeBLeg = (session, evt) => {
  const {logger, recognizer_a, recognizer_b, synthesizer_a} = session.locals;
  const {speech} = evt;
  const transcript = speech.alternatives[0].transcript;
  logger.info({speech}, 'transcription received for channel 2');

  session.reply();

  assert.ok(speech.is_final, 'expecting only final transcriptions');

  translateText(logger, transcript, recognizer_b.language, recognizer_a.language)
    .then((translation) => {
      if (!translation) return;
      logger.info({translation}, `translated text, now sending dub command: ${translation}`);

      /* speak the translation to the a party */
      session.injectCommand('dub', {
        action: 'sayOnTrack',
        track: 'a',
        say: {
          text: translation,
          synthesizer: synthesizer_a
        }
      });
      return;
    })
    .catch((err) => logger.error({err}, 'Error translating text'));
};

module.exports = service;
