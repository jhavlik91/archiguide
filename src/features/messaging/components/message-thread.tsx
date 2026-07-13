"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Reply, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { type ConversationDetail, type MessageView } from "../types";
import { sendMessage, markConversationRead } from "../actions";
import { formatTime } from "./format";

/** Optimistická zpráva, dokud ji server nepotvrdí (pak ji nahradí serverová). */
type Pending = {
  clientToken: string;
  content: string;
  replyAuthor: string | null;
};

/** Jak často se vlákno doptává na nové zprávy (bez websocketů v MVP). */
const POLL_INTERVAL_MS = 8000;

/**
 * Vlákno konverzace (T030): hlavička s kontextem, zprávy, composer s
 * optimistickým odesláním, odpovědí na zprávu a pollingem. Odeslání NIKDY
 * falešně nehlásí úspěch — při chybě zůstane text v poli k opětovnému odeslání
 * (zadani/16 §8). Obsah se vždy renderuje jako text (XSS).
 */
export function MessageThread({ detail }: { detail: ConversationDetail }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<MessageView | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [isSending, startSending] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  const serverTokens = new Set(detail.messages.map((m) => m.clientToken));
  // Optimistické zprávy, které server ještě nepotvrdil (jinak by se zdvojily).
  const visiblePending = pending.filter((p) => !serverTokens.has(p.clientToken));

  // Po každém refreshi (nová serverová data) zahoď už potvrzené optimistické.
  useEffect(() => {
    setPending((prev) => prev.filter((p) => !serverTokens.has(p.clientToken)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.messages.length]);

  // Otevření vlákna → označit přečtené; poté pravidelný polling nových zpráv.
  useEffect(() => {
    let active = true;
    void markConversationRead({ conversationId: detail.id }).then(() => {
      if (active) router.refresh();
    });
    const timer = setInterval(() => {
      void markConversationRead({ conversationId: detail.id }).then(() => {
        if (active) router.refresh();
      });
    }, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [detail.id, router]);

  // Skok na konec při přírůstku zpráv.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [detail.messages.length, visiblePending.length]);

  function submit() {
    const content = input.trim();
    if (!content || isSending) return;

    const clientToken = crypto.randomUUID();
    const reply = replyingTo;
    setPending((prev) => [
      ...prev,
      { clientToken, content, replyAuthor: reply?.sender.label ?? null },
    ]);
    setInput("");
    setReplyingTo(null);

    startSending(async () => {
      const res = await sendMessage({
        conversationId: detail.id,
        content,
        clientToken,
        replyToId: reply?.id,
      });
      if (res.ok) {
        router.refresh();
      } else {
        // Neúspěch: zahoď optimistickou zprávu a vrať text do pole k retry.
        setPending((prev) => prev.filter((p) => p.clientToken !== clientToken));
        setInput((cur) => (cur.length === 0 ? content : cur));
        setReplyingTo(reply);
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Hlavička s kontextem a protistranou. */}
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Zpět na seznam"
        >
          <Link href="/messages">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {detail.other.href && !detail.other.deleted ? (
              <Link
                href={detail.other.href}
                className="hover:underline truncate font-semibold"
              >
                {detail.other.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "truncate font-semibold",
                  detail.other.deleted && "text-muted-foreground italic",
                )}
              >
                {detail.other.label}
              </span>
            )}
          </div>
          {detail.context ? (
            <span className="text-muted-foreground text-xs">
              {detail.context.label}
            </span>
          ) : null}
        </div>
      </header>

      {/* Seznam zpráv. */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {detail.hasMoreOlder ? (
          <p className="text-muted-foreground text-center text-xs">
            Zobrazeny jsou nejnovější zprávy.
          </p>
        ) : null}

        {detail.messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onReply={() => setReplyingTo(m)}
            canReply={detail.canSend && !m.hidden}
          />
        ))}

        {visiblePending.map((p) => (
          <div key={p.clientToken} className="flex justify-end">
            <div className="bg-primary/70 text-primary-foreground max-w-[80%] rounded-2xl rounded-br-sm px-3 py-2">
              {p.replyAuthor ? (
                <p className="border-primary-foreground/40 mb-1 border-l-2 pl-2 text-xs opacity-80">
                  Odpověď: {p.replyAuthor}
                </p>
              ) : null}
              <p className="text-sm whitespace-pre-wrap break-words">
                {p.content}
              </p>
              <span className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-80">
                <Loader2 className="size-3 animate-spin" /> Odesílám…
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer / blokované odeslání. */}
      {detail.canSend ? (
        <div className="border-t p-3">
          {replyingTo ? (
            <div className="bg-muted mb-2 flex items-start gap-2 rounded-md px-3 py-2 text-sm">
              <Reply className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">
                  Odpověď: {replyingTo.sender.label}
                </p>
                <p className="truncate">{replyingTo.content}</p>
              </div>
              <button
                type="button"
                aria-label="Zrušit odpověď"
                onClick={() => setReplyingTo(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Napište zprávu…"
              aria-label="Text zprávy"
              className="max-h-40 min-h-11 flex-1 resize-none"
              rows={1}
            />
            <Button
              onClick={submit}
              disabled={isSending || input.trim().length === 0}
              aria-label="Odeslat zprávu"
            >
              {isSending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground border-t p-4 text-center text-sm">
          {detail.blockedReason ?? "Do této konverzace nelze psát."}
        </div>
      )}
    </div>
  );
}

/** Jedna zpráva ve vlákně (bublina). Skrytou (T036) nahradí placeholder. */
function MessageBubble({
  message,
  onReply,
  canReply,
}: {
  message: MessageView;
  onReply: () => void;
  canReply: boolean;
}) {
  const mine = message.mine;
  return (
    <div className={cn("group flex", mine ? "justify-end" : "justify-start")}>
      <div className="flex max-w-[80%] items-end gap-1">
        {!mine && canReply ? (
          <ReplyButton onReply={onReply} />
        ) : null}
        <div
          className={cn(
            "rounded-2xl px-3 py-2",
            mine
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted rounded-bl-sm",
          )}
        >
          {message.replyTo ? (
            <p
              className={cn(
                "mb-1 border-l-2 pl-2 text-xs",
                mine
                  ? "border-primary-foreground/40 opacity-80"
                  : "border-border text-muted-foreground",
              )}
            >
              {message.replyTo.authorLabel}: {message.replyTo.excerpt}
            </p>
          ) : null}
          {message.hidden ? (
            <p className="text-sm italic opacity-70">
              Zpráva byla skryta moderátorem.
            </p>
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}
          <span
            className={cn(
              "mt-1 block text-right text-[10px]",
              mine ? "opacity-80" : "text-muted-foreground",
            )}
          >
            {formatTime(message.createdAt)}
          </span>
        </div>
        {mine && canReply ? <ReplyButton onReply={onReply} /> : null}
      </div>
    </div>
  );
}

function ReplyButton({ onReply }: { onReply: () => void }) {
  return (
    <button
      type="button"
      onClick={onReply}
      aria-label="Odpovědět na zprávu"
      className="text-muted-foreground hover:text-foreground mb-1 opacity-0 transition-opacity group-hover:opacity-100"
    >
      <Reply className="size-4" />
    </button>
  );
}
