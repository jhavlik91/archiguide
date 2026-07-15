import { redirect } from "next/navigation";

/**
 * Nav položka „Moderace" (T006 placeholder) a „Nahlášení" (T036) mířila na dvě
 * oddělené cesty pro jednu a tutéž frontu — sjednoceno na `/admin/reports`.
 */
export default function AdminModerationPage() {
  redirect("/admin/reports");
}
