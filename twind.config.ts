import { Options } from "$fresh/plugins/twind.ts";

export default {
  selfURL: import.meta.url,
  theme: {
    extend: {
      screens: {
        "sm": { "raw": "(min-height: 800px)" },
      },
    },
  },
} as Options;
