import { MembershipRole, UserPermissionRole } from "@prisma/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { ComponentProps, useEffect, useState } from "react";

import { classNames } from "@calcom/lib";
import { HOSTED_CAL_FEATURES, WEBAPP_URL } from "@calcom/lib/constants";
import { getPlaceholderAvatar } from "@calcom/lib/defaultAvatarImage";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";

import { Badge, Button, ErrorBoundary, Icon } from "../../..";
import { useMeta } from "../Meta";
import Shell from "../Shell";
import { VerticalTabItemProps } from "../navigation/tabs/VerticalTabItem";
import { VerticalTabItem } from "../navigation/tabs/VerticalTabs";

const tabs: VerticalTabItemProps[] = [
  {
    name: "my_account",
    href: "/settings/my-account",
    icon: Icon.FiUser,
    children: [
      { name: "profile", href: "/settings/my-account/profile" },
      { name: "general", href: "/settings/my-account/general" },
      { name: "calendars", href: "/settings/my-account/calendars" },
      { name: "conferencing", href: "/settings/my-account/conferencing" },
      { name: "appearance", href: "/settings/my-account/appearance" },
      // TODO
      // { name: "referrals", href: "/settings/my-account/referrals" },
    ],
  },
  {
    name: "security",
    href: "/settings/security",
    icon: Icon.FiKey,
    children: [
      { name: "password", href: "/settings/security/password" },
      { name: "2fa_auth", href: "/settings/security/two-factor-auth" },
      { name: "impersonation", href: "/settings/security/impersonation" },
    ],
  },
  {
    name: "billing",
    href: "/settings/billing",
    icon: Icon.FiCreditCard,
    children: [{ name: "manage_billing", href: "/settings/billing" }],
  },
  {
    name: "developer",
    href: "/settings/developer",
    icon: Icon.FiTerminal,
    children: [
      //
      { name: "webhooks", href: "/settings/developer/webhooks" },
      { name: "api_keys", href: "/settings/developer/api-keys" },
      // TODO: Add profile level for embeds
      // { name: "embeds", href: "/v2/settings/developer/embeds" },
    ],
  },
  {
    name: "teams",
    href: "/settings/teams",
    icon: Icon.FiUsers,
    children: [],
  },
  {
    name: "admin",
    href: "/settings/admin",
    icon: Icon.FiLock,
    children: [
      //
      { name: "impersonation", href: "/settings/admin/impersonation" },
      { name: "apps", href: "/settings/admin/apps" },
      { name: "users", href: "/settings/admin/users" },
    ],
  },
];

tabs.find((tab) => {
  // Add "SAML SSO" to the tab
  if (tab.name === "security" && !HOSTED_CAL_FEATURES) {
    tab.children?.push({ name: "saml_config", href: "/settings/security/sso" });
  }
});

// The following keys are assigned to admin only
const adminRequiredKeys = ["admin"];

const useTabs = () => {
  const session = useSession();

  const isAdmin = session.data?.user.role === UserPermissionRole.ADMIN;
  // check if name is in adminRequiredKeys
  return tabs.filter((tab) => {
    if (isAdmin) return true;
    return !adminRequiredKeys.includes(tab.name);
  });
};

const SettingsSidebarContainer = ({ className = "" }) => {
  const { t } = useLocale();
  const tabsWithPermissions = useTabs();
  const [teamMenuState, setTeamMenuState] =
    useState<{ teamId: number | undefined; teamMenuOpen: boolean }[]>();

  const { data: teams } = trpc.viewer.teams.list.useQuery();

  useEffect(() => {
    if (teams) {
      const teamStates = teams?.map((team) => ({ teamId: team.id, teamMenuOpen: false }));
      setTeamMenuState(teamStates);
    }
  }, [teams]);

  return (
    <nav
      className={`no-scrollbar flex w-56 flex-col space-y-1 overflow-scroll py-3 px-2 ${className}`}
      aria-label="Tabs">
      <>
        <div className="desktop-only pt-4" />
        <VerticalTabItem
          name="Back"
          href="/."
          icon={Icon.FiArrowLeft}
          textClassNames="text-md font-medium leading-none text-black"
        />
        {tabsWithPermissions.map((tab) => {
          return tab.name !== "teams" ? (
            <React.Fragment key={tab.href}>
              <div className={`${!tab.children?.length ? "!mb-3" : ""}`}>
                <div className="group flex h-9 w-64 flex-row items-center rounded-md px-3 text-sm font-medium leading-none text-gray-600 hover:bg-gray-100  group-hover:text-gray-700 [&[aria-current='page']]:bg-gray-200 [&[aria-current='page']]:text-gray-900">
                  {tab && tab.icon && (
                    <tab.icon className="mr-[12px] h-[16px] w-[16px] stroke-[2px] md:mt-0" />
                  )}
                  <p className="text-sm font-medium leading-5">{t(tab.name)}</p>
                </div>
              </div>
              <div className="my-3">
                {tab.children?.map((child, index) => (
                  <VerticalTabItem
                    key={child.href}
                    name={t(child.name)}
                    isExternalLink={child.isExternalLink}
                    href={child.href || "/"}
                    textClassNames="px-3 text-gray-900 font-medium text-sm"
                    className={`my-0.5 h-7 ${tab.children && index === tab.children?.length - 1 && "!mb-3"}`}
                    disableChevron
                  />
                ))}
              </div>
            </React.Fragment>
          ) : (
            <React.Fragment key={tab.href}>
              <div className={`${!tab.children?.length ? "mb-3" : ""}`}>
                <Link href={tab.href}>
                  <a>
                    <div className="group flex h-9 w-64 flex-row items-center rounded-md px-3 py-[10px] text-sm font-medium leading-none text-gray-600 hover:bg-gray-100  group-hover:text-gray-700 [&[aria-current='page']]:bg-gray-200 [&[aria-current='page']]:text-gray-900">
                      {tab && tab.icon && (
                        <tab.icon className="mr-[12px] h-[16px] w-[16px] stroke-[2px] md:mt-0" />
                      )}
                      <p className="text-sm font-medium leading-5">{t(tab.name)}</p>
                    </div>
                  </a>
                </Link>
                {teams &&
                  teamMenuState &&
                  teams.map((team, index: number) => {
                    if (teamMenuState.some((teamState) => teamState.teamId === team.id))
                      return (
                        <Collapsible
                          key={team.id}
                          open={teamMenuState[index].teamMenuOpen}
                          onOpenChange={() =>
                            setTeamMenuState([
                              ...teamMenuState,
                              (teamMenuState[index] = {
                                ...teamMenuState[index],
                                teamMenuOpen: !teamMenuState[index].teamMenuOpen,
                              }),
                            ])
                          }>
                          <CollapsibleTrigger>
                            <div
                              className="flex h-9 w-64 flex-row items-center rounded-md px-3 py-[10px] text-sm font-medium leading-none hover:bg-gray-100  group-hover:text-gray-700 [&[aria-current='page']]:bg-gray-200 [&[aria-current='page']]:text-gray-900"
                              onClick={() =>
                                setTeamMenuState([
                                  ...teamMenuState,
                                  (teamMenuState[index] = {
                                    ...teamMenuState[index],
                                    teamMenuOpen: !teamMenuState[index].teamMenuOpen,
                                  }),
                                ])
                              }>
                              <div className="mr-[13px]">
                                {teamMenuState[index].teamMenuOpen ? (
                                  <Icon.FiChevronDown />
                                ) : (
                                  <Icon.FiChevronRight />
                                )}
                              </div>
                              <img
                                src={getPlaceholderAvatar(team.logo, team?.name as string)}
                                className="mr-[8px] h-[16px] w-[16px] self-start rounded-full stroke-[2px] md:mt-0"
                                alt={team.name || "Team logo"}
                              />
                              <p>{team.name}</p>
                              {!team.accepted && (
                                <Badge className="ml-3" variant="orange">
                                  Inv.
                                </Badge>
                              )}
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            {team.accepted && (
                              <VerticalTabItem
                                name={t("profile")}
                                href={`/settings/teams/${team.id}/profile`}
                                textClassNames="px-3 text-gray-900 font-medium text-sm"
                                disableChevron
                              />
                            )}
                            <VerticalTabItem
                              name={t("members")}
                              href={`/settings/teams/${team.id}/members`}
                              textClassNames="px-3 text-gray-900 font-medium text-sm"
                              disableChevron
                            />
                            {(team.role === MembershipRole.OWNER || team.role === MembershipRole.ADMIN) && (
                              <>
                                {/* TODO */}
                                {/* <VerticalTabItem
                              name={t("general")}
                              href={`${WEBAPP_URL}/settings/my-account/appearance`}
                              textClassNames="px-3 text-gray-900 font-medium text-sm"
                              disableChevron
                            /> */}
                                <VerticalTabItem
                                  name={t("appearance")}
                                  href={`/settings/teams/${team.id}/appearance`}
                                  textClassNames="px-3 text-gray-900 font-medium text-sm"
                                  disableChevron
                                />
                                <VerticalTabItem
                                  name={t("billing")}
                                  href={`/settings/teams/${team.id}/billing`}
                                  textClassNames="px-3 text-gray-900 font-medium text-sm"
                                  disableChevron
                                />
                                {HOSTED_CAL_FEATURES && (
                                  <VerticalTabItem
                                    name={t("saml_config")}
                                    href={`/settings/teams/${team.id}/sso`}
                                    textClassNames="px-3 text-gray-900 font-medium text-sm"
                                    disableChevron
                                  />
                                )}
                              </>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                  })}
                <VerticalTabItem
                  name={t("add_a_team")}
                  href={`${WEBAPP_URL}/settings/teams/new`}
                  textClassNames="px-3 text-gray-900 font-medium text-sm"
                  icon={Icon.FiPlus}
                  disableChevron
                />
              </div>
            </React.Fragment>
          );
        })}
      </>
    </nav>
  );
};

const MobileSettingsContainer = (props: { onSideContainerOpen?: () => void }) => {
  const { t } = useLocale();

  return (
    <>
      <nav className="fixed z-20 flex w-full items-center justify-between border-b border-gray-100 bg-gray-50 p-4 sm:relative lg:hidden">
        <div className="flex items-center space-x-3 ">
          <Button StartIcon={Icon.FiMenu} color="minimal" size="icon" onClick={props.onSideContainerOpen} />
          <a href="/" className="flex items-center space-x-2 rounded-md px-3 py-1 hover:bg-gray-200">
            <Icon.FiArrowLeft className="text-gray-700" />
            <p className="font-semibold text-black">{t("settings")}</p>
          </a>
        </div>
      </nav>
    </>
  );
};

export default function SettingsLayout({
  children,
  ...rest
}: { children: React.ReactNode } & ComponentProps<typeof Shell>) {
  const router = useRouter();
  const state = useState(false);
  const [sideContainerOpen, setSideContainerOpen] = state;

  useEffect(() => {
    const closeSideContainer = () => {
      if (window.innerWidth >= 1024) {
        setSideContainerOpen(false);
      }
    };

    window.addEventListener("resize", closeSideContainer);
    return () => {
      window.removeEventListener("resize", closeSideContainer);
    };
  }, []);

  useEffect(() => {
    if (sideContainerOpen) {
      setSideContainerOpen(!sideContainerOpen);
    }
  }, [router.asPath]);

  return (
    <Shell
      flexChildrenContainer
      {...rest}
      SidebarContainer={<SettingsSidebarContainer className="hidden lg:flex" />}
      drawerState={state}
      MobileNavigationContainer={null}
      SettingsSidebarContainer={
        <div
          className={classNames(
            "fixed inset-y-0 z-50 m-0 h-screen w-56 transform overflow-x-hidden overflow-y-scroll border-gray-100 bg-gray-50 transition duration-200 ease-in-out",
            sideContainerOpen ? "translate-x-0" : "-translate-x-full"
          )}>
          <SettingsSidebarContainer />
        </div>
      }
      TopNavContainer={
        <MobileSettingsContainer onSideContainerOpen={() => setSideContainerOpen(!sideContainerOpen)} />
      }>
      <div className="flex flex-1 [&>*]:flex-1">
        <div className="mx-auto max-w-full justify-center md:max-w-3xl">
          <ShellHeader />
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </div>
    </Shell>
  );
}

export const getLayout = (page: React.ReactElement) => <SettingsLayout>{page}</SettingsLayout>;

function ShellHeader() {
  const { meta } = useMeta();
  const { t, isLocaleReady } = useLocale();
  return (
    <header className="mx-auto block justify-between pt-12 sm:flex sm:pt-8">
      <div className="mb-8 flex w-full items-center border-b border-gray-200 pb-8">
        {meta.backButton && (
          <a href="javascript:history.back()">
            <Icon.FiArrowLeft className="mr-7" />
          </a>
        )}
        <div>
          {meta.title && isLocaleReady ? (
            <h1 className="font-cal mb-1 text-xl font-bold tracking-wide text-black">{t(meta.title)}</h1>
          ) : (
            <div className="mb-1 h-6 w-24 animate-pulse rounded-md bg-gray-200" />
          )}
          {meta.description && isLocaleReady ? (
            <p className="text-sm text-gray-600 ltr:mr-4 rtl:ml-4">{t(meta.description)}</p>
          ) : (
            <div className="mb-1 h-6 w-32 animate-pulse rounded-md bg-gray-200" />
          )}
        </div>
        <div className="ml-auto">{meta.CTA}</div>
      </div>
    </header>
  );
}
