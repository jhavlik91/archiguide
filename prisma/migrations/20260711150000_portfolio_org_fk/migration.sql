-- T012 doplněk: FK firemního vlastníka portfolia. Migrace `20260710224801_portfolio`
-- vznikla před zmergováním T009, kdy tabulka `organizations` ještě neexistovala;
-- teď existuje, takže odložený FK doplňujeme (append-only, bez zásahu do už
-- aplikované migrace).

-- AddForeignKey
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
