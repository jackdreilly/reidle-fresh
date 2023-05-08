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
                    href="/practice"
                    class="text-white bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-purple-300 dark:focus:ring-purple-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center mr-2 mb-2"
                  >
                    <PracticeSVG fill="#ffffff" />
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
              <li style={{ display: playedToday ? "none" : null }}>
                <a
                  href="/play"
                  class="flex items-center p-2 text-base font-normal text-gray-900 rounded-lg hover:bg-gray-100 "
                >
                  <PlaySVG />
                  <span
                    class={"ml-3 " + (route === "/play" ? "font-bold" : "")}
                  >
                    Play
                  </span>
                </a>
              </li>
              <li>
                <a
                  href="/practice"
                  class="flex items-center p-2 text-base font-normal text-gray-900 rounded-lg hover:bg-gray-100 "
                >
                  <PracticeSVG />
                  <span
                    class={"ml-3 " + (route === "/practice" ? "font-bold" : "")}
                  >
                    Practice
                  </span>
                </a>
              </li>
              <li>
                <a
                  href="/challenges"
                  class="flex items-center p-2 text-base font-normal text-gray-900 rounded-lg hover:bg-gray-100 "
                >
                  <ChallengeSVG />
                  <span
                    class={"ml-3 " +
                      (route === "/challenges" ? "font-bold" : "")}
                  >
                    Challenges
                  </span>
                </a>
              </li>
              <li>
                <a
                  href="/stats/today"
                  class="flex items-center p-2 text-base font-normal text-gray-900 rounded-lg hover:bg-gray-100 "
                >
                  <svg
                    fill="currentColor"
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
              <li>
                <a
                  href="/battles"
                  class="flex items-center p-2 text-base font-normal text-gray-900 rounded-lg hover:bg-gray-100 "
                >
                  <svg
                    version="1.1"
                    id="Layer_1"
                    xmlns="http://www.w3.org/2000/svg"
                    x="0px"
                    y="0px"
                    height="30"
                    width="30"
                    viewBox="0 0 122.88 118.71"
                    style="enable-background:new 0 0 122.88 118.71"
                  >
                    <g>
                      <path d="M51.31,31.23c2.55-4.65,5.15-8.64,7.79-12c0.1-0.13,0.2-0.25,0.3-0.38c3.19-5.52,5.43-11.01,2.84-12.81l0,0 c-1.68-1.16-4.12-1.2-6.67-0.64c-3.81,0.83-7.67,2.93-9.99,4.82c-3.04,2.47-5.75,5.62-8.07,8.98c-2.76,4.01-4.93,8.28-6.38,12.04 c-1.48,3.85-2.54,7.96-3.15,12.36c-0.59,4.29-0.75,8.85-0.44,13.69c2.83,7.42,6.63,14,11.44,19.69c0.36,0.41,0.72,0.81,1.09,1.21 c5.54,5.96,12.31,10.72,20.21,14.36l0,0c0.09,0.04,0.18,0.09,0.27,0.15c0.95-0.07,1.92-0.16,2.9-0.28c1.7-0.21,3.35-0.48,4.96-0.81 c5.3-1.09,9.78-2.69,14.01-4.83c4.28-2.16,8.34-4.88,12.77-8.15c2.16-1.6,4.31-3.32,6.44-5.17c2.12-1.84,4.14-3.75,6.05-5.74l0,0 c4.16-4.7,7.01-9.24,8.61-13.63c1.55-4.26,1.91-8.38,1.11-12.38c-0.74-3.73-3.16-8.11-6.22-12.32c-3.91-5.38-8.82-10.38-12.66-13.4 c-1.65-1.3-3.28-2.39-4.88-3.27c-5.18-2.83-10.31-3.58-15.3-2.11c-5.09,1.5-10.16,5.29-15.11,11.53c-2.06,3.59-4.37,6.95-6.13,9.51 c-0.48,0.7-0.9,1.31-1.55,2.3c-0.77,1.16-2.34,1.48-3.5,0.71C50.93,33.91,50.6,32.38,51.31,31.23L51.31,31.23z M19.5,66.5 c-0.17,6.41,0.83,9.06,5.6,15.25c1.68,2.18,3.51,4.36,5.5,6.54c3.73,2.86,4.32,5.71,1.4,8.57l-1.4,1.56 c-2.52,1.56-5.31,1.85-9.04-2.34l-5.54-7.03c-2.49-3.16-5.72-6.19-5.96-10.43c-0.04-0.79-0.01-1.6,0.09-2.44l-2.43,2.51 c-0.79,1-1.43,2.03-1.88,3.1C5.39,82.82,5.12,83.89,5.06,85c-0.21,3.71,3.45,9.41,8.27,14.78c5.86,6.53,13.25,12.32,17.65,13.58 c6.96,2.01,14.64-6.88,21.08-14.32c0.88-1.02,1.74-2.01,2.58-2.96c-7.18-3.96-13.31-8.84-18.42-14.59 c-0.42-0.47-0.83-0.94-1.23-1.42c-4.53-5.21-8.26-11.21-11.14-18.04L19.5,66.5L19.5,66.5z M59.89,97.79 c-1.27,1.37-2.62,2.93-4.03,4.56c-7.4,8.56-16.22,18.76-26.28,15.87c-5.24-1.51-13.61-7.92-20.02-15.07 C3.96,96.9-0.28,89.91,0.01,84.72c0.1-1.74,0.51-3.39,1.18-4.95c0.65-1.51,1.54-2.95,2.64-4.32l0,0c0.05-0.06,0.1-0.12,0.16-0.18 l18.43-19.06c-0.22-4.66-0.02-9.1,0.56-13.31c0.66-4.75,1.82-9.23,3.44-13.46c1.59-4.12,3.95-8.78,6.93-13.11 c2.57-3.72,5.61-7.24,9.04-10.03c2.82-2.29,7.5-4.84,12.11-5.84c3.79-0.83,7.62-0.64,10.61,1.44l0.01,0l0,0 c2.78,1.93,3.45,4.96,2.9,8.44c2.92-2.16,5.89-3.68,8.91-4.56c6.33-1.86,12.74-0.96,19.13,2.53c1.89,1.03,3.76,2.27,5.59,3.72 c4.15,3.27,9.43,8.64,13.63,14.41c3.44,4.73,6.19,9.79,7.09,14.31c0.97,4.89,0.55,9.91-1.33,15.06c-1.82,5-5.02,10.11-9.65,15.33 c-0.02,0.03-0.05,0.05-0.07,0.08l0,0c-2.09,2.16-4.21,4.17-6.37,6.05c-2.15,1.87-4.4,3.67-6.75,5.41c-4.65,3.44-8.94,6.3-13.5,8.6 c-4.61,2.33-9.49,4.08-15.27,5.27c-1.83,0.38-3.63,0.67-5.37,0.89C62.7,97.59,61.31,97.71,59.89,97.79L59.89,97.79z" />
                    </g>
                  </svg>
                  <span
                    class={"flex-1 ml-3 whitespace-nowrap " +
                      (route === "/battles" ? "font-bold" : "")}
                  >
                    Battles
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
              <li>
                <a
                  href="https://wordle-old.reillybrothers.net"
                  target="_blank"
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
                      d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
                    />
                    <path
                      clipRule="evenodd"
                      fillRule="evenodd"
                      d="M6 10a.75.75 0 01.75-.75h9.546l-1.048-.943a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 11-1.004-1.114l1.048-.943H6.75A.75.75 0 016 10z"
                    />
                  </svg>
                  <span class="flex-1 ml-3 whitespace-nowrap">
                    Reidle Classic
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
