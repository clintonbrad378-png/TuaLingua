let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
  if (muted && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function isMuted() {
  return muted;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.25, i * 0.09, "triangle", 0.09));
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

let voice: SpeechSynthesisVoice | null = null;
let voicesReady = false;

function pickVoice(): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;
  if (voice) return voice;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  voice =
    voices.find((v) => v.lang === "en-US" && /google|natural|samantha/i.test(v.name)) ??
    voices.find((v) => v.lang === "en-US") ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null;
  return voice;
}

export function warmUpVoices() {
  if (!("speechSynthesis" in window)) return;
  if (!voicesReady) {
    voicesReady = true;
    window.speechSynthesis.onvoiceschanged = () => {
      voice = null;
      pickVoice();
    };
  }
  pickVoice();
}

export function ttsAvailable(): boolean {
  return "speechSynthesis" in window;
}

export function speak(text: string, rate = 1) {
  if (muted || !text || !("speechSynthesis" in window)) return;
  pickVoice();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = rate;
  if (voice) u.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
