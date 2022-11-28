import { renderEmail } from "../";
import OrganizerScheduledEmail from "./organizer-scheduled-email";

export default class OrganizerRescheduledEmail extends OrganizerScheduledEmail {
  protected getNodeMailerPayload(): Record<string, unknown> {
    const toAddresses = [this.calEvent.organizer.email];
    if (this.calEvent.team) {
      this.calEvent.team.members.forEach((member) => {
        const memberAttendee = this.calEvent.attendees.find((attendee) => attendee.name === member);
        if (memberAttendee) {
          toAddresses.push(memberAttendee.email);
        }
      });
    }

    return {
      icalEvent: {
        filename: "event.ics",
        content: this.getiCalEventAsString(),
      },
      from: `Cal.com <${this.getMailerOptions().from}>`,
      to: toAddresses.join(","),
      subject: `${this.calEvent.organizer.language.translate("event_type_has_been_rescheduled_on_time_date", {
        eventType: this.calEvent.type,
        name: this.calEvent.attendees[0].name,
        date: `${this.getOrganizerStart("h:mma")} - ${this.getOrganizerEnd(
          "h:mma"
        )}, ${this.calEvent.organizer.language.translate(
          this.getOrganizerStart("dddd").toLowerCase()
        )}, ${this.calEvent.organizer.language.translate(
          this.getOrganizerStart("MMMM").toLowerCase()
        )} ${this.getOrganizerStart("D")}, ${this.getOrganizerStart("YYYY")}`,
      })}`,
      html: renderEmail("OrganizerRescheduledEmail", {
        calEvent: this.calEvent,
        attendee: this.calEvent.organizer,
      }),
      text: this.getTextBody("event_has_been_rescheduled"),
    };
  }
}
