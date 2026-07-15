"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  Info,
  Loader2,
  Paperclip,
  Reply,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { type ConversationDetail, type MessageView } from "../types";
import { markConversationRead, setBlock } from "../actions";
import { detectContactInfo } from "../rules";
import { formatTime } from "./format";
import { MessageAttachments } from "./message-attachments";
import { ReportMessageDialog } from "./report-message-dialog";

/** Optimistická zpráva, dokud ji server nepotvrdí (pak ji nahradí serverová). */
type Pending = {
  clientToken: string;
  content: string;
  replyAuthor: string | null;
  attachmentNames: string[];
};

/** Jak často se vlákno doptává na nové zprávy (bez websocketů v MVP). */
const POLL_INTERVAL_MS = 8000;

/**
 * Vlákno konverzace (T030 + přílohy/blokace/report T031): hlavička s kontextem a
 * blokací, zprávy s přílohami a nahlášením, composer s optimistickým odesláním
 * (přes multipart routu `/api/messages`, aby uneslo soubory), privacy hintem a
 * pollingem. Odeslání NIKDY falešně nehlásí úspěch — při chybě zůstane text i
 * soubory k opětovnému odeslání (zadani/16 §8). Obsah se vždy renderuje jako text.
 */
export function MessageThread({ detail }: { detail: ConversationDetail }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [replyingTo, setReplyingTo] = useState<MessageView | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [isSending, startSending] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const contactHints = detectContactInfo(input);
  const showContactHint = contactHints.email || contactHints.phone;

  function addFiles(picked: FileList | null) {
    if (!picked || picked.length === 0) return;
    // Zhmotni soubory HNED — `picked` je živý FileList a vyprázdnění inputu níže
    // by ho vynulovalo dřív, než se líný updater stavu spustí.
    const added = Array.from(picked);
    setFiles((prev) => [...prev, ...added]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function submit() {
    const content = input.trim();
    if ((content.length === 0 && files.length === 0) || isSending) return;

    const clientToken = crypto.randomUUID();
    const reply = replyingTo;
    const attachmentNames = files.map((f) => f.name);
    const outgoingFiles = files;

    setPending((prev) => [
      ...prev,
      {
        clientToken,
        content,
        replyAuthor: reply?.sender.label ?? null,
        attachmentNames,
      },
    ]);
    setInput("");
    setFiles([]);
    setReplyingTo(null);

    startSending(async () => {
      const form = new FormData();
      form.set("conversationId", detail.id);
      form.set("content", content);
      form.set("clientToken", clientToken);
      if (reply?.id) form.set("replyToId", reply.id);
      for (const file of outgoingFiles) form.append("files", file);

      let ok = false;
      let errorMessage = "Zprávu se nepodařilo odeslat. Zkuste to prosím znovu.";
      try {
        const res = await fetch("/api/messages", { method: "POST", body: form });
        ok = res.ok;
        if (!ok) {
          const data = (await res.json().catch(() => null)) as
            | { message?: string }
            | null;
          if (data?.message) errorMessage = data.message;
        }
      } catch {
        ok = false;
      }

      if (ok) {
        router.refresh();
      } else {
        // Neúspěch: zahoď optimistickou zprávu a vrať obsah i soubory k retry.
        setPending((prev) => prev.filter((p) => p.clientToken !== clientToken));
        setInput((cur) => (cur.length === 0 ? content : cur));
        setFiles((cur) => (cur.length === 0 ? outgoingFiles : cur));
        setReplyingTo(reply);
        toast.error(errorMessage);
      }
    });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Hlavička s kontextem, protistranou a blokací. */}
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
        {!detail.other.deleted ? (
          <BlockButton
            conversationId={detail.id}
            blockedByMe={detail.blockedByMe}
          />
        ) : null}
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
              {p.content ? (
                <p className="text-sm whitespace-pre-wrap break-words">
                  {p.content}
                </p>
              ) : null}
              {p.attachmentNames.map((name, i) => (
                <p
                  key={i}
                  className="mt-1 flex items-center gap-1 text-xs opacity-80"
                >
                  <Paperclip className="size-3" /> {name}
                </p>
              ))}
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

          {files.length > 0 ? (
            <ul className="mb-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <li
                  key={i}
                  className="bg-muted flex items-center gap-2 rounded-md px-2 py-1 text-xs"
                >
                  <Paperclip className="size-3 shrink-0" />
                  <span className="max-w-40 truncate">{f.name}</span>
                  <button
                    type="button"
                    aria-label={`Odebrat ${f.name}`}
                    onClick={() => removeFile(i)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {showContactHint ? (
            <p className="text-muted-foreground mb-2 flex items-start gap-1.5 text-xs">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Sdílíte kontaktní údaj. Můžete, ale dělejte to na vlastní uvážení —
                platnou komunikaci vám neblokujeme.
              </span>
            </p>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              aria-label="Přiložit soubor"
            >
              <Paperclip className="size-4" />
            </Button>
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
              disabled={
                isSending || (input.trim().length === 0 && files.length === 0)
              }
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

/** Tlačítko blokace/odblokace protistrany v hlavičce vlákna (T031). */
function BlockButton({
  conversationId,
  blockedByMe,
}: {
  conversationId: string;
  blockedByMe: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    if (isPending) return;
    startTransition(async () => {
      const res = await setBlock({ conversationId, blocked: !blockedByMe });
      if (res.ok) {
        toast.success(
          blockedByMe ? "Uživatel byl odblokován." : "Uživatel byl zablokován.",
        );
        router.refresh();
      } else {
        toast.error(res.message ?? "Akci se nepodařilo provést.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggle}
      disabled={isPending}
      className="shrink-0 gap-1.5"
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : blockedByMe ? (
        <ShieldCheck className="size-4" />
      ) : (
        <Ban className="size-4" />
      )}
      <span className="hidden sm:inline">
        {blockedByMe ? "Odblokovat" : "Blokovat"}
      </span>
    </Button>
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
        {!mine && !message.hidden ? (
          <div className="mb-1 flex flex-col justify-end">
            {canReply ? <ReplyButton onReply={onReply} /> : null}
            <ReportMessageDialog messageId={message.id} />
          </div>
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
            <>
              {message.content ? (
                <p className="text-sm whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              ) : null}
              <MessageAttachments
                attachments={message.attachments}
                mine={mine}
              />
            </>
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
