import * as React from 'react';

import { useFetchClient } from '@strapi/admin/strapi-admin';
import {
  Button,
  Field,
  Flex,
  Modal,
  SingleSelect,
  SingleSelectOption,
  Typography,
} from '@strapi/design-system';

import {
  DEFAULT_EXPORT,
  routes,
  saveFile,
  type ExportEnvelope,
  type ExportRequest,
  type Format,
  type Status,
} from '../api';

/**
 * The export dialog the Content Manager opens, for either scope.
 *
 * One component for "the rows I ticked" and "everything in this view", because
 * the two differ only in which keys of the request are filled in. What they
 * must not differ in is the answer to "what am I about to get" - a dialog that
 * asks the same questions but means something different each time is worse
 * than two dialogs.
 *
 * Only format and status are offered. The full page keeps the rest: relations
 * and media are defaults nobody changes per export, and a list view is not the
 * place to relearn them.
 */
export const ExportScopeDialog = ({
  /** What is being exported, in words, e.g. "3 selected entries". */
  scope,
  /** The scope as request keys - `documentIds`, or `filters` and `locale`. */
  request,
  uid,
  onClose,
}: {
  scope: string;
  request: Partial<ExportRequest>;
  uid: string;
  onClose: () => void;
}) => {
  const { post } = useFetchClient();

  const [format, setFormat] = React.useState<Format>(DEFAULT_EXPORT.format);
  const [status, setStatus] = React.useState<Status>(DEFAULT_EXPORT.status);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);

  const run = async () => {
    setBusy(true);
    setError(null);
    setWarnings([]);

    try {
      // `envelope` asks for the file as a string inside JSON rather than as a
      // download, for the reason spelled out in ExportPanel: Strapi's admin
      // fetch client parses every response as JSON whatever it is handed, so a
      // real download reaches the browser as a parsed object.
      const { data } = await post<ExportEnvelope>(routes.export, {
        uid,
        ...DEFAULT_EXPORT,
        ...request,
        format,
        status,
        envelope: true,
      });

      saveFile(data.body, data.filename, data.mime);

      // Warnings keep the dialog open. A truncated export or one that dropped
      // its components is still a file in the downloads folder, and closing on
      // success would be the last chance to say so.
      if (data.warnings?.length) {
        setWarnings(data.warnings);
        return;
      }

      onClose();
    } catch (caught: any) {
      setError(caught?.response?.data?.error?.message ?? 'The export failed.');
    } finally {
      setBusy(false);
    }
  };

  // No Modal.Root, Modal.Content or Modal.Header here: the Content Manager's
  // own DocumentActionModal renders all three around this, and takes the title
  // from the action's description. Adding them again nests a dialog in a dialog
  // and prints the title twice.
  return (
    <>
      <Modal.Body>
        <Flex direction="column" alignItems="stretch" gap={4}>
          <Typography textColor="neutral700">Exporting {scope}.</Typography>

          <Field.Root name="ferry-format">
            <Field.Label>Format</Field.Label>
            <SingleSelect
              value={format}
              onChange={(value) => setFormat(String(value) as Format)}
              disabled={busy}
            >
              <SingleSelectOption value="json">JSON</SingleSelectOption>
              <SingleSelectOption value="csv">CSV</SingleSelectOption>
            </SingleSelect>
          </Field.Root>

          <Field.Root name="ferry-status">
            <Field.Label>Version</Field.Label>
            <SingleSelect
              value={status}
              onChange={(value) => setStatus(String(value) as Status)}
              disabled={busy}
            >
              <SingleSelectOption value="draft">Draft</SingleSelectOption>
              <SingleSelectOption value="published">Published</SingleSelectOption>
            </SingleSelect>
          </Field.Root>

          {warnings.length > 0 ? (
            <Flex direction="column" alignItems="flex-start" gap={1}>
              <Typography variant="pi" textColor="warning600" fontWeight="bold">
                The file was saved, with warnings:
              </Typography>
              {warnings.map((warning) => (
                <Typography key={warning} variant="pi" textColor="warning600">
                  {warning}
                </Typography>
              ))}
            </Flex>
          ) : null}

          {error ? <Typography textColor="danger600">{error}</Typography> : null}
        </Flex>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="tertiary" onClick={onClose} disabled={busy}>
          {warnings.length > 0 ? 'Close' : 'Cancel'}
        </Button>
        <Button onClick={run} loading={busy}>
          Export
        </Button>
      </Modal.Footer>
    </>
  );
};
