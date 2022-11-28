import prisma from "@calcom/prisma";
import { AppDeclarativeHandler } from "@calcom/types/AppHandler";

import appConfig from "../config.json";

const handler: AppDeclarativeHandler = {
  // Instead of passing appType and slug from here, api/integrations/[..args] should be able to derive and pass these directly to createCredential
  appType: appConfig.type,
  variant: appConfig.variant,
  slug: appConfig.slug,
  supportsMultipleInstalls: false,
  handlerType: "add",
  createCredential: async ({ user, appType, slug }) => {
    return await prisma.credential.create({
      data: {
        type: appType,
        key: {},
        userId: user.id,
        appId: slug,
      },
    });
  },
  redirect: {
    url: "/apps/routing-forms/forms",
  },
};

export default handler;
