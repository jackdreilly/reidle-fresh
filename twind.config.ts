import { Options } from "$fresh/plugins/twind.ts";

export default {
  selfURL: import.meta.url,
  theme: {
    extend: {
      screens: {
        "sm": "370px",
      },
    },
  },
} as Options;
