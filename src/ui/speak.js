// Spoken lines. Most of the game's lines are recorded (src/audio/voices, made with
// scripts/make-voices.py) in character voices: Grandpa Ollie, a narrator and the three dragons.
// Anything without a recording (like a dragon's chosen name) falls back to the browser's voice.
import LINES from '../audio/voiceLines.json';

const files = import.meta.glob('../audio/voices/*.mp3', { query: '?url', import: 'default', eager: true });
const URLS = Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split('/').pop().replace('.mp3', ''), url]));

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const BY_TEXT = new Map(Object.entries(LINES).map(([id, l]) => [norm(l.text), id]));

let current = null; // the clip playing now
let queue = [];
let browserVoice = null;

export const hasLine = (id) => !!URLS[id];

// Play recorded lines one after another (a single id or a list). Stops anything already speaking.
export function speakLine(ids) {
  stopSpeaking();
  queue = (Array.isArray(ids) ? ids : [ids]).filter(hasLine);
  next();
}

function next() {
  const id = queue.shift();
  if (!id) return;
  try {
    current = new Audio(URLS[id]);
    current.onended = next;
    current.play().catch(() => {}); // blocked before the first click; nothing to do
  } catch {
    /* audio not available */
  }
}

// Say some text: its recording if there is one, otherwise the browser's voice.
export function speak(text) {
  const id = BY_TEXT.get(norm(text));
  if (id) return speakLine(id);
  speakWithBrowser(text);
}

function speakWithBrowser(text) {
  const synth = window.speechSynthesis;
  if (!synth || !text) return;
  try {
    stopSpeaking();
    if (!browserVoice) {
      const voices = synth.getVoices?.() ?? [];
      browserVoice = voices.find((v) => /en[-_]/i.test(v.lang) && /female|samantha|zira|google us/i.test(v.name)) ?? voices.find((v) => /^en/i.test(v.lang)) ?? null;
    }
    const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, ''));
    if (browserVoice) u.voice = browserVoice;
    u.rate = 0.92;
    u.pitch = 1.05;
    synth.speak(u);
  } catch {
    /* speech not allowed here */
  }
}

export function stopSpeaking() {
  queue = [];
  if (current) {
    current.onended = null;
    current.pause();
    current = null;
  }
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}
