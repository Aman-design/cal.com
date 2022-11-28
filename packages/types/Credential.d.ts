import { Prisma } from ".prisma/client";

/*
 * The logic on this it's just using Credential Type doesn't reflect that some fields can be
 * null sometimes, so with this we should get correct type.
 * Also there may be a better place to save this.
 */
export type CredentialPayload = Prisma.CredentialGetPayload<{
  select: {
    id: true;
    appId: true;
    type: true;
    userId: true;
    key: true;
  };
}>;

export type CredentialWithAppName = CredentialPayload & { appName: string };
