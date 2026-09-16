import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type VoiceStatus =
  | "idle"
  | "listening"
  | "transcribing"
  | "synthesizing"
  | "playing";

interface AudioPlaybackContextValue {
  activeText: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  status: VoiceStatus;
  voiceMode: boolean;
  setVoiceMode: (enabled: boolean) => void;
  playText: (text: string) => Promise<void>;
  togglePlayback: () => void;
  seek: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  stopPlayback: () => void;
}

const AudioPlaybackContext = createContext<AudioPlaybackContextValue | null>(
  null,
);

const ttsEndpoint = "/api/v1/audio/synthesize";

export const AudioPlaybackProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [activeText, setActiveText] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [voiceMode, setVoiceMode] = useState(false);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onLoadedMetadata = () =>
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => {
      setIsPlaying(true);
      setStatus("playing");
    };
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setStatus("idle");
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.src = "";
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const stopPlayback = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    if (speechRef.current && "speechSynthesis" in window)
      window.speechSynthesis.cancel();
    speechRef.current = null;
    setIsPlaying(false);
    setStatus("idle");
  };

  const playText = async (text: string) => {
    if (!text.trim()) return;
    if (activeText === text && isPlaying) {
      togglePlayback();
      return;
    }

    stopPlayback();
    setActiveText(text);
    setCurrentTime(0);
    setStatus("synthesizing");

    try {
      const response = await fetch(ttsEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error("TTS endpoint unavailable");
      const audio = audioRef.current;
      if (!audio) throw new Error("Audio output unavailable");
      const blob = await response.blob();
      audio.src = URL.createObjectURL(blob);
      audio.playbackRate = playbackRate;
      await audio.play();
    } catch {
      if (!("speechSynthesis" in window)) {
        setStatus("idle");
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = playbackRate;
      utterance.onstart = () => {
        setIsPlaying(true);
        setStatus("playing");
      };
      utterance.onend = () => {
        setIsPlaying(false);
        setStatus("idle");
      };
      utterance.onerror = () => {
        setIsPlaying(false);
        setStatus("idle");
      };
      speechRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (audio?.src) {
      if (audio.paused) void audio.play();
      else audio.pause();
      return;
    }
    if (speechRef.current && "speechSynthesis" in window) {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      else window.speechSynthesis.pause();
      setIsPlaying(
        window.speechSynthesis.speaking && !window.speechSynthesis.paused,
      );
    }
  };

  const seek = (time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const setPlaybackRate = (rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
    if (speechRef.current) speechRef.current.rate = rate;
  };

  return (
    <AudioPlaybackContext.Provider
      value={{
        activeText,
        isPlaying,
        currentTime,
        duration,
        playbackRate,
        status,
        voiceMode,
        setVoiceMode,
        playText,
        togglePlayback,
        seek,
        setPlaybackRate,
        stopPlayback,
      }}
    >
      {children}
    </AudioPlaybackContext.Provider>
  );
};

export const useAudioPlayback = () => {
  const context = useContext(AudioPlaybackContext);
  if (!context)
    throw new Error(
      "useAudioPlayback must be used inside AudioPlaybackProvider",
    );
  return context;
};
