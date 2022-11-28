import {
  TimeUnit,
  WorkflowTriggerEvents,
  WorkflowTemplates,
  WorkflowActions,
  WorkflowMethods,
} from "@prisma/client";
import client from "@sendgrid/client";
import sgMail from "@sendgrid/mail";

import dayjs from "@calcom/dayjs";
import prisma from "@calcom/prisma";

import { BookingInfo, timeUnitLowerCase } from "./smsReminderManager";
import customTemplate, { VariablesType } from "./templates/customTemplate";
import emailReminderTemplate from "./templates/emailReminderTemplate";

let sendgridAPIKey, senderEmail: string;

if (process.env.SENDGRID_API_KEY) {
  sendgridAPIKey = process.env.SENDGRID_API_KEY as string;
  senderEmail = process.env.SENDGRID_EMAIL as string;

  sgMail.setApiKey(sendgridAPIKey);
  client.setApiKey(sendgridAPIKey);
}

export const scheduleEmailReminder = async (
  evt: BookingInfo,
  triggerEvent: WorkflowTriggerEvents,
  action: WorkflowActions,
  timeSpan: {
    time: number | null;
    timeUnit: TimeUnit | null;
  },
  sendTo: string,
  emailSubject: string,
  emailBody: string,
  workflowStepId: number,
  template: WorkflowTemplates
) => {
  const { startTime, endTime } = evt;
  const uid = evt.uid as string;
  const currentDate = dayjs();
  const timeUnit: timeUnitLowerCase | undefined = timeSpan.timeUnit?.toLocaleLowerCase() as timeUnitLowerCase;

  let scheduledDate = null;

  if (triggerEvent === WorkflowTriggerEvents.BEFORE_EVENT) {
    scheduledDate = timeSpan.time && timeUnit ? dayjs(startTime).subtract(timeSpan.time, timeUnit) : null;
  } else if (triggerEvent === WorkflowTriggerEvents.AFTER_EVENT) {
    scheduledDate = timeSpan.time && timeUnit ? dayjs(endTime).add(timeSpan.time, timeUnit) : null;
  }
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_EMAIL) {
    console.error("Sendgrid credentials are missing from the .env file");
    return;
  }

  const batchIdResponse = await client.request({
    url: "/v3/mail/batch",
    method: "POST",
  });

  let name = "";
  let attendeeName = "";
  let timeZone = "";

  switch (action) {
    case WorkflowActions.EMAIL_HOST:
      name = evt.organizer.name;
      attendeeName = evt.attendees[0].name;
      timeZone = evt.organizer.timeZone;
      break;
    case WorkflowActions.EMAIL_ATTENDEE:
      name = evt.attendees[0].name;
      attendeeName = evt.organizer.name;
      timeZone = evt.attendees[0].timeZone;
      break;
    case WorkflowActions.EMAIL_ADDRESS:
      name = "";
      attendeeName = evt.attendees[0].name;
      timeZone = evt.organizer.timeZone;
  }

  let emailContent = {
    emailSubject,
    emailBody: {
      text: emailBody,
      html: `<body style="white-space: pre-wrap;">${emailBody}</body>`,
    },
  };

  switch (template) {
    case WorkflowTemplates.REMINDER:
      emailContent = emailReminderTemplate(startTime, endTime, evt.title, timeZone, attendeeName, name);
      break;
    case WorkflowTemplates.CUSTOM:
      const variables: VariablesType = {
        eventName: evt.title || "",
        organizerName: evt.organizer.name,
        attendeeName: evt.attendees[0].name,
        attendeeEmail: evt.attendees[0].email,
        eventDate: dayjs(startTime).tz(timeZone),
        eventTime: dayjs(startTime).tz(timeZone),
        timeZone: timeZone,
        location: evt.location,
        additionalNotes: evt.additionalNotes,
        customInputs: evt.customInputs,
      };

      const emailSubjectTemplate = await customTemplate(
        emailSubject,
        variables,
        evt.organizer.language.locale
      );
      emailContent.emailSubject = emailSubjectTemplate.text;
      emailContent.emailBody = await customTemplate(emailBody, variables, evt.organizer.language.locale);
      break;
  }

  if (
    triggerEvent === WorkflowTriggerEvents.NEW_EVENT ||
    triggerEvent === WorkflowTriggerEvents.EVENT_CANCELLED ||
    triggerEvent === WorkflowTriggerEvents.RESCHEDULE_EVENT
  ) {
    try {
      await sgMail.send({
        to: sendTo,
        from: senderEmail,
        subject: emailContent.emailSubject,
        text: emailContent.emailBody.text,
        html: emailContent.emailBody.html,
        batchId: batchIdResponse[1].batch_id,
        replyTo: evt.organizer.email,
      });
    } catch (error) {
      console.log("Error sending Email");
    }
  } else if (
    (triggerEvent === WorkflowTriggerEvents.BEFORE_EVENT ||
      triggerEvent === WorkflowTriggerEvents.AFTER_EVENT) &&
    scheduledDate
  ) {
    // Sendgrid to schedule emails
    // Can only schedule at least 60 minutes and at most 72 hours in advance
    if (
      currentDate.isBefore(scheduledDate.subtract(1, "hour")) &&
      !scheduledDate.isAfter(currentDate.add(72, "hour"))
    ) {
      try {
        await sgMail.send({
          to: sendTo,
          from: senderEmail,
          subject: emailContent.emailSubject,
          text: emailContent.emailBody.text,
          html: emailContent.emailBody.html,
          batchId: batchIdResponse[1].batch_id,
          sendAt: scheduledDate.unix(),
          replyTo: evt.organizer.email,
        });

        await prisma.workflowReminder.create({
          data: {
            bookingUid: uid,
            workflowStepId: workflowStepId,
            method: WorkflowMethods.EMAIL,
            scheduledDate: scheduledDate.toDate(),
            scheduled: true,
            referenceId: batchIdResponse[1].batch_id,
          },
        });
      } catch (error) {
        console.log(`Error scheduling email with error ${error}`);
      }
    } else if (scheduledDate.isAfter(currentDate.add(72, "hour"))) {
      // Write to DB and send to CRON if scheduled reminder date is past 72 hours
      await prisma.workflowReminder.create({
        data: {
          bookingUid: uid,
          workflowStepId: workflowStepId,
          method: WorkflowMethods.EMAIL,
          scheduledDate: scheduledDate.toDate(),
          scheduled: false,
        },
      });
    }
  }
};

export const deleteScheduledEmailReminder = async (referenceId: string) => {
  try {
    await client.request({
      url: "/v3/user/scheduled_sends",
      method: "POST",
      body: {
        batch_id: referenceId,
        status: "cancel",
      },
    });
  } catch (error) {
    console.log(`Error canceling reminder with error ${error}`);
  }
};
