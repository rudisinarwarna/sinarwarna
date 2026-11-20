import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Mic,
  MicOff,
  Pause,
  PhoneOff,
  Play,
  SwitchCamera,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react';
import type { CreativeModeId } from '../types/chat';
import { buildLiveWsUrl } from '../config/api';
import { SinarLogo } from './SinarLogo';

interface LiveStudioModalProps {
  isOpen: boolean;
  initialCameraOn?: boolean;
  activeMode: CreativeModeId;
  onClose: (transcriptLog?: Array<{ role: 'user' | 'model'; text: string }>) => void;
}

type VoicePersonaId = 'santi' | 'cynthia' | 'awen' | 'cyndi' | 'owie';

const VOICE_OPTIONS: Array<{ id: VoicePersonaId; label: string }> = [
  { id: 'santi', label: 'Santi' },
  { id: 'cynthia', label: 'Cynthia' },
  { id: 'awen', label: 'Awen' },
  { id: 'cyndi', label: 'Cyndi' },
  { id: 'owie', label: 'Owie (Anjing)' },
];

interface TranscriptEntry {
  id: string;
  role: 'user' | 'model';
  text: string;
}

function downsampleTo16k(float32: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return float32;
  const ratio = inputSampleRate / 16000;
  const newLength = Math.floor(float32.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), float32.length);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += float32[j];
      count++;
    }
    result[i] = count > 0 ? sum / count : float32[start] || 0;
  }
  return result;
}

function float32ToInt16Base64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function decodeBase64Pcm24kToFloat32(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(new ArrayBuffer(len));
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
  const float32 = new Float32Array(new ArrayBuffer(int16.length * 4));
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  return float32;
}

export const LiveStudioModal: React.FC<LiveStudioModalProps> = ({
  isOpen,
  initialCameraOn = false,
  activeMode,
  onClose,
}) => {
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'paused' | 'error'>(
    'connecting'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [voice, setVoice] = useState<VoicePersonaId>('santi');
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(initialCameraOn);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [micEnergy, setMicEnergy] = useState(0);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoIntervalRef = useRef<number | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const isMutedRef = useRef(isMuted);
  const isPausedRef = useRef(isPaused);
  const transcriptsRef = useRef<TranscriptEntry[]>([]);
  const transcriptsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    setIsCameraOn(initialCameraOn);
  }, [initialCameraOn, isOpen]);

  useEffect(() => {
    transcriptsRef.current = transcripts;
    transcriptsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const stopPlaybackQueue = useCallback(() => {
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
      } catch {
        // Ignore already stopped source
      }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const stopCameraStream = useCallback(() => {
    if (videoIntervalRef.current !== null) {
      window.clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    if (camStreamRef.current) {
      for (const t of camStreamRef.current.getTracks()) {
        t.stop();
      }
      camStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const cleanupSession = useCallback(() => {
    stopPlaybackQueue();
    stopCameraStream();

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // Ignore disconnect error
      }
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    if (micStreamRef.current) {
      for (const t of micStreamRef.current.getTracks()) {
        t.stop();
      }
      micStreamRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      void inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      void outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Ignore close error
      }
      wsRef.current = null;
    }
  }, [stopCameraStream, stopPlaybackQueue]);

  const appendTranscriptChunk = useCallback((role: 'user' | 'model', chunk: string) => {
    if (!chunk) return;
    setTranscripts((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role) {
        return [...prev.slice(0, -1), { ...last, text: `${last.text}${chunk}` }];
      }
      return [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role,
          text: chunk,
        },
      ];
    });
  }, []);

  const playAudioChunk24k = useCallback((base64Audio: string) => {
    const outCtx = outputAudioCtxRef.current;
    if (!outCtx) return;

    if (outCtx.state === 'suspended') {
      void outCtx.resume();
    }

    const float32 = decodeBase64Pcm24kToFloat32(base64Audio);
    if (float32.length === 0) return;

    const buffer = outCtx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = outCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(outCtx.destination);

    const now = outCtx.currentTime;
    const startAt = Math.max(now, nextStartTimeRef.current);
    nextStartTimeRef.current = startAt + buffer.duration;

    activeSourcesRef.current.add(source);
    setStatus('speaking');

    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0 && !isPausedRef.current) {
        setStatus('listening');
      }
    };

    source.start(startAt);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      cleanupSession();
      setTranscripts([]);
      setIsMuted(false);
      setIsPaused(false);
      return;
    }

    let cancelled = false;
    setStatus('connecting');
    setErrorMessage(null);

    async function initLive() {
      cleanupSession();

      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (cancelled) {
          for (const t of micStream.getTracks()) t.stop();
          return;
        }
        micStreamRef.current = micStream;

        const inputCtx = new AudioContext({ sampleRate: 16000 });
        const outputCtx = new AudioContext({ sampleRate: 24000 });
        if (outputCtx.state === 'suspended') {
          void outputCtx.resume().catch(() => {});
        }
        inputAudioCtxRef.current = inputCtx;
        outputAudioCtxRef.current = outputCtx;

        const wsUrl = buildLiveWsUrl(voice, activeMode);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          if (cancelled) return;
          try {
            const msg = JSON.parse(String(event.data)) as {
              ready?: boolean;
              audio?: string;
              inputTranscript?: string;
              outputTranscript?: string;
              interrupted?: boolean;
              turnComplete?: boolean;
              error?: string;
            };

            if (msg.ready) {
              setStatus(isPausedRef.current ? 'paused' : 'listening');
            }
            if (msg.error) {
              setErrorMessage(msg.error);
              setStatus('error');
              return;
            }
            if (msg.interrupted) {
              stopPlaybackQueue();
              if (!isPausedRef.current) setStatus('listening');
            }
            if (msg.audio) {
              playAudioChunk24k(msg.audio);
            }
            if (msg.inputTranscript) {
              appendTranscriptChunk('user', msg.inputTranscript);
            }
            if (msg.outputTranscript) {
              appendTranscriptChunk('model', msg.outputTranscript);
            }
            if (msg.turnComplete && activeSourcesRef.current.size === 0 && !isPausedRef.current) {
              setStatus('listening');
            }
          } catch {
            // Ignore malformed message
          }
        };

        ws.onerror = () => {
          if (!cancelled) {
            setErrorMessage('Gagal menyambung ke server Gemini Live.');
            setStatus('error');
          }
        };

        const source = inputCtx.createMediaStreamSource(micStream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        const silentGain = inputCtx.createGain();
        silentGain.gain.value = 0;

        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(inputCtx.destination);

        processor.onaudioprocess = (e) => {
          if (cancelled || isMutedRef.current || isPausedRef.current) {
            setMicEnergy(0);
            return;
          }
          const rawChannel = e.inputBuffer.getChannelData(0);
          let sumSq = 0;
          for (let i = 0; i < rawChannel.length; i += 8) {
            sumSq += rawChannel[i] * rawChannel[i];
          }
          const rms = Math.sqrt(sumSq / (rawChannel.length / 8));
          setMicEnergy(Math.min(1, rms * 5));

          const activeWs = wsRef.current;
          if (!activeWs || activeWs.readyState !== WebSocket.OPEN) return;

          const resampled = downsampleTo16k(rawChannel, inputCtx.sampleRate);
          const base64 = float32ToInt16Base64(resampled);
          activeWs.send(JSON.stringify({ audio: base64 }));
        };
      } catch {
        if (!cancelled) {
          setErrorMessage(
            'Akses mikrofon ditolak atau tidak tersedia. Aktifkan izin mikrofon lalu coba lagi.'
          );
          setStatus('error');
        }
      }
    }

    void initLive();

    return () => {
      cancelled = true;
      cleanupSession();
    };
  }, [
    activeMode,
    appendTranscriptChunk,
    cleanupSession,
    isOpen,
    playAudioChunk24k,
    stopPlaybackQueue,
    voice,
  ]);

  useEffect(() => {
    if (!isOpen || !isCameraOn) {
      stopCameraStream();
      return;
    }

    let cancelled = false;

    async function startLiveCamera() {
      stopCameraStream();
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          for (const t of camStream.getTracks()) t.stop();
          return;
        }
        camStreamRef.current = camStream;
        if (videoRef.current) {
          videoRef.current.srcObject = camStream;
          await videoRef.current.play();
        }

        videoIntervalRef.current = window.setInterval(() => {
          if (isPausedRef.current) return;
          const video = videoRef.current;
          const activeWs = wsRef.current;
          if (!video || !activeWs || activeWs.readyState !== WebSocket.OPEN) return;
          if (video.readyState < 2) return;

          const w = video.videoWidth || 640;
          const h = video.videoHeight || 360;
          const maxDim = 768;
          const scale = Math.min(1, maxDim / Math.max(w, h));

          const canvas = document.createElement('canvas');
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
          const base64 = dataUrl.split(',')[1];
          if (base64) {
            activeWs.send(JSON.stringify({ video: base64 }));
          }
        }, 1000);
      } catch {
        if (!cancelled) {
          setIsCameraOn(false);
          setErrorMessage('Kamera tidak dapat diakses. Periksa izin kamera di peramban Anda.');
        }
      }
    }

    void startLiveCamera();

    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [facingMode, isCameraOn, isOpen, stopCameraStream]);

  const handleTogglePause = () => {
    setIsPaused((prev) => {
      const next = !prev;
      if (next) {
        stopPlaybackQueue();
        setStatus('paused');
      } else {
        setStatus('listening');
      }
      return next;
    });
  };

  const handleEndCall = () => {
    const captured = transcriptsRef.current.map((t) => ({ role: t.role, text: t.text }));
    cleanupSession();
    onClose(captured.length > 0 ? captured : undefined);
  };

  if (!isOpen) return null;

  const activeVoiceLabel =
    VOICE_OPTIONS.find((item) => item.id === voice)?.label || 'Santi';

  const micScale = status === 'listening' ? 1 + micEnergy * 0.16 : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#060914] text-white overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Sinar Warna Live"
    >
      {/* Full-Screen Live Camera Layer when camera is ON */}
      {isCameraOn ? (
        <div className="absolute inset-0 z-0 bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/75 via-black/35 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
        </div>
      ) : (
        /* Vivid Red & Blue collaborative ambient studio backdrop */
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div
            className={`absolute -left-28 -top-24 h-[460px] w-[460px] rounded-full bg-[#E51D2B]/30 blur-[130px] transition-opacity duration-300 ${
              status === 'speaking' ? 'opacity-100' : 'opacity-70'
            }`}
          />
          <div
            className={`absolute -right-28 -bottom-24 h-[500px] w-[500px] rounded-full bg-[#0A36FF]/35 blur-[135px] transition-opacity duration-300 ${
              status === 'speaking' ? 'opacity-100' : 'opacity-75'
            }`}
          />
        </div>
      )}

      {/* Floating Top Bar */}
      <header className="relative z-10 flex h-16 shrink-0 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2.5 min-w-0">
          <SinarLogo size={26} spinning={isCameraOn && status === 'speaking'} />
          <span className="font-display text-sm font-semibold tracking-tight text-white whitespace-nowrap">
            Sinar Warna Live
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isCameraOn && (
            <button
              type="button"
              onClick={() =>
                setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
              }
              title="Ganti kamera depan/belakang"
              aria-label="Ganti kamera depan/belakang"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/75 transition-colors cursor-pointer"
            >
              <SwitchCamera className="h-4 w-4" />
            </button>
          )}

          <label htmlFor="live-voice-select" className="sr-only">
            Pilih suara asisten
          </label>
          <div className="inline-flex h-10 items-center gap-1.5 rounded-full border border-blue-400/35 bg-black/45 backdrop-blur-md px-3">
            <Volume2 className="h-3.5 w-3.5 text-[#FF4D5A]" />
            <select
              id="live-voice-select"
              value={voice}
              onChange={(e) => setVoice(e.target.value as VoicePersonaId)}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
            >
              {VOICE_OPTIONS.map((v) => (
                <option key={v.id} value={v.id} className="bg-[#0B0F1E] text-white">
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Center Stage */}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-end sm:justify-center px-4 py-2">
        {errorMessage && (
          <div className="mb-4 flex max-w-md items-center gap-2.5 rounded-2xl border border-red-500/40 bg-red-950/75 px-4 py-3 text-xs text-red-200 backdrop-blur-md">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {!isCameraOn ? (
          <div className="my-auto flex flex-col items-center justify-center gap-6 py-4">
            {/* Huge background-less animated Sinar Warna logo */}
            <div className="relative flex h-56 w-56 items-center justify-center sm:h-68 sm:w-68">
              <div
                style={{
                  transform: `scale(${status === 'speaking' ? 1.24 : 0.96 + micEnergy * 0.28})`,
                }}
                className={`pointer-events-none absolute inset-4 rounded-full bg-gradient-to-tr from-[#E51D2B]/45 via-transparent to-[#0A36FF]/50 blur-3xl transition-transform duration-150 ${
                  status === 'speaking' ? 'opacity-100' : 'opacity-70'
                }`}
              />

              {status === 'speaking' && (
                <>
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-2 rounded-full border-2 border-[#E51D2B]/65 animate-sinar-ring"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-2 rounded-full border-2 border-[#0A36FF]/65 animate-sinar-ring-delayed"
                  />
                </>
              )}

              {status === 'listening' && micEnergy > 0.08 && (
                <div
                  aria-hidden="true"
                  style={{ transform: `scale(${1 + micEnergy * 0.35})`, opacity: Math.min(0.65, micEnergy) }}
                  className="pointer-events-none absolute inset-6 rounded-full border border-blue-400/50 transition-transform duration-100"
                />
              )}

              <div
                style={status === 'listening' ? { transform: `scale(${micScale})` } : undefined}
                className={`relative z-10 flex items-center justify-center transition-transform duration-150 ${
                  status === 'speaking'
                    ? 'animate-sinar-speak'
                    : status === 'listening' || status === 'connecting'
                    ? 'animate-sinar-float'
                    : ''
                }`}
              >
                <img
                  src="/assets/sinar-warna-logo.png"
                  alt="Sinar Warna Live"
                  referrerPolicy="no-referrer"
                  className={`h-40 w-auto sm:h-52 object-contain select-none transition-[filter] duration-200 ${
                    status === 'speaking'
                      ? 'drop-shadow-[0_0_32px_rgba(10,54,255,0.65)]'
                      : 'drop-shadow-[0_0_20px_rgba(229,29,43,0.35)]'
                  }`}
                />
              </div>
            </div>

            <div className="space-y-1.5 text-center px-3">
              <p className="font-display text-lg font-semibold text-white sm:text-xl">
                {status === 'connecting' && `Menghubungkan ${activeVoiceLabel}...`}
                {status === 'listening' && 'Silakan berbicara...'}
                {status === 'speaking' && `${activeVoiceLabel} sedang berbicara`}
                {status === 'paused' && 'Sesi Live dijeda'}
                {status === 'error' && 'Koneksi terputus'}
              </p>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                {isMuted
                  ? 'Mikrofon dibisukan · Ketuk ikon mikrofon untuk berbicara'
                  : 'Ketuk ikon kamera kapan saja agar AI melihat objek langsung'}
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-2 text-center">
            <p className="inline-block rounded-full bg-black/50 px-3.5 py-1.5 text-xs font-medium text-zinc-100 backdrop-blur-md">
              {status === 'connecting' && `Menghubungkan kamera ke ${activeVoiceLabel}...`}
              {status === 'listening' && 'Kamera aktif · Silakan berbicara'}
              {status === 'speaking' && `${activeVoiceLabel} sedang berbicara...`}
              {status === 'paused' && 'Sesi Live dijeda'}
            </p>
          </div>
        )}

        {/* Real-time Live Transcripts */}
        {transcripts.length > 0 && (
          <div className="mt-2 w-full max-w-xl max-h-24 sm:max-h-28 overflow-y-auto rounded-2xl border border-white/15 bg-black/45 px-4 py-2.5 text-xs space-y-1.5 backdrop-blur-md">
            {transcripts.slice(-4).map((item) => (
              <p key={item.id} className="leading-relaxed text-zinc-100">
                <span
                  className={`font-semibold mr-1.5 ${
                    item.role === 'user' ? 'text-[#FF4D5A]' : 'text-[#60A5FA]'
                  }`}
                >
                  {item.role === 'user' ? 'Anda:' : `${activeVoiceLabel}:`}
                </span>
                <span>{item.text}</span>
              </p>
            ))}
            <div ref={transcriptsEndRef} />
          </div>
        )}
      </main>

      {/* Bottom Gemini Live Control Dock */}
      <footer className="relative z-10 flex shrink-0 items-center justify-center gap-4 px-4 pb-7 pt-3 sm:gap-5 sm:pb-8">
        <button
          type="button"
          onClick={() => setIsCameraOn((prev) => !prev)}
          title={isCameraOn ? 'Matikan kamera langsung' : 'Nyalakan kamera langsung'}
          aria-label={isCameraOn ? 'Matikan kamera langsung' : 'Nyalakan kamera langsung'}
          className={`inline-flex h-14 w-14 items-center justify-center rounded-full border backdrop-blur-md transition-colors cursor-pointer ${
            isCameraOn
              ? 'border-blue-400 bg-[#0A36FF] text-white shadow-lg shadow-blue-600/40'
              : 'border-white/20 bg-white/10 text-zinc-100 hover:bg-white/20'
          }`}
        >
          {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={() => setIsMuted((prev) => !prev)}
          title={isMuted ? 'Aktifkan mikrofon' : 'Bisukan mikrofon'}
          aria-label={isMuted ? 'Aktifkan mikrofon' : 'Bisukan mikrofon'}
          className={`inline-flex h-14 w-14 items-center justify-center rounded-full border backdrop-blur-md transition-colors cursor-pointer ${
            isMuted
              ? 'border-[#E51D2B] bg-[#E51D2B]/40 text-red-100'
              : 'border-white/20 bg-white/10 text-zinc-100 hover:bg-white/20'
          }`}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={handleTogglePause}
          title={isPaused ? 'Lanjutkan Live' : 'Jeda Live'}
          aria-label={isPaused ? 'Lanjutkan Live' : 'Jeda Live'}
          className={`inline-flex h-14 w-14 items-center justify-center rounded-full border backdrop-blur-md transition-colors cursor-pointer ${
            isPaused
              ? 'border-blue-400 bg-[#0A36FF]/45 text-blue-100'
              : 'border-white/20 bg-white/10 text-zinc-100 hover:bg-white/20'
          }`}
        >
          {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={handleEndCall}
          title="Akhiri Sinar Warna Live"
          aria-label="Akhiri Sinar Warna Live"
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#E51D2B] text-white shadow-lg shadow-red-600/45 hover:bg-red-600 transition-colors cursor-pointer"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </footer>
    </div>
  );
};
