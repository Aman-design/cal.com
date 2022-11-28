import { classNames } from "@calcom/lib";

export default function VerticalDivider({ className, ...props }: JSX.IntrinsicElements["svg"]) {
  className = classNames(className, "mx-3");
  return (
    <svg
      className={className}
      {...props}
      width="2"
      height="16"
      viewBox="0 0 2 16"
      ry="6"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <rect width="2" height="16" rx="1" fill="#D1D5DB" />
    </svg>
  );
}
