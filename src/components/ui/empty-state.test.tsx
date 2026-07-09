import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

describe("EmptyState", () => {
  it("renders the title and description", () => {
    render(<EmptyState title="Nic tu není" description="Zkuste to později" />);
    expect(
      screen.getByRole("heading", { name: "Nic tu není" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Zkuste to později")).toBeInTheDocument();
  });

  it("renders the provided action", () => {
    render(<EmptyState title="Prázdné" action={<Button>Přidat</Button>} />);
    expect(screen.getByRole("button", { name: "Přidat" })).toBeInTheDocument();
  });
});
