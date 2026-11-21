import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CloudRain,
  Compass,
  Disc,
  Download,
  ImagePlus,
  Loader2,
  Music,
  Pause,
  Play,
  Repeat,
  Sparkles,
  Trees,
  Volume2,
  VolumeX,
  Wand2,
  Waves,
  X,
} from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import { AMBIENT_TRACKS, ambientBgm, type SoundscapeKind } from '../../utils/ambientBgm';
import { AmbientAudioVisualizer } from '../ui/AmbientVisualLayer';
import { ModulePageHeader } from '../ui/CommonUI';

const TRACK_ICONS: Record<SoundscapeKind, React.ComponentType<{ className?: string }>> = {
  rain: CloudRain,
  ocean: Waves,
  forest: Trees,
  space: Compass,
  piano: Music,
  'deep-focus': Sparkles,
};

interface GeneratedLyriaTrack {
  id: string;
  prompt: string;
  model: 'lyria-3-clip-preview' | 'lyria-3-pro-preview';
  audioDataUrl: string;
  lyrics: string;
  createdAt: string;
}

const STARTER_PROMPTS = [
  'Warm lo-fi Rhodes chords with soft vinyl texture and calm late-night bass, 74 BPM',
  'Cinematic ambient synth pad with gentle piano arpeggios for deep software engineering focus',
  'Acoustic nylon guitar fingerpicking with subtle rain atmosphere and warm cello',
  'Minimalist downtempo electronic pulse with crystalline marimba and airy pads',
];

export const MusicStudioModule: React.FC = () => {
  const [engineState, setEngineState] = useState(() => ambientBgm.getState());
  const [lyriaMode, setLyriaMode] = useState<'clip' | 'pro'>('clip');
  const [prompt, setPrompt] = useState(STARTER_PROMPTS[0]);
  const [refImage, setRefImage] = useState<{
    name: string;
    base64: string;
    mimeType: string;
    previewUrl: string;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [generatedTracks, setGeneratedTracks] = useState<GeneratedLyriaTrack[]>([]);
  const [activeGeneratedId, setActiveGeneratedId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEngineState(ambientBgm.getState());
    return ambientBgm.subscribe(() => {
      setEngineState(ambientBgm.getState());
    });
  }, []);

  const handleTogglePlay = async () => {
    if (engineState.isPlaying) {
      ambientBgm.stop();
    } else {
      await ambientBgm.start(engineState.track);
    }
  };

  const handleSelectTrack = async (id: SoundscapeKind) => {
    const found = AMBIENT_TRACKS.find((t) => t.id === id);
    if (!found) return;
    localStorage.setItem('rw_bgm_track_id', found.id);
    if (engineState.isPlaying) {
      ambientBgm.setTrack(found);
    } else {
      await ambientBgm.start(found);
    }
  };

  const handleImagePick = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setGenError('Please choose a valid PNG, JPG, or WebP image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx === -1) return;
      setRefImage({
        name: file.name,
        base64: dataUrl.slice(commaIdx + 1),
        mimeType: file.type || 'image/jpeg',
        previewUrl: dataUrl,
      });
      setGenError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateMusic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setGenError(null);

    try {
      const res = await fetch('/api/music/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          mode: lyriaMode,
          imageBase64: refImage?.base64,
          imageMimeType: refImage?.mimeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error || `Music generation failed (HTTP ${res.status}).`);
        return;
      }

      const item: GeneratedLyriaTrack = {
        id: `lyria-${Date.now()}`,
        prompt: prompt.trim(),
        model: data.model,
        audioDataUrl: data.audioDataUrl,
        lyrics: data.lyrics || '',
        createdAt: new Date().toISOString(),
      };
      setGeneratedTracks((prev) => [item, ...prev]);
      setActiveGeneratedId(item.id);
    } catch (err) {
      setGenError(
        err instanceof Error
          ? err.message
          : 'Unable to reach the server-side music generation endpoint.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const activeGenerated =
    generatedTracks.find((t) => t.id === activeGeneratedId) || generatedTracks[0] || null;

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Ambient & AI Music Studio"
        description="Compose custom music with Lyria (lyria-3-clip-preview & lyria-3-pro-preview) or play six original, copyright-free soundscapes synthesized locally with Web Audio API."
        actions={
          <button
            type="button"
            onClick={() => void handleTogglePlay()}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 ${
              engineState.isPlaying
                ? 'bg-violet-600 hover:bg-violet-500'
                : 'bg-cyan-600 hover:bg-cyan-500'
            }`}
          >
            {engineState.isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span>{engineState.isPlaying ? 'Pause Soundscape' : 'Play Soundscape'}</span>
          </button>
        }
      />

      {/* Lyria AI Music Generation Studio */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <span>AI Music Generator (Lyria)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Server-side MP3 generation via <code className="font-mono">lyria-3-clip-preview</code> (up to 30s) or{' '}
              <code className="font-mono">lyria-3-pro-preview</code> (full-length tracks). Requires a paid Gemini API key in Settings &gt; Secrets.
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1">
            <button
              type="button"
              onClick={() => setLyriaMode('clip')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                lyriaMode === 'clip'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Lyria Clip (30s)
            </button>
            <button
              type="button"
              onClick={() => setLyriaMode('pro')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                lyriaMode === 'pro'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Lyria Pro (Full Track)
            </button>
          </div>
        </div>

        <form onSubmit={(e) => void handleGenerateMusic(e)} className="space-y-3">
          <div>
            <label htmlFor="lyria-prompt" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Music Prompt (genre, mood, instruments, tempo, optional lyrics)
            </label>
            <textarea
              id="lyria-prompt"
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the track you want Lyria to compose…"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {STARTER_PROMPTS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(preset)}
                className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:border-cyan-500/50 transition-colors text-left"
              >
                {preset.slice(0, 48)}…
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handleImagePick(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                <span>{refImage ? `Image: ${refImage.name}` : 'Optional Inspiration Image'}</span>
              </button>
              {refImage && (
                <button
                  type="button"
                  onClick={() => setRefImage(null)}
                  aria-label="Remove reference image"
                  className="rounded-md p-1 text-slate-400 hover:text-rose-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isGenerating || !prompt.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Generating with {lyriaMode === 'pro' ? 'Lyria Pro' : 'Lyria Clip'}…</span>
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>Generate Music</span>
                </>
              )}
            </button>
          </div>
        </form>

        {genError && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Lyria Music Generation Unavailable</p>
              <p className="mt-0.5 leading-relaxed">{genError}</p>
            </div>
          </div>
        )}

        {activeGenerated && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {activeGenerated.prompt}
                </p>
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {activeGenerated.model} · {new Date(activeGenerated.createdAt).toLocaleTimeString()}
                </p>
              </div>
              <a
                href={activeGenerated.audioDataUrl}
                download={`${activeGenerated.id}.mp3`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download MP3</span>
              </a>
            </div>
            <audio controls src={activeGenerated.audioDataUrl} className="w-full" />
            {activeGenerated.lyrics && (
              <pre className="whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 max-h-40 overflow-y-auto">
                {activeGenerated.lyrics}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Built-In Web Audio Master Deck + Visualizer */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-cyan-600 dark:text-cyan-400">
              <Disc
                className={`h-5 w-5 ${engineState.isPlaying ? 'animate-spin' : ''}`}
                style={{ animationDuration: '6s' }}
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {engineState.track.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {engineState.isPlaying
                  ? engineState.isMuted
                    ? 'Active (Muted)'
                    : `Playing · ${engineState.track.tempoLabel}`
                  : 'Standby · Built-in offline synth · Off by default'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => ambientBgm.toggleMute()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {engineState.isMuted ? (
                <VolumeX className="h-3.5 w-3.5 text-rose-500" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-cyan-500" />
              )}
              <span>{engineState.isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !engineState.isLooping;
                localStorage.setItem('rw_bgm_loop', String(next));
                ambientBgm.setLooping(next);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                engineState.isLooping
                  ? 'border-violet-500/60 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Repeat className="h-3.5 w-3.5" />
              <span>Looping: {engineState.isLooping ? 'Continuous' : '8-Bar Cycle'}</span>
            </button>

            <div className="flex items-center gap-2 min-w-44">
              <span className="text-xs text-slate-500 dark:text-slate-400">Vol</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={engineState.volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  localStorage.setItem('rw_bgm_volume', String(val));
                  ambientBgm.setVolume(val);
                }}
                aria-label="Master soundscape volume"
                className="flex-1 accent-cyan-600"
              />
              <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 w-9 text-right">
                {Math.round(engineState.volume * 100)}%
              </span>
            </div>
          </div>
        </div>

        <AmbientAudioVisualizer />
      </div>

      {/* 6 Original Soundscape Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {AMBIENT_TRACKS.map((track) => {
          const Icon = TRACK_ICONS[track.id];
          const isSelected = track.id === engineState.track.id;
          const isTrackPlaying = isSelected && engineState.isPlaying;
          return (
            <button
              key={track.id}
              type="button"
              onClick={() => void handleSelectTrack(track.id)}
              className={`text-left rounded-xl border p-5 transition-colors ${
                isSelected
                  ? 'border-cyan-500/70 bg-cyan-500/8 dark:bg-cyan-500/10'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-cyan-600 dark:text-cyan-400">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {isTrackPlaying ? 'Playing Now' : `${track.bpm} BPM`}
                </span>
              </div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {track.title}
              </h2>
              <p className="text-[11px] font-mono text-violet-700 dark:text-violet-400 mt-0.5">
                {track.tempoLabel}
              </p>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {track.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
