import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OutboundEvent } from '../../src/domain/types/index.js';

const { insertMock, patchMock, deleteMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock('googleapis', () => ({
  google: {
    calendar: vi.fn(() => ({
      events: {
        insert: insertMock,
        patch: patchMock,
        delete: deleteMock,
      },
    })),
  },
}));

import { createGoogleCalendarWriter } from '../../src/writers/google/calendar-writer.js';

const CALENDAR_ID = 'pilot-calendar@test';

const busyOutbound: OutboundEvent = {
  uid: 'busy@er.example',
  summary: 'Busy',
  start: new Date('2026-09-01T10:00:00.000Z'),
  end: new Date('2026-09-01T11:00:00.000Z'),
};

function writer() {
  return createGoogleCalendarWriter({
    auth: {} as import('google-auth-library').OAuth2Client,
    calendarId: CALENDAR_ID,
  });
}

describe('createGoogleCalendarWriter', () => {
  beforeEach(() => {
    insertMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
    insertMock.mockResolvedValue({ data: { id: 'google-new-id' } });
    patchMock.mockResolvedValue({ data: { id: 'google-patched-id' } });
  });

  it('upsertOutbound create maps busy outbound with opaque transparency and iCalUID', async () => {
    const w = writer();
    const result = await w.upsertOutbound({
      mappingKey: { uid: busyOutbound.uid },
      outbound: busyOutbound,
      bridgeUuid: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(result.googleEventId).toBe('google-new-id');
    expect(insertMock).toHaveBeenCalledOnce();
    expect(insertMock).toHaveBeenCalledWith({
      calendarId: CALENDAR_ID,
      requestBody: expect.objectContaining({
        summary: 'Busy',
        transparency: 'opaque',
        iCalUID: 'busy@er.example',
        extendedProperties: {
          private: {
            'er.bridge_uuid': '550e8400-e29b-41d4-a716-446655440000',
          },
        },
      }),
    });
    expect(patchMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('upsertOutbound update patches existing google event id', async () => {
    const w = writer();
    await w.upsertOutbound({
      mappingKey: { uid: busyOutbound.uid },
      outbound: busyOutbound,
      existingGoogleEventId: 'existing-google-id',
      bridgeUuid: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(patchMock).toHaveBeenCalledOnce();
    expect(patchMock).toHaveBeenCalledWith({
      calendarId: CALENDAR_ID,
      eventId: 'existing-google-id',
      requestBody: expect.objectContaining({
        summary: 'Busy',
        transparency: 'opaque',
      }),
    });
    expect(insertMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('cancel patches status cancelled and never deletes', async () => {
    const w = writer();
    await w.cancel({ googleEventId: 'evt-master', isRecurringInstance: false });

    expect(patchMock).toHaveBeenCalledOnce();
    expect(patchMock).toHaveBeenCalledWith({
      calendarId: CALENDAR_ID,
      eventId: 'evt-master',
      requestBody: { status: 'cancelled' },
    });
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('upsertOutbound with recurrenceId uses instance originalStartTime', async () => {
    const recurrenceStart = new Date('2026-09-08T10:00:00.000Z');
    const instanceOutbound: OutboundEvent = {
      ...busyOutbound,
      recurrenceId: recurrenceStart,
      isRecurring: true,
    };
    const w = writer();
    await w.upsertOutbound({
      mappingKey: {
        uid: busyOutbound.uid,
        recurrenceId: recurrenceStart.toISOString(),
      },
      outbound: instanceOutbound,
      bridgeUuid: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(insertMock).toHaveBeenCalledOnce();
    expect(insertMock).toHaveBeenCalledWith({
      calendarId: CALENDAR_ID,
      requestBody: expect.objectContaining({
        originalStartTime: {
          dateTime: recurrenceStart.toISOString(),
          timeZone: 'UTC',
        },
      }),
    });
  });

  it('cancel recurring instance patches instance event id', async () => {
    const w = writer();
    await w.cancel({
      googleEventId: 'instance-event-id',
      isRecurringInstance: true,
    });

    expect(patchMock).toHaveBeenCalledWith({
      calendarId: CALENDAR_ID,
      eventId: 'instance-event-id',
      requestBody: { status: 'cancelled' },
    });
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
