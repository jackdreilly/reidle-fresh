import { Head } from "$fresh/runtime.ts";
import { ComponentChildren } from "preact";
import { ReidleHead } from "./reidle_template.tsx";
export default function GameTemplate(
  { isPractice, children, title }: {
    isPractice: boolean;
    children?: ComponentChildren;
    title: string;
  },
) {
  title ??= isPractice ? "Practice" : "Play";
  return (
    <html class="h-full">
      <ReidleHead title={title} />
      <body class="h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
