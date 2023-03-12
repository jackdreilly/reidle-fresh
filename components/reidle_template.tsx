import { asset, Head } from "$fresh/runtime.ts";
import { ComponentChildren } from "preact";

export default function ReidleTemplate(
  { children, title }: {
    children: ComponentChildren;
    title?: string;
    fullPage?: boolean;
  },
) {
  return (
    <html>
      <Head>
        <title>{title ?? "Reidle"}</title>
        <link rel="prefetch" href={asset("/words.csv")} sizes="any" />
        <link rel="prefetch" href={asset("/answers.csv")} sizes="any" />
        <meta
          name="description"
          content="Reidle is a Wordle clone with a leaderboard, a forced starting word, and very strict rules."
        >
        </meta>
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link
          crossOrigin="use-credentials"
          rel="manifest"
          href="/manifest.webmanifest"
        />
        <meta name="msapplication-TileColor" content="#da532c" />
        <meta name="theme-color" content="#ffffff" />
        <script src="/worker.js" type="module" />
      </Head>
      <body>
        <ReidleHeader />
        <div class="m-4">
          {children}
        </div>
      </body>
    </html>
  );
}

export function ReidleHeader({ children }: { children?: ComponentChildren }) {
  return (
    <nav class="h-[2.5rem] flex items-center">
      <h1 class="m-2 text-2xl">
        <a
          class="font-medium text-blue-600 dark:text-blue-500 hover:underline"
          href="/"
        >
          Reidle
        </a>
      </h1>
      {children}
    </nav>
  );
}
