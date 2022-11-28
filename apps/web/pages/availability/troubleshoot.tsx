import { useState } from "react";

import dayjs from "@calcom/dayjs";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { RouterOutputs, trpc } from "@calcom/trpc/react";
import { Shell, SkeletonText } from "@calcom/ui";

type User = RouterOutputs["viewer"]["me"];

export interface IBusySlot {
  start: string | Date;
  end: string | Date;
  title?: string;
  source?: string | null;
}

const AvailabilityView = ({ user }: { user: User }) => {
  const { t } = useLocale();
  const [selectedDate, setSelectedDate] = useState(dayjs());

  const { data, isLoading } = trpc.viewer.availability.user.useQuery(
    {
      username: user.username!,
      dateFrom: selectedDate.startOf("day").utc().format(),
      dateTo: selectedDate.endOf("day").utc().format(),
      withSource: true,
    },
    {
      enabled: !!user.username,
    }
  );

  return (
    <div className="max-w-xl overflow-hidden rounded-md bg-white shadow">
      <div className="px-4 py-5 sm:p-6">
        {t("overview_of_day")}{" "}
        <input
          type="date"
          className="inline h-8 border-none p-0"
          defaultValue={selectedDate.format("YYYY-MM-DD")}
          onChange={(e) => {
            if (e.target.value) setSelectedDate(dayjs(e.target.value));
          }}
        />
        <small className="block text-neutral-400">{t("hover_over_bold_times_tip")}</small>
        <div className="mt-4 space-y-4">
          <div className="bg-brand dark:bg-darkmodebrand overflow-hidden rounded-md">
            <div className="text-brandcontrast dark:text-darkmodebrandcontrast px-4 py-2 sm:px-6">
              {t("your_day_starts_at")} {convertMinsToHrsMins(user.startTime)}
            </div>
          </div>
          {isLoading ? (
            <>
              <SkeletonText className="block h-16 w-full" />
              <SkeletonText className="block h-16 w-full" />
            </>
          ) : data && data.busy.length > 0 ? (
            data.busy
              .sort((a: IBusySlot, b: IBusySlot) => (a.start > b.start ? -1 : 1))
              .map((slot: IBusySlot) => (
                <div
                  key={dayjs(slot.start).format("HH:mm")}
                  className="overflow-hidden rounded-md bg-neutral-100">
                  <div className="px-4 py-5 text-black sm:p-6">
                    {t("calendar_shows_busy_between")}{" "}
                    <span className="font-medium text-neutral-800" title={dayjs(slot.start).format("HH:mm")}>
                      {dayjs(slot.start).format("HH:mm")}
                    </span>{" "}
                    {t("and")}{" "}
                    <span className="font-medium text-neutral-800" title={dayjs(slot.end).format("HH:mm")}>
                      {dayjs(slot.end).format("HH:mm")}
                    </span>{" "}
                    {t("on")} {dayjs(slot.start).format("D")}{" "}
                    {t(dayjs(slot.start).format("MMMM").toLowerCase())} {dayjs(slot.start).format("YYYY")}
                    {slot.title && ` - (${slot.title})`}
                    {slot.source && <small>{` - (source: ${slot.source})`}</small>}
                  </div>
                </div>
              ))
          ) : (
            <div className="overflow-hidden rounded-md bg-neutral-100">
              <div className="px-4 py-5 text-black sm:p-6">{t("calendar_no_busy_slots")}</div>
            </div>
          )}

          <div className="bg-brand dark:bg-darkmodebrand overflow-hidden rounded-md">
            <div className="text-brandcontrast dark:text-darkmodebrandcontrast px-4 py-2 sm:px-6">
              {t("your_day_ends_at")} {convertMinsToHrsMins(user.endTime)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Troubleshoot() {
  const { data, isLoading } = trpc.viewer.me.useQuery();
  const { t } = useLocale();
  return (
    <div>
      <Shell heading={t("troubleshoot")} subtitle={t("troubleshoot_description")}>
        {!isLoading && data && <AvailabilityView user={data} />}
      </Shell>
    </div>
  );
}

function convertMinsToHrsMins(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hs = h < 10 ? "0" + h : h;
  const ms = m < 10 ? "0" + m : m;
  return `${hs}:${ms}`;
}
