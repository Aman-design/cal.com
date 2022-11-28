import { TFunction } from "next-i18next";

import { renderEmail } from "../";
import BaseEmail from "./_base-email";

export type TeamInvite = {
  language: TFunction;
  from: string;
  to: string;
  teamName: string;
  joinLink: string;
};

export default class TeamInviteEmail extends BaseEmail {
  teamInviteEvent: TeamInvite;

  constructor(teamInviteEvent: TeamInvite) {
    super();
    this.name = "SEND_TEAM_INVITE_EMAIL";
    this.teamInviteEvent = teamInviteEvent;
  }

  protected getNodeMailerPayload(): Record<string, unknown> {
    return {
      to: this.teamInviteEvent.to,
      from: `Cal.com <${this.getMailerOptions().from}>`,
      subject: this.teamInviteEvent.language("user_invited_you", {
        user: this.teamInviteEvent.from,
        team: this.teamInviteEvent.teamName,
      }),
      html: renderEmail("TeamInviteEmail", this.teamInviteEvent),
      text: "",
    };
  }
}
