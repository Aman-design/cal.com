import { TFunction } from "next-i18next";

import type { CalendarEvent } from "@calcom/types/Calendar";

import { Info } from "./Info";

const PersonInfo = ({ name = "", email = "", role = "" }) => (
  <div style={{ color: "#494949", fontWeight: 400, lineHeight: "24px" }}>
    {name} - {role}{" "}
    <span style={{ color: "#888888" }}>
      <a href={`mailto:${email}`} style={{ color: "#888888" }}>
        {email}
      </a>
    </span>
  </div>
);

export function WhoInfo(props: { calEvent: CalendarEvent; t: TFunction }) {
  const { t } = props;
  return (
    <Info
      label={t("who")}
      description={
        <>
          <PersonInfo
            name={props.calEvent.organizer.name}
            role={t("organizer")}
            email={props.calEvent.organizer.email}
          />
          {props.calEvent.attendees.map((attendee) => (
            <PersonInfo
              key={attendee.id || attendee.name}
              name={attendee.name}
              role={t("guest")}
              email={attendee.email}
            />
          ))}
        </>
      }
      withSpacer
    />
  );
}
