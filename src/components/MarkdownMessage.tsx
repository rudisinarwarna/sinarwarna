import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

interface MarkdownMessageProps {
  content: string;
  isStreaming?: boolean;
}

function extractHexColors(markdown: string): string[] {
  const matches = markdown.match(/#[0-9A-Fa-f]{6}\b/g);
  if (!matches) return [];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of matches) {
    const upper = raw.toUpperCase();
    if (!seen.has(upper)) {
      seen.add(upper);
      unique.push(upper);
    }
    if (unique.length >= 8) break;
  }
  return unique;
}

const CodeBlock: React.FC<{
  language?: string;
  value: string;
}> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored if blocked
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#1B1C1E]">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-3.5 py-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-mono">{language || 'teks'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
      </div>
      <pre className="overflow-x-auto p-3.5 text-[13px] leading-relaxed font-mono text-zinc-800 dark:text-zinc-200">
        <code>{value}</code>
      </pre>
    </div>
  );
};

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({
  content,
  isStreaming = false,
}) => {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const hexColors = useMemo(() => extractHexColors(content), [content]);

  const handleCopyHex = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedHex(hex);
      window.setTimeout(() => setCopiedHex(null), 1500);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div className="space-y-3 text-[15px] leading-[1.7] text-zinc-800 dark:text-[#E3E3E3]">
      <div className="max-w-none space-y-3">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="font-display text-xl font-semibold tracking-tight text-zinc-900 dark:text-white mt-5 mb-2 first:mt-0">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="font-display text-lg font-semibold tracking-tight text-zinc-900 dark:text-white mt-5 mb-2 first:mt-0">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-white mt-4 mb-1.5 first:mt-0">
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className="leading-[1.7] text-zinc-800 dark:text-[#E3E3E3]">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc pl-5 space-y-1.5 text-zinc-800 dark:text-[#E3E3E3]">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal pl-5 space-y-1.5 text-zinc-800 dark:text-[#E3E3E3]">
                {children}
              </ol>
            ),
            li: ({ children }) => <li className="leading-[1.65] pl-0.5">{children}</li>,
            strong: ({ children }) => (
              <strong className="font-semibold text-zinc-950 dark:text-white">{children}</strong>
            ),
            blockquote: ({ children }) => (
              <blockquote className="my-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#1E1F20] px-4 py-3 text-zinc-700 dark:text-zinc-300">
                {children}
              </blockquote>
            ),
            hr: () => <hr className="my-4 border-zinc-200 dark:border-zinc-800" />,
            table: ({ children }) => (
              <div className="my-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full border-collapse text-left text-sm tabular-nums">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-zinc-50 dark:bg-[#1E1F20] border-b border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                {children}
              </thead>
            ),
            th: ({ children }) => (
              <th className="px-3.5 py-2.5 font-semibold text-xs text-zinc-700 dark:text-zinc-300">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-3.5 py-2.5 border-t border-zinc-200/70 dark:border-zinc-800/70 text-zinc-700 dark:text-zinc-300 align-top">
                {children}
              </td>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-700 dark:hover:text-blue-300"
              >
                {children}
              </a>
            ),
            code: ({ className, children, ...props }) => {
              const match = /language-(\w+)/.exec(className || '');
              const codeString = String(children).replace(/\n$/, '');
              const isMultiline = Boolean(match) || codeString.includes('\n');
              if (isMultiline) {
                return <CodeBlock language={match?.[1]} value={codeString} />;
              }
              return (
                <code
                  className="rounded-md bg-zinc-100 dark:bg-[#28292C] px-1.5 py-0.5 font-mono text-[13px] text-zinc-900 dark:text-zinc-100"
                  {...props}
                >
                  {children}
                </code>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>

      {!isStreaming && hexColors.length > 0 && (
        <div className="pt-2">
          <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Palet Warna Terdeteksi — klik untuk menyalin kode HEX
          </p>
          <div className="flex flex-wrap gap-2">
            {hexColors.map((hex) => {
              const isCopied = copiedHex === hex;
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => handleCopyHex(hex)}
                  className="group inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1E1F20] px-2.5 py-1.5 text-xs font-mono text-zinc-700 dark:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title={`Salin ${hex}`}
                >
                  <span
                    className="h-4 w-4 rounded border border-black/10 dark:border-white/15 shrink-0"
                    style={{ backgroundColor: hex }}
                  />
                  <span>{isCopied ? 'Tersalin' : hex}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
