import { guessEventLocationType } from "@calcom/app-store/locations";
import { Dayjs } from "@calcom/dayjs";
import { Prisma } from "@calcom/prisma/client";

export type VariablesType = {
  eventName?: string;
  organizerName?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  eventDate?: Dayjs;
  eventTime?: Dayjs;
  timeZone?: string;
  location?: string | null;
  additionalNotes?: string | null;
  customInputs?: Prisma.JsonValue;
};

const customTemplate = async (text: string, variables: VariablesType, locale: string) => {
  const timeWithTimeZone = `${variables.eventTime?.locale(locale).format("HH:mm")} (${variables.timeZone})`;
  let locationString = variables.location || "";

  if (text.includes("{LOCATION}")) {
    locationString = guessEventLocationType(locationString)?.label || locationString;
  }

  let dynamicText = text
    .replaceAll("{EVENT_NAME}", variables.eventName || "")
    .replaceAll("{ORGANIZER}", variables.organizerName || "")
    .replaceAll("{ATTENDEE}", variables.attendeeName || "")
    .replaceAll("{ORGANIZER_NAME}", variables.organizerName || "") //old variable names
    .replaceAll("{ATTENDEE_NAME}", variables.attendeeName || "") //old variable names
    .replaceAll("{EVENT_DATE}", variables.eventDate?.locale(locale).format("dddd, MMMM D, YYYY") || "")
    .replaceAll("{EVENT_TIME}", timeWithTimeZone)
    .replaceAll("{LOCATION}", locationString)
    .replaceAll("{ADDITIONAL_NOTES}", variables.additionalNotes || "")
    .replaceAll("{ATTENDEE_EMAIL}", variables.attendeeEmail || "");

  const customInputvariables = dynamicText.match(/\{(.+?)}/g)?.map((variable) => {
    return variable.replace("{", "").replace("}", "");
  });

  customInputvariables?.forEach((variable) => {
    if (variables.customInputs) {
      Object.keys(variables.customInputs).forEach((customInput) => {
        const formatedToVariable = customInput
          .replace(/[^a-zA-Z0-9 ]/g, "")
          .trim()
          .replaceAll(" ", "_")
          .toUpperCase();
        if (variable === formatedToVariable && variables.customInputs) {
          dynamicText = dynamicText.replace(
            `{${variable}}`,
            variables.customInputs[customInput as keyof typeof variables.customInputs]
          );
        }
      });
    }
  });

  const textHtml = `<body style="white-space: pre-wrap;">${dynamicText}</body>`;
  return { text: dynamicText, html: textHtml };
};

export default customTemplate;
