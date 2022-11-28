import { useState } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Badge, getSettingsLayout as getLayout, Loader, Meta, Switch } from "@calcom/ui";

import DisableTwoFactorModal from "@components/settings/DisableTwoFactorModal";
import EnableTwoFactorModal from "@components/settings/EnableTwoFactorModal";

const TwoFactorAuthView = () => {
  const utils = trpc.useContext();

  const { t } = useLocale();
  const { data: user, isLoading } = trpc.viewer.me.useQuery();

  const [enableModalOpen, setEnableModalOpen] = useState(false);
  const [disableModalOpen, setDisableModalOpen] = useState(false);

  if (isLoading) return <Loader />;

  return (
    <>
      <Meta title="Two-Factor Authentication" description="Manage settings for your account passwords" />
      <div className="mt-6 flex items-start space-x-4">
        <Switch
          checked={user?.twoFactorEnabled}
          onCheckedChange={() =>
            user?.twoFactorEnabled ? setDisableModalOpen(true) : setEnableModalOpen(true)
          }
        />
        <div>
          <div className="flex">
            <p className="font-semibold">{t("two_factor_auth")}</p>
            <Badge className="ml-2 text-xs" variant={user?.twoFactorEnabled ? "success" : "gray"}>
              {user?.twoFactorEnabled ? t("enabled") : t("disabled")}
            </Badge>
          </div>
          <p className="text-sm text-gray-600">Add an extra layer of security to your account.</p>
        </div>
      </div>

      <EnableTwoFactorModal
        open={enableModalOpen}
        onOpenChange={() => setEnableModalOpen(!enableModalOpen)}
        onEnable={() => {
          setEnableModalOpen(false);
          utils.viewer.me.invalidate();
        }}
        onCancel={() => {
          setEnableModalOpen(false);
        }}
      />

      <DisableTwoFactorModal
        open={disableModalOpen}
        onOpenChange={() => setDisableModalOpen(!disableModalOpen)}
        onDisable={() => {
          setDisableModalOpen(false);
          utils.viewer.me.invalidate();
        }}
        onCancel={() => {
          setDisableModalOpen(false);
        }}
      />
    </>
  );
};

TwoFactorAuthView.getLayout = getLayout;

export default TwoFactorAuthView;
