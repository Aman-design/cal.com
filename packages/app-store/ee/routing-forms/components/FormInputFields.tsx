import { App_RoutingForms_Form } from "@prisma/client";
import { Dispatch, SetStateAction } from "react";

import { getQueryBuilderConfig } from "../pages/route-builder/[...appPages]";
import { SerializableForm, Response } from "../types/types";

type Props = {
  form: SerializableForm<App_RoutingForms_Form>;
  response: Response;
  setResponse: Dispatch<SetStateAction<Response>>;
};

export default function FormInputFields(props: Props) {
  const { form, response, setResponse } = props;

  const queryBuilderConfig = getQueryBuilderConfig(form);

  return (
    <>
      {form.fields?.map((field) => {
        const widget = queryBuilderConfig.widgets[field.type];
        if (!("factory" in widget)) {
          return null;
        }
        const Component = widget.factory;

        const optionValues = field.selectText?.trim().split("\n");
        const options = optionValues?.map((value) => {
          const title = value;
          return {
            value,
            title,
          };
        });
        return (
          <div key={field.id} className="mb-4 block flex-col sm:flex ">
            <div className="min-w-48 mb-2 flex-grow">
              <label
                id="slug-label"
                htmlFor="slug"
                className="flex text-sm font-medium text-neutral-700 dark:text-white">
                {field.label}
              </label>
            </div>
            <div className="flex rounded-sm">
              <Component
                value={response[field.id]?.value}
                // required property isn't accepted by query-builder types
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                /* @ts-ignore */
                required={!!field.required}
                listValues={options}
                data-testid="form-field"
                setValue={(value) => {
                  setResponse((response) => {
                    response = response || {};
                    return {
                      ...response,
                      [field.id]: {
                        label: field.label,
                        value,
                      },
                    };
                  });
                }}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}
