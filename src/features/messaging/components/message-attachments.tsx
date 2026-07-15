"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { AttachmentItem } from "@/features/attachments/components/attachment-item";
import { type AttachmentView } from "@/features/attachments/types";
import { deleteMessageAttachment } from "../actions";

/**
 * Přílohy jedné zprávy ve vlákně (T031). Obrázek se vykreslí inline jako náhled
 * (odkaz vede na autorizované stažení), ostatní typy jako karta s názvem a
 * velikostí. Smazaná příloha → placeholder „příloha byla odstraněna" (nikdy
 * rozbitý odkaz). U vlastních zpráv lze aktivní přílohu odstranit.
 */
export function MessageAttachments({
  attachments,
  mine,
}: {
  attachments: AttachmentView[];
  mine: boolean;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-1 flex flex-col gap-2">
      {attachments.map((a) => (
        <AttachmentEntry key={a.id} attachment={a} deletable={mine} />
      ))}
    </div>
  );
}

function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

function AttachmentEntry({
  attachment,
  deletable,
}: {
  attachment: AttachmentView;
  deletable: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (isPending) return;
    startTransition(async () => {
      const res = await deleteMessageAttachment({ attachmentId: attachment.id });
      if (res.ok) {
        router.refresh();
      } else {
        toast.error(res.message ?? "Přílohu se nepodařilo odstranit.");
      }
    });
  }

  const canDelete = deletable && !attachment.deleted;

  // Obrázek → inline náhled; ostatní / smazané → sdílená karta přílohy.
  const body =
    !attachment.deleted && isImage(attachment.mimeType) && attachment.downloadUrl ? (
      <a
        href={attachment.downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-md border"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.downloadUrl}
          alt={attachment.fileName}
          className="max-h-64 w-auto max-w-full object-contain"
        />
      </a>
    ) : (
      <AttachmentItem attachment={attachment} />
    );

  return (
    <div className={cn("group/att relative", isPending && "opacity-50")}>
      {body}
      {canDelete ? (
        <button
          type="button"
          onClick={remove}
          disabled={isPending}
          aria-label="Odstranit přílohu"
          className="bg-background/90 text-muted-foreground hover:text-destructive absolute top-1 right-1 rounded-md border p-1 opacity-0 shadow-sm transition-opacity group-hover/att:opacity-100 focus:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
