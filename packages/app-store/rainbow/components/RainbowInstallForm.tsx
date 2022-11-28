import { z } from "zod";

import { SetAppDataGeneric } from "@calcom/app-store/EventTypeAppContext";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { SUPPORTED_CHAINS_FOR_FORM } from "@calcom/rainbow/utils/ethereum";
import { Select } from "@calcom/ui";

import { appDataSchema } from "../zod";

type RainbowInstallFormProps = {
  setAppData: SetAppDataGeneric<typeof appDataSchema>;
} & Pick<z.infer<typeof appDataSchema>, "smartContractAddress" | "blockchainId">;

const RainbowInstallForm: React.FC<RainbowInstallFormProps> = ({
  setAppData,
  blockchainId,
  smartContractAddress,
}) => {
  const { t } = useLocale();

  return (
    <>
      <div className="mt-4 block items-center sm:flex">
        <div className="min-w-48 mb-4 sm:mb-0">
          <label htmlFor="blockchainId" className="flex text-sm font-medium text-neutral-700">
            {t("Blockchain")}
          </label>
        </div>
        <Select
          isSearchable={false}
          className="block w-full min-w-0 flex-1 rounded-sm text-sm"
          onChange={(e) => {
            setAppData("blockchainId", (e && e.value) || 1);
          }}
          defaultValue={SUPPORTED_CHAINS_FOR_FORM.find((e) => e.value === blockchainId)}
          options={SUPPORTED_CHAINS_FOR_FORM || [{ value: 1, label: "Ethereum" }]}
        />
      </div>
      <div className="block items-center sm:flex">
        <div className="min-w-48 mb-4 sm:mb-0">
          <label htmlFor="smartContractAddress" className="flex text-sm font-medium text-neutral-700">
            {t("token_address")}
          </label>
        </div>
        <div className="w-full">
          <div className="relative mt-1 rounded-sm">
            <input
              type="text"
              className="block w-full rounded-sm border-gray-300 text-sm "
              placeholder={t("Example: 0x71c7656ec7ab88b098defb751b7401b5f6d8976f")}
              defaultValue={(smartContractAddress || "") as string}
              onChange={(e) => {
                setAppData("smartContractAddress", e.target.value);
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default RainbowInstallForm;
