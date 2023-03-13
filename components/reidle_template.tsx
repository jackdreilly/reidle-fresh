import { asset, Head } from "$fresh/runtime.ts";
import { ComponentChildren } from "preact";

export default function ReidleTemplate(
  { children, title, route }: {
    route?: string;
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
        <ReidleHeader route={route} />
        <div class="m-4">
          {children}
        </div>
      </body>
    </html>
  );
}

import NavDrawerIcon from "@/components/NavDrawerIcon.tsx";
import Drawer from "../islands/drawer.tsx";
interface Link {
  text: string;
  link: string;
  matches?(other: string): boolean;
  show?: boolean;
}
export const reidleHeaderLinks: Link[] = [
  {
    text: "Reidle",
    link: "/",
    show: true,
  },
  { text: "Play", link: "/play", show: true },
  { text: "Practice", link: "/practice", show: true },
  {
    text: "Stats",
    link: "/stats/today",
    matches(o) {
      return o.startsWith("/stats");
    },
    show: true,
  },
  { text: "Messages", link: "/messages" },
  { text: "Account", link: "/set-name" },
];
export function ReidleHeader(
  { route }: { route?: string },
) {
  return (
    <nav class="mb-3">
      <div class="bg-purple-900 flex justify-between items-center">
        <div id="navigation-bar" class="flex">
          {reidleHeaderLinks.map(({ show, link, text, matches }) => (
            <a
              class={(show ? "block" : "hidden") +
                " text-white hover:text-purple-300 p-3 cursor-pointer md:block " +
                (((matches ?? ((x) => x === link))(route ?? ""))
                  ? "bg-purple-600"
                  : "")}
              href={link}
            >
              {text}
            </a>
          ))}
        </div>
        <div class="md:hidden z-10">
          <Drawer />
        </div>
      </div>
    </nav>
  );
}
