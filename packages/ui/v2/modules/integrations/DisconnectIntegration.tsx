import { useState } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";

import { Button, ButtonProps, Dialog, DialogContent, DialogTrigger, Icon, showToast } from "../../..";

export default function DisconnectIntegration({
  credentialId,
  label,
  trashIcon,
  isGlobal,
  onSuccess,
  buttonProps,
}: {
  credentialId: number;
  label?: string;
  trashIcon?: boolean;
  isGlobal?: boolean;
  onSuccess?: () => void;
  buttonProps?: ButtonProps;
}) {
  const { t } = useLocale();
  const [modalOpen, setModalOpen] = useState(false);

  const mutation = trpc.viewer.deleteCredential.useMutation({
    onSuccess: () => {
      showToast(t("app_removed_successfully"), "success");
      setModalOpen(false);
      onSuccess && onSuccess();
    },
    onError: () => {
      showToast(t("error_removing_app"), "error");
      setModalOpen(false);
    },
  });

  return (
    <>
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogTrigger asChild>
          <Button
            color={buttonProps?.color || "destructive"}
            StartIcon={trashIcon ? Icon.FiTrash : undefined}
            size={trashIcon && !label ? "icon" : "base"}
            disabled={isGlobal}
            {...buttonProps}>
            {label && label}
          </Button>
        </DialogTrigger>
        <DialogContent
          title={t("remove_app")}
          description={t("are_you_sure_you_want_to_remove_this_app")}
          type="confirmation"
          actionText={t("yes_remove_app")}
          Icon={Icon.FiAlertCircle}
          actionOnClick={() => mutation.mutate({ id: credentialId })}
        />
      </Dialog>
    </>
  );
}
