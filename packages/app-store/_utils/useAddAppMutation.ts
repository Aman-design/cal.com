import { useMutation, UseMutationOptions } from "@tanstack/react-query";

import type { IntegrationOAuthCallbackState } from "@calcom/app-store/types";
import { WEBAPP_URL } from "@calcom/lib/constants";
import { App } from "@calcom/types/App";

import getInstalledAppPath from "./getInstalledAppPath";

function gotoUrl(url: string, newTab?: boolean) {
  if (newTab) {
    window.open(url, "_blank");
    return;
  }
  window.location.href = url;
}

type CustomUseMutationOptions =
  | Omit<UseMutationOptions<unknown, unknown, unknown, unknown>, "mutationKey" | "mutationFn" | "onSuccess">
  | undefined;

type UseAddAppMutationOptions = CustomUseMutationOptions & {
  onSuccess: (data: { setupPending: boolean }) => void;
};

function useAddAppMutation(_type: App["type"] | null, options?: UseAddAppMutationOptions) {
  const mutation = useMutation<
    { setupPending: boolean },
    Error,
    { type?: App["type"]; variant?: string; slug?: string; isOmniInstall?: boolean } | ""
  >(async (variables) => {
    let type: string | null | undefined;
    let isOmniInstall;
    if (variables === "") {
      type = _type;
    } else {
      isOmniInstall = variables.isOmniInstall;
      type = variables.type;
    }
    if (type?.endsWith("_other_calendar")) {
      type = type.split("_other_calendar")[0];
    }
    const state: IntegrationOAuthCallbackState = {
      returnTo:
        WEBAPP_URL +
        getInstalledAppPath(
          { variant: variables && variables.variant, slug: variables && variables.slug },
          location.search
        ),
    };
    const stateStr = encodeURIComponent(JSON.stringify(state));
    const searchParams = `?state=${stateStr}`;

    const res = await fetch(`/api/integrations/${type}/add` + searchParams);

    if (!res.ok) {
      const errorBody = await res.json();
      throw new Error(errorBody.message || "Something went wrong");
    }

    const json = await res.json();
    const externalUrl = /https?:\/\//.test(json.url) && !json.url.startsWith(window.location.origin);

    if (!isOmniInstall) {
      gotoUrl(json.url, json.newTab);
    }

    // Skip redirection only if it is an OmniInstall and redirect URL isn't of some other origin
    // This allows installation of apps like Stripe to still redirect to their authentication pages.

    // Check first that the URL is absolute, then check that it is of different origin from the current.
    if (externalUrl) {
      // TODO: For Omni installation to authenticate and come back to the page where installation was initiated, some changes need to be done in all apps' add callbacks
      gotoUrl(json.url, json.newTab);
    }

    return { setupPending: externalUrl || json.url.endsWith("/setup") };
  }, options);

  return mutation;
}

export default useAddAppMutation;
