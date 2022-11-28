import Link from "next/link";
import { createElement } from "react";

import classNames from "@calcom/lib/classNames";

export function List(props: JSX.IntrinsicElements["ul"] & { noBorderTreatment?: true }) {
  const { noBorderTreatment, ...rest } = props;
  return (
    <ul
      {...rest}
      className={classNames(
        "sm:mx-0 sm:overflow-hidden",
        !noBorderTreatment && "divide-y divide-neutral-200 rounded-md border border-l border-r ",
        props.className
      )}>
      {props.children}
    </ul>
  );
}

export type ListItemProps = { expanded?: boolean } & ({ href?: never } & JSX.IntrinsicElements["li"]);
export type ListLinkItemProps = {
  href: string;
  heading: string;
  subHeading: string;
  disabled?: boolean;
  actions?: JSX.Element;
} & JSX.IntrinsicElements["li"];

export function ListItem(props: ListItemProps) {
  const { href, expanded, ...passThroughProps } = props;

  const elementType = href ? "a" : "li";

  const element = createElement(
    elementType,
    {
      ...passThroughProps,
      className: classNames(
        "items-center bg-white min-w-0 flex-1 flex border-gray-200",
        expanded ? "my-2 border" : "border -mb-px last:mb-0",
        props.className,
        (props.onClick || href) && "hover:bg-neutral-50"
      ),
    },
    props.children
  );

  return href ? (
    <Link passHref href={href}>
      {element}
    </Link>
  ) : (
    element
  );
}

export function ListLinkItem(props: ListLinkItemProps) {
  const { href, heading = "", children, disabled = false, actions = <div /> } = props;
  let subHeading = props.subHeading;
  if (!subHeading) {
    subHeading = "";
  }
  return (
    <li
      className={classNames(
        "group flex w-full items-center justify-between p-5 hover:bg-neutral-50",
        disabled ? "hover:bg-white" : ""
      )}>
      <Link passHref href={href}>
        <a
          className={classNames(
            "flex-grow truncate text-sm",
            disabled ? "pointer-events-none cursor-not-allowed opacity-30" : ""
          )}>
          <h1 className="text-sm font-semibold leading-none">{heading}</h1>
          <h2 className="min-h-4 mt-2 text-sm font-normal leading-none">
            {subHeading.substring(0, 100)}
            {subHeading.length > 100 && "..."}
          </h2>
          <div className="mt-2">{children}</div>
        </a>
      </Link>
      {actions}
    </li>
  );
}

export function ListItemTitle<TComponent extends keyof JSX.IntrinsicElements = "span">(
  props: JSX.IntrinsicElements[TComponent] & { component?: TComponent }
) {
  const { component = "span", ...passThroughProps } = props;

  return createElement(
    component,
    {
      ...passThroughProps,
      className: classNames("text-sm font-medium text-neutral-900 truncate", props.className),
    },
    props.children
  );
}

export function ListItemText<TComponent extends keyof JSX.IntrinsicElements = "span">(
  props: JSX.IntrinsicElements[TComponent] & { component?: TComponent }
) {
  const { component = "span", ...passThroughProps } = props;

  return createElement(
    component,
    {
      ...passThroughProps,
      className: classNames("text-sm text-gray-500 truncate", props.className),
    },
    props.children
  );
}
