import { asset } from "$fresh/runtime.ts";
import { AppProps } from "$fresh/server.ts";

export default function App({ Component }: AppProps) {
  return (
    <html lang="en" class="h-full antialiased bg-gray-50 text-gray-900">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
        />
        <title>Reidle</title>
        <meta
          name="description"
          content="Reidle - Fast, competitive Wordle with forced starting words, hard rules, and daily leaderboards."
        />
        <meta name="theme-color" content="#16a34a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Reidle" />

        <link rel="icon" type="image/x-icon" href={asset("/favicon.ico")} />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href={asset("/apple-touch-icon.png")}
        />
        <link rel="manifest" href={asset("/manifest.webmanifest")} />

        <link rel="prefetch" href={asset("/words.csv")} sizes="any" />
        <link rel="prefetch" href={asset("/answers.csv")} sizes="any" />

        <script defer src={asset("/register.js")} />
        <script defer src={asset("/heap.js")} />

        <style>
          {`
            :root {
              --sat: env(safe-area-inset-top, 0px);
              --sab: env(safe-area-inset-bottom, 0px);
              --sal: env(safe-area-inset-left, 0px);
              --sar: env(safe-area-inset-right, 0px);
            }

            * {
              -webkit-tap-highlight-color: transparent;
            }

            html, body {
              height: 100%;
              margin: 0;
              padding: 0;
              overscroll-behavior-y: none;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }

            @keyframes tile-pop {
              0% { transform: scale(0.85); opacity: 0.5; }
              40% { transform: scale(1.12); }
              100% { transform: scale(1); opacity: 1; }
            }

            @keyframes tile-flip {
              0% { transform: rotateX(0); }
              50% { transform: rotateX(-90deg); }
              100% { transform: rotateX(0); }
            }

            @keyframes row-shake {
              0%, 100% { transform: translateX(0); }
              15%, 45%, 75% { transform: translateX(-6px); }
              30%, 60%, 85% { transform: translateX(6px); }
            }

            @keyframes toast-in {
              0% { transform: translateY(-12px); opacity: 0; }
              100% { transform: translateY(0); opacity: 1; }
            }

            .animate-tile-pop {
              animation: tile-pop 0.12s ease-in-out forwards;
            }

            .animate-tile-flip {
              animation: tile-flip 0.5s ease-in-out forwards;
            }

            .animate-row-shake {
              animation: row-shake 0.4s ease-in-out;
            }

            .animate-toast {
              animation: toast-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }

            /* Custom slim scrollbar */
            ::-webkit-scrollbar {
              width: 5px;
              height: 5px;
            }
            ::-webkit-scrollbar-track {
              background: transparent;
            }
            ::-webkit-scrollbar-thumb {
              background: #cbd5e1;
              border-radius: 9999px;
            }
            ::-webkit-scrollbar-thumb:hover {
              background: #94a3b8;
            }
          `}
        </style>
      </head>
      <body class="min-h-full flex flex-col bg-white text-gray-900 select-none">
        <Component />
      </body>
    </html>
  );
}
