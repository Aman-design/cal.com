import type { Credential } from "@prisma/client";
import { useRouter } from "next/router";

import useAddAppMutation from "@calcom/app-store/_utils/useAddAppMutation";
import { InstallAppButton } from "@calcom/app-store/components";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { App } from "@calcom/types/App";

import { Button, Icon } from "../../..";
import { showToast } from "../notifications";

interface AppCardProps {
  app: App;
  credentials?: Credential[];
}

export default function AppCard({ app, credentials }: AppCardProps) {
  const { t } = useLocale();
  const router = useRouter();
  const mutation = useAddAppMutation(null, {
    onSuccess: (data) => {
      // Refresh SSR page content without actual reload
      router.replace(router.asPath);
      if (data.setupPending) return;
      showToast(t("app_successfully_installed"), "success");
    },
    onError: (error) => {
      if (error instanceof Error) showToast(error.message || t("app_could_not_be_installed"), "error");
    },
  });

  const allowedMultipleInstalls = app.categories && app.categories.indexOf("calendar") > -1;
  const appAdded = (credentials && credentials.length) || 0;

  return (
    <div className="relative flex h-64 flex-col rounded-md border border-gray-300 p-5">
      <div className="flex">
        <img src={app.logo} alt={app.name + " Logo"} className="mb-4 h-12 w-12 rounded-sm" />
      </div>
      <div className="flex items-center">
        <h3 className="font-medium">{app.name}</h3>
      </div>
      {/* TODO: add reviews <div className="flex text-sm text-gray-800">
          <span>{props.rating} stars</span> <StarIcon className="ml-1 mt-0.5 h-4 w-4 text-yellow-600" />
          <span className="pl-1 text-gray-500">{props.reviews} reviews</span>
        </div> */}
      <p
        className="mt-2 flex-grow text-sm text-gray-500"
        style={{
          overflow: "hidden",
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: "3",
        }}>
        {app.description}
      </p>
      <div className="mt-5 flex max-w-full flex-row justify-between gap-2">
        <Button
          color="secondary"
          className="flex w-32 flex-grow justify-center"
          href={`/apps/${app.slug}`}
          data-testid={`app-store-app-card-${app.slug}`}>
          {t("details")}
        </Button>
        {app.isGlobal || (credentials && credentials.length > 0 && allowedMultipleInstalls)
          ? !app.isGlobal && (
              <InstallAppButton
                type={app.type}
                isProOnly={app.isProOnly}
                wrapperClassName="[@media(max-width:260px)]:w-full"
                render={({ useDefaultComponent, ...props }) => {
                  if (useDefaultComponent) {
                    props = {
                      ...props,
                      onClick: () => {
                        mutation.mutate({ type: app.type, variant: app.variant, slug: app.slug });
                      },
                    };
                  }
                  return (
                    <Button
                      color="secondary"
                      className="[@media(max-width:260px)]:w-full [@media(max-width:260px)]:justify-center"
                      StartIcon={Icon.FiPlus}
                      {...props}>
                      {t("install")}
                    </Button>
                  );
                }}
              />
            )
          : credentials &&
            credentials.length === 0 && (
              <InstallAppButton
                type={app.type}
                isProOnly={app.isProOnly}
                wrapperClassName="[@media(max-width:260px)]:w-full"
                render={({ useDefaultComponent, ...props }) => {
                  if (useDefaultComponent) {
                    props = {
                      ...props,
                      onClick: () => {
                        mutation.mutate({ type: app.type, variant: app.variant, slug: app.slug });
                      },
                    };
                  }
                  props.color;
                  //     ^?
                  return (
                    <Button
                      StartIcon={Icon.FiPlus}
                      color="secondary"
                      className="[@media(max-width:260px)]:w-full [@media(max-width:260px)]:justify-center"
                      data-testid="install-app-button"
                      {...props}>
                      {t("install")}
                    </Button>
                  );
                }}
              />
            )}
      </div>
      <div className="max-w-44 absolute right-0 mr-4 flex flex-wrap justify-end gap-1">
        {appAdded > 0 && (
          <span className="rounded-md bg-green-100 px-2 py-1 text-sm font-normal text-green-800">
            {t("installed", { count: appAdded })}
          </span>
        )}
        {app.isGlobal && (
          <span className="flex items-center rounded-md bg-gray-100 px-2 py-1 text-sm font-normal text-gray-800">
            {t("default")}
          </span>
        )}
      </div>
    </div>
  );
}
