import { useRouter } from "next/router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Toaster } from "react-hot-toast";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Alert, Button, Form, TextField } from "@calcom/ui";

export default function CalDavCalendarSetup() {
  const { t } = useLocale();
  const router = useRouter();
  const form = useForm({
    defaultValues: {
      url: "",
      username: "",
      password: "",
    },
  });

  const [errorMessage, setErrorMessage] = useState("");

  return (
    <div className="flex h-screen bg-gray-200">
      <div className="m-auto rounded bg-white p-5 md:w-[560px] md:p-10">
        <div className="flex flex-col space-y-5 md:flex-row md:space-y-0 md:space-x-5">
          <div>
            {/* eslint-disable @next/next/no-img-element */}
            <img
              src="/api/app-store/caldavcalendar/icon.svg"
              alt="CalDav Calendar"
              className="h-12 w-12 max-w-2xl"
            />
          </div>
          <div className="flex w-10/12 flex-col">
            <h1 className="text-gray-600">{t("connect_caldav_server")}</h1>
            <div className="mt-1 text-sm">{t("credentials_stored_encrypted")}</div>
            <div className="my-2 mt-3">
              <Form
                form={form}
                handleSubmit={async (values) => {
                  setErrorMessage("");
                  const res = await fetch("/api/integrations/caldavcalendar/add", {
                    method: "POST",
                    body: JSON.stringify(values),
                    headers: {
                      "Content-Type": "application/json",
                    },
                  });
                  const json = await res.json();
                  if (!res.ok) {
                    setErrorMessage(json?.message || t("something_went_wrong"));
                  } else {
                    router.push(json.url);
                  }
                }}>
                <fieldset className="space-y-2" disabled={form.formState.isSubmitting}>
                  <TextField
                    required
                    type="text"
                    {...form.register("url")}
                    label={t("calendar_url")}
                    placeholder="https://example.com/calendar"
                  />
                  <TextField
                    required
                    type="text"
                    {...form.register("username")}
                    label={t("username")}
                    placeholder="rickroll"
                  />
                  <TextField
                    required
                    type="password"
                    {...form.register("password")}
                    label={t("password")}
                    placeholder="•••••••••••••"
                    autoComplete="password"
                  />
                </fieldset>

                {errorMessage && <Alert severity="error" title={errorMessage} className="my-4" />}
                <div className="mt-5 justify-end space-x-2 sm:mt-4 sm:flex">
                  <Button type="button" color="secondary" onClick={() => router.back()}>
                    {t("cancel")}
                  </Button>
                  <Button type="submit" loading={form.formState.isSubmitting}>
                    {t("save")}
                  </Button>
                </div>
              </Form>
            </div>
          </div>
        </div>
      </div>
      <Toaster position="bottom-right" />
    </div>
  );
}
