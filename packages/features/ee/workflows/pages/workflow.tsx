import { zodResolver } from "@hookform/resolvers/zod";
import {
  TimeUnit,
  WorkflowActions,
  WorkflowStep,
  WorkflowTemplates,
  WorkflowTriggerEvents,
} from "@prisma/client";
import { isValidPhoneNumber } from "libphonenumber-js";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { classNames } from "@calcom/lib";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { HttpError } from "@calcom/lib/http-error";
import { stringOrNumber } from "@calcom/prisma/zod-utils";
import { trpc } from "@calcom/trpc/react";
import type { MultiSelectCheckboxesOptionType as Option } from "@calcom/ui";
import { Alert, Button, Form, Shell, showToast } from "@calcom/ui";

import LicenseRequired from "../../common/components/v2/LicenseRequired";
import SkeletonLoader from "../components/SkeletonLoaderEdit";
import WorkflowDetailsPage from "../components/WorkflowDetailsPage";
import { getTranslatedText, translateVariablesToEnglish } from "../lib/variableTranslations";

export type FormValues = {
  name: string;
  activeOn: Option[];
  steps: WorkflowStep[];
  trigger: WorkflowTriggerEvents;
  time?: number;
  timeUnit?: TimeUnit;
};

export function onlyLettersNumbersSpaces(str: string) {
  if (str.length <= 11 && /^[A-Za-z0-9\s]*$/.test(str)) {
    return true;
  }
  return false;
}

const formSchema = z.object({
  name: z.string(),
  activeOn: z.object({ value: z.string(), label: z.string() }).array(),
  trigger: z.nativeEnum(WorkflowTriggerEvents),
  time: z.number().gte(0).optional(),
  timeUnit: z.nativeEnum(TimeUnit).optional(),
  steps: z
    .object({
      id: z.number(),
      stepNumber: z.number(),
      action: z.nativeEnum(WorkflowActions),
      workflowId: z.number(),
      reminderBody: z.string().nullable(),
      emailSubject: z.string().nullable(),
      template: z.nativeEnum(WorkflowTemplates),
      numberRequired: z.boolean().nullable(),
      sendTo: z
        .string()
        .refine((val) => isValidPhoneNumber(val) || val.includes("@"))
        .optional()
        .nullable(),
      sender: z
        .string()
        .refine((val) => onlyLettersNumbersSpaces(val))
        .optional()
        .nullable(),
    })
    .array(),
});

const querySchema = z.object({
  workflow: stringOrNumber,
});

function WorkflowPage() {
  const { t, i18n } = useLocale();
  const session = useSession();
  const router = useRouter();

  const [selectedEventTypes, setSelectedEventTypes] = useState<Option[]>([]);
  const [isAllDataLoaded, setIsAllDataLoaded] = useState(false);

  const form = useForm<FormValues>({
    mode: "onBlur",
    resolver: zodResolver(formSchema),
  });

  const { workflow: workflowId } = router.isReady ? querySchema.parse(router.query) : { workflow: -1 };
  const utils = trpc.useContext();

  const {
    data: workflow,
    isError,
    error,
    isLoading,
  } = trpc.viewer.workflows.get.useQuery(
    { id: +workflowId },
    {
      enabled: router.isReady && !!workflowId,
    }
  );

  useEffect(() => {
    if (workflow && !isLoading) {
      setSelectedEventTypes(
        workflow.activeOn.map((active) => ({
          value: String(active.eventType.id),
          label: active.eventType.title,
        })) || []
      );
      const activeOn = workflow.activeOn
        ? workflow.activeOn.map((active) => ({
            value: active.eventType.id.toString(),
            label: active.eventType.slug,
          }))
        : undefined;

      //translate dynamic variables into local language
      const steps = workflow.steps.map((step) => {
        const updatedStep = step;
        if (step.reminderBody) {
          updatedStep.reminderBody = getTranslatedText(step.reminderBody || "", {
            locale: i18n.language,
            t,
          });
        }
        if (step.emailSubject) {
          updatedStep.emailSubject = getTranslatedText(step.emailSubject || "", {
            locale: i18n.language,
            t,
          });
        }
        return updatedStep;
      });

      form.setValue("name", workflow.name);
      form.setValue("steps", steps);
      form.setValue("trigger", workflow.trigger);
      form.setValue("time", workflow.time || undefined);
      form.setValue("timeUnit", workflow.timeUnit || undefined);
      form.setValue("activeOn", activeOn || []);
      setIsAllDataLoaded(true);
    }
  }, [isLoading]);

  const updateMutation = trpc.viewer.workflows.update.useMutation({
    onSuccess: async ({ workflow }) => {
      if (workflow) {
        utils.viewer.workflows.get.setData({ id: +workflow.id }, workflow);

        showToast(
          t("workflow_updated_successfully", {
            workflowName: workflow.name,
          }),
          "success"
        );
      }
      await router.push("/workflows");
    },
    onError: (err) => {
      if (err instanceof HttpError) {
        const message = `${err.statusCode}: ${err.message}`;
        showToast(message, "error");
      }
    },
  });

  return session.data ? (
    <Form
      form={form}
      handleSubmit={async (values) => {
        let activeOnEventTypeIds: number[] = [];
        let isEmpty = false;

        values.steps.forEach((step) => {
          const isSMSAction =
            step.action === WorkflowActions.SMS_ATTENDEE || step.action === WorkflowActions.SMS_NUMBER;

          const strippedHtml = step.reminderBody?.replace(/<[^>]+>/g, "") || "";

          const isBodyEmpty =
            step.template === WorkflowTemplates.CUSTOM && !isSMSAction && strippedHtml.length <= 1;

          if (isBodyEmpty) {
            form.setError(`steps.${step.stepNumber - 1}.reminderBody`, {
              type: "custom",
              message: t("fill_this_field"),
            });
          }

          if (step.reminderBody) {
            step.reminderBody = translateVariablesToEnglish(step.reminderBody, { locale: i18n.language, t });
          }
          if (step.emailSubject) {
            step.emailSubject = translateVariablesToEnglish(step.emailSubject, { locale: i18n.language, t });
          }
          isEmpty = !isEmpty ? isBodyEmpty : isEmpty;
        });

        if (!isEmpty) {
          if (values.activeOn) {
            activeOnEventTypeIds = values.activeOn.map((option) => {
              return parseInt(option.value, 10);
            });
          }
          updateMutation.mutate({
            id: parseInt(router.query.workflow as string, 10),
            name: values.name,
            activeOn: activeOnEventTypeIds,
            steps: values.steps,
            trigger: values.trigger,
            time: values.time || null,
            timeUnit: values.timeUnit || null,
          });
        }
      }}>
      <Shell
        backPath="/workflows"
        title={workflow && workflow.name ? workflow.name : "Untitled"}
        CTA={
          <div>
            <Button type="submit">{t("save")}</Button>
          </div>
        }
        heading={
          session.data?.hasValidLicense &&
          isAllDataLoaded && (
            <div className={classNames(workflow && !workflow.name ? "text-gray-400" : "")}>
              {workflow && workflow.name ? workflow.name : "untitled"}
            </div>
          )
        }>
        <LicenseRequired>
          {!isError ? (
            <>
              {isAllDataLoaded ? (
                <>
                  <WorkflowDetailsPage
                    form={form}
                    workflowId={+workflowId}
                    selectedEventTypes={selectedEventTypes}
                    setSelectedEventTypes={setSelectedEventTypes}
                  />
                </>
              ) : (
                <SkeletonLoader />
              )}
            </>
          ) : (
            <Alert severity="error" title="Something went wrong" message={error.message} />
          )}
        </LicenseRequired>
      </Shell>
    </Form>
  ) : (
    <></>
  );
}

export default WorkflowPage;
