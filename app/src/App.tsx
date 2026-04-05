import { AppShell } from "./components/AppShell";
import { useAppState } from "./state/appState";

export function App() {
  const state = useAppState();

  return <AppShell state={state} />;
}
