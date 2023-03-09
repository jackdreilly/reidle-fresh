import { ComponentChildren } from "preact";

export default function GameTemplate(
  { children, title }: { children: ComponentChildren; title: string },
) {
  return (
    <html class="h-full m-0 p-0">
      <head>
        <title>{title}</title>
      </head>
      <body class="flex flex-col h-full">
        {children}
      </body>
    </html>
  );
}
