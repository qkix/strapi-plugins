// `ArrowsHorizontal` - content going out and content coming in, which is the
// whole plugin. Deliberately not `Upload` or `Download`: each of those names
// one direction, and picking either makes the menu entry look like half of
// what it is. `Archive` was the other candidate and reads as storage rather
// than movement.
import { ArrowsHorizontal } from '@strapi/icons';

import { ExportBulkAction, ExportViewAction } from './components/exportActions';
import { PLUGIN_ID } from './pluginId';

export default {
  register(app: any) {
    app.registerPlugin({ id: PLUGIN_ID, name: PLUGIN_ID, isReady: true });

    app.addMenuLink({
      to: `/plugins/${PLUGIN_ID}`,
      icon: ArrowsHorizontal,
      intlLabel: { id: `${PLUGIN_ID}.menu.label`, defaultMessage: 'Ferry' },
      Component: async () => {
        const { TransferPage } = await import('./pages/TransferPage');
        return { default: TransferPage };
      },
      permissions: [{ action: `plugin::${PLUGIN_ID}.export`, subject: null }],
    });
  },

  bootstrap(app: any) {
    const contentManager = app.getPlugin('content-manager');

    /**
     * Export from the list view, in the two shapes the question comes in.
     *
     * A bulk action for the rows someone ticked, and a button beside the view
     * settings for whatever the filters currently match. They are separate
     * controls because a bulk action does not exist until something is
     * selected, and selection is per page - so it cannot answer "all three
     * hundred of these", which is the other half of the same job.
     *
     * Placed before Delete rather than appended: the destructive action stays
     * last, where muscle memory expects it.
     */
    contentManager.apis.addBulkAction((actions: any[]) => {
      const destructive = actions.findIndex((action) => action.type === 'delete');
      const at = destructive === -1 ? actions.length : destructive;

      return [...actions.slice(0, at), ExportBulkAction, ...actions.slice(at)];
    });

    contentManager.injectComponent('listView', 'actions', {
      name: `${PLUGIN_ID}-export-view`,
      Component: ExportViewAction,
    });
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = await import(`./translations/${locale}.json`);
          return { data, locale };
        } catch {
          return { data: {}, locale };
        }
      })
    );
  },
};

export { PLUGIN_ID } from './pluginId';
