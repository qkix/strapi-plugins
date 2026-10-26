import type { QueueItem } from './api';

/**
 * The document the edit view is showing, or `undefined` before its first save.
 *
 * The Content Manager hands panels and document actions the id from the URL.
 * A collection type's URL carries one; a single type's URL is only
 * `/content-manager/single-types/:model`, so there the id is `undefined` even
 * for a saved entry, and only the loaded document knows it.
 */
export const documentIdOf = (props?: {
  documentId?: string;
  document?: { documentId?: string } | null;
}): string | undefined => props?.documentId || props?.document?.documentId || undefined;

/** Where the queue sends a reviewer: the edit view for this item's kind. */
export const editViewPath = (
  item: Pick<QueueItem, 'contentTypeUid' | 'contentTypeKind' | 'documentId' | 'locale'>
): string => {
  const path =
    item.contentTypeKind === 'singleType'
      ? `/content-manager/single-types/${item.contentTypeUid}`
      : `/content-manager/collection-types/${item.contentTypeUid}/${item.documentId}`;

  return path + (item.locale ? `?plugins[i18n][locale]=${item.locale}` : '');
};
