export type SoundscapeKind =
  | 'rain'
  | 'ocean'
  | 'forest'
  | 'space'
  | 'piano'
  | 'deep-focus';

export interface AmbientTrack {
  id: SoundscapeKind;
  title: string;
  tempoLabel: string;
  description: string;
  bpm: number;
  chords: number[][];
  melodyPool: number[];
  filterCutoffHz: number;
}

// Six 100% original, copyright-free generative ambient soundscapes synthesized via Web Audio API
export const AMBIENT_TRACKS: AmbientTrack[] = [
  {
    id: 'rain',
    title: 'Rain Ambience',
    tempoLabel: 'Soft Pink Noise · Gentle Rain',
    description: 'Filtered rainfall texture with delicate droplet harmonic tones.',
    bpm: 56,
    chords: [
      [146.83, 220.0, 261.63, 329.63],
      [130.81, 196.0, 246.94, 293.66],
    ],
    melodyPool: [523.25, 587.33, 659.25, 783.99],
    filterCutoffHz: 950,
  },
  {
    id: 'ocean',
    title: 'Ocean Waves Ambience',
    tempoLabel: 'Slow Tide Swell · Surf Noise',
    description: 'Rhythmic coastal swell modulation over deep warm ocean harmonics.',
    bpm: 44,
    chords: [
      [110.0, 164.81, 220.0, 293.66],
      [130.81, 196.0, 246.94, 329.63],
    ],
    melodyPool: [261.63, 293.66, 329.63, 392.0],
    filterCutoffHz: 520,
  },
  {
    id: 'forest',
    title: 'Forest Atmosphere',
    tempoLabel: 'Canopy Breeze · Soft Flutes',
    description: 'Airy woodland breeze paired with tranquil pentatonic wind chimes.',
    bpm: 52,
    chords: [
      [174.61, 220.0, 261.63, 349.23],
      [146.83, 220.0, 293.66, 329.63],
    ],
    melodyPool: [587.33, 659.25, 783.99, 880.0, 1046.5],
    filterCutoffHz: 780,
  },
  {
    id: 'space',
    title: 'Space Ambience',
    tempoLabel: 'Deep Cosmos · Sub-Harmonic',
    description: 'Expansive celestial drone with slow-moving open fifth intervals.',
    bpm: 40,
    chords: [
      [82.41, 123.47, 164.81, 246.94],
      [98.0, 146.83, 196.0, 293.66],
    ],
    melodyPool: [329.63, 392.0, 493.88, 587.33],
    filterCutoffHz: 460,
  },
  {
    id: 'piano',
    title: 'Original Relaxing Piano Tones',
    tempoLabel: '50 BPM · Felt Keys',
    description: 'Original warm felt-piano chords and unhurried melodic notes.',
    bpm: 50,
    chords: [
      [130.81, 196.0, 246.94, 293.66],
      [110.0, 164.81, 220.0, 261.63],
      [174.61, 220.0, 261.63, 329.63],
      [196.0, 246.94, 293.66, 392.0],
    ],
    melodyPool: [392.0, 440.0, 493.88, 523.25, 587.33],
    filterCutoffHz: 760,
  },
  {
    id: 'deep-focus',
    title: 'Deep Focus Ambient Sound',
    tempoLabel: '48 BPM · Alpha Pad',
    description: 'Balanced low-fatigue harmonic bed engineered for sustained concentration.',
    bpm: 48,
    chords: [
      [146.83, 220.0, 293.66, 329.63],
      [116.54, 174.61, 233.08, 293.66],
      [196.0, 246.94, 293.66, 392.0],
    ],
    melodyPool: [293.66, 329.63, 392.0, 440.0],
    filterCutoffHz: 580,
  },
];

class AmbientBgmEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private oceanLfo: OscillatorNode | null = null;

  private isPlaying = false;
  private isMuted = false;
  private isLooping = true;
  private volume = 0.32;
  private currentTrack: AmbientTrack = AMBIENT_TRACKS[0];
  private stepTimer: number | null = null;
  private stepIndex = 0;
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  getState() {
    return {
      isPlaying: this.isPlaying,
      isMuted: this.isMuted,
      isLooping: this.isLooping,
      volume: this.volume,
      track: this.currentTrack,
    };
  }

  getFrequencyData(target: Uint8Array<ArrayBuffer>): boolean {
    if (!this.analyser || !this.isPlaying) {
      target.fill(0);
      return false;
    }
    this.analyser.getByteFrequencyData(target);
    return true;
  }

  private ensureContext() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.0001;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.85;

      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = this.currentTrack.filterCutoffHz;
      this.filterNode.Q.value = 0.7;

      this.delayNode = this.ctx.createDelay(2.0);
      this.delayNode.delayTime.value = 0.52;
      this.delayFeedback = this.ctx.createGain();
      this.delayFeedback.gain.value = 0.32;

      this.filterNode.connect(this.masterGain);
      this.filterNode.connect(this.delayNode);
      this.delayNode.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayNode);
      this.delayNode.connect(this.masterGain);

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
  }

  private stopNoiseBed() {
    try {
      this.noiseSource?.stop();
    } catch {
      // ignore if already stopped
    }
    try {
      this.oceanLfo?.stop();
    } catch {
      // ignore
    }
    this.noiseSource = null;
    this.oceanLfo = null;
    this.noiseGain = null;
    this.noiseFilter = null;
  }

  private startNoiseBedIfNeeded() {
    this.stopNoiseBed();
    if (!this.ctx || !this.masterGain) return;

    const id = this.currentTrack.id;
    if (id !== 'rain' && id !== 'ocean' && id !== 'forest') return;

    // Synthesize 4 seconds of smooth pink-ish noise buffer
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    if (id === 'rain') {
      filter.type = 'bandpass';
      filter.frequency.value = 1200;
      filter.Q.value = 0.45;
      gain.gain.value = 0.28;
    } else if (id === 'ocean') {
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      filter.Q.value = 0.6;
      gain.gain.value = 0.24;

      // Slow wave swell LFO (~0.11 Hz = ~9s wave cycle)
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 0.11;
      lfoGain.gain.value = 0.18;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
      this.oceanLfo = lfo;
    } else {
      // forest breeze
      filter.type = 'bandpass';
      filter.frequency.value = 620;
      filter.Q.value = 0.8;
      gain.gain.value = 0.14;
    }

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start();

    this.noiseSource = src;
    this.noiseFilter = filter;
    this.noiseGain = gain;
  }

  private scheduleChord(freqs: number[], durationSec: number) {
    if (!this.ctx || !this.filterNode) return;
    const now = this.ctx.currentTime;
    const isPiano = this.currentTrack.id === 'piano';

    freqs.forEach((freq, idx) => {
      if (!this.ctx || !this.filterNode) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = isPiano ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime((idx % 2 === 0 ? 1 : -1) * (isPiano ? 1.5 : 4), now);

      const peak = (isPiano ? 0.11 : 0.085) / Math.sqrt(freqs.length);
      gain.gain.setValueAtTime(0.0001, now);
      if (isPiano) {
        gain.gain.linearRampToValueAtTime(peak, now + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec * 0.95);
      } else {
        gain.gain.linearRampToValueAtTime(peak, now + durationSec * 0.34);
        gain.gain.setValueAtTime(peak * 0.85, now + durationSec * 0.68);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
      }

      osc.connect(gain);
      gain.connect(this.filterNode);
      osc.start(now);
      osc.stop(now + durationSec + 0.1);
    });
  }

  private scheduleAccentNote(freq: number, delayOffsetSec: number) {
    if (!this.ctx || !this.filterNode) return;
    const start = this.ctx.currentTime + delayOffsetSec;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = this.currentTrack.id === 'forest' ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.038, start + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 3.0);

    osc.connect(gain);
    gain.connect(this.filterNode);
    osc.start(start);
    osc.stop(start + 3.1);
  }

  private runStep = () => {
    if (!this.isPlaying || !this.ctx) return;

    if (!this.isLooping && this.stepIndex >= this.currentTrack.chords.length * 2) {
      this.stop();
      return;
    }

    const beatSec = 60 / this.currentTrack.bpm;
    const barSec = beatSec * 4;
    const chord = this.currentTrack.chords[this.stepIndex % this.currentTrack.chords.length];

    this.scheduleChord(chord, barSec * 1.04);

    const pool = this.currentTrack.melodyPool;
    const noteA = pool[this.stepIndex % pool.length];
    const noteB = pool[(this.stepIndex + 2) % pool.length];
    this.scheduleAccentNote(noteA, beatSec * 0.8);
    if (this.stepIndex % 2 === 0) {
      this.scheduleAccentNote(noteB, beatSec * 2.4);
    }

    this.stepIndex += 1;
    this.stepTimer = window.setTimeout(this.runStep, barSec * 1000);
  };

  private applyEffectiveGain() {
    if (!this.ctx || !this.masterGain) return;
    const effective = this.isPlaying && !this.isMuted ? Math.max(0.0001, this.volume) : 0.0001;
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setTargetAtTime(effective, this.ctx.currentTime, 0.2);
  }

  async start(track?: AmbientTrack) {
    if (track) this.currentTrack = track;
    this.ensureContext();
    if (!this.ctx || !this.filterNode) return;

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.filterNode.frequency.setTargetAtTime(
      this.currentTrack.filterCutoffHz,
      this.ctx.currentTime,
      0.25
    );

    if (this.stepTimer !== null) {
      clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }

    this.isPlaying = true;
    this.stepIndex = 0;
    this.startNoiseBedIfNeeded();
    this.applyEffectiveGain();
    this.runStep();
    this.notify();
  }

  stop() {
    this.isPlaying = false;
    if (this.stepTimer !== null) {
      clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }
    this.stopNoiseBed();
    this.applyEffectiveGain();
    this.notify();
  }

  setTrack(track: AmbientTrack) {
    this.currentTrack = track;
    this.stepIndex = 0;
    if (this.isPlaying) {
      void this.start(track);
    } else {
      this.notify();
    }
  }

  setVolume(val: number) {
    this.volume = Math.min(1, Math.max(0, val));
    if (this.volume > 0 && this.isMuted) {
      this.isMuted = false;
    }
    this.applyEffectiveGain();
    this.notify();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.applyEffectiveGain();
    this.notify();
  }

  setLooping(loop: boolean) {
    this.isLooping = loop;
    this.notify();
  }

  // Optional gentle non-intrusive notification chime
  async playNotificationChime() {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const tempCtx = this.ctx || new AudioCtx();
      if (tempCtx.state === 'suspended') await tempCtx.resume();
      const now = tempCtx.currentTime;
      const osc = tempCtx.createOscillator();
      const gain = tempCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.14);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      osc.connect(gain);
      gain.connect(tempCtx.destination);
      osc.start(now);
      osc.stop(now + 0.48);
    } catch {
      // Ignore if blocked before user gesture
    }
  }
}

export const ambientBgm = new AmbientBgmEngine();
