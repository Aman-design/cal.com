import { useId } from "@radix-ui/react-id";
import { Root as ToggleGroupPrimitive, Item as ToggleGroupItemPrimitive } from "@radix-ui/react-toggle-group";
import { useState } from "react";

import classNames from "@calcom/lib/classNames";
import { useLocale } from "@calcom/lib/hooks/useLocale";

import { Label } from "../../../components/form/inputs/Label";

const boolean = (yesNo: "yes" | "no") => (yesNo === "yes" ? true : yesNo === "no" ? false : undefined);
const yesNo = (boolean?: boolean) => (boolean === true ? "yes" : boolean === false ? "no" : undefined);

export const BooleanToggleGroup = function BooleanToggleGroup({
  defaultValue = true,
  value,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onValueChange = () => {},
}: {
  defaultValue?: boolean;
  value?: boolean;
  onValueChange?: (value?: boolean) => void;
}) {
  // Maintain a state because it is not necessary that onValueChange the parent component would re-render. Think react-hook-form
  // Also maintain a string as boolean isn't accepted as ToggleGroupPrimitive value
  const [yesNoValue, setYesNoValue] = useState<"yes" | "no" | undefined>(yesNo(value));

  if (!yesNoValue) {
    setYesNoValue(yesNo(defaultValue));
    onValueChange(defaultValue);
    return null;
  }
  const commonClass =
    "mb-2 inline-flex items-center justify-center rounded-md py-[10px] px-4 text-sm font-medium  leading-4 md:mb-0";
  const selectedClass = classNames(commonClass, "bg-gray-200  text-gray-900");
  const unselectedClass = classNames(commonClass, "text-gray-600 hover:bg-gray-100 hover:text-gray-900");
  return (
    <ToggleGroupPrimitive
      value={yesNoValue}
      type="single"
      className="space-x-2 rounded-sm"
      onValueChange={(yesNoValue: "yes" | "no") => {
        setYesNoValue(yesNoValue);
        onValueChange(boolean(yesNoValue));
      }}>
      <ToggleGroupItemPrimitive
        className={classNames(boolean(yesNoValue) ? selectedClass : unselectedClass)}
        value="yes">
        Yes
      </ToggleGroupItemPrimitive>
      <ToggleGroupItemPrimitive
        className={classNames(!boolean(yesNoValue) ? selectedClass : unselectedClass)}
        value="no">
        No
      </ToggleGroupItemPrimitive>
    </ToggleGroupPrimitive>
  );
};

export const BooleanToggleGroupField = function BooleanToggleGroupField(
  props: Parameters<typeof BooleanToggleGroup>[0] & {
    label?: string;
    containerClassName?: string;
    name?: string;
    labelProps?: React.ComponentProps<typeof Label>;
    className?: string;
    error?: string;
  }
) {
  const { t } = useLocale();
  const { label = t(props.name || ""), containerClassName, labelProps, className, ...passThrough } = props;
  const id = useId();
  return (
    <div className={classNames(containerClassName)}>
      <div className={className}>
        {!!label && (
          <Label htmlFor={id} {...labelProps} className={classNames(props.error && "text-red-900", "mt-4")}>
            {label}
          </Label>
        )}
      </div>
      <BooleanToggleGroup {...passThrough} />
    </div>
  );
};
