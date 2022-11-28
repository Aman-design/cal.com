import { MembershipRole } from "@prisma/client";

import classNames from "@calcom/lib/classNames";
import { getPlaceholderAvatar } from "@calcom/lib/getPlaceholderAvatar";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import {
  Avatar,
  Button,
  Dropdown,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
} from "@calcom/ui";

interface Props {
  team: {
    id?: number;
    name?: string | null;
    slug?: string | null;
    logo?: string | null;
    bio?: string | null;
    hideBranding?: boolean | undefined;
    role: MembershipRole;
    accepted: boolean;
  };
  key: number;
  onActionSelect: (text: string) => void;
  isLoading?: boolean;
  hideDropdown: boolean;
  setHideDropdown: (value: boolean) => void;
}

export default function TeamInviteListItem(props: Props) {
  const { t } = useLocale();
  const utils = trpc.useContext();
  const team = props.team;

  const acceptOrLeaveMutation = trpc.viewer.teams.acceptOrLeave.useMutation({
    onSuccess: async () => {
      await utils.viewer.teams.get.invalidate();
      await utils.viewer.teams.list.invalidate();
    },
  });

  function acceptOrLeave(accept: boolean) {
    acceptOrLeaveMutation.mutate({
      teamId: team?.id as number,
      accept,
    });
  }

  const acceptInvite = () => acceptOrLeave(true);
  const declineInvite = () => acceptOrLeave(false);

  const isInvitee = !props.team.accepted;

  if (!team) return <></>;

  const teamInfo = (
    <div className="flex">
      <Avatar
        size="mdLg"
        imageSrc={getPlaceholderAvatar(team?.logo, team?.name as string)}
        alt="Team Logo"
        className=""
      />
      <div className="ml-3 inline-block">
        <span className="text-sm font-semibold text-black">{team.name}</span>
        <span className="block text-sm leading-5 text-gray-700">
          {t("invited_by_team", { teamName: team.name, role: t(team.role.toLocaleLowerCase()) })}
        </span>
      </div>
    </div>
  );

  return (
    <li className="divide-y rounded-md border border-gray-400 bg-gray-100 px-5 py-4">
      <div
        className={classNames(
          "flex items-center  justify-between",
          !isInvitee && "group hover:bg-neutral-50"
        )}>
        {teamInfo}
        <div>
          <>
            <div className="hidden sm:flex">
              <Button
                type="button"
                className="mr-3 border-gray-700"
                size="icon"
                color="secondary"
                onClick={declineInvite}
                StartIcon={Icon.FiSlash}
              />
              <Button
                type="button"
                className="border-gray-700"
                size="icon"
                color="secondary"
                onClick={acceptInvite}
                StartIcon={Icon.FiCheck}
              />
            </div>
            <div className="block sm:hidden">
              <Dropdown>
                <DropdownMenuTrigger asChild>
                  <Button type="button" color="minimal" size="icon" StartIcon={Icon.FiMoreHorizontal} />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>
                    <Button
                      color="destructive"
                      className="w-full rounded-none font-medium"
                      StartIcon={Icon.FiCheck}
                      onClick={acceptInvite}>
                      {t("accept")}
                    </Button>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Button
                      color="destructive"
                      className="w-full rounded-none font-medium"
                      StartIcon={Icon.FiX}
                      onClick={declineInvite}>
                      {t("reject")}
                    </Button>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </Dropdown>
            </div>
          </>
        </div>
      </div>
    </li>
  );
}
