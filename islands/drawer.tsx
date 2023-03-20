import { reidleHeaderLinks } from "@/components/reidle_template.tsx";
import { useState } from "preact/hooks";
import ReadNotification from "./ReadNotification.tsx";

export default function Drawer() {
  const [show, setShow] = useState(false);
  return (
    <div onClick={() => setShow((s) => !s)}>
      <div class="relative">
        <svg
          class="h-5 w-5"
          fill="#888888"
          version="1.1"
          id="Capa_1"
          xmlns="http://www.w3.org/2000/svg"
          width="800px"
          height="800px"
          viewBox="0 0 24.75 24.75"
        >
          <g>
            <path d="M0,3.875c0-1.104,0.896-2,2-2h20.75c1.104,0,2,0.896,2,2s-0.896,2-2,2H2C0.896,5.875,0,4.979,0,3.875z M22.75,10.375H2
       c-1.104,0-2,0.896-2,2c0,1.104,0.896,2,2,2h20.75c1.104,0,2-0.896,2-2C24.75,11.271,23.855,10.375,22.75,10.375z M22.75,18.875H2
       c-1.104,0-2,0.896-2,2s0.896,2,2,2h20.75c1.104,0,2-0.896,2-2S23.855,18.875,22.75,18.875z" />
          </g>
        </svg>
        <div class="bottom-2 left-2 absolute">
          <ReadNotification />
        </div>
      </div>
      <nav
        class={(show ? "block" : "hidden") +
          " absolute top-[55px] shadow-2xl rounded-md right-1 w-48 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg"}
      >
        <ul>
          {reidleHeaderLinks.map(({ text, link }, i) => (
            <li>
              <a
                href={link}
                class={[
                  "block",
                  "w-full",
                  "px-4",
                  "py-2",
                  "m-5",
                  "border-b",
                  "text-5xl",
                  "border-gray-200",
                  "cursor-pointer",
                  "hover:bg-gray-100",
                  "hover:text-blue-700",
                  "focus:outline-none",
                  "focus:ring-2",
                  "focus:ring-blue-700",
                  "focus:text-blue-700",
                  i === 0
                    ? "rounded-t-lg"
                    : i === reidleHeaderLinks.length - 1
                    ? "rounded-b-lg"
                    : "",
                ].join(" ")}
              >
                {text}
                {text === "Messages" ? <ReadNotification /> : null}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
