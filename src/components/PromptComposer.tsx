import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  AudioLines,
  Camera,
  ImagePlus,
  Mic,
  MicOff,
  Square,
  X,
} from 'lucide-react';
import type { ImageAttachment } from '../types/chat';
import { useLanguage } from '../i18n/LanguageContext';

interface PromptComposerProps {
  isStreaming: boolean;
  onSend: (text: string, attachments: ImageAttachment[]) => void;
  onStop: () => void;
  onOpenCamera: () => void;
  onOpenLive: () => void;
  pendingCameraAttachment?: ImageAttachment | null;
  onConsumePendingCameraAttachment?: () => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export const PromptComposer: React.FC<PromptComposerProps> = ({
  isStreaming,
  onSend,
  onStop,
  onOpenCamera,
  onOpenLive,
  pendingCameraAttachment,
  onConsumePendingCameraAttachment,
}) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const { t } = useLanguage();
  const speechSupported = Boolean(getSpeechRecognitionCtor());

  useEffect(() => {
    if (pendingCameraAttachment) {
      setUploadError(null);
      setAttachments((prev) => {
        if (prev.length >= 3) {
          setUploadError(t.composer.maxImagesError);
          return prev;
        }
        return [...prev, pendingCameraAttachment];
      });
      onConsumePendingCameraAttachment?.();
    }
  }, [pendingCameraAttachment, onConsumePendingCameraAttachment, t.composer.maxImagesError]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const readFiles = async (files: FileList | File[]) => {
    setUploadError(null);
    const list = Array.from(files);
    const remainingSlots = 3 - attachments.length;
    if (remainingSlots <= 0) {
      setUploadError(t.composer.maxImagesError);
      return;
    }

    const accepted = list.slice(0, remainingSlots);
    const nextAttachments: ImageAttachment[] = [];

    for (const file of accepted) {
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
        setUploadError(t.composer.unsupportedFormatError);
        continue;
      }
      if (file.size > 4 * 1024 * 1024) {
        setUploadError(t.composer.maxSizeError);
        continue;
      }

      const rawDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error(t.composer.fileReadError));
        reader.readAsDataURL(file);
      });

      let finalMime = file.type;
      let finalPreviewUrl = rawDataUrl;
      let base64Data = rawDataUrl.split(',')[1] || '';

      if (base64Data.length > 135000 && file.type !== 'image/gif') {
        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('Gagal memuat gambar'));
            el.src = rawDataUrl;
          });
          const maxSide = 900;
          const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round((img.width || 1) * scale));
          canvas.height = Math.max(1, Math.round((img.height || 1) * scale));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            for (const q of [0.82, 0.7, 0.56, 0.44]) {
              const candidateUrl = canvas.toDataURL('image/jpeg', q);
              const candidateB64 = candidateUrl.split(',')[1] || '';
              if (candidateB64.length > 0 && candidateB64.length <= 145000) {
                finalMime = 'image/jpeg';
                finalPreviewUrl = candidateUrl;
                base64Data = candidateB64;
                break;
              }
            }
          }
        } catch {
          // Keep original attachment if canvas resize fails
        }
      }

      if (base64Data) {
        nextAttachments.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          mimeType: finalMime,
          data: base64Data,
          previewUrl: finalPreviewUrl,
        });
      }
    }

    if (nextAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...nextAttachments]);
    }
  };

  const handleSubmit = () => {
    if (isStreaming) return;
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;

    onSend(trimmed, attachments);
    setText('');
    setAttachments([]);
    setUploadError(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleVoiceInput = () => {
    setUploadError(null);
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechCtor = getSpeechRecognitionCtor();
    if (!SpeechCtor) {
      setUploadError(t.composer.speechNotSupported);
      return;
    }

    try {
      const recognition = new SpeechCtor();
      recognition.lang = t.composer.speechLang;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setText((prev) => (prev ? `${prev.trimEnd()} ${transcript}` : transcript));
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  };

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !isStreaming;

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files?.length) {
            void readFiles(e.dataTransfer.files);
          }
        }}
        className={`relative rounded-3xl border transition-colors bg-zinc-50/95 dark:bg-[#14192B] ${
          isDragging
            ? 'border-[#0A36FF] ring-2 ring-blue-500/30'
            : 'border-blue-500/25 dark:border-[#293456] focus-within:border-[#0A36FF] dark:focus-within:border-[#3B82F6]'
        }`}
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3.5">
            {attachments.map((att) => (
              <div key={att.id} className="relative group">
                <img
                  src={att.previewUrl}
                  alt={att.name}
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 rounded-xl border border-blue-500/40 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((item) => item.id !== att.id))}
                  aria-label={`Hapus ${att.name}`}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#E51D2B] text-white shadow-xs cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {uploadError && (
          <p className="px-4 pt-2.5 text-xs text-[#E51D2B] dark:text-red-400">{uploadError}</p>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.composer.placeholder}
          aria-label={t.composer.ariaLabel}
          className="w-full resize-none bg-transparent px-4 pt-3.5 pb-1.5 text-[15px] leading-relaxed text-zinc-900 placeholder:text-zinc-500 dark:text-[#E3E3E3] dark:placeholder:text-zinc-400 focus:outline-none max-h-[180px]"
        />

        {/* Clean Gemini-style bottom toolbar: Gambar, Kamera, Live, Kirim */}
        <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-1 sm:px-3">
          <div className="flex items-center gap-1 min-w-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) {
                  void readFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title={t.composer.imageTooltip}
              aria-label={t.composer.imageTooltip}
              className="inline-flex h-11 w-11 sm:w-auto sm:px-3 items-center justify-center gap-1.5 rounded-full text-xs font-medium text-zinc-600 hover:bg-blue-600/10 hover:text-[#0A36FF] dark:text-zinc-300 dark:hover:bg-blue-500/15 dark:hover:text-blue-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ImagePlus className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{t.composer.imageBtn}</span>
            </button>

            <button
              type="button"
              onClick={onOpenCamera}
              title={t.composer.cameraTooltip}
              aria-label={t.composer.cameraTooltip}
              className="inline-flex h-11 w-11 sm:w-auto sm:px-3 items-center justify-center gap-1.5 rounded-full text-xs font-medium text-zinc-600 hover:bg-red-600/10 hover:text-[#E51D2B] dark:text-zinc-300 dark:hover:bg-red-500/15 dark:hover:text-red-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Camera className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{t.composer.cameraBtn}</span>
            </button>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleVoiceInput}
              title={
                speechSupported
                  ? isListening
                    ? t.composer.micStopTooltip
                    : t.composer.micStartTooltip
                  : t.composer.micInfoTooltip
              }
              aria-label={isListening ? t.composer.micStopTooltip : t.composer.micStartTooltip}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors cursor-pointer shrink-0 ${
                isListening
                  ? 'bg-[#E51D2B]/20 text-[#E51D2B] dark:text-red-300 animate-pulse'
                  : 'text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white'
              }`}
            >
              {isListening ? <MicOff className="h-5 w-5 sm:h-4 sm:w-4" /> : <Mic className="h-5 w-5 sm:h-4 sm:w-4" />}
            </button>

            {/* Gemini Live button */}
            <button
              type="button"
              onClick={onOpenLive}
              title={t.composer.liveTooltip}
              aria-label={t.composer.liveTooltip}
              className="inline-flex h-10 sm:h-11 items-center gap-1.5 rounded-full border border-blue-500/35 bg-gradient-to-r from-[#E51D2B]/12 to-[#0A36FF]/15 px-3 sm:px-3.5 text-xs font-semibold text-[#0A36FF] hover:from-[#E51D2B]/20 hover:to-[#0A36FF]/25 dark:border-blue-400/35 dark:text-blue-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <AudioLines className="h-4 w-4 text-[#E51D2B] dark:text-[#FF4D5A]" />
              <span>{t.composer.liveBtn}</span>
            </button>

            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                title={t.composer.stopTooltip}
                aria-label={t.composer.stopTooltip}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#E51D2B] text-white hover:bg-red-700 transition-colors cursor-pointer"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSend}
                title={t.composer.sendTooltip}
                aria-label={t.composer.sendTooltip}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-all ${
                  canSend
                    ? 'bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] text-white shadow-md shadow-blue-600/25 hover:opacity-95 cursor-pointer'
                    : 'bg-zinc-200 text-zinc-400 dark:bg-[#222940] dark:text-zinc-600 cursor-not-allowed'
                }`}
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-1.5 text-center text-[11px] text-zinc-500 dark:text-zinc-500">
        {t.composer.disclaimer}
      </p>
    </div>
  );
};
