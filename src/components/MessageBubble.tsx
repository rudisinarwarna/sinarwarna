import React, { useState } from 'react';
import { AlertCircle, Check, Copy, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import type { ChatMessage } from '../types/chat';
import { MarkdownMessage } from './MarkdownMessage';
import { SinarLogo } from './SinarLogo';

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  isLastModelMessage?: boolean;
  onQuickRefine?: (instruction: string) => void;
  onRegenerate?: () => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isStreaming = false,
  isLastModelMessage = false,
  onQuickRefine,
  onRegenerate,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!message.text) return;
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] sm:max-w-[75%] space-y-2.5 rounded-2xl border border-[#0A36FF]/30 bg-gradient-to-br from-[#E51D2B]/[0.07] via-blue-50/70 to-[#0A36FF]/[0.12] dark:border-blue-500/35 dark:from-[#E51D2B]/[0.16] dark:via-[#141A2E] dark:to-[#0A36FF]/[0.22] px-4 py-3 text-[15px] leading-relaxed text-zinc-900 dark:text-[#E3E3E3]">
          {message.attachments && message.attachments.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {message.attachments.map((att) => (
                <img
                  key={att.id}
                  src={att.previewUrl}
                  alt={att.name}
                  referrerPolicy="no-referrer"
                  className="h-28 w-28 rounded-xl border border-black/10 dark:border-white/10 object-cover"
                />
              ))}
            </div>
          ) : message.attachmentNames && message.attachmentNames.length > 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Lampiran gambar: {message.attachmentNames.join(', ')}
            </p>
          ) : null}
          {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3.5 sm:gap-4">
      <div className="mt-0.5 shrink-0">
        <SinarLogo size={26} spinning={isStreaming} />
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        {message.error ? (
          <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3.5 text-sm text-red-800 dark:text-red-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <div className="space-y-2">
                <p className="leading-relaxed">{message.error}</p>
                {onRegenerate && (
                  <button
                    type="button"
                    onClick={onRegenerate}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-[#1E1F20] px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Coba Lagi</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : isStreaming && !message.text ? (
          <div className="space-y-2.5 py-1" aria-label="Sinar Warna sedang menyusun jawaban">
            <div className="h-3.5 w-3/4 rounded-md bg-zinc-200/80 dark:bg-zinc-800 animate-pulse" />
            <div className="h-3.5 w-full rounded-md bg-zinc-200/70 dark:bg-zinc-800/80 animate-pulse" />
            <div className="h-3.5 w-2/3 rounded-md bg-zinc-200/60 dark:bg-zinc-800/60 animate-pulse" />
          </div>
        ) : (
          <MarkdownMessage content={message.text} isStreaming={isStreaming} />
        )}

        {!isStreaming && !message.error && message.text && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-[#28292C] dark:hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Salin</span>
                </>
              )}
            </button>

            {isLastModelMessage && onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-[#28292C] dark:hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Regenerasi</span>
              </button>
            )}

            {isLastModelMessage && onQuickRefine && (
              <>
                <span className="mx-1 text-zinc-300 dark:text-zinc-700" aria-hidden="true">
                  |
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onQuickRefine('Ringkas jawaban di atas menjadi versi yang lebih padat dan siap pakai.')
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-[#28292C] dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>Lebih Ringkas</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onQuickRefine('Kembangkan ide di atas dengan 3 variasi kreatif baru yang lebih berani dan detail.')
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-[#28292C] dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Variasi Baru</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
