import { emptyBundle, type BundleChecklist, type ContentBundle } from '$lib/sync/bundle';

export function mkChecklist(
  id: string, name: string, updated_at: string,
  extra: Partial<BundleChecklist> = {},
): BundleChecklist {
  return {
    id, name_en: name, name_is: `${name}-is`,
    item_order: [], created_at: '2026-01-01T00:00:00.000Z', updated_at,
    items: [], ...extra,
  };
}

export function mkBundle(checklists: BundleChecklist[], extra: Partial<ContentBundle> = {}): ContentBundle {
  return { ...emptyBundle(), checklists, ...extra };
}
