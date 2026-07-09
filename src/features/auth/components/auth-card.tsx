import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Vystředěný obal pro auth stránky (login, registrace, reset). */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <Card>
        <CardHeader>
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ArchiGuide
          </Link>
          <CardTitle className="text-2xl">{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
      {footer ? (
        <p className="text-muted-foreground mt-4 text-center text-sm">
          {footer}
        </p>
      ) : null}
    </main>
  );
}

/** Chybová hláška formuláře (role=alert). */
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-destructive text-sm">
      {children}
    </p>
  );
}
