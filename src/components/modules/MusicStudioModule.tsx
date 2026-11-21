import React, { useEffect, useState } from 'react';
import {
  CloudRain,
  Compass,
  Disc,
  Music,
  Pause,
  Play,
  Repeat,
  Sparkles,
  Trees,
  Volume2,
  VolumeX,
  Waves,
} from 'lucide-react';
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

export const MusicStudioModule: React.FC = () => {
  const [engineState, setEngineState] = useState(() => ambientBgm.getState());

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

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Ambient Music"
        description="Six original soundscapes synthesized locally using Web Audio API. Music stays off by default until you press Play."
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

      {/* Master Deck & Audio Visualizer */}
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
                  : 'Standby · Off by default'}
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
              <span>Loop: {engineState.isLooping ? 'Continuous' : '8-Bar Cycle'}</span>
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
