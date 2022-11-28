import { Dispatch, SetStateAction } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { HttpError } from "@calcom/lib/http-error";
import { trpc } from "@calcom/trpc/react";
import { ConfirmationDialogContent, Dialog, showToast } from "@calcom/ui";

interface IDeleteDialog {
  isOpenDialog: boolean;
  setIsOpenDialog: Dispatch<SetStateAction<boolean>>;
  workflowId: number;
  additionalFunction: () => Promise<boolean | void>;
}

export const DeleteDialog = (props: IDeleteDialog) => {
  const { t } = useLocale();
  const { isOpenDialog, setIsOpenDialog, workflowId, additionalFunction } = props;
  const utils = trpc.useContext();

  const deleteMutation = trpc.viewer.workflows.delete.useMutation({
    onSuccess: async () => {
      await utils.viewer.workflows.list.invalidate();
      additionalFunction();
      showToast(t("workflow_deleted_successfully"), "success");
      setIsOpenDialog(false);
    },
    onError: (err) => {
      if (err instanceof HttpError) {
        const message = `${err.statusCode}: ${err.message}`;
        showToast(message, "error");
        setIsOpenDialog(false);
      }
    },
  });

  return (
    <Dialog open={isOpenDialog} onOpenChange={setIsOpenDialog}>
      <ConfirmationDialogContent
        isLoading={deleteMutation.isLoading}
        variety="danger"
        title={t("delete_workflow")}
        confirmBtnText={t("confirm_delete_workflow")}
        loadingText={t("confirm_delete_workflow")}
        onConfirm={(e) => {
          e.preventDefault();
          deleteMutation.mutate({ id: workflowId });
        }}>
        {t("delete_workflow_description")}
      </ConfirmationDialogContent>
    </Dialog>
  );
};
