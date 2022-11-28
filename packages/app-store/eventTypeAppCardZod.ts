// It's the shared zod for all EventType apps for their data in eventType.metadata.apps
import { z } from "zod";

export const eventTypeAppCardZod = z.object({
  enabled: z.boolean().optional(),
});
