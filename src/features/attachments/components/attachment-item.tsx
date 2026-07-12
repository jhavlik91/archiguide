import { FileText, Paperclip, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AttachmentView, AttachmentVisibility } from "../types";

/**
 * Sdílená prezentace jedné přílohy pro konzumující kontexty (brief, poptávka,
 * reakce, zprávy). Aktivní příloha = odkaz na autorizované stažení; smazaná =
 * placeholder „příloha byla odstraněna", nikdy rozbitý odkaz (T023 § Main flow
 * bod 6). Bez klientské logiky (server component) — jen zobrazení nad `AttachmentView`.
 */

const VISIBILITY_LABEL: Record<AttachmentVisibility, string> = {
  private: "Soukromé",
  shared_in_context: "Sdílené v kontextu",
  public: "Veřejné",
};

/** Lidsky čitelná velikost souboru. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} kB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export type AttachmentItemProps = {
  attachment: AttachmentView;
  /** Zobrazit odznak viditelnosti (typicky vidí jen vlastník). */
  showVisibility?: boolean;
  className?: string;
};

export function AttachmentItem({
  attachment,
  showVisibility = false,
  className,
}: AttachmentItemProps) {
  if (attachment.deleted) {
    return (
      <div
        className={cn(
          "border-muted-foreground/40 text-muted-foreground flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm",
          className,
        )}
      >
        <Paperclip className="size-4 shrink-0" aria-hidden />
        <span className="italic">Příloha byla odstraněna</span>
      </div>
    );
  }

  return (
    <a
      href={attachment.downloadUrl ?? "#"}
      className={cn(
        "hover:bg-accent focus:ring-ring flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none",
        className,
      )}
      download
    >
      <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-medium">
        {attachment.fileName}
      </span>
      {attachment.sensitive && (
        <Badge variant="warning" className="gap-1">
          <ShieldAlert className="size-3" aria-hidden />
          Citlivé
        </Badge>
      )}
      {showVisibility && (
        <Badge variant="outline">
          {VISIBILITY_LABEL[attachment.visibility]}
        </Badge>
      )}
      <span className="text-muted-foreground shrink-0 text-xs">
        {formatBytes(attachment.byteSize)}
      </span>
    </a>
  );
}
