import React from "react";
import { Pause, Play, Square, Volume2 } from "lucide-react";
import {
  useAudioPlayback,
  type VoiceStatus,
} from "../../lib/AudioPlaybackContext";

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
};

const statusLabel: Record<VoiceStatus, string> = {
  idle: "",
  listening: "Listening...",
  transcribing: "Transcribing...",
  synthesizing: "Synthesizing audio...",
  playing: "Playing response",
};

export const AudioController: React.FC = () => {
  const {
    activeText,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    status,
    togglePlayback,
    seek,
    setPlaybackRate,
    stopPlayback,
  } = useAudioPlayback();
  if (!activeText && status === "idle") return null;

  return (
    <div className="fixed bottom-24 left-1/2 z-40 flex w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-[4px] border border-accent-primary/40 bg-surface-2/95 px-3 py-2 shadow-[0_8px_28px_rgba(0,0,0,.35)] backdrop-blur-md">
      <button
        type="button"
        onClick={togglePlayback}
        title={isPlaying ? "Pause audio" : "Play audio"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[2px] bg-accent-primary text-background hover:brightness-110"
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <Volume2 size={15} className="shrink-0 text-accent-primary" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-accent-primary">
          <span>{statusLabel[status] || "Audio response"}</span>
          <span className="flex items-end gap-[2px]" aria-hidden="true">
            {[3, 7, 11, 6, 9, 4].map((height, index) => (
              <span
                key={index}
                className={`w-[2px] rounded-full bg-accent-primary ${isPlaying ? "animate-pulse" : ""}`}
                style={{ height }}
              />
            ))}
          </span>
        </div>
        <input
          aria-label="Audio progress"
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={Math.min(currentTime, duration || 1)}
          onChange={(event) => seek(Number(event.target.value))}
          className="h-1 w-full accent-[#D97A3F]"
        />
      </div>
      <span className="shrink-0 font-mono text-[10px] text-text-muted">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
      <select
        aria-label="Playback speed"
        value={playbackRate}
        onChange={(event) => setPlaybackRate(Number(event.target.value))}
        className="h-7 rounded-[2px] border border-border bg-surface-1 px-1 font-mono text-[10px] text-text-primary focus:outline-none"
      >
        {[1, 1.25, 1.5].map((rate) => (
          <option key={rate} value={rate}>
            {rate.toFixed(2).replace(/0$/, "")}x
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={stopPlayback}
        title="Stop audio"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] text-text-muted hover:bg-accent-secondary/20 hover:text-accent-secondary"
      >
        <Square size={13} />
      </button>
    </div>
  );
};

export default AudioController;
