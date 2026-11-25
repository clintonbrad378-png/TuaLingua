import { invoke, isTauri } from "@tauri-apps/api/core";
import { langBcp47, langOf } from "./langs";

export type TtsEngine = "auto" | "native" | "web";
export type TtsVoice = { id: string; name: string; lang: string; default?: boolean; engine: "native" | "web" };
export type TtsEngineInfo = { id: string; label: string; default?: boolean };
export type TtsStatus = { available: boolean; engine: "native" | "web" | "none"; error?: string | null };

const ENGINE_KEY = "tl-tts-engine";
const NATIVE_ENGINE_KEY = "tl-tts-native-engine";
const VOICE_KEY = "tl-tts-voice";
const RATE_KEY = "tl-tts-rate";

let ctx: AudioContext | null = null;
let muted = false;
let voiceLang = "en";
let enginePref: TtsEngine = readEngine();
let nativeEnginePref: string = typeof localStorage !== "undefined" ? localStorage.getItem(NATIVE_ENGINE_KEY) ?? "" : "";
let voicePref: string = typeof localStorage !== "undefined" ? localStorage.getItem(VOICE_KEY) ?? "" : "";
let ratePref: number = readRate();
let lastError: string | null = null;
const listeners = new Set<() => void>();

const inTauri = typeof window !== "undefined" && isTauri();
const isAndroid =
  typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

function readEngine(): TtsEngine {
  if (typeof localStorage === "undefined") return "auto";
  const v = localStorage.getItem(ENGINE_KEY);
  return v === "native" || v === "web" || v === "auto" ? v : "auto";
}

function readRate(): number {
  if (typeof localStorage === "undefined") return 1;
  const v = Number(localStorage.getItem(RATE_KEY));
  return Number.isFinite(v) ? Math.min(1.5, Math.max(0.5, v)) : 1;
}

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeAudio(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getTtsError() {
  return lastError;
}

function setError(err: unknown) {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : null;
  if (msg && msg !== lastError) {
    lastError = msg;
    emit();
  }
}

function clearError() {
  if (lastError !== null) {
    lastError = null;
    emit();
  }
}

export function getTtsEngine(): TtsEngine {
  return enginePref;
}

export function setTtsEngine(v: TtsEngine) {
  enginePref = v;
  if (typeof localStorage !== "undefined") localStorage.setItem(ENGINE_KEY, v);
  emit();
}

export function getTtsNativeEngine() {
  return nativeEnginePref;
}

export function setTtsNativeEngine(id: string) {
  nativeEnginePref = id;
  voicePref = ""; // voice IDs differ across engines
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(NATIVE_ENGINE_KEY, id);
    localStorage.setItem(VOICE_KEY, "");
  }
  emit();
}

export function getTtsVoicePref() {
  return voicePref;
}

export function setTtsVoicePref(id: string) {
  voicePref = id;
  if (typeof localStorage !== "undefined") localStorage.setItem(VOICE_KEY, id);
  emit();
}

export function getTtsRate() {
  return ratePref;
}

export function setTtsRate(v: number) {
  ratePref = Math.min(1.5, Math.max(0.5, v));
  if (typeof localStorage !== "undefined") localStorage.setItem(RATE_KEY, String(ratePref));
  emit();
}

export function markActivated() {
  // kept for backward-compatible call sites
}

export function setVoiceLanguage(lang: string) {
  const norm = langOf(lang).id;
  if (norm !== voiceLang) {
    voiceLang = norm;
    voiceCache.clear();
    emit();
  }
}

export function setMuted(value: boolean) {
  muted = value;
  if (muted) stopSpeech();
  emit();
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

/* ---------- TTS providers ---------- */

function webSpeechAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function webSpeechUsable() {
  // On Android WebView, speechSynthesis.getVoices() can block the UI thread.
  return webSpeechAvailable() && !(inTauri && isAndroid);
}

function shouldUseNative() {
  if (enginePref === "web") return false;
  if (enginePref === "native") return inTauri;
  return inTauri && isAndroid;
}

function shouldUseWebFallback() {
  if (enginePref === "native") return false;
  if (inTauri && isAndroid) return false;
  return webSpeechAvailable();
}

export async function getNativeTtsStatus(): Promise<TtsStatus> {
  if (!inTauri) return { available: false, engine: "native", error: "not-tauri" };
  try {
    const res = await invoke<{ available: boolean; engine?: string; error?: string | null }>(
      "plugin:native-tts|status",
    );
    return { available: !!res.available, engine: "native", error: res.error ?? null };
  } catch (e) {
    return { available: false, engine: "native", error: e instanceof Error ? e.message : String(e) };
  }
}

export async function listTtsEngines(): Promise<TtsEngineInfo[]> {
  if (!inTauri) return [];
  try {
    const res = await invoke<TtsEngineInfo[] | { engines?: TtsEngineInfo[] }>(
      "plugin:native-tts|engines",
    );
    return Array.isArray(res) ? res : res.engines ?? [];
  } catch {
    return [];
  }
}

export async function listTtsVoices(): Promise<TtsVoice[]> {
  const out: TtsVoice[] = [];
  if (inTauri) {
    try {
      const native = await invoke<
        Array<{ id: string; name: string; lang: string; default?: boolean }> |
        { voices?: Array<{ id: string; name: string; lang: string; default?: boolean }> }
      >("plugin:native-tts|voices", nativeEnginePref ? { engine: nativeEnginePref } : {});
      const list = Array.isArray(native) ? native : native.voices ?? [];
      for (const v of list) {
        out.push({ ...v, engine: "native" });
      }
    } catch {
      /* noop */
    }
  }
  if (webSpeechUsable()) {
    for (const v of window.speechSynthesis.getVoices()) {
      out.push({
        id: `web:${v.voiceURI || v.name}`,
        name: v.name,
        lang: v.lang,
        default: v.default,
        engine: "web",
      });
    }
  }
  return out;
}

let voicesReady = false;
const voiceCache = new Map<string, SpeechSynthesisVoice>();

function pickWebVoice(): SpeechSynthesisVoice | null {
  if (!webSpeechAvailable()) return null;
  const bcp = langBcp47(voiceLang).toLowerCase();
  const base = bcp.split("-")[0];
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  if (voicePref.startsWith("web:")) {
    const wanted = voicePref.slice(4);
    const exact = voices.find((v) => (v.voiceURI || v.name) === wanted);
    if (exact) return exact;
  }

  if (voiceCache.has(bcp)) return voiceCache.get(bcp) ?? null;
  const normLang = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-").toLowerCase();
  const found =
    voices.find((v) => normLang(v) === bcp && /google|natural|samantha|enhanced|microsoft/i.test(v.name)) ??
    voices.find((v) => normLang(v) === bcp) ??
    voices.find((v) => normLang(v).startsWith(base)) ??
    voices.find((v) => v.default) ??
    null;
  if (found) voiceCache.set(bcp, found);
  return found;
}

export function warmUpVoices() {
  if (!webSpeechUsable()) return;
  if (!voicesReady) {
    voicesReady = true;
    window.speechSynthesis.onvoiceschanged = () => {
      voiceCache.clear();
      pickWebVoice();
      emit();
    };
  }
  pickWebVoice();
}

export function ttsAvailable(): boolean {
  return inTauri || webSpeechAvailable();
}

export function stopSpeech() {
  if (inTauri) {
    void invoke("plugin:native-tts|stop").catch(() => {
      /* noop */
    });
  }
  if (webSpeechAvailable()) {
    window.speechSynthesis.cancel();
  }
}

function cleanText(text: string) {
  return text.replace(/[(（][^)）]*[)）]/g, " ").replace(/\s+/g, " ").trim() || text;
}

function speakWeb(text: string, rate: number) {
  if (!webSpeechAvailable()) throw new Error("Web Speech no disponible");
  const bcp = langBcp47(voiceLang);
  const u = new SpeechSynthesisUtterance(text);
  u.lang = bcp;
  u.rate = rate;
  const found = pickWebVoice();
  if (found) u.voice = found;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

async function speakNative(text: string, rate: number) {
  const voiceId = voicePref && !voicePref.startsWith("web:") ? voicePref : null;
  await invoke("plugin:native-tts|speak", {
    text,
    lang: langBcp47(voiceLang),
    rate,
    voiceId,
    engine: nativeEnginePref || null,
  });
}

export function speak(text: string, rate = ratePref) {
  if (muted || !text) return;
  const clean = cleanText(text);
  const effectiveRate = Math.min(1.5, Math.max(0.5, rate));

  const tryWeb = (err?: unknown) => {
    if (err) setError(err);
    if (!shouldUseWebFallback()) return;
    try {
      speakWeb(clean, effectiveRate);
      if (!err) clearError();
    } catch (e) {
      setError(e);
    }
  };

  if (shouldUseNative()) {
    void speakNative(clean, effectiveRate)
      .then(() => clearError())
      .catch((e) => tryWeb(e));
    return;
  }

  tryWeb();
}

export async function testTts() {
  const sample = "Hola, esto es una prueba de voz.";
  speak(sample, ratePref);
}
