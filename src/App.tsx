import { useRouter } from "./router";
import Layout from "./components/Layout";

export default function App() {
  const { current, progress } = useRouter();
  if (!current) return null;
  const { Page, route, params, query, data, key } = current;
  const page = <Page key={key} params={params} query={query} data={data} />;
  return (
    <>
      {progress && <div class="fixed top-0 left-0 z-[200] h-0.5 w-full animate-pulse bg-blue-500" />}
      {route.layout
        ? <Layout route={route.layout.route} fullPage={route.layout.fullPage}>{page}</Layout>
        : page}
    </>
  );
}
