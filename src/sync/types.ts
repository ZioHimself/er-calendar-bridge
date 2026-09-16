import type { OutboundEvent } from '../domain/types/index.js';
import type { WithholdNotifier } from '../notify/types.js';
import type { AuditStore } from '../store/audit-store.js';
import type { MappingStore } from '../store/mapping-store.js';
import type { SyncStateStore } from '../store/sync-state-store.js';

export interface SyncDelta {
  changed: Array<{ href: string; data: string; etag?: string }>;
  deleted: Array<{ href: string; uid?: string; recurrenceId?: string }>;
}

export interface CalDavReader {
  poll(): Promise<SyncDelta>;
}

export interface CalendarWriter {
  upsertOutbound(params: {
    mappingKey: { uid: string; recurrenceId?: string };
    outbound: OutboundEvent;
    existingGoogleEventId?: string;
    bridgeUuid: string;
  }): Promise<{ googleEventId: string }>;

  cancel(params: {
    googleEventId: string;
    isRecurringInstance: boolean;
  }): Promise<void>;
}

export interface Logger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export interface SyncCycleResult {
  created: number;
  updated: number;
  cancelled: number;
  dropped: number;
  errors: number;
  lastSuccessAt?: Date;
}

export interface SyncCycleDeps {
  caldav: CalDavReader;
  writer: CalendarWriter;
  mappingStore: MappingStore;
  syncStateStore: SyncStateStore;
  auditStore: AuditStore;
  withholdNotifier: WithholdNotifier;
  /** When false, audit records notify_status disabled without calling SMTP. */
  notifyEnabled: boolean;
  calendarUrl: string;
  log: Logger;
  now?: () => Date;
}
