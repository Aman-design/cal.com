import { WorkflowActions, WorkflowTemplates } from "@prisma/client";
import { useRouter } from "next/router";
import { Dispatch, SetStateAction, useMemo, useState } from "react";
import { Controller, UseFormReturn } from "react-hook-form";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import useMeQuery from "@calcom/trpc/react/hooks/useMeQuery";
import { Icon } from "@calcom/ui";
import { Button, Label, TextField } from "@calcom/ui";
import { MultiSelectCheckboxes } from "@calcom/ui";
import type { MultiSelectCheckboxesOptionType as Option } from "@calcom/ui";

import type { FormValues } from "../pages/workflow";
import { AddActionDialog } from "./AddActionDialog";
import { DeleteDialog } from "./DeleteDialog";
import WorkflowStepContainer from "./WorkflowStepContainer";

interface Props {
  form: UseFormReturn<FormValues>;
  workflowId: number;
  selectedEventTypes: Option[];
  setSelectedEventTypes: Dispatch<SetStateAction<Option[]>>;
}

export default function WorkflowDetailsPage(props: Props) {
  const { form, workflowId, selectedEventTypes, setSelectedEventTypes } = props;
  const { t } = useLocale();
  const router = useRouter();

  const [isAddActionDialogOpen, setIsAddActionDialogOpen] = useState(false);
  const [reload, setReload] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data, isLoading } = trpc.viewer.eventTypes.getByViewer.useQuery();

  const eventTypeOptions = useMemo(
    () =>
      data?.eventTypeGroups.reduce(
        (options, group) => [
          ...options,
          ...group.eventTypes.map((eventType) => ({
            value: String(eventType.id),
            label: eventType.title,
          })),
        ],
        [] as Option[]
      ) || [],
    [data]
  );

  const addAction = (action: WorkflowActions, sendTo?: string, numberRequired?: boolean, sender?: string) => {
    const steps = form.getValues("steps");
    const id =
      steps?.length > 0
        ? steps.sort((a, b) => {
            return a.id - b.id;
          })[0].id - 1
        : 0;

    const step = {
      id: id > 0 ? 0 : id, //id of new steps always <= 0
      action,
      stepNumber:
        steps && steps.length > 0
          ? steps.sort((a, b) => {
              return a.stepNumber - b.stepNumber;
            })[steps.length - 1].stepNumber + 1
          : 1,
      sendTo: sendTo || null,
      workflowId: workflowId,
      reminderBody: null,
      emailSubject: null,
      template: WorkflowTemplates.CUSTOM,
      numberRequired: numberRequired || false,
      sender: sender || "Cal",
    };
    steps?.push(step);
    form.setValue("steps", steps);
  };

  return (
    <>
      <div className="my-8 sm:my-0 md:flex">
        <div className="pl-2 pr-3 md:sticky md:top-6 md:h-0 md:pl-0">
          <div className="mb-5">
            <TextField label={`${t("workflow_name")}:`} type="text" {...form.register("name")} />
          </div>
          <Label>{t("which_event_type_apply")}</Label>
          <Controller
            name="activeOn"
            control={form.control}
            render={() => {
              return (
                <MultiSelectCheckboxes
                  options={eventTypeOptions}
                  isLoading={isLoading}
                  className="w-full md:w-64"
                  setSelected={setSelectedEventTypes}
                  selected={selectedEventTypes}
                  setValue={(s: Option[]) => {
                    form.setValue("activeOn", s);
                  }}
                />
              );
            }}
          />
          <div className="my-7 border-transparent md:border-t md:border-gray-200" />
          <Button
            type="button"
            StartIcon={Icon.FiTrash2}
            color="destructive"
            className="border"
            onClick={() => setDeleteDialogOpen(true)}>
            {t("delete_workflow")}
          </Button>
          <div className="my-7 border-t border-gray-200 md:border-none" />
        </div>

        {/* Workflow Trigger Event & Steps */}
        <div className="w-full rounded-md border border-gray-200 bg-gray-50 p-3 py-5 md:ml-3 md:p-8">
          {form.getValues("trigger") && (
            <div>
              <WorkflowStepContainer form={form} />
            </div>
          )}
          {form.getValues("steps") && (
            <>
              {form.getValues("steps")?.map((step) => {
                return (
                  <WorkflowStepContainer
                    key={step.id}
                    form={form}
                    step={step}
                    reload={reload}
                    setReload={setReload}
                  />
                );
              })}
            </>
          )}
          <div className="my-3 flex justify-center">
            <Icon.FiArrowDown className="stroke-[1.5px] text-3xl text-gray-500" />
          </div>
          <div className="flex justify-center">
            <Button
              type="button"
              onClick={() => setIsAddActionDialogOpen(true)}
              color="secondary"
              className="bg-white">
              {t("add_action")}
            </Button>
          </div>
        </div>
      </div>
      <AddActionDialog
        isOpenDialog={isAddActionDialogOpen}
        setIsOpenDialog={setIsAddActionDialogOpen}
        addAction={addAction}
      />
      <DeleteDialog
        isOpenDialog={deleteDialogOpen}
        setIsOpenDialog={setDeleteDialogOpen}
        workflowId={workflowId}
        additionalFunction={async () => await router.push("/workflows")}
      />
    </>
  );
}
