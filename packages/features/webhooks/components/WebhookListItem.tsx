import classNames from "@calcom/lib/classNames";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { RouterOutputs, trpc } from "@calcom/trpc/react";
import { Badge, Button, Icon, showToast, Switch, Tooltip } from "@calcom/ui";

export type TWebhook = RouterOutputs["viewer"]["webhook"]["list"][number];

export default function WebhookListItem(props: {
  webhook: TWebhook;
  onEditWebhook: () => void;
  lastItem: boolean;
}) {
  const { t } = useLocale();
  const utils = trpc.useContext();
  const { webhook } = props;
  const deleteWebhook = trpc.viewer.webhook.delete.useMutation({
    async onSuccess() {
      await utils.viewer.webhook.list.invalidate();
      showToast(t("webhook_removed_successfully"), "success");
    },
  });
  const toggleWebhook = trpc.viewer.webhook.edit.useMutation({
    async onSuccess(data) {
      console.log("data", data);
      await utils.viewer.webhook.list.invalidate();
      // TODO: Better success message
      showToast(t(data?.active ? "enabled" : "disabled"), "success");
    },
  });

  return (
    <div className={classNames("flex w-full justify-between p-4", props.lastItem ? "" : "border-b")}>
      <div>
        <p className="text-sm font-medium text-gray-900">{webhook.subscriberUrl}</p>
        <Tooltip content={t("triggers_when")}>
          <div className="mt-2.5 w-4/5">
            {webhook.eventTriggers.map((trigger) => (
              <Badge key={trigger} className="mr-2" variant="gray" bold StartIcon={Icon.FiAlertCircle}>
                {t(`${trigger.toLowerCase()}`)}
              </Badge>
            ))}
          </div>
        </Tooltip>
      </div>
      <div className="flex items-center space-x-4">
        <Switch
          defaultChecked={webhook.active}
          onCheckedChange={() =>
            toggleWebhook.mutate({
              id: webhook.id,
              active: !webhook.active,
              payloadTemplate: webhook.payloadTemplate,
            })
          }
        />
        <Button color="secondary" onClick={props.onEditWebhook}>
          {t("edit")}
        </Button>
        <Button
          color="destructive"
          StartIcon={Icon.FiTrash}
          size="icon"
          onClick={() => {
            // TODO: Confimation dialog before deleting
            deleteWebhook.mutate({ id: webhook.id });
          }}
        />
      </div>
    </div>
  );
}
