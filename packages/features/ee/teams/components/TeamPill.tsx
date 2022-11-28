import { MembershipRole } from "@prisma/client";
import classNames from "classnames";

import { useLocale } from "@calcom/lib/hooks/useLocale";

type PillColor = "blue" | "green" | "red" | "orange";

interface Props {
  text: string;
  color?: PillColor;
}

export default function TeamPill(props: Props) {
  return (
    <div
      className={classNames("text-medium self-center rounded-md px-1 py-0.5 text-xs ltr:mr-1 rtl:ml-1", {
        " bg-gray-100 text-gray-800": !props.color,
        " bg-blue-100 text-blue-800": props.color === "blue",
        " bg-red-100 text-red-800 ": props.color === "red",
        " bg-orange-100 text-orange-800": props.color === "orange",
      })}>
      {props.text}
    </div>
  );
}

export function TeamRole(props: { role: MembershipRole }) {
  const { t } = useLocale();
  const keys: Record<MembershipRole, PillColor | undefined> = {
    [MembershipRole.OWNER]: "blue",
    [MembershipRole.ADMIN]: "red",
    [MembershipRole.MEMBER]: undefined,
  };
  return <TeamPill text={t(props.role.toLowerCase())} color={keys[props.role]} />;
}
