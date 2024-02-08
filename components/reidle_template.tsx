import { asset, Head } from "$fresh/runtime.ts";
import { ComponentChildren } from "preact";
import AllNotification from "@/islands/AllNotification.tsx";

export default function ReidleTemplate(
  { children, title, route, fullPage, playedToday }: {
    route: string;
    children: ComponentChildren;
    title: string;
    fullPage?: boolean;
    playedToday: boolean;
  },
) {
  return (
    <html class={fullPage ? "h-full" : ""}>
      <ReidleHead title={title} fullPage={fullPage} />
      <body class={fullPage ? "h-full" : ""}>
        <nav class="fixed top-0 z-50 w-full bg-white border-b border-gray-200 ">
          <div
            class={[
              "px-3",
              fullPage ? "py-[0.4rem]" : "py-3",
              "lg:px-5",
              "lg:pl-3",
            ].join(" ")}
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center justify-start">
                <button
                  data-drawer-target="logo-sidebar"
                  data-drawer-toggle="logo-sidebar"
                  aria-controls="logo-sidebar"
                  type="button"
                  class="relative inline-flex items-center p-2 text-sm text-gray-500 rounded-lg md:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 "
                >
                  <div class="absolute top-[-.5em] right-[-.5em]">
                    <AllNotification />
                  </div>
                  <span class="sr-only">Open sidebar</span>
                  <svg
                    class="w-6 h-6"
                    aria-hidden="true"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      clip-rule="evenodd"
                      fill-rule="evenodd"
                      d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z"
                    >
                    </path>
                  </svg>
                </button>
                <a href="/" class="flex ml-2 md:mr-24">
                  <img
                    height="48px"
                    width="48px"
                    src={asset("/android-chrome-96x96.webp")}
                    class="mr-3"
                    alt="Reidle Logo"
                  />
                  <span class="self-center text-xl font-semibold md:text-2xl whitespace-nowrap hidden md:contents">
                    Reidle
                  </span>
                </a>
                <span class="flex self-center text-xl font-semibold md:text-2xl whitespace-nowrap md:hidden">
                  <a
                    href="/play"
                    class="text-white bg-gradient-to-r from-pink-400 via-pink-500 to-pink-600 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-pink-300 dark:focus:ring-pink-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center mr-2 mb-2"
                    style={{ display: playedToday ? "none" : null }}
                  >
                    <PlaySVG fill="#ffffff" />
                  </a>
                  <a
                    href="/challenges"
                    class="text-white bg-gradient-to-r from-green-400 via-green-500 to-green-600 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-green-300 dark:focus:ring-green-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center mr-2 mb-2"
                  >
                    <ChallengeSVG fill="#ffffff" />
                  </a>
                  <a
                    href="/battles"
                    class="text-white bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-purple-300 dark:focus:ring-purple-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center mr-2 mb-2"
                  >
                    <BattleSvg fill="#ffffff" />
                  </a>
                </span>
              </div>
            </div>
          </div>
        </nav>

        <aside
          id="logo-sidebar"
          class="fixed top-0 left-0 z-40 w-48 h-screen pt-20 transition-transform -translate-x-full bg-white border-r border-gray-200 md:translate-x-0 "
          aria-label="Sidebar"
        >
          <div class="h-full px-3 pb-4 overflow-y-auto bg-white ">
            <ul class="space-y-2">
              <li class="rounded-lg bg-[#b68c0021] hover:bg-[#b68c0060] ">
                <a
                  href="/stats/today"
                  class="flex items-center p-2 text-base font-normal text-gray-900"
                >
                  <svg
                    fill="#D4A65D"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                    class="flex-shrink-0 w-6 h-6 text-gray-500 transition duration-75 group-hover:text-gray-900 "
                  >
                    <path
                      clip-rule="evenodd"
                      fill-rule="evenodd"
                      d="M10 1c-1.828 0-3.623.149-5.371.435a.75.75 0 00-.629.74v.387c-.827.157-1.642.345-2.445.564a.75.75 0 00-.552.698 5 5 0 004.503 5.152 6 6 0 002.946 1.822A6.451 6.451 0 017.768 13H7.5A1.5 1.5 0 006 14.5V17h-.75C4.56 17 4 17.56 4 18.25c0 .414.336.75.75.75h10.5a.75.75 0 00.75-.75c0-.69-.56-1.25-1.25-1.25H14v-2.5a1.5 1.5 0 00-1.5-1.5h-.268a6.453 6.453 0 01-.684-2.202 6 6 0 002.946-1.822 5 5 0 004.503-5.152.75.75 0 00-.552-.698A31.804 31.804 0 0016 2.562v-.387a.75.75 0 00-.629-.74A33.227 33.227 0 0010 1zM2.525 4.422C3.012 4.3 3.504 4.19 4 4.09V5c0 .74.134 1.448.38 2.103a3.503 3.503 0 01-1.855-2.68zm14.95 0a3.503 3.503 0 01-1.854 2.68C15.866 6.449 16 5.74 16 5v-.91c.496.099.988.21 1.475.332z"
                    >
                    </path>
                  </svg>
                  <span
                    class={"ml-3 " + (route === "/stats" ? "font-bold" : "")}
                  >
                    Leaderboard
                  </span>
                </a>
              </li>
              <li
                class="rounded-lg  bg-[#ff00001c] hover:bg-[#ff000050]"
                style={{ display: playedToday ? "none" : null }}
              >
                <a
                  href="/play"
                  class="flex items-center p-2 text-base font-normal text-gray-900"
                >
                  <PlaySVG fill="#db2777" />
                  <span
                    class={"ml-3 " + (route === "/play" ? "font-bold" : "")}
                  >
                    Play
                  </span>
                </a>
              </li>
              <li class="bg-[#00ff3c1f] hover:bg-[#00ff3c60]  rounded-lg">
                <a
                  href="/challenges"
                  class="flex items-center p-2 text-base font-normal text-gray-900"
                >
                  <ChallengeSVG fill="#059669" />
                  <span
                    class={"ml-3 " +
                      (route === "/challenges" ? "font-bold" : "")}
                  >
                    Challenges
                  </span>
                </a>
              </li>
              <li class="rounded-lg bg-[#5b73ff21] hover:bg-[#5b73ff60] ">
                <a
                  href="/battles"
                  class="flex items-center p-2 text-base font-normal text-gray-900"
                >
                  <BattleSvg fill="#6d28d9" />
                  <span
                    class={"flex-1 ml-3 whitespace-nowrap " +
                      (route === "/battles" ? "font-bold" : "")}
                  >
                    Battles
                  </span>
                </a>
              </li>
              <li class="rounded-lg bg-[#00ddff1a] hover:bg-[#00ddff60] ">
                <a
                  href="/practice"
                  class="flex items-center p-2 text-base font-normal text-gray-900"
                >
                  <PracticeSVG fill="#00A6B5" />
                  <span
                    class={"ml-3 " + (route === "/practice" ? "font-bold" : "")}
                  >
                    Practice
                  </span>
                </a>
              </li>
              <li class="rounded-lg bg-[#f7f1b5] hover:bg-[#bfb865] ">
                <a
                  href="/rankings"
                  class="flex items-center p-2 text-base font-normal text-gray-900"
                >
                  <RankingsSVG fill="#5c5300" />
                  <span
                    class={"ml-3 " + (route === "/rankings" ? "font-bold" : "")}
                  >
                    Rankings
                  </span>
                </a>
              </li>
              <li>
                <a
                  href="/messages"
                  class="flex items-center p-2 text-base font-normal text-gray-900 rounded-lg hover:bg-gray-100 "
                >
                  <Messages />
                  <span
                    class={"flex-1 ml-3 whitespace-nowrap " +
                      (route === "/messages" ? "font-bold" : "")}
                  >
                    Messages
                  </span>
                  <span class="inline-flex items-center justify-center">
                    <AllNotification />
                  </span>
                </a>
              </li>
              <li class="flex items-center p-2 text-base font-normal text-gray-900 rounded-lg hover:bg-gray-100 ">
                <a
                  href="/wrapped"
                  class="flex items-center p-2 text-base font-normal text-gray-900"
                >
                  <span
                    class={"ml-3 " + (route === "/wrapped" ? "font-bold" : "")}
                  >
                    Wrapped 2023
                  </span>
                </a>
              </li>
              <li>
                <a
                  href="/account"
                  class="flex items-center p-2 text-base font-normal text-gray-900 rounded-lg hover:bg-gray-100 "
                >
                  <svg
                    aria-hidden="true"
                    class="flex-shrink-0 w-6 h-6 text-gray-500 transition duration-75 group-hover:text-gray-900 "
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clip-rule="evenodd"
                    >
                    </path>
                  </svg>
                  <span
                    class={"flex-1 ml-3 whitespace-nowrap " +
                      (route === "/account" ? "font-bold" : "")}
                  >
                    Account
                  </span>
                </a>
              </li>
              <li>
                <a
                  href="/sign-out"
                  class="flex items-center p-2 text-base font-normal text-gray-900 rounded-lg hover:bg-gray-100 "
                >
                  <svg
                    aria-hidden="true"
                    class="flex-shrink-0 w-6 h-6 text-gray-500 transition duration-75 group-hover:text-gray-900 "
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      clipRule="evenodd"
                      fillRule="evenodd"
                      d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
                    />
                  </svg>
                  <span class="flex-1 ml-3 whitespace-nowrap">
                    Log Out
                  </span>
                </a>
              </li>
            </ul>
          </div>
        </aside>
        <div
          class={[
            "md:ml-48",
            fullPage ? "pt-[4em] h-full" : "pt-[6em] px-4 pb-4",
          ].join(" ")}
        >
          {children}
        </div>
      </body>
    </html>
  );
}

function BattleSvg({ fill }: { fill?: string }) {
  return (
    <svg
      class="flex-shrink-0 w-6 h-6 text-gray-500 transition duration-75 group-hover:text-gray-900"
      fill={fill ?? "currentColor"}
      x="0px"
      y="0px"
      height="24"
      width="24"
    >
      <path
        d="M 119,462 C 99,457 66,431 39,402 10,369 -2,343 3,322 6,314 10,305 15,298 c 7,-8 25,-29 27,-28 2,1 -0,7 -1,16 -2,18 -2,27 2,34 3,7 6,11 26,35 24,29 28,33 39,33 8,0 12,-2 19,-8 C 132,374 134,370 134,364 c 0,-6 -2,-10 -10,-18 C 108,330 92,308 85,296 80,284 79,280 79,254 L 79,231 80,230 84,226 l 5,-5 0,-12 c 0,-30 5,-63 15,-88 8,-23 24,-50 38,-69 9,-11 23,-25 33,-31 C 185,14 202,6 212,3 c 11,-3 25,-2 33,1 9,3 19,10 20,19 0,0 1,2 -1,8 -20,54 -7,18 21,-0 C 293,26 310,21 327,21 c 20,0 34,4 52,15 14,8 24,16 40,32 24,24 38,43 50,66 9,18 11,27 11,45 0,16 -1,21 -6,36 -10,31 -34,62 -69,92 -56,47 -107,70 -161,74 l -9,1 -11,13 c -40,46 -59,61 -79,67 -8,2 -19,2 -25,1 z"
        transform="matrix(0.05019839,0,0,0.05019839,-0.09522931,0.33275301)"
      />
    </svg>
  );
}

function PlaySVG({ fill }: { fill?: string }) {
  return (
    <svg
      fill={fill ?? "currentColor"}
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      class="w-6 h-6 text-gray-500 transition duration-75 group-hover:text-gray-900 "
      style="stroke-width: var(--grid-item-icon-stroke-width); transform: scale(var(--grid-item-icon-scale));"
    >
      <path
        clip-rule="evenodd"
        fill-rule="evenodd"
        d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm6.39-2.908a.75.75 0 01.766.027l3.5 2.25a.75.75 0 010 1.262l-3.5 2.25A.75.75 0 018 12.25v-4.5a.75.75 0 01.39-.658z"
      >
      </path>
    </svg>
  );
}

function Messages() {
  return (
    <svg
      aria-hidden="true"
      class="flex-shrink-0 w-6 h-6 text-gray-500 transition duration-75 group-hover:text-gray-900 "
      fill="currentColor"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        clip-rule="evenodd"
        fill-rule="evenodd"
        d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
      >
      </path>
    </svg>
  );
}

export function ReidleHead(
  { title, fullPage }: { title: string; fullPage?: boolean },
) {
  return (
    <Head>
      <title>{title ?? "Reidle"}</title>
      <script defer src={asset("/flowbite.min.js")} />
      <link rel="prefetch" href={asset("/words.csv")} sizes="any" />
      <link rel="prefetch" href={asset("/answers.csv")} sizes="any" />
      {fullPage
        ? (
          <meta
            name="viewport"
            content="width=device-width, minimum-scale=1.0, maximum-scale = 1.0, user-scalable = no"
          />
        )
        : null}
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

function PracticeSVG({ fill }: { fill?: string }) {
  return (
    <svg
      fill={fill ?? "currentColor"}
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      class="w-6 h-6 text-gray-500 transition duration-75 group-hover:text-gray-900 "
      style="stroke-width: var(--grid-item-icon-stroke-width); transform: scale(var(--grid-item-icon-scale));"
    >
      <g transform="translate(0.000000,20.000000) scale(0.003906,-0.003906)">
        <path d="M3240 5111 c-74 -24 -141 -83 -181 -161 -20 -37 -24 -60 -24 -130 0
-74 4 -92 29 -140 22 -44 177 -204 794 -822 863 -864 816 -823 962 -823 174 1
300 127 300 300 0 121 -18 147 -278 407 l-227 228 167 167 c91 93 171 178 177
190 14 28 14 108 0 136 -16 31 -459 475 -491 493 -32 17 -110 19 -141 3 -12
-6 -97 -86 -190 -177 l-167 -167 -228 227 c-142 142 -244 235 -272 250 -34 18
-64 23 -125 25 -44 1 -91 -1 -105 -6z" />
        <path d="M2373 4679 c-64 -25 -137 -93 -166 -157 -32 -69 -31 -189 2 -257 19
-40 217 -243 995 -1023 534 -535 994 -988 1021 -1007 156 -104 364 -46 444
125 21 44 26 69 25 130 -1 139 64 66 -1042 1171 -953 953 -1000 998 -1055
1018 -73 26 -155 26 -224 0z" />
        <path d="M2235 2880 l-460 -460 323 -322 322 -323 462 462 463 463 -320 320
c-176 176 -322 320 -325 320 -3 0 -212 -207 -465 -460z" />
        <path d="M657 2929 c-92 -22 -165 -81 -206 -169 -21 -44 -26 -69 -25 -130 1
-139 -64 -66 1042 -1171 953 -953 1000 -998 1055 -1018 153 -56 324 13 390
157 32 69 31 189 -2 257 -19 40 -217 243 -995 1023 -534 535 -993 988 -1021
1006 -77 50 -153 65 -238 45z" />
        <path d="M213 2076 c-133 -43 -213 -152 -213 -291 0 -121 18 -147 278 -407
l227 -228 -167 -167 c-91 -93 -171 -178 -177 -190 -16 -31 -14 -109 3 -141 18
-33 462 -475 494 -492 26 -13 88 -16 123 -5 13 4 102 84 197 178 l172 172 228
-227 c142 -142 244 -235 272 -250 38 -19 60 -23 140 -23 109 0 149 16 211 82
65 67 84 116 84 213 0 74 -4 92 -29 140 -22 44 -177 204 -794 822 -685 685
-773 770 -826 794 -70 32 -162 40 -223 20z" />
      </g>
    </svg>
  );
}
function ChallengeSVG({ fill }: { fill?: string }) {
  return (
    <svg
      fill={fill ?? "currentColor"}
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      class="w-6 h-6 text-gray-500 transition duration-75 group-hover:text-gray-900 "
      style="stroke-width: var(--grid-item-icon-stroke-width); transform: scale(var(--grid-item-icon-scale));"
    >
      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
    </svg>
  );
}

function RankingsSVG({ fill }: { fill?: string }) {
  return (
    <svg
      fill={fill ?? "currentColor"}
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      class="w-6 h-6 text-gray-500 transition duration-75 group-hover:text-gray-900 "
      style="stroke-width: var(--grid-item-icon-stroke-width); transform: scale(var(--grid-item-icon-scale));"
    >
      <path
        fill-rule="evenodd"
        d="M12.577 4.878a.75.75 0 0 1 .919-.53l4.78 1.281a.75.75 0 0 1 .531.919l-1.281 4.78a.75.75 0 0 1-1.449-.387l.81-3.022a19.407 19.407 0 0 0-5.594 5.203.75.75 0 0 1-1.139.093L7 10.06l-4.72 4.72a.75.75 0 0 1-1.06-1.061l5.25-5.25a.75.75 0 0 1 1.06 0l3.074 3.073a20.923 20.923 0 0 1 5.545-4.931l-3.042-.815a.75.75 0 0 1-.53-.919Z"
        clip-rule="evenodd"
      />
    </svg>
  );
}
