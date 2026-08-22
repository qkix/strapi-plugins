import * as React from 'react';

import { useQueryParams, useRBAC } from '@strapi/admin/strapi-admin';
import { Button, Modal } from '@strapi/design-system';
import { Download } from '@strapi/icons';

import { ExportScopeDialog } from './ExportScopeDialog';

import { PLUGIN_ID } from '../pluginId';

/**
 * Ferry only ever carries project content types.
 *
 * The server refuses anything else - `schema.allowed()` requires an `api::` uid
 * - so offering the button on the upload library's list view would be offering
 * a 400. Same rule, stated twice, because the alternative is a control that
 * only fails once pressed.
 */
const exportable = (uid: string): boolean => uid.startsWith('api::');

const EXPORT_PERMISSION = [{ action: `plugin::${PLUGIN_ID}.export`, subject: null }];

/** The list view's query, as far as an export cares about it. */
interface ListQuery {
  filters?: Record<string, unknown>;
  sort?: string;
  plugins?: { i18n?: { locale?: string } };
}

/**
 * Which locale the list view is showing.
 *
 * i18n keeps it in the query rather than the path, and a content type without
 * i18n has none - in which case the server takes the default, which is the only
 * one there is.
 */
const localeOf = (query: ListQuery): string | undefined => query.plugins?.i18n?.locale;

/**
 * Export the ticked rows.
 *
 * A bulk action, so it appears only once something is selected, next to Delete
 * and Publish. That is the shape of the request it answers: "a copy of the
 * twelve articles I just fixed".
 */
export const ExportBulkAction = ({ documents, model }: { documents: any[]; model: string }) => {
  const { allowedActions, isLoading } = useRBAC({ export: EXPORT_PERMISSION });
  const [{ query }] = useQueryParams<ListQuery>();

  if (isLoading || !allowedActions.canExport || !exportable(model)) return null;

  const documentIds = documents.map((document) => document.documentId).filter(Boolean);
  if (documentIds.length === 0) return null;

  const count = documentIds.length;

  return {
    label: 'Export',
    icon: <Download />,
    dialog: {
      type: 'modal' as const,
      title: 'Export',
      content: ({ onClose }: { onClose: () => void }) => (
        <ExportScopeDialog
          uid={model}
          scope={`${count} selected ${count === 1 ? 'entry' : 'entries'}`}
          request={{ documentIds, locale: localeOf(query) }}
          onClose={onClose}
        />
      ),
    },
  };
};

/**
 * Export everything the current filters match.
 *
 * The other half of the same job, and it cannot be the same control: a bulk
 * action exists only while rows are ticked, and ticking is per page. Narrowing
 * a list to three hundred entries and wanting all of them is the case this
 * covers, and there is no way to tick them.
 *
 * Lives in the `listView.actions` injection zone, beside the view settings -
 * always visible, because the filters it follows always exist, even when they
 * are "no filters at all".
 */
export const ExportViewAction = () => {
  const { allowedActions, isLoading } = useRBAC({ export: EXPORT_PERMISSION });
  const [{ query }] = useQueryParams<ListQuery>();
  const [open, setOpen] = React.useState(false);

  // The zone gives no props, so the content type comes from the route - the
  // same trick the list-view hooks need. Not anchored at the start: the admin
  // can be mounted under a base path.
  const match = window.location.pathname.match(/\/content-manager\/collection-types\/([^/?#]+)/);
  const uid = match ? decodeURIComponent(match[1]) : null;

  if (isLoading || !allowedActions.canExport || !uid || !exportable(uid)) return null;

  const filters = query.filters;
  const filtered = Boolean(filters && Object.keys(filters).length > 0);

  return (
    <>
      <Button variant="tertiary" startIcon={<Download />} onClick={() => setOpen(true)}>
        Export
      </Button>

      {/*
        The Content Manager wraps a bulk action's content in a dialog for you.
        An injected component gets no such courtesy, so this half brings the
        frame and the title that the other half is handed.
      */}
      {open ? (
        <Modal.Root open onOpenChange={() => setOpen(false)}>
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Export</Modal.Title>
            </Modal.Header>
            <ExportScopeDialog
              uid={uid}
              scope={
                filtered ? 'everything matching this view' : 'every entry of this content type'
              }
              request={{ filters, sort: query.sort, locale: localeOf(query) }}
              onClose={() => setOpen(false)}
            />
          </Modal.Content>
        </Modal.Root>
      ) : null}
    </>
  );
};
