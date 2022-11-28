import * as RadixToggleGroup from "@radix-ui/react-toggle-group";
import { useEffect, useState } from "react";

import { classNames } from "@calcom/lib";

export const ToggleGroupItem = () => <div>hi</div>;

interface ToggleGroupProps extends Omit<RadixToggleGroup.ToggleGroupSingleProps, "type"> {
  options: { value: string; label: string }[];
  isFullWidth?: boolean;
}

export const ToggleGroup = ({ options, onValueChange, isFullWidth, ...props }: ToggleGroupProps) => {
  const [value, setValue] = useState<string | undefined>(props.defaultValue);
  const [activeToggleElement, setActiveToggleElement] = useState<null | HTMLButtonElement>(null);

  useEffect(() => {
    if (value && onValueChange) onValueChange(value);
  }, [value, onValueChange]);

  return (
    <>
      <RadixToggleGroup.Root
        type="single"
        {...props}
        onValueChange={setValue}
        className={classNames(
          "dark:border-darkgray-200 relative inline-flex rounded-md border border-gray-200 p-1",
          props.className,
          isFullWidth && "w-full"
        )}>
        {/* Active toggle. It's a separate element so we can animate it nicely. */}
        <span
          aria-hidden
          className="dark:bg-darkgray-200 absolute top-[4px] bottom-[4px] left-0 z-[0] rounded-[4px] bg-gray-200 transition-all"
          style={{ left: activeToggleElement?.offsetLeft, width: activeToggleElement?.offsetWidth }}
        />
        {options.map((option) => (
          <RadixToggleGroup.Item
            key={option.value}
            value={option.value}
            className={classNames(
              "relative rounded-[4px] px-3 py-1 text-sm dark:text-neutral-200 [&[aria-checked='false']]:hover:font-medium",
              isFullWidth && "w-full"
            )}
            ref={(node) => {
              if (node && value === option.value) {
                setActiveToggleElement(node);
              }
              return node;
            }}>
            {option.label}
          </RadixToggleGroup.Item>
        ))}
      </RadixToggleGroup.Root>
    </>
  );
};
