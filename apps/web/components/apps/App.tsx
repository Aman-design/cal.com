import Link from "next/link";
import { useRouter } from "next/router";
import React, { useState } from "react";

import useAddAppMutation from "@calcom/app-store/_utils/useAddAppMutation";
import { InstallAppButton } from "@calcom/app-store/components";
import LicenseRequired from "@calcom/features/ee/common/components/v2/LicenseRequired";
import classNames from "@calcom/lib/classNames";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { App as AppType } from "@calcom/types/App";
import {
  Button,
  DisconnectIntegration,
  Icon,
  Shell,
  showToast,
  SkeletonButton,
  SkeletonText,
} from "@calcom/ui";

import HeadSeo from "@components/seo/head-seo";

const Component = ({
  name,
  type,
  logo,
  slug,
  variant,
  body,
  categories,
  author,
  price = 0,
  commission,
  isGlobal = false,
  feeType,
  docs,
  website,
  email,
  tos,
  privacy,
  isProOnly,
  images,
}: Parameters<typeof App>[0]) => {
  const { t } = useLocale();
  const hasImages = images && images.length > 0;
  const router = useRouter();

  const mutation = useAddAppMutation(null, {
    onSuccess: (data) => {
      if (data.setupPending) return;
      showToast(t("app_successfully_installed"), "success");
    },
    onError: (error) => {
      if (error instanceof Error) showToast(error.message || t("app_could_not_be_installed"), "error");
    },
  });

  const priceInDollar = Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    useGrouping: false,
  }).format(price);

  const [existingCredentials, setExistingCredentials] = useState<number[]>([]);
  const appCredentials = trpc.viewer.appCredentialsByType.useQuery(
    { appType: type },
    {
      onSuccess(data) {
        setExistingCredentials(data);
      },
    }
  );

  const allowedMultipleInstalls = categories.indexOf("calendar") > -1;

  return (
    <div className="relative flex-1 flex-col items-start justify-start px-4 md:flex md:px-8 lg:flex-row lg:px-0">
      {hasImages && (
        <div className="align-center mb-4 -ml-4 -mr-4 flex min-h-[450px] w-auto basis-3/5 snap-x snap-mandatory flex-row overflow-auto whitespace-nowrap bg-gray-100 p-4  md:mb-8 md:-ml-8 md:-mr-8 md:p-8 lg:mx-0 lg:mb-0 lg:max-w-2xl lg:flex-col lg:justify-center lg:rounded-md">
          {images ? (
            images.map((img) => (
              <img
                key={img}
                src={img}
                alt={`Screenshot of app ${name}`}
                className="mr-4 h-auto max-h-80 max-w-[90%] snap-center rounded-md object-contain last:mb-0 md:max-h-min lg:mb-4 lg:mr-0  lg:max-w-full"
              />
            ))
          ) : (
            <SkeletonText />
          )}
        </div>
      )}
      <div
        className={classNames(
          "sticky top-0 -mt-4 max-w-xl basis-2/5 pb-12 text-sm lg:pb-0",
          hasImages && "lg:ml-8"
        )}>
        <div className="mb-8 flex pt-4">
          <header>
            <div className="mb-4 flex items-center">
              <img className="min-h-16 min-w-16 h-16 w-16" src={logo} alt={name} />
              <h1 className="font-cal ml-4 text-3xl text-gray-900">{name}</h1>
            </div>
            <h2 className="text-sm font-medium text-gray-600">
              <Link href={`categories/${categories[0]}`}>
                <a className="rounded-md bg-gray-100 p-1 text-xs capitalize text-gray-800">{categories[0]}</a>
              </Link>{" "}
              • {t("published_by", { author })}
            </h2>
          </header>
        </div>
        {!appCredentials.isLoading ? (
          isGlobal ||
          (existingCredentials.length > 0 && allowedMultipleInstalls ? (
            <div className="flex space-x-3">
              <Button StartIcon={Icon.FiCheck} color="secondary" disabled>
                {existingCredentials.length > 0
                  ? t("active_install", { count: existingCredentials.length })
                  : t("default")}
              </Button>
              {!isGlobal && (
                <InstallAppButton
                  type={type}
                  isProOnly={isProOnly}
                  render={({ useDefaultComponent, ...props }) => {
                    if (useDefaultComponent) {
                      props = {
                        ...props,
                        onClick: () => {
                          mutation.mutate({ type, variant, slug });
                        },
                        loading: mutation.isLoading,
                      };
                    }
                    return (
                      <Button
                        StartIcon={Icon.FiPlus}
                        {...props}
                        // @TODO: Overriding color and size prevent us from
                        // having to duplicate InstallAppButton for now.
                        color="primary"
                        size="base"
                        data-testid="install-app-button">
                        {t("install_another")}
                      </Button>
                    );
                  }}
                />
              )}
            </div>
          ) : existingCredentials.length > 0 ? (
            <DisconnectIntegration
              buttonProps={{ color: "secondary" }}
              label={t("disconnect")}
              credentialId={existingCredentials[0]}
              onSuccess={() => {
                router.replace("/apps/installed");
              }}
            />
          ) : (
            <InstallAppButton
              type={type}
              isProOnly={isProOnly}
              render={({ useDefaultComponent, ...props }) => {
                if (useDefaultComponent) {
                  props = {
                    ...props,
                    onClick: () => {
                      mutation.mutate({ type, variant, slug });
                    },
                    loading: mutation.isLoading,
                  };
                }
                return (
                  <Button
                    data-testid="install-app-button"
                    {...props}
                    // @TODO: Overriding color and size prevent us from
                    // having to duplicate InstallAppButton for now.
                    color="primary"
                    size="base">
                    {t("install_app")}
                  </Button>
                );
              }}
            />
          ))
        ) : (
          <SkeletonButton className="h-10 w-24" />
        )}
        {price !== 0 && (
          <span className="block text-right">
            {feeType === "usage-based" ? commission + "% + " + priceInDollar + "/booking" : priceInDollar}
            {feeType === "monthly" && "/" + t("month")}
          </span>
        )}

        <div className="prose prose-sm mt-8">{body}</div>
        <h4 className="mt-8 font-semibold text-gray-900 ">{t("pricing")}</h4>
        <span>
          {price === 0 ? (
            "Free"
          ) : (
            <>
              {Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                useGrouping: false,
              }).format(price)}
              {feeType === "monthly" && "/" + t("month")}
            </>
          )}
        </span>

        <h4 className="mt-8 mb-2 font-semibold text-gray-900 ">{t("learn_more")}</h4>
        <ul className="prose-sm -ml-1 -mr-1 leading-5">
          {docs && (
            <li>
              <a
                target="_blank"
                rel="noreferrer"
                className="text-sm font-normal text-black no-underline hover:underline"
                href={docs}>
                <Icon.FiBookOpen className="mr-1 -mt-1 inline h-4 w-4 text-gray-500" />
                {t("documentation")}
              </a>
            </li>
          )}
          {website && (
            <li>
              <a
                target="_blank"
                rel="noreferrer"
                className="font-normal text-black no-underline hover:underline"
                href={website}>
                <Icon.FiExternalLink className="mr-1 -mt-px inline h-4 w-4 text-gray-500" />
                {website.replace("https://", "")}
              </a>
            </li>
          )}
          {email && (
            <li>
              <a
                target="_blank"
                rel="noreferrer"
                className="font-normal text-black no-underline hover:underline"
                href={"mailto:" + email}>
                <Icon.FiMail className="mr-1 -mt-px inline h-4 w-4 text-gray-500" />

                {email}
              </a>
            </li>
          )}
          {tos && (
            <li>
              <a
                target="_blank"
                rel="noreferrer"
                className="font-normal text-black no-underline hover:underline"
                href={tos}>
                <Icon.FiFile className="mr-1 -mt-px inline h-4 w-4 text-gray-500" />
                {t("terms_of_service")}
              </a>
            </li>
          )}
          {privacy && (
            <li>
              <a
                target="_blank"
                rel="noreferrer"
                className="font-normal text-black no-underline hover:underline"
                href={privacy}>
                <Icon.FiShield className="mr-1 -mt-px inline h-4 w-4 text-gray-500" />
                {t("privacy_policy")}
              </a>
            </li>
          )}
        </ul>
        <hr className="my-8" />
        <span className="leading-1 block text-xs text-gray-500">{t("every_app_published")}</span>
        <a className="mt-2 block text-xs text-red-500" href="mailto:help@cal.com">
          <Icon.FiFlag className="inline h-3 w-3" /> {t("report_app")}
        </a>
      </div>
    </div>
  );
};

export default function App(props: {
  name: string;
  description: AppType["description"];
  type: AppType["type"];
  isGlobal?: AppType["isGlobal"];
  logo: string;
  slug: string;
  variant: string;
  body: React.ReactNode;
  categories: string[];
  author: string;
  pro?: boolean;
  price?: number;
  commission?: number;
  feeType?: AppType["feeType"];
  docs?: string;
  website?: string;
  email: string; // required
  tos?: string;
  privacy?: string;
  licenseRequired: AppType["licenseRequired"];
  isProOnly: AppType["isProOnly"];
  images?: string[];
}) {
  const { t } = useLocale();

  return (
    <Shell large isPublic heading={t("app_store")} backPath="/apps" withoutSeo>
      <HeadSeo
        title={props.name}
        description={props.description}
        app={{ slug: props.logo, name: props.name, description: props.description }}
        nextSeoProps={{
          nofollow: true,
          noindex: true,
        }}
      />
      {props.licenseRequired ? (
        <LicenseRequired>
          <Component {...props} />
        </LicenseRequired>
      ) : (
        <Component {...props} />
      )}
    </Shell>
  );
}
