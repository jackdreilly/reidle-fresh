import { asset, Head } from "$fresh/runtime.ts";
import Drawer from "@/islands/drawer.tsx";
import ReadNotification from "@/islands/ReadNotification.tsx";
import { ComponentChildren } from "preact";

export default function ReidleTemplate(
  { children, title, route }: {
    route?: string;
    children: ComponentChildren;
    title: string;
    fullPage?: boolean;
  },
) {
  return (
    <html>
      <ReidleHead title={title} />
      <body>
        <ReidleHeader route={route} />
        <div class="m-4">
          {children}
        </div>
      </body>
    </html>
  );
}

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
    matches(x) {
      return x === "/";
    },
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
  { text: "Account", link: "/account" },
];

export function ReidleHead({ title }: { title: string }) {
  return (
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
        href={asset("/apple-touch-icon.png")}
      />
      <link
        rel="manifest"
        href={asset("/manifest.webmanifest")}
      />
      <meta name="theme-color" content="#ffffff" />
      <script defer src={asset("/register.js")} />
    </Head>
  );
}

export function ReidleHeader({ route }: { route?: string }) {
  return (
    <div class="bg-white w-full max-w-screen-lg py-2 px-3 flex flex-row gap-2">
      <ul class="flex flex-grow items-center gap-6">
        {reidleHeaderLinks.map(({ text, link, matches, show }) => (
          <li
            class={[
              "md:list-item",
              !show ? "hidden" : "",
            ].join(" ")}
          >
            <a
              href={link}
              class={[
                "text-gray-500",
                "hover:text-gray-700",
                "py-1",
                "border-gray-500",
                (matches ?? ((x) => x.startsWith(link)))(route ?? "")
                  ? "font-bold border-b-2"
                  : "",
                link === "/" ? "text-3xl font-bold text-black" : "",
              ].join(" ")}
            >
              {text}
              {text === "Messages" ? <ReadNotification /> : null}
            </a>
          </li>
        ))}
        <li class="flex-grow"></li>
        <li class="md:hidden z-10">
          <Drawer />
        </li>
      </ul>
    </div>
  );
}
