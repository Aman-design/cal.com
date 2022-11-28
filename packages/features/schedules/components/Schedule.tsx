import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type {
  ArrayPath,
  Control,
  ControllerRenderProps,
  FieldArrayWithId,
  FieldPath,
  FieldPathValue,
  FieldValues,
  UseFieldArrayRemove,
} from "react-hook-form";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { GroupBase, Props } from "react-select";

import dayjs, { ConfigType, Dayjs } from "@calcom/dayjs";
import { defaultDayRange as DEFAULT_DAY_RANGE } from "@calcom/lib/availability";
import classNames from "@calcom/lib/classNames";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { weekdayNames } from "@calcom/lib/weekday";
import useMeQuery from "@calcom/trpc/react/hooks/useMeQuery";
import { TimeRange } from "@calcom/types/schedule";
import {
  Button,
  Dropdown,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Icon,
  Select,
  SkeletonText,
  Switch,
} from "@calcom/ui";

export type FieldPathByValue<TFieldValues extends FieldValues, TValue> = {
  [Key in FieldPath<TFieldValues>]: FieldPathValue<TFieldValues, Key> extends TValue ? Key : never;
}[FieldPath<TFieldValues>];

const ScheduleDay = <TFieldValues extends FieldValues>({
  name,
  weekday,
  control,
  CopyButton,
}: {
  name: string;
  weekday: string;
  control: Control<TFieldValues>;
  CopyButton: JSX.Element;
}) => {
  const { watch, setValue } = useFormContext();
  const watchDayRange = watch(name);

  return (
    <div className="mb-1 flex w-full flex-col py-1 sm:flex-row">
      {/* Label & switch container */}
      <div className="flex h-11 items-center justify-between sm:w-32">
        <div>
          <label className="flex flex-row items-center space-x-2">
            <div>
              <Switch
                disabled={!watchDayRange}
                defaultChecked={watchDayRange && watchDayRange.length > 0}
                checked={watchDayRange && !!watchDayRange.length}
                onCheckedChange={(isChecked) => {
                  setValue(name, isChecked ? [DEFAULT_DAY_RANGE] : []);
                }}
              />
            </div>
            <span className="inline-block min-w-[88px] text-sm capitalize">{weekday}</span>
            {watchDayRange && !!watchDayRange.length && (
              <div className="mt-1 mb-1 sm:hidden">{CopyButton}</div>
            )}
          </label>
        </div>
      </div>
      <>
        {watchDayRange ? (
          <div className="flex sm:ml-2">
            <DayRanges control={control} name={name} />
            {!!watchDayRange.length && <div className="mt-1 hidden sm:block">{CopyButton}</div>}
          </div>
        ) : (
          <SkeletonText className="mt-2.5 ml-1 h-6 w-48" />
        )}
      </>
      <div className="my-2 h-[1px] w-full bg-gray-200 sm:hidden" />
    </div>
  );
};

const CopyButton = ({
  getValuesFromDayRange,
  weekStart,
}: {
  getValuesFromDayRange: string;
  weekStart: number;
}) => {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const fieldArrayName = getValuesFromDayRange.substring(0, getValuesFromDayRange.lastIndexOf("."));
  const { setValue, getValues } = useFormContext();
  return (
    <Dropdown open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          className={classNames(open && "ring-brand-500 !bg-gray-100 outline-none ring-2 ring-offset-1")}
          type="button"
          tooltip={t("duplicate")}
          color="minimal"
          size="icon"
          StartIcon={Icon.FiCopy}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <CopyTimes
          weekStart={weekStart}
          disabled={parseInt(getValuesFromDayRange.replace(fieldArrayName + ".", ""), 10)}
          onClick={(selected) => {
            selected.forEach((day) => setValue(`${fieldArrayName}.${day}`, getValues(getValuesFromDayRange)));
          }}
          onCancel={() => setOpen(false)}
        />
      </DropdownMenuContent>
    </Dropdown>
  );
};

const Schedule = <
  TFieldValues extends FieldValues,
  TPath extends FieldPathByValue<TFieldValues, TimeRange[][]>
>({
  name,
  control,
  weekStart = 0,
}: {
  name: TPath;
  control: Control<TFieldValues>;
  weekStart?: number;
}) => {
  const { i18n } = useLocale();

  return (
    <>
      {/* First iterate for each day */}
      {weekdayNames(i18n.language, weekStart, "long").map((weekday, num) => {
        const weekdayIndex = (num + weekStart) % 7;
        const dayRangeName = `${name}.${weekdayIndex}`;
        return (
          <ScheduleDay
            name={dayRangeName}
            key={weekday}
            weekday={weekday}
            control={control}
            CopyButton={<CopyButton weekStart={weekStart} getValuesFromDayRange={dayRangeName} />}
          />
        );
      })}
    </>
  );
};

const DayRanges = <TFieldValues extends FieldValues>({
  name,
  control,
}: {
  name: string;
  control: Control<TFieldValues>;
}) => {
  const { t } = useLocale();

  const { remove, fields, append } = useFieldArray({
    control,
    name: name as unknown as ArrayPath<TFieldValues>,
  });

  return (
    <div>
      {fields.map((field, index: number) => (
        <Fragment key={field.id}>
          <div className="mb-2 flex first:mt-1">
            <Controller name={`${name}.${index}`} render={({ field }) => <TimeRangeField {...field} />} />
            {index === 0 && (
              <Button
                tooltip={t("add_time_availability")}
                className=" text-neutral-400"
                type="button"
                color="minimal"
                size="icon"
                StartIcon={Icon.FiPlus}
                onClick={() => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const nextRange: any = getNextRange(fields[fields.length - 1]);
                  if (nextRange) append(nextRange);
                }}
              />
            )}
            {index !== 0 && <RemoveTimeButton index={index} remove={remove} />}
          </div>
        </Fragment>
      ))}
    </div>
  );
};

const RemoveTimeButton = ({
  index,
  remove,
  className,
}: {
  index: number | number[];
  remove: UseFieldArrayRemove;
  className?: string;
}) => {
  return (
    <Button
      type="button"
      size="icon"
      color="minimal"
      StartIcon={Icon.FiTrash}
      onClick={() => remove(index)}
      className={className}
    />
  );
};

const TimeRangeField = ({ className, value, onChange }: { className?: string } & ControllerRenderProps) => {
  // this is a controlled component anyway given it uses LazySelect, so keep it RHF agnostic.
  return (
    <div className={classNames("mr-1 sm:mx-1", className)}>
      <LazySelect
        className="inline-block h-9 w-[100px]"
        value={value.start}
        max={value.end}
        onChange={(option) => {
          onChange({ ...value, start: new Date(option?.value as number) });
        }}
      />
      <span className="mx-2 w-2 self-center"> - </span>
      <LazySelect
        className="inline-block w-[100px] rounded-md"
        value={value.end}
        min={value.start}
        onChange={(option) => {
          onChange({ ...value, end: new Date(option?.value as number) });
        }}
      />
    </div>
  );
};

const LazySelect = ({
  value,
  min,
  max,
  ...props
}: Omit<Props<IOption, false, GroupBase<IOption>>, "value"> & {
  value: ConfigType;
  min?: ConfigType;
  max?: ConfigType;
}) => {
  // Lazy-loaded options, otherwise adding a field has a noticeable redraw delay.
  const { options, filter } = useOptions();

  useEffect(() => {
    filter({ current: value });
  }, [filter, value]);

  return (
    <Select
      options={options}
      onMenuOpen={() => {
        if (min) filter({ offset: min });
        if (max) filter({ limit: max });
      }}
      value={options.find((option) => option.value === dayjs(value).toDate().valueOf())}
      onMenuClose={() => filter({ current: value })}
      components={{ DropdownIndicator: () => null, IndicatorSeparator: () => null }}
      {...props}
    />
  );
};

interface IOption {
  readonly label: string;
  readonly value: number;
}

/**
 * Creates an array of times on a 15 minute interval from
 * 00:00:00 (Start of day) to
 * 23:45:00 (End of day with enough time for 15 min booking)
 */
/** Begin Time Increments For Select */
const INCREMENT = 15;
const useOptions = () => {
  // Get user so we can determine 12/24 hour format preferences
  const query = useMeQuery();
  const { timeFormat } = query.data || { timeFormat: null };

  const [filteredOptions, setFilteredOptions] = useState<IOption[]>([]);

  const options = useMemo(() => {
    const end = dayjs().utc().endOf("day");
    let t: Dayjs = dayjs().utc().startOf("day");

    const options: IOption[] = [];
    while (t.isBefore(end)) {
      options.push({
        value: t.toDate().valueOf(),
        label: dayjs(t)
          .utc()
          .format(timeFormat === 12 ? "h:mma" : "HH:mm"),
      });
      t = t.add(INCREMENT, "minutes");
    }
    return options;
  }, [timeFormat]);

  const filter = useCallback(
    ({ offset, limit, current }: { offset?: ConfigType; limit?: ConfigType; current?: ConfigType }) => {
      if (current) {
        const currentOption = options.find((option) => option.value === dayjs(current).toDate().valueOf());
        if (currentOption) setFilteredOptions([currentOption]);
      } else
        setFilteredOptions(
          options.filter((option) => {
            const time = dayjs(option.value);
            return (!limit || time.isBefore(limit)) && (!offset || time.isAfter(offset));
          })
        );
    },
    [options]
  );

  return { options: filteredOptions, filter };
};

const getNextRange = (field?: FieldArrayWithId) => {
  const nextRangeStart = dayjs((field as unknown as TimeRange).end);
  const nextRangeEnd = dayjs(nextRangeStart).add(1, "hour");

  if (nextRangeEnd.isBefore(nextRangeStart.endOf("day"))) {
    return {
      start: nextRangeStart.toDate(),
      end: nextRangeEnd.toDate(),
    };
  }
};

const CopyTimes = ({
  disabled,
  onClick,
  onCancel,
  weekStart,
}: {
  disabled: number;
  onClick: (selected: number[]) => void;
  onCancel: () => void;
  weekStart: number;
}) => {
  const [selected, setSelected] = useState<number[]>([]);
  const { i18n, t } = useLocale();

  return (
    <div className="space-y-2 py-2">
      <div className="p-2">
        <p className="h6 pb-3 pl-1 text-xs font-medium uppercase text-neutral-400">{t("copy_times_to")}</p>
        <ol className="space-y-2">
          {weekdayNames(i18n.language, weekStart).map((weekday, num) => {
            const weekdayIndex = (num + weekStart) % 7;
            return (
              <li key={weekday}>
                <label className="flex w-full items-center justify-between">
                  <span className="px-1">{weekday}</span>
                  <input
                    value={weekdayIndex}
                    defaultChecked={disabled === weekdayIndex}
                    disabled={disabled === weekdayIndex}
                    onChange={(e) => {
                      if (e.target.checked && !selected.includes(weekdayIndex)) {
                        setSelected(selected.concat([weekdayIndex]));
                      } else if (!e.target.checked && selected.includes(weekdayIndex)) {
                        setSelected(selected.slice(selected.indexOf(weekdayIndex), 1));
                      }
                    }}
                    type="checkbox"
                    className="inline-block rounded-[4px] border-gray-300 text-neutral-900 focus:ring-neutral-500 disabled:text-neutral-400"
                  />
                </label>
              </li>
            );
          })}
        </ol>
      </div>
      <hr />
      <div className="space-x-2 px-2">
        <Button color="minimal" onClick={() => onCancel()}>
          {t("cancel")}
        </Button>
        <Button color="primary" onClick={() => onClick(selected)}>
          {t("apply")}
        </Button>
      </div>
    </div>
  );
};

export default Schedule;
