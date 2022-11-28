import classNames from "classnames";
import React, { useState } from "react";
import { ControllerRenderProps } from "react-hook-form";

import { Icon } from "@calcom/ui";

const EditableHeading = function EditableHeading({
  value,
  onChange,
  isReady,
  ...passThroughProps
}: {
  isReady?: boolean;
} & Omit<JSX.IntrinsicElements["input"], "name" | "onChange"> &
  ControllerRenderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const enableEditing = () => setIsEditing(true);
  return (
    <div className="group relative cursor-pointer" onClick={enableEditing}>
      <div className="flex items-center">
        <label className="min-w-8 relative inline-block">
          <span className="whitespace-pre text-xl tracking-normal text-transparent">{value}&nbsp;</span>
          {!isEditing && isReady && (
            <Icon.FiEdit2 className="ml-1 inline h-4 w-4 align-top text-gray-700 group-hover:text-gray-500" />
          )}
          <input
            {...passThroughProps}
            type="text"
            value={value}
            required
            className={classNames(
              "absolute top-0 left-0 w-full cursor-pointer border-none bg-transparent p-0 align-top text-xl text-gray-900 hover:text-gray-700 focus:text-black focus:outline-none focus:ring-0"
            )}
            onFocus={(e) => {
              setIsEditing(true);
              passThroughProps.onFocus && passThroughProps.onFocus(e);
            }}
            onBlur={(e) => {
              setIsEditing(false);
              passThroughProps.onBlur && passThroughProps.onBlur(e);
            }}
            onChange={(e) => onChange && onChange(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
};

export default EditableHeading;
