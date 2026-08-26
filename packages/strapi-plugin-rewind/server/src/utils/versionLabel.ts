import type { Core } from '@strapi/strapi';

/**
 * Which field the Content Manager treats as a type's title.
 *
 * Returned as a function so the lookup is cached per content type: a backfill
 * runs it once per row, a snapshot once per relation target, and the
 * configuration behind it does not change while the server is up.
 *
 * `undefined` when the type has no configuration yet - which happens for a
 * content type added since the last admin build - so callers guess instead.
 */
export const createMainFieldResolver = (strapi: Core.Strapi) => {
  const mainFieldByUid = new Map<string, string | undefined>();

  return async (uid: string): Promise<string | undefined> => {
    if (mainFieldByUid.has(uid)) return mainFieldByUid.get(uid);

    let mainField: string | undefined;
    try {
      const configuration = await strapi
        .plugin('content-manager')
        .service('content-types')
        .findConfiguration(strapi.contentTypes[uid]);
      mainField = configuration?.settings?.mainField;
    } catch {
      // No configuration for this type - the caller falls back to guessing.
    }

    mainFieldByUid.set(uid, mainField);
    return mainField;
  };
};

/**
 * Field names worth trying when the Content Manager has no opinion.
 *
 * Shared with {@link import('../services/serializer').labelFieldsFor}, so a
 * version and the relations inside it are named by the same rule.
 */
export const LABEL_FIELD_CANDIDATES = ['title', 'name', 'label'];

/**
 * Derives the short, human-readable stand-in shown for a version in the panel.
 *
 * Without it every row is a badge and a timestamp, so two versions holding
 * completely different content look identical and nothing tells an editor what
 * pressing Restore would give them.
 *
 * The field is whatever the Content Manager displays as the entry's title, so
 * the panel agrees with the rest of the admin.
 */
export const createLabeller = (strapi: Core.Strapi) => {
  const mainFieldFor = createMainFieldResolver(strapi);

  return async (
    uid: string,
    data: Record<string, unknown> | null | undefined
  ): Promise<string | null> => {
    if (!data) return null;

    const mainField = await mainFieldFor(uid);
    const candidates = [mainField, ...LABEL_FIELD_CANDIDATES].filter(Boolean) as string[];

    for (const field of candidates) {
      const value = data[field];
      if (typeof value === 'string' && value.trim()) {
        return value.trim().slice(0, 255);
      }
    }

    return null;
  };
};
