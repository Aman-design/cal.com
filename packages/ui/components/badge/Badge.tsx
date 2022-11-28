import { Icon } from "react-feather";
import { GoPrimitiveDot } from "react-icons/go";

import classNames from "@calcom/lib/classNames";

const badgeClassNameByVariant = {
  default: "bg-orange-100 text-orange-800",
  warning: "bg-orange-100 text-orange-800",
  orange: "bg-orange-100 text-orange-800",
  success: "bg-green-100 text-green-800",
  green: "bg-green-100 text-green-800",
  gray: "bg-gray-100 text-gray-800 dark:bg-transparent dark:text-darkgray-800",
  blue: "bg-blue-100 text-blue-800",
  red: "bg-red-100 text-red-800",
  error: "bg-red-100 text-red-800",
};

const classNameBySize = {
  default: "h-5",
  lg: "h-6",
};

export type BadgeProps = {
  variant: keyof typeof badgeClassNameByVariant;
  size?: keyof typeof classNameBySize;
  StartIcon?: Icon;
  bold?: boolean;
  withDot?: boolean;
  rounded?: boolean;
} & JSX.IntrinsicElements["div"];

export const Badge = function Badge(props: BadgeProps) {
  const {
    variant = "default",
    className,
    size = "default",
    rounded,
    StartIcon,
    withDot,
    bold,
    ...passThroughProps
  } = props;
  const hasIconOrDot = StartIcon || withDot;
  return (
    <div
      {...passThroughProps}
      className={classNames(
        "inline-flex items-center justify-center py-0.5 px-[6px] text-xs",
        bold ? "font-semibold" : "font-normal",
        rounded ? "min-w-5 min-h-5 rounded-full pt-1" : "rounded-md",
        !hasIconOrDot ? classNameBySize[size] : "",
        badgeClassNameByVariant[variant],
        className
      )}>
      <>
        {StartIcon && <StartIcon className="mr-1 h-3 w-3 stroke-[3px]" />}
        {withDot && <GoPrimitiveDot className="mr-1 h-3 w-3 stroke-[3px]" />}
        {props.children}
      </>
    </div>
  );
};
