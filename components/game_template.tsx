import { asset, Head } from "$fresh/runtime.ts";
import { ComponentChildren } from "preact";
export default function GameTemplate(
  { isPractice, children }: {
    isPractice: boolean;
    children?: ComponentChildren;
  },
) {
  const title = isPractice ? "Practice" : "Play";
  return (
    <html class="h-full">
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
      <body class="h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
