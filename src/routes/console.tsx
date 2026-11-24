import { createFileRoute, notFound } from "@tanstack/react-router";
import { ConsoleScreen } from "@/components/console/console-screen";
import { consoleEnabled, resolveConsoleRuntimeKind } from "@/components/console/console-view";

/**
 * Phase 4 director console route. Flag default OFF: only the exact string
 * "true" on VITE_DIRECTOR_CONSOLE opens the console; anything else (absent,
 * "1", "false") renders not-found. The solo `/` route is untouched.
 */
export const Route = createFileRoute("/console")({
  beforeLoad: () => {
    if (!consoleEnabled(import.meta.env.VITE_DIRECTOR_CONSOLE)) throw notFound();
  },
  component: ConsolePage,
});

function ConsolePage() {
  return <ConsoleScreen runtime={resolveConsoleRuntimeKind(import.meta.env.VITE_CONSOLE_API)} />;
}
