import { useState } from "react";
import { useForm } from "react-hook-form";

import { ErrorCode } from "@calcom/lib/auth";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button, Dialog, DialogContent, Form, Label, PasswordField } from "@calcom/ui";

import TwoFactor from "@components/auth/TwoFactor";

import TwoFactorAuthAPI from "./TwoFactorAuthAPI";

interface DisableTwoFactorAuthModalProps {
  open: boolean;
  onOpenChange: () => void;

  /** Called when the user closes the modal without disabling two-factor auth */
  onCancel: () => void;
  /** Called when the user disables two-factor auth */
  onDisable: () => void;
}

interface DisableTwoFactorValues {
  totpCode: string;
  password: string;
}

const DisableTwoFactorAuthModal = ({
  onDisable,
  onCancel,
  open,
  onOpenChange,
}: DisableTwoFactorAuthModalProps) => {
  const [isDisabling, setIsDisabling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { t } = useLocale();

  const form = useForm<DisableTwoFactorValues>();

  async function handleDisable({ totpCode, password }: DisableTwoFactorValues) {
    if (isDisabling) {
      return;
    }
    setIsDisabling(true);
    setErrorMessage(null);

    try {
      const response = await TwoFactorAuthAPI.disable(password, totpCode);
      if (response.status === 200) {
        onDisable();
        return;
      }

      const body = await response.json();
      if (body.error === ErrorCode.IncorrectPassword) {
        setErrorMessage(t("incorrect_password"));
      }
      if (body.error === ErrorCode.SecondFactorRequired) {
        setErrorMessage(t("2fa_required"));
      }
      if (body.error === ErrorCode.IncorrectTwoFactorCode) {
        setErrorMessage(t("incorrect_2fa"));
      } else {
        setErrorMessage(t("something_went_wrong"));
      }
    } catch (e) {
      setErrorMessage(t("something_went_wrong"));
      console.error(t("error_disabling_2fa"), e);
    } finally {
      setIsDisabling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t("disable_2fa")}
        description={t("disable_2fa_recommendation")}
        type="creation"
        useOwnActionButtons>
        <Form form={form} handleSubmit={handleDisable}>
          <div className="mb-4">
            <PasswordField
              labelProps={{
                className: "block text-sm font-medium text-gray-700",
              }}
              {...form.register("password")}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-black"
            />
            <Label className="mt-4"> {t("2fa_code")}</Label>

            <TwoFactor center={false} />

            {errorMessage && <p className="mt-1 text-sm text-red-700">{errorMessage}</p>}
          </div>

          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <Button type="submit" className="ltr:ml-2 rtl:mr-2" disabled={isDisabling}>
              {t("disable")}
            </Button>
            <Button color="secondary" onClick={onCancel}>
              {t("cancel")}
            </Button>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default DisableTwoFactorAuthModal;
