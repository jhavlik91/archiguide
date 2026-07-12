-- Guide — výstupy koncových větví (T019).
-- Mapování odpovědí na doporučené profese / další krok / podklady / safety flag.
-- AlterTable
ALTER TABLE "guide_scenarios" ADD COLUMN "outcomes" JSONB NOT NULL DEFAULT '[]';
