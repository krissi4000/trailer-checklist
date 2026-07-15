import Dexie, { type Table } from 'dexie';

export type Lang = 'en' | 'is';

export interface Checklist {
  id: string;
  name_en: string;
  name_is: string;
  item_order: string[];
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  checklist_id: string;
  title_en: string;
  title_is: string;
  instructions_en: string;
  instructions_is: string;
  media_ids: string[];
}

export interface Media {
  id: string;
  type: 'photo' | 'video';
  blob: Blob;
  thumbnail_blob: Blob | null;
  mime: string;
  size_bytes: number;
  created_at: string;
}

export type SyncStatus = 'pending' | 'synced' | 'error';

export interface ItemResult {
  item_id: string;
  title_snapshot: string;
  checked: boolean;
  note: string;
}

export interface Run {
  id: string;
  checklist_id: string;
  checklist_name_snapshot: string;
  user_name: string;
  started_at: string;
  finished_at: string;
  notes: string;
  item_results: ItemResult[];
  sync_status: SyncStatus;
  last_error: string | null;
  attempt_count: number;
}

export interface InfoEntry {
  id: string;
  label_en: string;
  label_is: string;
  value: string;
}

export interface Settings {
  id: 'singleton';
  users: string[];
  language: Lang;
  endpoint_url: string;
  shared_secret: string;
  device_name: string;
  info_entries: InfoEntry[];
  lang_default_migrated: boolean;
  shared_updated_at: string; // stamp of the users+info_entries merge unit; '' = never touched
}

export interface Tombstone {
  id: string; // checklist id
  deleted_at: string; // ISO
}

export interface SyncState {
  id: 'singleton';
  last_synced_rev: number;
  last_synced_at: string | null;
  last_error: string | null;
}

export class TrailerDB extends Dexie {
  checklists!: Table<Checklist, string>;
  items!: Table<Item, string>;
  media!: Table<Media, string>;
  runs!: Table<Run, string>;
  settings!: Table<Settings, string>;
  tombstones!: Table<Tombstone, string>;
  sync_state!: Table<SyncState, string>;

  constructor() {
    super('trailer-checklist');
    this.version(1).stores({
      checklists: 'id, updated_at',
      items: 'id, checklist_id',
      media: 'id',
      runs: 'id, sync_status, finished_at',
      settings: 'id',
    });
    this.version(2).stores({
      checklists: 'id, updated_at',
      items: 'id, checklist_id',
      media: 'id',
      runs: 'id, sync_status, finished_at',
      settings: 'id',
      tombstones: 'id',
      sync_state: 'id',
    });
  }
}

export const db = new TrailerDB();
