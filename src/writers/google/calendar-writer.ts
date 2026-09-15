import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
import type { OutboundEvent } from '../../domain/types/index.js';
import type { CalendarWriter } from '../../sync/types.js';

export const BRIDGE_UUID_PRIVATE_KEY = 'er.bridge_uuid';

function isBusyOutbound(outbound: OutboundEvent): boolean {
  return outbound.summary === 'Busy';
}

function toGoogleDateTime(date: Date): calendar_v3.Schema$EventDateTime {
  return {
    dateTime: date.toISOString(),
    timeZone: 'UTC',
  };
}

function buildEventBody(
  outbound: OutboundEvent,
  bridgeUuid: string,
  options: { isCreate: boolean; isRecurringInstance: boolean },
): calendar_v3.Schema$Event {
  const start = toGoogleDateTime(outbound.start);
  const end = outbound.end ? toGoogleDateTime(outbound.end) : undefined;

  if (isBusyOutbound(outbound)) {
    const body: calendar_v3.Schema$Event = {
      summary: 'Busy',
      transparency: 'opaque',
      start,
      end,
    };
    if (options.isCreate) {
      body.iCalUID = outbound.uid;
      body.extendedProperties = {
        private: {
          [BRIDGE_UUID_PRIVATE_KEY]: bridgeUuid,
        },
      };
    }
    if (options.isRecurringInstance && outbound.recurrenceId) {
      body.originalStartTime = toGoogleDateTime(outbound.recurrenceId);
    }
    return body;
  }

  const body: calendar_v3.Schema$Event = {
    summary: outbound.summary,
    description: outbound.description,
    location: outbound.location,
    start,
    end,
  };
  if (outbound.categories?.length) {
    body.extendedProperties = {
      ...(body.extendedProperties ?? {}),
      private: {
        ...(body.extendedProperties?.private ?? {}),
        categories: outbound.categories.join(','),
      },
    };
  }
  if (options.isCreate) {
    body.iCalUID = outbound.uid;
    body.extendedProperties = {
      ...(body.extendedProperties ?? {}),
      private: {
        ...(body.extendedProperties?.private ?? {}),
        [BRIDGE_UUID_PRIVATE_KEY]: bridgeUuid,
      },
    };
  }
  if (options.isRecurringInstance && outbound.recurrenceId) {
    body.originalStartTime = toGoogleDateTime(outbound.recurrenceId);
  }
  return body;
}

export type GoogleCalendarWriterDeps = Readonly<{
  auth: OAuth2Client;
  calendarId: string;
}>;

export function createGoogleCalendarWriter(
  deps: GoogleCalendarWriterDeps,
): CalendarWriter {
  const calendar = google.calendar({ version: 'v3', auth: deps.auth });

  return {
    async upsertOutbound(params) {
      const isRecurringInstance =
        params.mappingKey.recurrenceId !== undefined ||
        params.outbound.recurrenceId !== undefined;

      const requestBody = buildEventBody(params.outbound, params.bridgeUuid, {
        isCreate: params.existingGoogleEventId === undefined,
        isRecurringInstance,
      });

      if (params.existingGoogleEventId !== undefined) {
        const response = await calendar.events.patch({
          calendarId: deps.calendarId,
          eventId: params.existingGoogleEventId,
          requestBody,
        });
        const id = response.data.id;
        if (!id) {
          throw new Error('Google Calendar patch returned no event id');
        }
        return { googleEventId: id };
      }

      const response = await calendar.events.insert({
        calendarId: deps.calendarId,
        requestBody,
      });
      const id = response.data.id;
      if (!id) {
        throw new Error('Google Calendar insert returned no event id');
      }
      return { googleEventId: id };
    },

    async cancel(params) {
      await calendar.events.patch({
        calendarId: deps.calendarId,
        eventId: params.googleEventId,
        requestBody: { status: 'cancelled' },
      });
    },
  };
}
