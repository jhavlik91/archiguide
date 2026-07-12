-- T015: úpravy obrázků. Aktivní upravená verze assetu je popsaná parametry
-- (editParams) a rendrovanými deriváty (editedThumbnailKey/editedWebKey +
-- rozměry). Originál (originalKey) ani jeho základní deriváty (thumbnailKey/
-- webKey) se nikdy nepřepisují — „vrátit originál" jen vynuluje tyto sloupce.
ALTER TABLE "media_assets"
    ADD COLUMN "editParams" JSONB,
    ADD COLUMN "editedThumbnailKey" TEXT,
    ADD COLUMN "editedWebKey" TEXT,
    ADD COLUMN "editedWidth" INTEGER,
    ADD COLUMN "editedHeight" INTEGER;
