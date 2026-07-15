import "server-only";

/**
 * Centrální seam registrace resolverů kontextů příloh (T023) napříč doménami.
 * Attachment routy (`/api/attachments/*`) importují tento modul pro jeho
 * side-effect, aby měly resolvery k dispozici i tehdy, když danou doménu jinak
 * neimportují (a nezáviselo to na tom, v které webpack vrstvě běží
 * `instrumentation.ts`). Nové domény sem přidají svůj registrační import.
 */

// T031 — přílohy zpráv (kontext `message`): přístup mají účastníci konverzace.
import "@/features/messaging/attachment-context";
