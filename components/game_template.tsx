import { Head } from "$fresh/runtime.ts";
import { ComponentChildren } from "preact";
import ReidleTemplate, { ReidleHead } from "./reidle_template.tsx";
export default function GameTemplate(
  { isPractice, children, title }: {
    isPractice: boolean;
    children?: ComponentChildren;
    title: string;
  },
) {
  title ??= isPractice ? "Practice" : "Play";
  return <ReidleTemplate fullPage title={title}>{children}</ReidleTemplate>;
}
