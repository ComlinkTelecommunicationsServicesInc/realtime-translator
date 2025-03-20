const {request} = require('undici');

const sendTranscriptionToUI = async(logger, {
  agent, channel, transcription, translatedText
}) => {
  const payload = {
    channel,
    transcript: `Original: ${transcription}\nTranslated: ${translatedText}`,
    confidence: 1,
    is_final: true,
    named_entities: [],
    sentiment: []
  };

  const headers = {
    'Content-Type': 'application/json',
  };

  logger.info({
    payload,
    url: `https://dialer-transcription.mvoipctsi.com/api/realtime_translation_brigde/${agent}`
  });

  try {
    await request(`https://dialer-transcription.mvoipctsi.com/api/realtime_translation_brigde/${agent}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
  } catch (error) {
    logger.error(error, 'Error sending transcription to UI');
  }
};

module.exports = {
  sendTranscriptionToUI
};

