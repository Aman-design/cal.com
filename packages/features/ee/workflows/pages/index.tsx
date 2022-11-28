import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { HttpError } from "@calcom/lib/http-error";
import { trpc } from "@calcom/trpc/react";
import { Button, Icon, Shell, showToast } from "@calcom/ui";

import LicenseRequired from "../../common/components/v2/LicenseRequired";
import SkeletonLoader from "../components/SkeletonLoaderList";
import WorkflowList from "../components/WorkflowListPage";

function WorkflowsPage() {
  const { t } = useLocale();

  const session = useSession();
  const router = useRouter();

  const { data, isLoading } = trpc.viewer.workflows.list.useQuery();

  const createMutation = trpc.viewer.workflows.createV2.useMutation({
    onSuccess: async ({ workflow }) => {
      await router.replace("/workflows/" + workflow.id);
    },
    onError: (err) => {
      if (err instanceof HttpError) {
        const message = `${err.statusCode}: ${err.message}`;
        showToast(message, "error");
      }

      if (err.data?.code === "UNAUTHORIZED") {
        const message = `${err.data.code}: You are not able to create this workflow`;
        showToast(message, "error");
      }
    },
  });

  return session.data ? (
    <Shell
      heading={data?.workflows.length ? t("workflows") : undefined}
      title={t("workflows")}
      subtitle={data?.workflows.length ? t("workflows_to_automate_notifications") : ""}
      CTA={
        session.data?.hasValidLicense && data?.workflows && data?.workflows.length > 0 ? (
          <Button
            StartIcon={Icon.FiPlus}
            onClick={() => createMutation.mutate()}
            loading={createMutation.isLoading}>
            {t("new")}
          </Button>
        ) : (
          <></>
        )
      }>
      <LicenseRequired>
        {isLoading ? (
          <SkeletonLoader />
        ) : (
          <>
            <WorkflowList workflows={data?.workflows} />
          </>
        )}
      </LicenseRequired>
    </Shell>
  ) : (
    <></>
  );
}

export default WorkflowsPage;
