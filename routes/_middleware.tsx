import { connectionMiddleware } from "@/utils/db.ts";
import { sessionMiddleware } from "@/utils/session.ts";

export const handler = [
  sessionMiddleware,
  connectionMiddleware,
];
