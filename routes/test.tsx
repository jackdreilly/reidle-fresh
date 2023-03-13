import { PageProps } from "$fresh/server.ts";
import NavDrawerIcon from "@/components/NavDrawerIcon.tsx";
interface Link {
  text: string;
  link: string;
  matches?(other: string): boolean;
  show?: boolean;
}
const links: Link[] = [
  {
    text: "Home",
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
  },
  { text: "Messages", link: "/messages" },
  { text: "Account", link: "/set-name" },
];
export default function Page(p: PageProps) {
  return (
    <html>
      <body>
        <nav>
          <div class="bg-purple-900 flex justify-between items-center">
            <div id="navigation-bar" class="flex">
              {links.map(({ show, link, text, matches }) => (
                <a
                  class={(show ? "block" : "hidden") +
                    " text-white p-5 cursor-pointer md:block " +
                    (((matches ?? ((x) => x === link))(p.route))
                      ? "bg-purple-600"
                      : "")}
                  href={link}
                >
                  {text}
                </a>
              ))}
            </div>
            <a
              id="menu-icon"
              class="text-white p-5 cursor-pointer block md:hidden"
            >
              <NavDrawerIcon />
            </a>
          </div>
        </nav>
      </body>
    </html>
  );
}
