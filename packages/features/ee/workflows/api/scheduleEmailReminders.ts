/* Schedule any workflow reminder that falls within 72 hours for email */
import { WorkflowActions, WorkflowMethods, WorkflowTemplates } from "@prisma/client";
import client from "@sendgrid/client";
import sgMail from "@sendgrid/mail";
import type { NextApiRequest, NextApiResponse } from "next";

import dayjs from "@calcom/dayjs";
import { defaultHandler } from "@calcom/lib/server";
import prisma from "@calcom/prisma";

import customTemplate, { VariablesType } from "../lib/reminders/templates/customTemplate";
import emailReminderTemplate from "../lib/reminders/templates/emailReminderTemplate";

const sendgridAPIKey = process.env.SENDGRID_API_KEY as string;
const senderEmail = process.env.SENDGRID_EMAIL as string;

sgMail.setApiKey(sendgridAPIKey);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiKey = req.headers.authorization || req.query.apiKey;
  if (process.env.CRON_API_KEY !== apiKey) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_EMAIL) {
    res.status(405).json({ message: "No SendGrid API key or email" });
    return;
  }

  //delete all scheduled email reminders where scheduled is past current date
  await prisma.workflowReminder.deleteMany({
    where: {
      method: WorkflowMethods.EMAIL,
      scheduledDate: {
        lte: dayjs().toISOString(),
      },
    },
  });

  //find all unscheduled Email reminders
  const unscheduledReminders = await prisma.workflowReminder.findMany({
    where: {
      method: WorkflowMethods.EMAIL,
      scheduled: false,
    },
    include: {
      workflowStep: true,
      booking: {
        include: {
          eventType: true,
          user: true,
          attendees: true,
        },
      },
    },
  });

  if (!unscheduledReminders.length) {
    res.status(200).json({ message: "No Emails to schedule" });
    return;
  }

  const dateInSeventyTwoHours = dayjs().add(72, "hour");

  for (const reminder of unscheduledReminders) {
    if (dayjs(reminder.scheduledDate).isBefore(dateInSeventyTwoHours)) {
      try {
        let sendTo;

        switch (reminder.workflowStep.action) {
          case WorkflowActions.EMAIL_HOST:
            sendTo = reminder.booking?.user?.email;
            break;
          case WorkflowActions.EMAIL_ATTENDEE:
            sendTo = reminder.booking?.attendees[0].email;
            break;
          case WorkflowActions.EMAIL_ADDRESS:
            sendTo = reminder.workflowStep.sendTo;
        }

        const name =
          reminder.workflowStep.action === WorkflowActions.EMAIL_ATTENDEE
            ? reminder.booking?.attendees[0].name
            : reminder.booking?.user?.name;

        const attendeeName =
          reminder.workflowStep.action === WorkflowActions.EMAIL_ATTENDEE
            ? reminder.booking?.user?.name
            : reminder.booking?.attendees[0].name;

        const timeZone =
          reminder.workflowStep.action === WorkflowActions.EMAIL_ATTENDEE
            ? reminder.booking?.attendees[0].timeZone
            : reminder.booking?.user?.timeZone;

        let emailContent = {
          emailSubject: reminder.workflowStep.emailSubject || "",
          emailBody: {
            text: reminder.workflowStep.reminderBody || "",
            html: `<body style="white-space: pre-wrap;">${reminder.workflowStep.reminderBody || ""}</body>`,
          },
        };

        switch (reminder.workflowStep.template) {
          case WorkflowTemplates.REMINDER:
            emailContent = emailReminderTemplate(
              reminder.booking?.startTime.toISOString() || "",
              reminder.booking?.endTime.toISOString() || "",
              reminder.booking?.eventType?.title || "",
              timeZone || "",
              attendeeName || "",
              name || ""
            );
            break;
          case WorkflowTemplates.CUSTOM:
            const variables: VariablesType = {
              eventName: reminder.booking?.eventType?.title || "",
              organizerName: reminder.booking?.user?.name || "",
              attendeeName: reminder.booking?.attendees[0].name,
              attendeeEmail: reminder.booking?.attendees[0].email,
              eventDate: dayjs(reminder.booking?.startTime).tz(timeZone),
              eventTime: dayjs(reminder.booking?.startTime).tz(timeZone),
              timeZone: timeZone,
              location: reminder.booking?.location || "",
              additionalNotes: reminder.booking?.description,
              customInputs: reminder.booking?.customInputs,
            };
            const emailSubject = await customTemplate(
              reminder.workflowStep.emailSubject || "",
              variables,
              reminder.booking?.user?.locale || ""
            );
            emailContent.emailSubject = emailSubject.text;
            emailContent.emailBody = await customTemplate(
              reminder.workflowStep.reminderBody || "",
              variables,
              reminder.booking?.user?.locale || ""
            );
            break;
        }
        if (emailContent.emailSubject.length > 0 && emailContent.emailBody.text.length > 0 && sendTo) {
          const batchIdResponse = await client.request({
            url: "/v3/mail/batch",
            method: "POST",
          });

          const batchId = batchIdResponse[1].batch_id;

          await sgMail.send({
            to: sendTo,
            from: senderEmail,
            subject: emailContent.emailSubject,
            text: emailContent.emailBody.text,
            html: emailContent.emailBody.html,
            batchId: batchId,
            sendAt: dayjs(reminder.scheduledDate).unix(),
            replyTo: reminder.booking?.user?.email || senderEmail,
          });

          await prisma.workflowReminder.update({
            where: {
              id: reminder.id,
            },
            data: {
              scheduled: true,
              referenceId: batchId,
            },
          });
        }
      } catch (error) {
        console.log(`Error scheduling Email with error ${error}`);
      }
    }
  }
  res.status(200).json({ message: "Emails scheduled" });
}

export default defaultHandler({
  POST: Promise.resolve({ default: handler }),
});
