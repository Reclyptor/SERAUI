import { Sidebar } from "../components/Sidebar";
import { listModels } from "../actions/models";
import { ModelCatalogProvider } from "../contexts/ModelCatalogContext";

// Async server component: fetches the SERA model catalog per request and
// threads it down via <ModelCatalogProvider>. The fetch is intentionally not
// wrapped in try/catch — chat routes are only reachable after auth (see
// proxy.ts), so a failure here means SERA is unreachable or the session is
// genuinely broken, and the Next.js error boundary should surface it.
export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const catalog = await listModels();
  return (
    <ModelCatalogProvider initialCatalog={catalog}>
      <div className="flex h-screen w-full bg-background">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 lg:ml-0 ml-[48px]">
          {children}
        </main>
      </div>
    </ModelCatalogProvider>
  );
}
