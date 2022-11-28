import { useAutoAnimate } from "@formkit/auto-animate/react";
import Link from "next/link";

import { RouterOutputs } from "@calcom/trpc/react";
import { Switch } from "@calcom/ui";

import { SetAppDataGeneric } from "../EventTypeAppContext";
import { eventTypeAppCardZod } from "../eventTypeAppCardZod";
import OmniInstallAppButton from "./OmniInstallAppButton";

export default function AppCard({
  app,
  description,
  switchOnClick,
  switchChecked,
  children,
  setAppData,
}: {
  app: RouterOutputs["viewer"]["apps"][number];
  description?: React.ReactNode;
  switchChecked?: boolean;
  switchOnClick?: (e: boolean) => void;
  children?: React.ReactNode;
  setAppData: SetAppDataGeneric<typeof eventTypeAppCardZod>;
}) {
  const [animationRef] = useAutoAnimate<HTMLDivElement>();

  return (
    <div className="mb-4 mt-2 rounded-md border border-gray-200">
      <div className="p-4 text-sm sm:p-8">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:gap-0">
          {/* Don't know why but w-[42px] isn't working, started happening when I started using next/dynamic */}
          <Link href={"/apps/" + app.slug}>
            <a className="mr-3 h-auto w-10 rounded-sm">
              <img className="w-full" src={app?.logo} alt={app?.name} />
            </a>
          </Link>
          <div className="flex flex-col">
            <span className="text-base font-semibold leading-4 text-black">{app?.name}</span>
            <p className="pt-2 text-sm font-normal leading-4 text-gray-600">
              {description || app?.description}
            </p>
          </div>
          {app?.isInstalled ? (
            <div className="ml-auto flex items-center">
              <Switch
                onCheckedChange={(enabled) => {
                  if (switchOnClick) {
                    switchOnClick(enabled);
                  }
                  setAppData("enabled", enabled);
                }}
                checked={switchChecked}
              />
            </div>
          ) : (
            <OmniInstallAppButton className="ml-auto flex items-center" appId={app?.slug} />
          )}
        </div>
      </div>
      <div ref={animationRef}>
        {app?.isInstalled && switchChecked && <hr />}
        {app?.isInstalled && switchChecked ? <div className="p-4 text-sm sm:px-8">{children}</div> : null}
      </div>
    </div>
  );
}
