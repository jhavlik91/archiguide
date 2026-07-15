"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  History,
  Loader2,
  Lock,
  Pencil,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import {
  refineRequestAction,
  transitionRequestAction,
  updateDraftRequestAction,
} from "../actions";
import { ownerActions, type RequestAction } from "../state-machine";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  REQUEST_TYPES,
  type RequestType,
  type RequestAuditItem,
  type RequestStatus,
  type RequestView,
} from "../types";

/** Profese nabídnutá k výběru (z briefu / z taxonomie). */
export interface ProfessionOption {
  slug: string;
  name: string;
}

/** Popisky přechodů pro tlačítka (čeština). */
const ACTION_LABELS: Record<RequestAction, string> = {
  publish: "Publikovat",
  start_discussion: "Zahájit jednání",
  pause: "Pozastavit",
  resume: "Obnovit",
  award: "Označit jako zadanou",
  close: "Uzavřít",
  cancel: "Zrušit poptávku",
  expire: "Nechat vypršet",
};

/** Varianta tlačítka přechodu — destruktivní pro zrušení. */
function actionVariant(action: RequestAction) {
  if (action === "cancel") return "destructive" as const;
  if (action === "publish") return "primary" as const;
  return "outline" as const;
}

function statusVariant(
  status: RequestStatus,
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "active" || status === "in_discussion") return "default";
  if (status === "cancelled" || status === "expired") return "destructive";
  if (status === "awarded" || status === "closed") return "secondary";
  return "outline";
}

/**
 * Detail a řízení poptávky (T024). Draft se plně edituje a publikuje; publikovaná
 * poptávka nabízí jen upřesnění (rozpočet/termín/čas) + stavové přechody. Stav je
 * vždy viditelný (badge); neplatné přechody server odmítne a UI zobrazí chybu.
 */
export function RequestDetail({
  request,
  professionOptions,
  audit,
}: {
  request: RequestView;
  professionOptions: ProfessionOption[];
  audit: RequestAuditItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isDraft = request.status === "draft";
  const actions = ownerActions(request.status);

  function runTransition(action: RequestAction) {
    startTransition(async () => {
      const res = await transitionRequestAction(request.id, action);
      if (res.ok) {
        toast.success(`Poptávka: ${ACTION_LABELS[action].toLowerCase()}.`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Hlavička: stav (vždy viditelný), typ, viditelnost, název. */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(request.status)}>
            {REQUEST_STATUS_LABELS[request.status]}
          </Badge>
          <Badge variant="outline">{REQUEST_TYPE_LABELS[request.type]}</Badge>
          <Badge variant="outline">
            <Lock className="mr-1 size-3" />
            Soukromá
          </Badge>
          {request.editedAfterPublish ? (
            <Badge variant="secondary">
              <Pencil className="mr-1 size-3" />
              Upraveno
            </Badge>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {request.title}
        </h1>
        <p className="text-muted-foreground text-sm">
          Poptávka vytvořená z projektového briefu.{" "}
          <Link
            href="/requests"
            className="text-primary font-medium hover:underline"
          >
            Zpět na moje poptávky
          </Link>
        </p>
      </div>

      {isDraft ? (
        <DraftEditor
          request={request}
          professionOptions={professionOptions}
          pending={pending}
          startTransition={startTransition}
        />
      ) : (
        <PublishedView
          request={request}
          professionOptions={professionOptions}
          pending={pending}
          startTransition={startTransition}
        />
      )}

      {/* Stavové přechody. Publikace v draftu je uvnitř editoru (po uložení). */}
      {actions.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 p-5 sm:p-6">
            <p className="text-sm font-semibold">Akce</p>
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <Button
                  key={action}
                  variant={actionVariant(action)}
                  disabled={pending}
                  onClick={() => runTransition(action)}
                >
                  {action === "publish" ? <Send /> : null}
                  {ACTION_LABELS[action]}
                </Button>
              ))}
            </div>
            {isDraft ? (
              <p className="text-muted-foreground text-sm">
                Před publikací zkontrolujte cílové profese a region — po
                publikaci už měníte jen upřesňující údaje.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Auditní historie významných přechodů. */}
      {audit.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 p-5 sm:p-6">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <History className="size-4" />
              Historie
            </p>
            <ul className="space-y-2">
              {audit.map((entry) => (
                <li
                  key={entry.id}
                  className="text-muted-foreground flex items-center justify-between gap-2 text-sm"
                >
                  <span>
                    {ACTION_LABELS[entry.action as RequestAction] ??
                      entry.action}
                    {entry.fromStatus ? (
                      <>
                        {" "}
                        <span className="text-xs">
                          ({REQUEST_STATUS_LABELS[entry.fromStatus]} →{" "}
                          {REQUEST_STATUS_LABELS[entry.toStatus]})
                        </span>
                      </>
                    ) : null}
                  </span>
                  <time className="text-xs" dateTime={entry.createdAt}>
                    {new Date(entry.createdAt).toLocaleString("cs-CZ")}
                  </time>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// --- Editace draftu ---------------------------------------------------------

function DraftEditor({
  request,
  professionOptions,
  pending,
  startTransition,
}: {
  request: RequestView;
  professionOptions: ProfessionOption[];
  pending: boolean;
  startTransition: React.TransitionStartFunction;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(request.title);
  const [type, setType] = useState<RequestType>(request.type);
  const [region, setRegion] = useState(request.region);
  const [budget, setBudget] = useState(request.budget ?? "");
  const [timeline, setTimeline] = useState(request.timeline ?? "");
  const [deadline, setDeadline] = useState(
    request.deadline ? request.deadline.slice(0, 10) : "",
  );
  const [selected, setSelected] = useState<Set<string>>(
    new Set(request.targetProfessionSlugs),
  );

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const res = await updateDraftRequestAction(request.id, {
        title,
        type,
        targetProfessionSlugs: [...selected],
        region,
        budget,
        timeline,
        deadline,
      });
      if (res.ok) {
        toast.success("Poptávka uložena.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="space-y-2">
          <Label htmlFor="req-title">Název poptávky</Label>
          <Input
            id="req-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="req-type">Typ poptávky</Label>
          <Select value={type} onValueChange={(v) => setType(v as RequestType)}>
            <SelectTrigger id="req-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REQUEST_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {REQUEST_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Cílové profese</Label>
          {professionOptions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Brief nedoporučil žádnou profesi — vraťte se do briefu a doplňte
              odpovědi.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {professionOptions.map((p) => {
                const on = selected.has(p.slug);
                return (
                  <button
                    key={p.slug}
                    type="button"
                    onClick={() => toggle(p.slug)}
                    aria-pressed={on}
                    className={
                      on
                        ? "bg-primary text-primary-foreground rounded-full px-3 py-1 text-sm"
                        : "border-input text-muted-foreground rounded-full border px-3 py-1 text-sm"
                    }
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-muted-foreground text-xs">
            Vyberte alespoň jednu profesi (převzato z briefu, můžete upravit).
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="req-region">Region</Label>
            <Input
              id="req-region"
              value={region}
              placeholder="Např. Praha a okolí"
              onChange={(e) => setRegion(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="req-deadline">Termín (nepovinné)</Label>
            <Input
              id="req-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="req-budget">Rozpočet (nepovinné)</Label>
          <Input
            id="req-budget"
            value={budget}
            placeholder="Neuvedeno"
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="req-timeline">Časový horizont (nepovinné)</Label>
          <Textarea
            id="req-timeline"
            value={timeline}
            placeholder="Neuvedeno"
            onChange={(e) => setTimeline(e.target.value)}
          />
        </div>

        <Button onClick={save} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          Uložit poptávku
        </Button>
      </CardContent>
    </Card>
  );
}

// --- Publikovaná poptávka ---------------------------------------------------

function PublishedView({
  request,
  professionOptions,
  pending,
  startTransition,
}: {
  request: RequestView;
  professionOptions: ProfessionOption[];
  pending: boolean;
  startTransition: React.TransitionStartFunction;
}) {
  const router = useRouter();
  const [budget, setBudget] = useState(request.budget ?? "");
  const [timeline, setTimeline] = useState(request.timeline ?? "");
  const [deadline, setDeadline] = useState(
    request.deadline ? request.deadline.slice(0, 10) : "",
  );
  const refinable = ["active", "in_discussion", "paused"].includes(
    request.status,
  );

  const professionNames = request.targetProfessionSlugs.map(
    (slug) => professionOptions.find((p) => p.slug === slug)?.name ?? slug,
  );

  function refine() {
    startTransition(async () => {
      const res = await refineRequestAction(request.id, {
        budget,
        timeline,
        deadline,
      });
      if (res.ok) {
        toast.success("Upřesnění uloženo.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Card>
        <CardContent className="grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2 sm:p-6">
          <Fact label="Cílové profese" value={professionNames.join(", ")} />
          <Fact label="Region" value={request.region} />
          <Fact label="Rozpočet" value={request.budget} />
          <Fact label="Časový horizont" value={request.timeline} />
          <Fact
            label="Termín"
            value={
              request.deadline
                ? new Date(request.deadline).toLocaleDateString("cs-CZ")
                : null
            }
          />
        </CardContent>
      </Card>

      {refinable ? (
        <Card>
          <CardContent className="space-y-4 p-5 sm:p-6">
            <p className="text-sm font-semibold">Upřesnit poptávku</p>
            <p className="text-muted-foreground text-sm">
              Po publikaci lze doplnit jen upřesňující údaje — typ a profese
              zůstávají zamčené (změna smyslu by mátla reakce).
            </p>
            <div className="space-y-2">
              <Label htmlFor="req-budget-2">Rozpočet</Label>
              <Input
                id="req-budget-2"
                value={budget}
                placeholder="Neuvedeno"
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-timeline-2">Časový horizont</Label>
              <Textarea
                id="req-timeline-2"
                value={timeline}
                placeholder="Neuvedeno"
                onChange={(e) => setTimeline(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-deadline-2">Termín</Label>
              <Input
                id="req-deadline-2"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={refine} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Pencil />}
              Uložit upřesnění
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  const empty = value === null || value.trim().length === 0;
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={
          empty ? "text-muted-foreground text-sm italic" : "text-sm font-medium"
        }
      >
        {empty ? "Neuvedeno" : value}
      </p>
    </div>
  );
}
