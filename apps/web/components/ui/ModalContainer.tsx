import classNames from "classnames";
import React, { PropsWithChildren } from "react";

import { Dialog, DialogContent } from "@calcom/ui";

export default function ModalContainer(
  props: PropsWithChildren<{
    wide?: boolean;
    scroll?: boolean;
    noPadding?: boolean;
    isOpen: boolean;
    onExit: () => void;
  }>
) {
  return (
    <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
      <Dialog open={props.isOpen} onOpenChange={props.onExit}>
        <DialogContent>
          <div
            className={classNames(
              "inline-block w-full transform bg-white text-left align-bottom transition-all sm:align-middle",
              {
                "sm:w-full sm:max-w-lg ": !props.wide,
                "sm:w-4xl sm:max-w-4xl": props.wide,
                "overflow-auto": props.scroll,
                "!p-0": props.noPadding,
              }
            )}>
            {props.children}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
