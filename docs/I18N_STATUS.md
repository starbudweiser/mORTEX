# i18n Migration Status

**Last Updated:** 2026-11-19

## Current State

mORTEX is translated into **French, English, Spanish and Italian**. The source language is English:
for most of the interface the key **is** the English text (`t("Select all")`), and `locales/<lang>/*.json`
map it to the translation. English needs no file for those keys (the key is shown as is).

| Language         | Files                                | Top-level entries                   | Notes                                                                           |
| ---------------- | ------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------- |
| `fr`, `es`, `it` | 41 each (`locales/<lang>/<ns>.json`) | 5,129 each (4,207 in `common.json`) | identical key sets in the three languages                                       |
| `en`             | 12                                   | 1,245                               | only the namespaced / nested keys (`collection.json`, `health_check.json`, ...) |

Other points:

- Language choice: `settings_interface/reducers/interface.ts` takes the **first** of the system's preferred
  languages (`navigator.languages`) that is one of fr / en / es / it, otherwise English. The i18next fallback is `en`.
- A community translation pack never hides the bundled texts: `util/i18n.ts` (`mergeMortexStrings`) fills in the keys
  the pack lacks and renames "Vortex" to "mORTEX".
- The two Swift extensions (`mac/swift/MortexIntents`, `MortexQuickLook`) have complete `en/fr/es/it.lproj`.
- 2026-11-19: about 120 visible texts that were missing in fr / es / it were added to `common.json`
  (table menus, view names, downloads flyout, change log, savegame monitoring, plugin sorting, ...), the 3 developer
  messages and "Knowledge base" are now translated in es / it.

### Namespaces configured

`common`, `collection`, `mod_management`, `download_management`, `profile_management`, `nexus_integration`,
`gamemode_management`, `extension_manager`, `health_check`, `gamebryo-plugin-management`, `support_bundle`,
`settings_editor` (see the `ns` array in `src/renderer/src/util/i18n.ts`). Most namespaces other than `common`,
`collection`, `health_check` and the extension-specific files are still small: the text lives in `common.json`.

### Known gaps (not translated yet)

- Texts written as **multi-line or concatenated** literals (`t("..." + "...")`, long `bbcode` dialogs such as the
  "Unsafe Mod Detected" warning in `InstallManager.ts`): roughly 200 keys, they are shown in English.
- `aria-label` / `title` attributes and a few labels written directly in JSX, for example
  `ui/components/pagination/Pagination.tsx`, `category_management/views/CategoryListItem.tsx`,
  `instructions_overlay/InstructionsOverlay.tsx`, `mod_management/views/ModList.tsx`.
- The crash dialog in `src/main/src/errorHandling.ts` (main process, before i18n is up).
- Game and product names (Baldur's Gate 3, Stardew Valley, The Witcher 3, MD5) and the font sample text are
  intentionally left as is.

## Namespaced keys: how they are resolved

`i18n.ts` sets `nsSeparator: ":::"` and `keySeparator: "::"` (old Vortex format, e.g. `t("dialog::title")`).
The newer pages use the standard `namespace:section.key` format. `api.translate(..., { isNamespaceKey: true })`
(`ExtensionManager.ts`) handles this: for that call it switches the separators to `:` and `.`, so
`t("collection:browse.title")` resolves to namespace `collection`, nested key `browse.title`.
`BrowseNexusPage.tsx` does exactly that (`isNamespaceKey: true` in its local `t`), so its keys are **not** shown raw:
this was checked in the code on 2026-11-19. A call that does not pass `isNamespaceKey` must use the `:::` / `::` format
(`t("collection:::browse::title")`).

## Namespace contents

### collection.json (`browse`, `pagination`)

```
browse/
  - title, selectGame, noCollections/{title,message}, searchPlaceholder, searchTooShort,
    resultsCount, sortBy, refresh, tabs/{collections,mods}, modsComingSoon/{title,description,openWebsite}
pagination/
  - goTo, pageNumber, go
```

### common.json

- Pluralization rules, the `actions` section (`actions.search`) and the flat English-text keys.

## Next Steps

### Migration Approach

- **"Fix on Touch"**: translate strings when working on a file.
- **New development**: all new code must use proper keys and add the text in fr, es and it at once.
- **No rush**: existing literal strings work fine (English is shown when a translation is missing).
- Check parity after every change: the three languages must keep the same key set.

## Tools & Resources

- **Migration Guide:** `docs/I18N_MIGRATION_GUIDE.md`
- **Example File:** `src/renderer/src/extensions/browse_nexus/views/BrowseNexusPage.tsx`
- **Namespace Files:** `locales/en/*.json`
- **i18n Config:** `src/renderer/src/util/i18n.ts` (the `ns` array registers namespaces)

## Benefits of Migration

Once fully migrated, this will enable:

✅ Easy translation for external contributors (no code reading required)
✅ Professional translation services can work directly with JSON files
✅ Organized, contextual string structure
✅ Translation completeness tracking
✅ Translation memory systems
✅ Standard industry workflow

## Reference

**Russian translation example:** `C:/Users/insom/Downloads/ru/`

- 28 namespace files
- 1,159+ strings organized by feature
- Proves the namespace structure works at scale
- Shows what full migration looks like

## Configuration

### Namespace registration

The `ns` array in `src/renderer/src/util/i18n.ts`, with `defaultNS` and
`fallbackNS` both set to `common`:

```typescript
ns: [
  "common",
  "collection",
  "mod_management",
  "download_management",
  "profile_management",
  "nexus_integration",
  "gamemode_management",
  "extension_manager",
  "health_check",
],
```

### Separator configuration

```typescript
nsSeparator: ":::",
keySeparator: "::",
```

Both formats are supported, see "Namespaced keys: how they are resolved" above.

## Success Metrics

- **Foundation:** ✅ Complete (namespaces configured, example working)
- **Documentation:** ✅ Complete (guide + status docs created)
- **Proof of Concept:** ✅ Complete (BrowseNexusPage.tsx migrated)
- **Translations fr / es / it:** ✅ same keys in all three, 5,129 entries each; remaining gaps listed above
