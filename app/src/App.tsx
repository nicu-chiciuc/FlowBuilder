import { Chat } from "./components/Chat";

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-light dark:bg-dark text-slate-900 dark:text-slate-100">
      <header className="shrink-0 bg-light dark:bg-dark p-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-semibold">FlowBuilder</h1>
        <p className="text-sm text-slate-500">Create n8n workflows with natural language</p>
      </header>
      <main className="flex-1 min-h-0">
        <Chat />
      </main>
    </div>
  );
}
