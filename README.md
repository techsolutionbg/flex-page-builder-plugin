# Flex Page Builder

A visual page builder for Flex CMS. The theme supplies the layouts: each layout draws the header and footer. The plugin chooses which layout a page uses and builds only the content between them.

Version: **0.1.0** · ID: `flex/page-builder` · Minimum Flex CMS version: **0.1.68**.

GitHub repository: `techsolutionbg/flex-page-builder-plugin`.

## Requirements and installation

Requires an installed Flex CMS 0.1.68 or later with PHP 8.3+ and its database. The active theme must render a content slot when `flex_page_builder` is set, and must print saved builder HTML (a root with the class `fpb-root`) between that layout's header and footer.

Place the package in `plugins/flex/page-builder/`, with `plugin.json` directly inside that folder. From the Flex CMS root:

```sh
php bin/flex plugin:install flex/page-builder
php bin/flex plugin:activate flex/page-builder
```

With Docker, prefix the commands with `docker compose exec app`. Installation creates the `flex_page_builder_documents` table when it is missing. The plugin requests the `admin.ui`, `events.listen`, `routes.admin` and `frontend.assets` permissions.

Deactivating the plugin removes the builder screen and the row action. The page content stays as the builder last saved it, as ordinary HTML, so the site and the classic editor keep working.

## How it is used

- **Отвори в Page Builder** in the **Действия** menu of every page, and at the start of the classic page editor, opens `/extension-pages/flex-page-builder-editor/{id}/edit`.
- The screen covers the admin window: a palette, the real theme header and footer around the content, and an inspector.
- **Лейаут** lists the templates declared by the active theme. The choice is stored as the page template.
- **Бюро**, **Таблет** and **Телефон** change only the preview width.
- **Запази** (also Ctrl+S) writes the element document and the compiled HTML into the page. A reload of the public page shows that content between the layout's header and footer.

## Elements

Heading (H1–H6), paragraph, image, button, list, divider, spacer and HTML. Headings, paragraphs, buttons and lists have a text size in pixels; an empty size leaves the theme's size.

The server compiler is the source of the saved HTML. Text is escaped. The HTML element drops scripts, frames, forms and inline event handlers.

## Admin API

All routes are under `/admin/plugins/flex/page-builder` and require an admin session (with CSRF protection for changes).

| Method and path | Purpose |
| --- | --- |
| `GET /pages/{id}` | The page, its layout, the theme layouts, the elements and `base_hash` |
| `PUT /pages/{id}` | Save `{elements, layout, base_hash, force?}`; `409` when the page changed since `base_hash` |
| `GET /pages/{id}/frame?template=` | The theme layout with an empty content slot |

## License

This plugin is licensed under the GNU General Public License, version 2 or (at your option) any later version (`GPL-2.0-or-later`). The full text of version 2 is in [`LICENSE`](LICENSE).
