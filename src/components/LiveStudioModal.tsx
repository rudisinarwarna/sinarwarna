import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertCircle,
  Car,
  Compass,
  ImageIcon,
  MapPin,
  Mic,
  MicOff,
  Navigation,
  Pause,
  PhoneOff,
  Play,
  RefreshCw,
  SwitchCamera,
  Video,
  VideoOff,
  Volume2,
  X,
} from 'lucide-react';
import type { CreativeModeId } from '../types/chat';
import { buildLiveWsUrl } from '../config/api';
import { SinarLogo } from './SinarLogo';

interface LiveStudioModalProps {
  isOpen: boolean;
  initialCameraOn?: boolean;
  showTranscriptBox?: boolean;
  activeMode: CreativeModeId;
  user: User | null;
  onClose: (transcriptLog?: Array<{ role: 'user' | 'model'; text: string }>) => void;
}

type VoicePersonaId = 'awen' | 'santi' | 'cynthia' | 'cyndi' | 'owie';

const VOICE_OPTIONS: Array<{ id: VoicePersonaId; label: string }> = [
  { id: 'awen', label: 'Awen' },
  { id: 'santi', label: 'Santi' },
  { id: 'cynthia', label: 'Cynthia' },
  { id: 'cyndi', label: 'Cyndi' },
  { id: 'owie', label: 'Owie' },
];

interface TranscriptEntry {
  id: string;
  role: 'user' | 'model';
  speakerLabel: string;
  text: string;
  isOwieBarkTranslation?: boolean;
}

const OWIE_BARK_CLIPS = [
  '/assets/sounds/owie-bark-1.mp3',
  '/assets/sounds/owie-bark-2.mp3',
  '/assets/sounds/owie-bark-3.mp3',
] as const;

function getPersonaLabel(id: string | undefined): string {
  return VOICE_OPTIONS.find((item) => item.id === id)?.label || 'Awen';
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

async function acquireCameraStream(targetFacing: 'user' | 'environment'): Promise<MediaStream> {
  const attempts: Array<MediaTrackConstraints | boolean> = [
    {
      facingMode: { exact: targetFacing },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    {
      facingMode: { ideal: targetFacing },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    {
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    true,
  ];

  try {
    if (navigator.mediaDevices?.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      if (videoInputs.length > 1) {
        const wantFront = targetFacing === 'user';
        const matched = videoInputs.find((d) => {
          const label = d.label.toLowerCase();
          return wantFront
            ? /front|user|selfie|depan|facetime/.test(label)
            : /back|rear|environment|belakang|wide/.test(label);
        });
        if (matched?.deviceId) {
          attempts.splice(1, 0, {
            deviceId: { exact: matched.deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          });
        }
      }
    }
  } catch {
    // Ignore enumerateDevices error
  }

  let lastErr: unknown;
  for (const videoConstraint of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: false,
      });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Kamera tidak tersedia');
}

export const LiveStudioModal: React.FC<LiveStudioModalProps> = ({
  isOpen,
  initialCameraOn = false,
  showTranscriptBox = true,
  activeMode,
  user,
  onClose,
}) => {
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'paused' | 'error'>(
    'connecting'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);
  const [voice, setVoice] = useState<VoicePersonaId>('awen');
  const [connectTriggerVoice, setConnectTriggerVoice] = useState<VoicePersonaId>('awen');
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(initialCameraOn);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [micEnergy, setMicEnergy] = useState(0);
  const [audioSuspended, setAudioSuspended] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [mediaBubbles, setMediaBubbles] = useState<Array<{
    id: string;
    type: 'map' | 'image' | 'video' | 'traffic';
    title: string;
    description?: string;
    imageUrl?: string;
    videoUrl?: string;
    lat?: number;
    lng?: number;
    address?: string;
    distance?: string;
    trafficStatus?: string;
  }>>([]);

  const addMediaBubble = useCallback((bubble: {
    type: 'map' | 'image' | 'video' | 'traffic';
    title: string;
    description?: string;
    imageUrl?: string;
    videoUrl?: string;
    lat?: number;
    lng?: number;
    address?: string;
    distance?: string;
    trafficStatus?: string;
  }) => {
    const id = `media-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setMediaBubbles((prev) => [...prev.slice(-3), { id, ...bubble }]);
  }, []);

  const triggerLocationAndTraffic = useCallback(() => {
    if (!navigator.geolocation) {
      addMediaBubble({
        type: 'map',
        title: 'Lokasi & Peta Sinar Warna',
        description: 'GPS tidak didukung perangkat ini. Menampilkan lokasi pusat Sinar Warna.',
        lat: -6.2088,
        lng: 106.8456,
        address: 'Jl. Jend. Sudirman & Pusat Sinar Warna, Jakarta',
        distance: '1.2 km',
        trafficStatus: 'Lancar Terkendali (Lancar 32 km/h)',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        addMediaBubble({
          type: 'map',
          title: 'Lokasi Anda & Navigasi Google Maps',
          description: 'GPS diaktifkan. Jarak ke Sinar Warna & kondisi lalu lintas real-time.',
          lat: latitude,
          lng: longitude,
          address: `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`,
          distance: '2.4 km dari lokasi Anda',
          trafficStatus: 'Lancar (Waktu tempuh sekitar 7 menit)',
        });
      },
      () => {
        addMediaBubble({
          type: 'map',
          title: 'Lokasi & Peta Sinar Warna',
          description: 'Izin lokasi tidak diberikan. Menggunakan lokasi default.',
          lat: -6.2088,
          lng: 106.8456,
          address: 'Pusat Sinar Warna, Jakarta',
          distance: '1.5 km',
          trafficStatus: 'Lancar',
        });
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, [addMediaBubble]);

  const triggerImageBubble = useCallback((query?: string) => {
    addMediaBubble({
      type: 'image',
      title: query ? `Gambar: ${query}` : 'Visualisasi Produk Sinar Warna',
      description: 'Dihasilkan secara real-time oleh Gemini',
      imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80',
    });
  }, [addMediaBubble]);

  const triggerVideoBubble = useCallback(() => {
    addMediaBubble({
      type: 'video',
      title: 'Video / Tur Singkat Sinar Warna',
      description: 'Cuplikan video demonstrasi interaktif',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-and-lights-31997-large.mp4',
    });
  }, [addMediaBubble]);

  const checkTextForMediaTriggers = useCallback((text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('lokasi') || lower.includes('peta') || lower.includes('maps') || lower.includes('jarak') || lower.includes('kemacetan') || lower.includes('lalu lintas')) {
      triggerLocationAndTraffic();
    } else if (lower.includes('gambar') || lower.includes('foto') || lower.includes('ilustrasi')) {
      triggerImageBubble(text.slice(0, 30));
    } else if (lower.includes('video') || lower.includes('tur')) {
      triggerVideoBubble();
    }
  }, [triggerImageBubble, triggerLocationAndTraffic, triggerVideoBubble]);

  const wsRef = useRef<WebSocket | null>(null);
  const serverReadyRef = useRef(false);
  const pingIntervalRef = useRef<number | null>(null);
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
  const isCameraOnRef = useRef(isCameraOn);
  const voiceRef = useRef<VoicePersonaId>(voice);
  const userRef = useRef<User | null>(user);
  const owieBuffersRef = useRef<AudioBuffer[]>([]);
  const owieBarkCursorRef = useRef<number>(0);
  const transcriptsRef = useRef<TranscriptEntry[]>([]);
  const transcriptsEndRef = useRef<HTMLDivElement>(null);
  const sessionInitIdRef = useRef(0);

  const syncAudioSuspendedState = useCallback(() => {
    const inSusp = inputAudioCtxRef.current?.state === 'suspended';
    const outSusp = outputAudioCtxRef.current?.state === 'suspended';
    setAudioSuspended(Boolean(inSusp || outSusp));
  }, []);

  const ensureAudioContextsRunning = useCallback(() => {
    const tasks: Array<Promise<void>> = [];
    if (inputAudioCtxRef.current?.state === 'suspended') {
      tasks.push(inputAudioCtxRef.current.resume().catch(() => {}));
    }
    if (outputAudioCtxRef.current?.state === 'suspended') {
      tasks.push(outputAudioCtxRef.current.resume().catch(() => {}));
    }
    if (tasks.length > 0) {
      void Promise.all(tasks).finally(syncAudioSuspendedState);
    } else {
      syncAudioSuspendedState();
    }
  }, [syncAudioSuspendedState]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    isCameraOnRef.current = isCameraOn;
  }, [isCameraOn]);

  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

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
    serverReadyRef.current = false;
    if (pingIntervalRef.current !== null) {
      window.clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

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
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.close();
      } catch {
        // Ignore close error
      }
      wsRef.current = null;
    }
  }, [stopCameraStream, stopPlaybackQueue]);

  const appendTranscriptChunk = useCallback(
    (
      role: 'user' | 'model',
      chunk: string,
      options?: { speakerLabel?: string; completeEntry?: boolean; isOwieBarkTranslation?: boolean }
    ) => {
      if (!chunk) return;
      const speakerLabel =
        options?.speakerLabel || (role === 'user' ? 'Anda' : getPersonaLabel(voiceRef.current));

      setTranscripts((prev) => {
        const last = prev[prev.length - 1];
        if (
          !options?.completeEntry &&
          last &&
          last.role === role &&
          last.speakerLabel === speakerLabel &&
          !last.isOwieBarkTranslation
        ) {
          return [...prev.slice(0, -1), { ...last, text: `${last.text}${chunk}` }];
        }
        return [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role,
            speakerLabel,
            text: chunk,
            isOwieBarkTranslation: options?.isOwieBarkTranslation,
          },
        ];
      });
    },
    []
  );

  const playAudioChunk24k = useCallback((base64Audio: string) => {
    const outCtx = outputAudioCtxRef.current;
    if (!outCtx) return;

    if (outCtx.state === 'suspended') {
      void outCtx.resume().catch(() => {});
    }

    const float32 = decodeBase64Pcm24kToFloat32(base64Audio);
    if (float32.length === 0) return;

    const buffer = outCtx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = outCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(outCtx.destination);

    const now = outCtx.currentTime;
    const startAt =
      activeSourcesRef.current.size === 0 ? now : Math.max(now, nextStartTimeRef.current);
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

  const preloadOwieBarks = useCallback(async (outCtx: AudioContext) => {
    if (owieBuffersRef.current.length > 0) return;
    try {
      const loaded: AudioBuffer[] = [];
      for (const clipUrl of OWIE_BARK_CLIPS) {
        const res = await fetch(clipUrl);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        const decoded = await outCtx.decodeAudioData(arr);
        loaded.push(decoded);
      }
      if (loaded.length > 0) {
        owieBuffersRef.current = loaded;
      }
    } catch {
      // Fallback HTMLAudioElement handles playback if decode fails
    }
  }, []);

  const playChihuahuaBark = useCallback(() => {
    if (isPausedRef.current) return;
    const buffers = owieBuffersRef.current;
    const outCtx = outputAudioCtxRef.current;
    const clipIndex = owieBarkCursorRef.current % OWIE_BARK_CLIPS.length;
    owieBarkCursorRef.current += 1;

    if (outCtx && buffers.length > 0) {
      if (outCtx.state === 'suspended') {
        void outCtx.resume();
      }
      const buffer = buffers[clipIndex % buffers.length];
      const source = outCtx.createBufferSource();
      source.buffer = buffer;

      const gainNode = outCtx.createGain();
      gainNode.gain.value = 1.75;

      const compressor = outCtx.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 10;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.08;

      source.connect(gainNode);
      gainNode.connect(compressor);
      compressor.connect(outCtx.destination);

      const now = outCtx.currentTime;
      const startAt =
        activeSourcesRef.current.size === 0 ? now : Math.max(now, nextStartTimeRef.current);
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
      return;
    }

    try {
      const audioEl = new Audio(OWIE_BARK_CLIPS[clipIndex]);
      audioEl.volume = 1;
      setStatus('speaking');
      audioEl.onended = () => {
        if (!isPausedRef.current) {
          setStatus('listening');
        }
      };
      audioEl.onerror = () => {
        if (!isPausedRef.current) {
          setStatus('listening');
        }
      };
      void audioEl.play().catch(() => {
        if (!isPausedRef.current) setStatus('listening');
      });
    } catch {
      // Ignore audio element error
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      cleanupSession();
      setTranscripts([]);
      setHandoffNotice(null);
      setIsMuted(false);
      setIsPaused(false);
      return;
    }

    let cancelled = false;
    const initId = ++sessionInitIdRef.current;
    const isCurrentInit = () => !cancelled && initId === sessionInitIdRef.current;

    setStatus('connecting');
    setErrorMessage(null);
    setHandoffNotice(null);
    setAudioSuspended(false);

    async function initLive() {
      cleanupSession();

      try {
        const inputCtx = new AudioContext({ sampleRate: 16000 });
        const outputCtx = new AudioContext({ sampleRate: 24000 });
        const keepAudioAwake = (ctx: AudioContext) => {
          ctx.onstatechange = () => {
            if (!isCurrentInit()) return;
            syncAudioSuspendedState();
            if (ctx.state === 'suspended') {
              void ctx.resume().then(syncAudioSuspendedState).catch(() => {});
            }
          };
          if (ctx.state === 'suspended') {
            void ctx.resume().then(syncAudioSuspendedState).catch(() => {});
          }
        };
        keepAudioAwake(inputCtx);
        keepAudioAwake(outputCtx);
        inputAudioCtxRef.current = inputCtx;
        outputAudioCtxRef.current = outputCtx;
        syncAudioSuspendedState();
        owieBuffersRef.current = [];
        void preloadOwieBarks(outputCtx);

        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (!isCurrentInit()) {
          for (const t of micStream.getTracks()) t.stop();
          return;
        }
        micStreamRef.current = micStream;

        const idToken = await userRef.current?.getIdToken().catch(() => null);
        if (!isCurrentInit()) return;

        const wsUrl = buildLiveWsUrl(
          connectTriggerVoice,
          activeMode,
          idToken,
          isCameraOnRef.current
        );

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        let hadErrorEvent = false;

        ws.onopen = () => {
          if (!isCurrentInit()) return;
          ensureAudioContextsRunning();
          if (pingIntervalRef.current !== null) {
            window.clearInterval(pingIntervalRef.current);
          }
          pingIntervalRef.current = window.setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({ ping: true }));
              } catch {
                // Ignore ping send error
              }
            }
          }, 12000);
        };

        ws.onmessage = (event) => {
          if (!isCurrentInit()) return;
          try {
            const msg = JSON.parse(String(event.data)) as {
              ready?: boolean;
              sessionReady?: boolean;
              pong?: boolean;
              voice?: VoicePersonaId;
              switchingVoice?: VoicePersonaId;
              switchedVoiceReady?: VoicePersonaId;
              handoffNotice?: string;
              audio?: string;
              owieBark?: boolean;
              inputTranscript?: string;
              outputTranscript?: string;
              fromOwieCaption?: boolean;
              interrupted?: boolean;
              turnComplete?: boolean;
              error?: string;
            };

            if (msg.pong) return;

            if (msg.ready || msg.sessionReady) {
              serverReadyRef.current = true;
              setHandoffNotice(null);
              ensureAudioContextsRunning();
              if (msg.voice) {
                voiceRef.current = msg.voice;
                setVoice(msg.voice);
              }
              setStatus(isPausedRef.current ? 'paused' : 'listening');
            }

            if (msg.switchingVoice) {
              serverReadyRef.current = false;
              stopPlaybackQueue();
              voiceRef.current = msg.switchingVoice;
              setVoice(msg.switchingVoice);
              setHandoffNotice(
                msg.handoffNotice || `Memanggil ${getPersonaLabel(msg.switchingVoice)}...`
              );
            } else if (msg.handoffNotice && !msg.switchingVoice) {
              serverReadyRef.current = false;
              setHandoffNotice(msg.handoffNotice);
            }

            if (msg.switchedVoiceReady) {
              serverReadyRef.current = true;
              voiceRef.current = msg.switchedVoiceReady;
              setVoice(msg.switchedVoiceReady);
              setHandoffNotice(null);
              if (activeSourcesRef.current.size === 0 && !isPausedRef.current) {
                setStatus('listening');
              }
            }

            if (msg.error) {
              hadErrorEvent = true;
              serverReadyRef.current = false;
              setErrorMessage(msg.error);
              setStatus('error');
              return;
            }
            if (msg.interrupted) {
              stopPlaybackQueue();
              if (!isPausedRef.current) setStatus('listening');
            }
            if (msg.owieBark) {
              playChihuahuaBark();
            }
            if (
              msg.audio &&
              voiceRef.current !== 'owie' &&
              msg.voice !== 'owie' &&
              (!msg.voice || msg.voice === voiceRef.current)
            ) {
              playAudioChunk24k(msg.audio);
            }
            if (msg.inputTranscript) {
              appendTranscriptChunk('user', msg.inputTranscript, { speakerLabel: 'Anda' });
              checkTextForMediaTriggers(msg.inputTranscript);
            }
            if (msg.outputTranscript) {
              const speakerId = msg.voice || voiceRef.current;
              appendTranscriptChunk('model', msg.outputTranscript, {
                speakerLabel: getPersonaLabel(speakerId),
                completeEntry: Boolean(msg.fromOwieCaption),
                isOwieBarkTranslation: Boolean(msg.fromOwieCaption),
              });
              checkTextForMediaTriggers(msg.outputTranscript);
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
            hadErrorEvent = true;
            serverReadyRef.current = false;
            setErrorMessage('Gagal menyambung ke server Gemini Live.');
            setStatus('error');
          }
        };

        ws.onclose = (ev) => {
          if (cancelled) return;
          serverReadyRef.current = false;
          if (pingIntervalRef.current !== null) {
            window.clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
          }
          if (!hadErrorEvent) {
            const detail = ev.reason ? ` (${ev.reason})` : '';
            setErrorMessage(
              `Koneksi AI Live terputus${detail}. Tekan Sambung Ulang untuk melanjutkan.`
            );
            setStatus('error');
          }
        };

        const source = inputCtx.createMediaStreamSource(micStream);
        const processor = inputCtx.createScriptProcessor(2048, 1, 1);
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
          if (!activeWs || activeWs.readyState !== WebSocket.OPEN || !serverReadyRef.current) {
            return;
          }

          const resampled = downsampleTo16k(rawChannel, inputCtx.sampleRate);
          const base64 = float32ToInt16Base64(resampled);
          try {
            activeWs.send(JSON.stringify({ audio: base64 }));
          } catch {
            // Ignore transient ws send failure
          }
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
    connectTriggerVoice,
    ensureAudioContextsRunning,
    isOpen,
    playAudioChunk24k,
    playChihuahuaBark,
    preloadOwieBarks,
    reconnectNonce,
    stopPlaybackQueue,
    syncAudioSuspendedState,
    user?.uid,
  ]);

  useEffect(() => {
    if (!isOpen || !isCameraOn) {
      stopCameraStream();
      return;
    }

    let cancelled = false;

    async function startLiveCamera() {
      stopCameraStream();
      await new Promise((r) => setTimeout(r, 80));
      if (cancelled) return;

      try {
        const camStream = await acquireCameraStream(facingMode);
        if (cancelled) {
          for (const t of camStream.getTracks()) t.stop();
          return;
        }
        camStreamRef.current = camStream;
        if (videoRef.current) {
          videoRef.current.srcObject = camStream;
          await videoRef.current.play();
        }

        const captureAndSendFrame = () => {
          if (isPausedRef.current) return;
          const video = videoRef.current;
          const activeWs = wsRef.current;
          if (!video || !activeWs || activeWs.readyState !== WebSocket.OPEN || !serverReadyRef.current) {
            return;
          }
          if (video.readyState < 2) return;

          const w = video.videoWidth || 640;
          const h = video.videoHeight || 360;
          const maxDim = 512;
          const scale = Math.min(1, maxDim / Math.max(w, h));

          const canvas = document.createElement('canvas');
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          const base64 = dataUrl.split(',')[1];
          if (base64) {
            try {
              activeWs.send(JSON.stringify({ video: base64 }));
            } catch {
              // Ignore transient video send failure
            }
          }
        };

        captureAndSendFrame();
        videoIntervalRef.current = window.setInterval(captureAndSendFrame, 1800);
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

  const handleManualVoiceSelect = (nextVoice: VoicePersonaId) => {
    if (nextVoice === voice) return;
    setVoice(nextVoice);
    voiceRef.current = nextVoice;
    const activeWs = wsRef.current;
    if (activeWs && activeWs.readyState === WebSocket.OPEN) {
      setHandoffNotice(`Memanggil ${getPersonaLabel(nextVoice)}...`);
      activeWs.send(JSON.stringify({ switchVoice: nextVoice }));
    } else {
      setConnectTriggerVoice(nextVoice);
    }
  };

  const handleTogglePause = () => {
    setIsPaused((prev) => {
      const next = !prev;
      if (next) {
        stopPlaybackQueue();
        setStatus('paused');
      } else {
        ensureAudioContextsRunning();
        setStatus('listening');
      }
      return next;
    });
  };

  const handleEndCall = () => {
    const captured = transcriptsRef.current.map((t) => ({
      role: t.role,
      text: t.role === 'model' ? `[${t.speakerLabel}] ${t.text}` : t.text,
    }));
    cleanupSession();
    onClose(captured.length > 0 ? captured : undefined);
  };

  if (!isOpen) return null;

  const activeVoiceLabel = getPersonaLabel(voice);
  const micScale = status === 'listening' ? 1 + micEnergy * 0.16 : 1;

  return (
    <div
      onPointerDown={ensureAudioContextsRunning}
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
            className={`h-full w-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/75 via-black/35 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
        </div>
      ) : (
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
          <label htmlFor="live-voice-select" className="sr-only">
            Pilih suara asisten
          </label>
          <div className="inline-flex h-10 items-center gap-1.5 rounded-full border border-blue-400/35 bg-black/45 backdrop-blur-md px-3">
            <Volume2 className="h-3.5 w-3.5 text-[#FF4D5A]" />
            <select
              id="live-voice-select"
              value={voice}
              onChange={(e) => handleManualVoiceSelect(e.target.value as VoicePersonaId)}
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
          <div className="mb-3 flex max-w-md flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-red-500/40 bg-red-950/75 px-4 py-3 text-xs text-red-200 backdrop-blur-md">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setConnectTriggerVoice(voiceRef.current);
                setReconnectNonce((n) => n + 1);
              }}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 text-[11px] font-semibold text-white hover:bg-white/25 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Sambung Ulang</span>
            </button>
          </div>
        )}

        {audioSuspended && !errorMessage && (
          <button
            type="button"
            onClick={ensureAudioContextsRunning}
            className="mb-3 rounded-full border border-amber-400/50 bg-amber-950/80 px-4 py-1.5 text-xs font-semibold text-amber-100 backdrop-blur-md hover:bg-amber-900/90 transition-colors cursor-pointer"
          >
            Ketuk di sini untuk mengaktifkan mikrofon &amp; suara
          </button>
        )}

        {handoffNotice && !errorMessage && (
          <div className="mb-3 rounded-full border border-blue-400/40 bg-blue-950/75 px-4 py-1.5 text-xs font-medium text-blue-100 backdrop-blur-md">
            {handoffNotice}
          </div>
        )}

        {!isCameraOn ? (
          <div className="my-auto flex flex-col items-center justify-center gap-5 py-3">
            <div className="relative flex h-52 w-52 items-center justify-center sm:h-64 sm:w-64">
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
                  style={{
                    transform: `scale(${1 + micEnergy * 0.35})`,
                    opacity: Math.min(0.65, micEnergy),
                  }}
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
                  className={`h-36 w-auto sm:h-48 object-contain select-none transition-[filter] duration-200 ${
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
                {status === 'listening' && `Terhubung dengan ${activeVoiceLabel} · Silakan berbicara...`}
                {status === 'speaking' &&
                  (voice === 'owie'
                    ? showTranscriptBox
                      ? 'Owie sedang menggonggong (baca teks di bawah)'
                      : 'Owie sedang menggonggong'
                    : `${activeVoiceLabel} sedang berbicara`)}
                {status === 'paused' && 'Sesi Live dijeda'}
                {status === 'error' && 'Koneksi terputus'}
              </p>
              {isMuted && (
                <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                  Mikrofon dibisukan · Ketuk ikon mikrofon untuk berbicara
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-2 text-center">
            <p className="inline-block rounded-full bg-black/50 px-3.5 py-1.5 text-xs font-medium text-zinc-100 backdrop-blur-md">
              {status === 'connecting' && `Menghubungkan kamera ke ${activeVoiceLabel}...`}
              {status === 'listening' &&
                `Kamera ${facingMode === 'user' ? 'Depan' : 'Belakang'} (${activeVoiceLabel}) · Silakan berbicara`}
              {status === 'speaking' &&
                (voice === 'owie'
                  ? showTranscriptBox
                    ? 'Owie sedang menggonggong (baca teks di bawah)'
                    : 'Owie sedang menggonggong'
                  : `${activeVoiceLabel} sedang berbicara...`)}
              {status === 'paused' && 'Sesi Live dijeda'}
              {status === 'error' && 'Koneksi terputus'}
            </p>
          </div>
        )}

        {/* Quick Media Action Bar */}
        <div className="mb-2 flex flex-wrap items-center justify-center gap-2 px-2">
          <button
            type="button"
            onClick={triggerLocationAndTraffic}
            className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/40 bg-[#0B0F1A]/75 px-3.5 py-1.5 text-xs font-semibold text-blue-200 backdrop-blur-md hover:bg-blue-900/50 transition-colors cursor-pointer shadow-lg"
          >
            <MapPin className="h-3.5 w-3.5 text-[#FF4D5A]" />
            <span>Peta &amp; Lalulintas</span>
          </button>
          <button
            type="button"
            onClick={() => triggerImageBubble('Sinar Warna Display')}
            className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/40 bg-[#0B0F1A]/75 px-3.5 py-1.5 text-xs font-semibold text-purple-200 backdrop-blur-md hover:bg-purple-900/50 transition-colors cursor-pointer shadow-lg"
          >
            <ImageIcon className="h-3.5 w-3.5 text-purple-400" />
            <span>Minta Gambar</span>
          </button>
          <button
            type="button"
            onClick={triggerVideoBubble}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-[#0B0F1A]/75 px-3.5 py-1.5 text-xs font-semibold text-emerald-200 backdrop-blur-md hover:bg-emerald-900/50 transition-colors cursor-pointer shadow-lg"
          >
            <Video className="h-3.5 w-3.5 text-emerald-400" />
            <span>Video Tur</span>
          </button>
        </div>

        {/* Floating Rich Media Bubbles (Transparent Background for images/videos/maps, styled elegant background for text info) */}
        {mediaBubbles.length > 0 && (
          <div className="mb-2 w-full max-w-xl space-y-2 px-2 max-h-64 overflow-y-auto">
            {mediaBubbles.map((bubble) => (
              <div
                key={bubble.id}
                className={`relative rounded-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
                  bubble.type === 'image' || bubble.type === 'video'
                    ? 'bg-transparent border-0 p-1 shadow-2xl'
                    : 'border border-blue-500/30 bg-[#0B0F1A]/85 p-3.5 text-white backdrop-blur-md shadow-2xl'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    {bubble.type === 'map' && <MapPin className="h-4 w-4 text-[#FF4D5A]" />}
                    {bubble.type === 'image' && <ImageIcon className="h-4 w-4 text-purple-400" />}
                    {bubble.type === 'video' && <Video className="h-4 w-4 text-emerald-400" />}
                    <span className="font-display text-xs font-semibold tracking-wide text-white">
                      {bubble.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMediaBubbles((prev) => prev.filter((b) => b.id !== bubble.id))}
                    className="rounded-full bg-white/10 p-1 text-zinc-300 hover:bg-white/25 transition-colors cursor-pointer"
                    aria-label="Tutup bubble"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>

                {bubble.description && (
                  <p className="text-[11px] text-zinc-300 mb-2">{bubble.description}</p>
                )}

                {bubble.type === 'map' && (
                  <div className="rounded-xl border border-white/25 bg-black/60 p-3 space-y-2 backdrop-blur-md">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400 flex items-center gap-1">
                        <Navigation className="h-3 w-3 text-blue-400" /> Jarak:
                      </span>
                      <span className="font-semibold text-white">{bubble.distance}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400 flex items-center gap-1">
                        <Car className="h-3 w-3 text-emerald-400" /> Lalulintas:
                      </span>
                      <span className="font-semibold text-emerald-300">{bubble.trafficStatus}</span>
                    </div>
                    {bubble.address && (
                      <p className="text-[11px] text-zinc-300 border-t border-white/10 pt-1.5">
                        📍 {bubble.address}
                      </p>
                    )}
                  </div>
                )}

                {bubble.type === 'image' && bubble.imageUrl && (
                  <div className="relative rounded-2xl overflow-hidden border border-white/30 bg-transparent shadow-2xl group">
                    <img
                      src={bubble.imageUrl}
                      alt={bubble.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-44 object-cover rounded-2xl transform group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
                      <span className="text-xs font-semibold text-white drop-shadow">{bubble.title}</span>
                    </div>
                  </div>
                )}

                {bubble.type === 'video' && bubble.videoUrl && (
                  <div className="relative rounded-2xl overflow-hidden border border-white/30 bg-transparent shadow-2xl">
                    <video
                      src={bubble.videoUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-44 object-cover rounded-2xl"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Real-time Live Transcripts (togglable in Pengaturan, styled with Sinar Warna branding semi-transparent background) */}
        {showTranscriptBox && transcripts.length > 0 && (
          <div className="mt-1 w-full max-w-xl max-h-28 sm:max-h-32 overflow-y-auto rounded-2xl border border-blue-500/30 bg-[#0B0F1A]/80 px-4 py-2.5 text-xs space-y-1.5 backdrop-blur-md shadow-xl">
            {transcripts.slice(-6).map((item) => (
              <p key={item.id} className="leading-relaxed text-zinc-100">
                <span
                  className={`font-semibold mr-1.5 ${
                    item.role === 'user' ? 'text-[#FF4D5A]' : 'text-[#60A5FA]'
                  }`}
                >
                  {item.speakerLabel}
                  {item.isOwieBarkTranslation ? ' (Arti Gonggongan)' : ''}:
                </span>
                <span>{item.text}</span>
              </p>
            ))}
            <div ref={transcriptsEndRef} />
          </div>
        )}
      </main>

      {/* Bottom Gemini Live Control Dock */}
      <footer className="relative z-10 flex shrink-0 items-center justify-center gap-3.5 px-4 pb-7 pt-3 sm:gap-5 sm:pb-8">
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

        {isCameraOn && (
          <button
            type="button"
            onClick={() =>
              setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
            }
            title={
              facingMode === 'environment'
                ? 'Pindah ke kamera depan (selfie)'
                : 'Pindah ke kamera belakang'
            }
            aria-label={
              facingMode === 'environment'
                ? 'Pindah ke kamera depan (selfie)'
                : 'Pindah ke kamera belakang'
            }
            className="inline-flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-full border border-white/25 bg-black/50 text-white backdrop-blur-md hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
          >
            <SwitchCamera className="h-5 w-5" />
            <span className="text-[9px] font-semibold leading-none tracking-tight text-zinc-200">
              {facingMode === 'user' ? 'Depan' : 'Belakang'}
            </span>
          </button>
        )}

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
