import { MembershipRole } from "@prisma/client";
import { useRouter } from "next/router";
import { Controller, useForm } from "react-hook-form";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Button, Form, getSettingsLayout as getLayout, Meta, showToast, Switch } from "@calcom/ui";

interface TeamAppearanceValues {
  hideBranding: boolean;
}

const ProfileView = () => {
  const { t } = useLocale();
  const router = useRouter();
  const utils = trpc.useContext();

  const mutation = trpc.viewer.teams.update.useMutation({
    onError: (err) => {
      showToast(err.message, "error");
    },
    async onSuccess() {
      await utils.viewer.teams.get.invalidate();
      showToast(t("your_team_updated_successfully"), "success");
    },
  });

  const form = useForm<TeamAppearanceValues>();

  const { data: team, isLoading } = trpc.viewer.teams.get.useQuery(
    { teamId: Number(router.query.id) },
    {
      onError: () => {
        router.push("/settings");
      },
      onSuccess: (team) => {
        if (team) {
          form.setValue("hideBranding", team.hideBranding);
        }
      },
    }
  );

  const isAdmin =
    team && (team.membership.role === MembershipRole.OWNER || team.membership.role === MembershipRole.ADMIN);

  return (
    <>
      <Meta title="Booking Appearance" description="Manage settings for your team's booking appearance" />
      {!isLoading && (
        <>
          {isAdmin ? (
            <Form
              form={form}
              handleSubmit={(values) => {
                if (team) {
                  const hideBranding = form.getValues("hideBranding");
                  if (team.hideBranding !== hideBranding) {
                    mutation.mutate({ id: team.id, hideBranding });
                  }
                }
              }}>
              <div className="relative flex items-start">
                <div className="flex-grow text-sm">
                  <label htmlFor="hide-branding" className="font-medium text-gray-700">
                    {t("disable_cal_branding")}
                  </label>
                  <p className="text-gray-500">{t("team_disable_cal_branding_description")}</p>
                </div>
                <div className="flex-none">
                  <Controller
                    control={form.control}
                    name="hideBranding"
                    render={({ field }) => (
                      <Switch
                        defaultChecked={field.value}
                        onCheckedChange={(isChecked) => {
                          form.setValue("hideBranding", isChecked);
                        }}
                      />
                    )}
                  />
                </div>
              </div>
              <Button color="primary" className="mt-8" type="submit" loading={mutation.isLoading}>
                {t("update")}
              </Button>
            </Form>
          ) : (
            <div className="rounded-md border border-gray-200 p-5">
              <span className="text-sm text-gray-600">{t("only_owner_change")}</span>
            </div>
          )}
        </>
      )}
    </>
  );
};

ProfileView.getLayout = getLayout;

export default ProfileView;
