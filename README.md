# Flex Page Builder

A visual page builder for Flex CMS. Pages pick a theme layout and optionally a reusable builder header and footer. Empty header/footer means the theme chrome is used.

Version: **0.1.0** · ID: `flex/page-builder` · Minimum Flex CMS version: **0.1.68**.

GitHub repository: `techsolutionbg/flex-page-builder-plugin`.

## Requirements and installation

Requires an installed Flex CMS 0.1.68 or later with PHP 8.3+ and its database. The active theme must render a content slot when `flex_page_builder` is set, and must print saved builder HTML (a root with the class `fpb-root`) between that layout's header and footer. Themes that support builder chrome should honor `$flex_builder_header` / `$flex_builder_footer` (see below).

Place the package in `plugins/flex/page-builder/`, with `plugin.json` directly inside that folder. From the Flex CMS root:

```sh
php bin/flex plugin:install flex/page-builder
php bin/flex plugin:activate flex/page-builder
```

With Docker, prefix the commands with `docker compose exec app`. Installation creates the `flex_page_builder_documents` and `flex_page_builder_chrome` tables when they are missing. The plugin requests the `admin.ui`, `events.listen`, `routes.admin` and `frontend.assets` permissions.

Deactivating the plugin removes the builder screen and the row action. The page content stays as the builder last saved it, as ordinary HTML, so the site and the classic editor keep working.

## How it is used

- **Отвори в Page Builder** in the **Действия** menu of every page, and at the start of the classic page editor, opens `/extension-pages/flex-page-builder-editor/{id}/edit`.
- The screen covers the admin window: a palette, the real theme header and footer around the content, and an inspector.
- **Лейаут** lists the templates declared by the active theme. The choice is stored as the page template.
- **Шапки и футери** under **Съдържание** is the CRUD library: create (choose header or footer), edit design, delete.
- On a page, pick chrome from **Шапка** / **Футър** in Page Builder, or from **Настройки → Шапка и футър**. Empty = theme chrome.
- **Бюро**, **Таблет** and **Телефон** change only the preview width.
- **Запази** (also Ctrl+S) writes the element document and the compiled HTML into the page. A reload of the public page shows that content between the resolved header and footer.

## Theme contract: builder header and footer

Core applies the `theme.render.data` filter before the theme template runs. This plugin may set:

| Variable | When set |
| --- | --- |
| `$flex_builder_header` | Non-empty HTML string for a page that selected a builder header |
| `$flex_builder_footer` | Non-empty HTML string for a page that selected a builder footer |

When the value is missing, `null`, or an empty string, the theme must print its normal header/footer. When it is a non-empty string, print it instead of the theme chrome (no extra escaping — it is already compiled HTML with an `fpb-root fpb-chrome fpb-chrome--header|footer` wrapper).

PHP example:

```php
$builderHeader = is_string($flex_builder_header ?? null) ? trim($flex_builder_header) : '';
if ($builderHeader !== '') {
    echo $builderHeader;
} else {
    require __DIR__ . '/partials/header.php';
}
```

Menus stay available via `$flex_menu` / `$flex_menu_html` inside the theme header when builder chrome is not used. v1 has no “hidden header” option — only theme or a selected builder header.

## Elements

Heading (H1–H6), paragraph, image, button, list, divider, spacer and HTML. Headings, paragraphs, buttons and lists have a text size in pixels; an empty size leaves the theme's size.

The server compiler is the source of the saved HTML. Text is escaped. The HTML element drops scripts, frames, forms and inline event handlers.

## Admin API

All routes are under `/admin/plugins/flex/page-builder` and require an admin session (with CSRF protection for changes).

| Method and path | Purpose |
| --- | --- |
| `GET /pages/{id}` | The page, layout, theme layouts, elements, `header_id`, `footer_id`, chrome lists and `base_hash` |
| `PUT /pages/{id}` | Save `{elements, layout, header_id, footer_id, base_hash, force?}`; `409` when the page changed since `base_hash` |
| `GET /pages/{id}/frame?template=` | The theme layout with an empty content slot |
| `PUT /pages/{id}/chrome` | Assign `{header_id, footer_id}` without rewriting page content |
| `GET /chrome` | `{headers, footers, items, layouts, defaults, button_styles}` |
| `PUT /chrome` | Reserved; returns the current library lists |
| `GET /chrome/frame?template=` | Theme layout frame for chrome-only editing |
| `GET /chrome/{id}` | One chrome document (`elements`, `html`, …) |
| `PUT /chrome/{id}` | Save `{kind, name, elements}` and compile a snapshot |
| `DELETE /chrome/{id}` | Remove a chrome document |

## License

This plugin is licensed under the GNU General Public License, version 2 or (at your option) any later version (`GPL-2.0-or-later`). The full text of version 2 is in [`LICENSE`](LICENSE).
