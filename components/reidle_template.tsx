import { ComponentChildren } from "preact";
import { Head } from "$fresh/runtime.ts";
import html from "../utils/utils.ts";

export default function ReidleTemplate(
  { children, title }: { children: ComponentChildren; title?: string },
) {
  return (
    <html>
      <Head>
        <title>{title ?? "Reidle"}</title>
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
        {ReidleHeader()}
        <div class="m-4">{children}</div>
      </body>
    </html>
  );
}

export function ReidleHeader() {
  const linkClass = "text-lg underline p-5 hover:text-blue-700 hover:font-bold";
  return (
    <div class="m-4 flex flex-wrap">
      <h1 class="text-2xl mr-0 hover:text-blue-700 hover:font-bold">
        <a href="/">Reidle</a>
      </h1>
      <a class={linkClass} href="/play">Play</a>
      <a class={linkClass} href="/practice">Practice</a>
      <a class={linkClass} href="/stats/today">Stats</a>
      <a class={linkClass} href="/messages">Messages</a>
      <a class={linkClass} href="/set-name">Set Name</a>
    </div>
  );
}
