import type { DefaultSession } from "next-auth";

// Rozšíření session o naše `user.id` (cuid uživatele v DB).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
