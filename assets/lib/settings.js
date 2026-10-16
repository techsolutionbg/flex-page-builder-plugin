const BASE = '/admin/plugins/flex/page-builder';

export function createPanel(host) {
  const {React, components: C, request, toast, icons} = host;
  const h = React.createElement;

  function SettingsTab() {
    const [enabled, setEnabled] = React.useState(false);
    const [loaded, setLoaded] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState('');
    const changed = host.useWorkspaceChanged?.();
    const saved = host.useWorkspaceSaved?.();

    React.useEffect(() => {
      let active = true;
      request(BASE + '/settings').then((data) => {
        if (!active) return;
        setEnabled(data.settings?.allow_html_import === true);
        setLoaded(true);
      }).catch((err) => {
        if (!active) return;
        setError(err.message || 'Настройките не можаха да бъдат заредени.');
        setLoaded(true);
      });
      return () => { active = false; };
    }, []);

    function update(event) {
      setEnabled(event.target.checked);
      setError('');
      changed?.();
    }

    async function save(event) {
      event.preventDefault();
      setSaving(true);
      setError('');
      try {
        const data = await request(BASE + '/settings', 'PUT', {allow_html_import: enabled});
        setEnabled(data.settings?.allow_html_import === true);
        saved?.();
        toast?.('Настройките на Flex Page Builder са запазени.');
      } catch (err) {
        setError(err.message || 'Настройките не можаха да бъдат запазени.');
      } finally {
        setSaving(false);
      }
    }

    if (!loaded) return h('p', {role: 'status'}, 'Зареждане на настройките…');

    return h('form', {className: 'react-edit-form', onSubmit: save},
      error && h('p', {className: 'react-inline-error', role: 'alert'}, error),
      h(C.CollapsibleSection, {
        title: 'Импорт на HTML документи',
        icon: icons.Settings,
        storageKey: 'flex-page-builder-html-import-settings',
        defaultOpen: true,
      },
      h('p', {className: 'react-field-hint'}, 'Определя дали Page Builder да може да разпознава HTML съдържание, което не е създадено от него.'),
      h(C.CheckboxField, {
        checked: enabled,
        label: 'Разреши разпознаване на външни HTML документи',
        description: 'При включена настройка пасивният външен HTML се разделя на избираеми блокове. Скриптове, PHP и интерактивни елементи остават в един защитен блок, който трябва да бъде премахнат, преди запис.',
        disabled: saving,
        onChange: update,
      })),
      h('div', {className: 'react-form-actions'},
        h(C.LoadingButton, {type: 'submit', loading: saving, disabled: saving, icon: h(icons.Save)}, 'Запази настройките')));
  }

  return SettingsTab;
}
