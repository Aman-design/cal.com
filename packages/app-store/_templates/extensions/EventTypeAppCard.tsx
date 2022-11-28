import { useState } from "react";

import { useAppContextWithSchema } from "@calcom/app-store/EventTypeAppContext";
import AppCard from "@calcom/app-store/_components/AppCard";
import type { EventTypeAppCardComponent } from "@calcom/app-store/types";
import { Icon } from "@calcom/ui";

import { appDataSchema } from "../zod";

const EventTypeAppCard: EventTypeAppCardComponent = function EventTypeAppCard({ eventType, app }) {
  const [getAppData, setAppData] = useAppContextWithSchema<typeof appDataSchema>();
  const isSunrise = getAppData("isSunrise");
  const [enabled, setEnabled] = useState(getAppData("enabled"));

  return (
    <AppCard
      setAppData={setAppData}
      app={app}
      switchOnClick={(e) => {
        if (!e) {
          setEnabled(false);
          setAppData("isSunrise", false);
        } else {
          setEnabled(true);
          setAppData("isSunrise", true);
        }
      }}
      switchChecked={enabled}>
      <div className="mt-2 text-sm">
        <div className="flex">
          <span className="mr-2">{isSunrise ? <Icon.FiSunrise /> : <Icon.FiSunset />}</span>I am an AppCard
          for Event with Title: {eventType.title}
        </div>{" "}
        <div className="mt-2">
          Edit <span className="italic">packages/app-store/{app.slug}/extensions/EventTypeAppCard.tsx</span>{" "}
          to play with me
        </div>
      </div>
    </AppCard>
  );
};

export default EventTypeAppCard;
