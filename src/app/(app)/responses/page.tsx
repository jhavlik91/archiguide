import { requireUser } from "@/lib/session";
import { listResponsesForAuthorUser } from "@/features/responses/service";
import { MyResponsesList } from "@/features/responses/components/my-responses-list";

/**
 * Dashboard „moje reakce" (T027 § Main flow bod 7). Reakce podané za
 * organizaci sem zatím nespadají (individuální dashboard) — firemní přehled
 * je slot pro budoucí práci, stejně jako výběr autora ve formuláři reakce.
 */
export default async function MyResponsesPage() {
  const actor = await requireUser();
  const responses = await listResponsesForAuthorUser(actor.userId);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Moje reakce</h1>
      <MyResponsesList responses={responses} />
    </div>
  );
}
