"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import {
  PORTFOLIO_PROJECT_TYPES,
  PORTFOLIO_PROJECT_TYPE_LABELS,
  PORTFOLIO_STATUS_LABELS,
  PORTFOLIO_VISIBILITIES,
  PORTFOLIO_VISIBILITY_LABELS,
  type PortfolioProjectType,
  type PortfolioStatus,
  type PortfolioVisibility,
} from "../../types";
import {
  publishPortfolioProject,
  savePortfolioMetadata,
  unpublishPortfolioProject,
} from "../../actions";

const NONE = "__none";

type ProjectMeta = {
  id: string;
  title: string;
  projectType: PortfolioProjectType | null;
  location: string | null;
  year: number | null;
  description: string | null;
  visibility: PortfolioVisibility;
  status: PortfolioStatus;
};

const STATUS_VARIANT: Record<PortfolioStatus, "secondary" | "success"> = {
  draft: "secondary",
  published: "success",
  archived: "secondary",
};

/**
 * Metadata díla + publikační cyklus (T012) v hlavičce editoru. Metadata se ukládají
 * tlačítkem (na rozdíl od bloků, které se ukládají automaticky). Publikace zmrazí
 * aktuální bloky do veřejné verze (T012/T013).
 */
export function MetadataForm({ project }: { project: ProjectMeta }) {
  const [title, setTitle] = useState(project.title);
  const [projectType, setProjectType] = useState<string>(
    project.projectType ?? NONE,
  );
  const [location, setLocation] = useState(project.location ?? "");
  const [year, setYear] = useState(project.year ? String(project.year) : "");
  const [description, setDescription] = useState(project.description ?? "");
  const [visibility, setVisibility] = useState<PortfolioVisibility>(
    project.visibility,
  );
  const [status, setStatus] = useState<PortfolioStatus>(project.status);
  const [pending, startTransition] = useTransition();
  const [publishing, startPublish] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await savePortfolioMetadata(project.id, {
        title: title.trim(),
        projectType: projectType === NONE ? null : projectType,
        location: location.trim() || undefined,
        year: year.trim() ? Number(year) : null,
        description: description.trim() || undefined,
        visibility,
      });
      if (result.ok) toast.success("Údaje uloženy.");
      else toast.error(result.message);
    });
  }

  function togglePublish() {
    startPublish(async () => {
      if (status === "published") {
        const result = await unpublishPortfolioProject({ projectId: project.id });
        if (result.ok) {
          setStatus("draft");
          toast.success("Publikace zrušena, dílo je zpět koncept.");
        } else toast.error(result.message);
      } else {
        const result = await publishPortfolioProject({ projectId: project.id });
        if (result.ok) {
          setStatus("published");
          toast.success("Dílo publikováno.");
        } else toast.error(result.message);
      }
    });
  }

  return (
    <div className="border-border bg-background space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Údaje o díle</h2>
          <Badge variant={STATUS_VARIANT[status]}>
            {PORTFOLIO_STATUS_LABELS[status]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/projekt/${project.id}?preview=1`}
              target="_blank"
              rel="noopener"
            >
              <ExternalLink className="size-4" /> Náhled stránky
            </Link>
          </Button>
          <Button size="sm" onClick={togglePublish} disabled={publishing}>
            {publishing && <Loader2 className="size-4 animate-spin" />}
            {status === "published" ? "Zrušit publikaci" : "Publikovat"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="pf-title">Název *</Label>
          <Input
            id="pf-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Název díla"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="pf-type">Typ díla</Label>
          <Select value={projectType} onValueChange={setProjectType}>
            <SelectTrigger id="pf-type">
              <SelectValue placeholder="Nevybráno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nevybráno</SelectItem>
              {PORTFOLIO_PROJECT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {PORTFOLIO_PROJECT_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="pf-visibility">Viditelnost</Label>
          <Select
            value={visibility}
            onValueChange={(v) => setVisibility(v as PortfolioVisibility)}
          >
            <SelectTrigger id="pf-visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PORTFOLIO_VISIBILITIES.map((v) => (
                <SelectItem key={v} value={v}>
                  {PORTFOLIO_VISIBILITY_LABELS[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="pf-location">Lokalita</Label>
          <Input
            id="pf-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Město / region"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="pf-year">Rok</Label>
          <Input
            id="pf-year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2025"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="pf-description">Perex</Label>
          <Textarea
            id="pf-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Krátký popis díla (delší obsah sestavíte z bloků níže)."
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Uložit údaje
        </Button>
      </div>
    </div>
  );
}
