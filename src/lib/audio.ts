const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

import { langBcp47, langOf } from "./langs";

/* Solo mp3: los dos formatos duplicaban el tamaño de la app y los WebViews
 * donde corre Tauri (Chromium/WKWebView/webkit2gtk) reproducen mp3 sin
 * problemas. Si un clip falla, la cadena cae al TTS del sistema. */

let ctx: AudioContext | null = null;
let muted = false;
let activated = false;
let voiceLang = "en";

export function markActivated() {
  activated = true;
}

export function setVoiceLanguage(lang: string) {
  const norm = langOf(lang).id;
  if (norm !== voiceLang) {
    voiceLang = norm;
    voiceCache.clear();
  }
}

export function setMuted(value: boolean) {
  muted = value;
  if (muted) stopSpeech();
}

export function isMuted() {
  return muted;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type Wave = OscillatorType;

function tone(freq: number, dur: number, delay: number, type: Wave = "sine", gain = 0.12) {
  const ac = audio();
  if (!ac || muted) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  tap() {
    tone(660, 0.06, 0, "triangle", 0.06);
  },
  correct() {
    tone(659.25, 0.12, 0, "sine", 0.11);
    tone(987.77, 0.18, 0.09, "sine", 0.11);
  },
  wrong() {
    tone(196, 0.2, 0, "sawtooth", 0.07);
    tone(147, 0.24, 0.1, "sawtooth", 0.07);
  },
  complete() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.22, i * 0.12, "sine", 0.1));
  },
  levelUp() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      tone(f, 0.25, i * 0.09, "triangle", 0.09),
    );
  },
};

export function vibrate(pattern: number | number[]) {
  if (muted) return;
  if ("vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* noop */
    }
  }
}

/* ---------- voz empaquetada (Piper) ---------- */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function fnv1a(text: string): number {
  let h = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h;
}

function hex(value: number): string {
  return value.toString(16).padStart(8, "0");
}

export function clipKey(text: string): string {
  const norm = text.trim().replace(/\s+/g, " ");
  return hex(fnv1a(norm)) + hex(fnv1a(`${norm}#tualingua`));
}

const clips = new Map<string, HTMLAudioElement>();
const MAX_CLIPS = 64;
let current: HTMLAudioElement | null = null;

function trimUrl(text: string): string {
  return `${BASE}/audio/${voiceLang}/${clipKey(text)}.mp3`;
}

function evictStaleClips() {
  while (clips.size > MAX_CLIPS) {
    let stale: string | null = null;
    for (const key of clips.keys()) {
      if (!current || current.src !== clips.get(key)?.src) {
        stale = key;
        break;
      }
    }
    if (!stale) break;
    const el = clips.get(stale);
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    clips.delete(stale);
  }
}

function clipEl(url: string): HTMLAudioElement {
  let el = clips.get(url);
  if (!el) {
    el = new Audio();
    el.preload = "auto";
    el.src = url;
    clips.set(url, el);
    evictStaleClips();
  }
  return el;
}

export function preloadClip(text: string) {
  const el = clipEl(trimUrl(text));
  try {
    el.load();
  } catch {
    /* noop */
  }
}

export function stopSpeech() {
  if (current) {
    try {
      current.pause();
      current.currentTime = 0;
    } catch {
      /* noop */
    }
    current = null;
  }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function playChain(text: string, rate: number) {
  const attempt = () => {
    const el = clipEl(trimUrl(text));
    let handled = false;
    const fail = (err?: unknown) => {
      if (handled) return;
      if (err && typeof err === "object" && (err as { name?: string }).name === "AbortError") return;
      handled = true;
      el.onerror = null;
      ttsSpeak(text, rate);
    };
    el.onerror = () => fail();
    try {
      el.currentTime = 0;
    } catch {
      /* noop */
    }
    el.playbackRate = rate < 1 ? Math.max(0.55, rate) : 1;
    const withPitch = el as HTMLAudioElement & {
      preservesPitch?: boolean;
      webkitPreservesPitch?: boolean;
    };
    withPitch.preservesPitch = true;
    withPitch.webkitPreservesPitch = true;
    const promise = el.play();
    if (promise && typeof promise.catch === "function") promise.catch(fail);
    current = el;
  };

  attempt();
}

export function speak(text: string, rate = 1) {
  if (muted || !text || !activated) return;
  stopSpeech();
  playChain(text, rate);
}

/* ---------- TTS del sistema (respaldo) ---------- */

let voicesReady = false;
const voiceCache = new Map<string, SpeechSynthesisVoice>();

function pickVoice(): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;
  const bcp = langBcp47(voiceLang);
  if (voiceCache.has(bcp)) return voiceCache.get(bcp) ?? null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const base = bcp.split("-")[0];
  const found =
    voices.find((v) => v.lang === bcp && /google|natural|samantha/i.test(v.name)) ??
    voices.find((v) => v.lang === bcp) ??
    voices.find((v) => v.lang.replace("_", "-").toLowerCase() === base) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(base)) ??
    null;
  if (found) voiceCache.set(bcp, found);
  return found ?? null;
}

export function warmUpVoices() {
  if (!("speechSynthesis" in window)) return;
  if (!voicesReady) {
    voicesReady = true;
    window.speechSynthesis.onvoiceschanged = () => {
      voiceCache.clear();
      pickVoice();
    };
  }
  pickVoice();
}

export function ttsAvailable(): boolean {
  return "speechSynthesis" in window;
}

function ttsSpeak(text: string, rate: number) {
  if (muted || !("speechSynthesis" in window)) return;
  const bcp = langBcp47(voiceLang);
  const u = new SpeechSynthesisUtterance(text);
  u.lang = bcp;
  u.rate = rate;
  const found = pickVoice();
  if (found) u.voice = found;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

