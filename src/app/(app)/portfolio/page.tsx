import { requireUser } from "@/lib/session";
import { listMyPortfolio } from "@/features/portfolio/queries";
import {
  PortfolioList,
  type PortfolioListItem,
} from "@/features/portfolio/components/portfolio-list";

/**
 * T012/T013 — seznam mých portfolio děl (`/portfolio`). Založení nového díla vede
 * rovnou do blokového editoru (T013). Data i viditelnost řeší `listMyPortfolio`.
 */
export default async function PortfolioPage() {
  await requireUser();
  const projects = await listMyPortfolio();

  const items: PortfolioListItem[] = projects.map((project) => ({
    id: project.id,
    title: project.title,
    status: project.status,
    updatedAt: project.updatedAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <PortfolioList projects={items} />
    </div>
  );
}
