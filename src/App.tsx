import { useRouter } from "./router";
import Layout from "./components/Layout";
import { useOnline } from "./lib/pwa";

export default function App() {
  const { current, progress } = useRouter();
  const online = useOnline();
  if (!current) return null;
  const { Page, route, params, query, data, key } = current;
  const page = <Page key={key} params={params} query={query} data={data} />;
  return (
    <>
      {!online && (
        <div role="status" class="fixed bottom-0 inset-x-0 z-[200] bg-gray-800 px-3 pt-1.5 pb-[max(.375rem,env(safe-area-inset-bottom))] text-center text-sm text-white">
          You're offline. Practice still works; everything else needs a connection.
        </div>
      )}
      {progress && <div class="fixed top-[env(safe-area-inset-top)] left-0 z-[200] h-0.5 w-full animate-pulse bg-blue-500" />}
      {route.layout
        ? <Layout route={route.layout.route} fullPage={route.layout.fullPage}>{page}</Layout>
        : page}
    </>
  );
}
