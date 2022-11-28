import type { AppMeta } from "@calcom/types/App";

import config from "./config.json";

export const metadata = {
  category: "analytics",
  ...config,
} as AppMeta;

export default metadata;
