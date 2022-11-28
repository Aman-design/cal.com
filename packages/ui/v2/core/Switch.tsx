import { useId } from "@radix-ui/react-id";
import * as Label from "@radix-ui/react-label";
import * as PrimitiveSwitch from "@radix-ui/react-switch";
import React from "react";

import classNames from "@calcom/lib/classNames";

const Switch = (
  props: React.ComponentProps<typeof PrimitiveSwitch.Root> & {
    label?: string;
    thumbProps?: {
      className?: string;
    };
    fitToHeight?: boolean;
  }
) => {
  const { label, ...primitiveProps } = props;
  const id = useId();

  return (
    <div className={classNames("flex h-auto w-auto flex-row items-center", props.fitToHeight && "h-fit")}>
      <PrimitiveSwitch.Root
        className={classNames(
          props.checked ? "bg-gray-900" : "bg-gray-200",
          primitiveProps.disabled ? "cursor-not-allowed" : "hover:bg-gray-300",
          "focus:ring-brand-800 h-5 w-[34px] rounded-full shadow-none",
          props.className
        )}
        {...primitiveProps}>
        <PrimitiveSwitch.Thumb
          id={id}
          // Since we dont support global dark mode - we have to style dark mode components specifically on the instance for now
          // TODO: Remove once we support global dark mode
          className={classNames(
            "block h-[14px] w-[14px] rounded-full bg-white",
            "translate-x-[4px] transition will-change-transform",
            "[&[data-state='checked']]:translate-x-[17px]",
            props.checked && "shadow-inner",
            props.thumbProps?.className
          )}
        />
      </PrimitiveSwitch.Root>
      {label && (
        <Label.Root
          htmlFor={id}
          className={classNames(
            "ml-2 align-text-top text-sm font-medium text-gray-900 ltr:ml-3 rtl:mr-3 dark:text-white",
            primitiveProps.disabled ? "cursor-not-allowed opacity-25" : "cursor-pointer "
          )}>
          {label}
        </Label.Root>
      )}
    </div>
  );
};

export default Switch;
