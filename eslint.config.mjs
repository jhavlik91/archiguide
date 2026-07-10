import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import eslintConfigPrettier from "eslint-config-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "storybook-static/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // T004: role se čtou/mění jen přes permission vrstvu (lib/permissions.ts,
  // lib/session.ts) a datovou vrstvu rolí (features/roles). Přímý přístup na
  // `db.userRole` odjinud je zakázaný, aby nevznikaly ad-hoc kontroly rolí.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name='userRole']",
          message:
            "Role se čtou/mění jen přes lib/session.ts nebo features/roles/service.ts (T004), ne ad-hoc přes db.userRole.",
        },
      ],
    },
  },
  {
    files: ["src/lib/session.ts", "src/features/roles/**/*.{ts,tsx}"],
    rules: { "no-restricted-syntax": "off" },
  },
  // Disable ESLint rules that conflict with Prettier formatting. Keep last.
  eslintConfigPrettier,
];

export default eslintConfig;
