"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FolderKanban, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import {
  PORTFOLIO_STATUS_LABELS,
  type PortfolioStatus,
} from "../types";
import { createPortfolioProject } from "../actions";

export type PortfolioListItem = {
  id: string;
  title: string;
  status: PortfolioStatus;
  updatedAt: string;
};

const STATUS_VARIANT: Record<PortfolioStatus, "secondary" | "success"> = {
  draft: "secondary",
  published: "success",
  archived: "secondary",
};

/**
 * Seznam mých portfolio děl (T012) + založení nového. Po vytvoření přejde rovnou
 * do blokového editoru (T013).
 */
export function PortfolioList({ projects }: { projects: PortfolioListItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function create() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Zadejte název díla.");
      return;
    }
    startTransition(async () => {
      const result = await createPortfolioProject({ title: trimmed });
      if (result.ok && result.projectId) {
        router.push(`/portfolio/${result.projectId}`);
      } else if (!result.ok) {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Vaše díla. Obsah sestavíte z bloků v editoru.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Nové dílo
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban />}
          title="Zatím žádná díla"
          description="Založte první dílo a sestavte ho z bloků – text, obrázky, galerie, před/po a další."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Nové dílo
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/portfolio/${project.id}`}>
              <Card className="hover:border-primary/40 transition-colors">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <span className="truncate font-medium">{project.title}</span>
                  <Badge variant={STATUS_VARIANT[project.status]}>
                    {PORTFOLIO_STATUS_LABELS[project.status]}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nové dílo</DialogTitle>
            <DialogDescription>
              Zadejte pracovní název. Ostatní údaje a obsah doplníte v editoru.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="new-title">Název</Label>
            <Input
              id="new-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Např. Rekonstrukce vily v Dejvicích"
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Zrušit
            </Button>
            <Button onClick={create} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Vytvořit a otevřít
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
