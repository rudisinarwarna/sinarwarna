import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, SwitchCamera, X } from 'lucide-react';
import type { ImageAttachment } from '../types/chat';
import { useLanguage } from '../i18n/LanguageContext';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (attachment: ImageAttachment) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setIsReady(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopStream();
      return;
    }

    let cancelled = false;
    setError(null);
    setIsReady(false);

    async function startCamera() {
      stopStream();
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          for (const t of media.getTracks()) t.stop();
          return;
        }
        streamRef.current = media;
        if (videoRef.current) {
          videoRef.current.srcObject = media;
          await videoRef.current.play();
          setIsReady(true);
        }
      } catch {
        if (!cancelled) {
          setError(t.camera.permissionError);
        }
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [facingMode, isOpen, stopStream, t.camera.permissionError]);

  const handleTakePhoto = () => {
    const video = videoRef.current;
    if (!video || !isReady) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(width, height));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const base64Data = dataUrl.split(',')[1] || '';
    if (!base64Data) return;

    onCapture({
      id: `cam-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `kamera-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.jpg`,
      mimeType: 'image/jpeg',
      data: base64Data,
      previewUrl: dataUrl,
    });
    stopStream();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-100 text-zinc-900 dark:bg-black dark:text-white overflow-hidden transition-colors duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={t.camera.dialogAria}
    >
      {/* Full-screen Edge-to-Edge Viewfinder */}
      <div className="relative flex-1 w-full h-full bg-zinc-200 dark:bg-black flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-red-200 bg-white/90 px-6 py-5 text-center text-sm text-red-700 shadow-lg dark:border-red-500/30 dark:bg-black/70 dark:text-red-200">
            <AlertCircle className="h-9 w-9 text-[#E51D2B] dark:text-red-400" />
            <p>{error}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        )}

        {/* Floating Top Overlay Controls */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-white/80 via-white/30 to-transparent dark:from-black/75 dark:via-black/35 dark:to-transparent px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#E51D2B] to-[#0A36FF] text-white shadow-md">
              <Camera className="h-4 w-4" />
            </span>
            <span className="font-display text-sm font-semibold tracking-tight text-zinc-900 dark:text-white">
              {t.camera.title}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
              }
              title={t.camera.switchCamera}
              aria-label={t.camera.switchCamera}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200/80 bg-white/85 text-zinc-800 shadow-md backdrop-blur-md hover:bg-white dark:border-transparent dark:bg-black/50 dark:text-white dark:shadow-none dark:hover:bg-black/75 transition-colors cursor-pointer"
            >
              <SwitchCamera className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                stopStream();
                onClose();
              }}
              title={t.camera.closeCamera}
              aria-label={t.camera.closeCamera}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200/80 bg-white/85 text-zinc-800 shadow-md backdrop-blur-md hover:bg-[#E51D2B] hover:text-white dark:border-transparent dark:bg-black/50 dark:text-white dark:shadow-none dark:hover:bg-[#E51D2B] transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Floating Bottom Shutter Bar */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center bg-gradient-to-t from-white/85 via-white/35 to-transparent dark:from-black/80 dark:via-black/35 dark:to-transparent px-5 pb-8 pt-8">
          <button
            type="button"
            disabled={!isReady || Boolean(error)}
            onClick={handleTakePhoto}
            className="inline-flex h-14 items-center gap-2.5 rounded-full bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] px-7 text-sm font-semibold text-white shadow-xl shadow-blue-600/35 hover:opacity-95 disabled:opacity-40 transition-all cursor-pointer"
          >
            <Camera className="h-5 w-5" />
            <span>{t.camera.takePhoto}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
