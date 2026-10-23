// Read text out loud with the browser's built-in voice, for kids who are still learning to read.
// Quietly does nothing where speech isn't available.
let voice = null;

function pickVoice() {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  // a friendly English voice if there is one
  voice = voices.find((v) => /en[-_]/i.test(v.lang) && /female|samantha|zira|google us/i.test(v.name)) ?? voices.find((v) => /^en/i.test(v.lang)) ?? null;
}

export function speak(text) {
  const synth = window.speechSynthesis;
  if (!synth || !text) return;
  try {
    if (!voice) pickVoice();
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, ''));
    if (voice) u.voice = voice;
    u.rate = 0.92;
    u.pitch = 1.05;
    synth.speak(u);
  } catch {
    /* speech not allowed here */
  }
}

export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}
