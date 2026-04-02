import { createApp } from "./_bundle.mjs";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const app = createApp();

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}
