import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Music, Pause, Play, Repeat, Sliders, Volume2, VolumeX } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import { AMBIENT_TRACKS, ambientBgm } from '../../utils/ambientBgm';

const STORAGE_TRACK_KEY = 'rw_bgm_track_id';
const STORAGE_VOL_KEY = 'rw_bgm_volume';
const STORAGE_LOOP_KEY = 'rw_bgm_loop';

export const AmbientMusicControl: React.FC = () => {
  const { setActiveModule } = useSystem();
  const [engineState, setEngineState] = useState(() => ambientBgm.getState());
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTrack = localStorage.getItem(STORAGE_TRACK_KEY);
    const savedVol = localStorage.getItem(STORAGE_VOL_KEY);
    const savedLoop = localStorage.getItem(STORAGE_LOOP_KEY);
    if (savedTrack) {
      const found = AMBIENT_TRACKS.find((t) => t.id === savedTrack);
      if (found) ambientBgm.setTrack(found);
    }
    if (savedVol !== null) {
      ambientBgm.setVolume(Number(savedVol));
    }
    if (savedLoop !== null) {
      ambientBgm.setLooping(savedLoop === 'true');
    }
    setEngineState(ambientBgm.getState());

    return ambientBgm.subscribe(() => {
      setEngineState(ambientBgm.getState());
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTogglePlay = async () => {
    if (engineState.isPlaying) {
      ambientBgm.stop();
    } else {
      await ambientBgm.start(engineState.track);
    }
  };

  const handleSelectTrack = async (trackId: string) => {
    const track = AMBIENT_TRACKS.find((t) => t.id === trackId);
    if (!track) return;
    localStorage.setItem(STORAGE_TRACK_KEY, track.id);
    if (engineState.isPlaying) {
      ambientBgm.setTrack(track);
    } else {
      await ambientBgm.start(track);
    }
  };

  const handleVolumeChange = (val: number) => {
    localStorage.setItem(STORAGE_VOL_KEY, String(val));
    ambientBgm.setVolume(val);
  };

  const handleToggleLoop = () => {
    const next = !engineState.isLooping;
    localStorage.setItem(STORAGE_LOOP_KEY, String(next));
    ambientBgm.setLooping(next);
  };

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        onClick={() => void handleTogglePlay()}
        aria-pressed={engineState.isPlaying}
        aria-label={engineState.isPlaying ? 'Pause ambient soundscape' : 'Play ambient soundscape'}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
          engineState.isPlaying
            ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/15'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        {engineState.isPlaying ? (
          <Pause className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
        ) : (
          <Play className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        )}
        <span className="hidden md:inline">
          {engineState.isPlaying ? (engineState.isMuted ? 'Muted' : 'Playing') : 'Audio Off'}
        </span>
      </button>

      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-expanded={menuOpen}
        aria-label="Open ambient soundscape menu"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
      >
        <Music className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
        <span className="hidden xl:inline max-w-28 truncate">{engineState.track.title}</span>
        <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
      </button>

      {menuOpen && (
        <div
          role="dialog"
          aria-label="Ambient Music Studio quick controls"
          className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-3.5 z-50 space-y-3"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                Ambient Music Studio
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                6 original Web Audio soundscapes · Off by default
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setActiveModule('music-studio');
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              <Sliders className="h-3 w-3" />
              <span>Studio</span>
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-0.5">
            {AMBIENT_TRACKS.map((track) => {
              const selected = track.id === engineState.track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => void handleSelectTrack(track.id)}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                    selected
                      ? 'border-cyan-500/60 bg-cyan-500/10 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">{track.title}</span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      {track.bpm} BPM
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {track.tempoLabel}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => ambientBgm.toggleMute()}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200"
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
                onClick={handleToggleLoop}
                className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium ${
                  engineState.isLooping
                    ? 'border-violet-500/60 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Repeat className="h-3 w-3" />
                <span>Loop: {engineState.isLooping ? 'On' : 'Off'}</span>
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                <span>Volume</span>
                <span className="font-mono tabular-nums">{Math.round(engineState.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={engineState.volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                aria-label="Ambient soundscape volume"
                className="w-full accent-cyan-600"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
