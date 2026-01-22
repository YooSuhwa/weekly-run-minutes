---
trigger: model_decision
description: when working for internationalization or localization.
---

# I18n Workflow

## Source of Truth

The single source of truth for all internationalization (i18n) keys is located in `packages/i18n/src/`.

- **Do NOT** edit files in `apps/web/src/config/messages` or `apps/mobile/lib/i18n` directly.
- **ALWAYS** make changes in `packages/i18n/src/*.arb` (e.g., `en.arb`, `ko.arb`, `ja.arb`).

## Workflow

### 1. Modify Keys

Add, update, or delete keys in `packages/i18n/src/en.arb`.

Sync these changes to other language files (`ko.arb`, `ja.arb`) as needed.

#### ARB File Format

```json
{
  "@@locale": "en",
  "appTitle": "Fullstack Starter",
  "@appTitle": {
    "description": "The app title"
  },
  "loading": "Loading...",
  "@loading": {
    "description": "Loading indicator text"
  },
  "error": "An error occurred",
  "@error": {
    "description": "Generic error message"
  },
  "save": "Save",
  "@save": {
    "description": "Save button text"
  }
}
```

### 2. Build & Distribute

Run build command to process source ARB files and distribute them to both applications.

```bash
mise //packages/i18n:build
```

This command performs the following:

- **For Web (`apps/web`)**:
  - Converts flat keys (e.g., `appTitle`, `loading`) to nested JSON objects.
  - Organizes keys into groups (`common`, `title`, etc.).
  - Outputs to `apps/web/src/config/messages/*.json`.

- **For Mobile (`apps/mobile`)**:
  - Preserves flat ARB format.
  - Adds `app_` prefix to each locale file (e.g., `app_en.arb`).
  - Outputs to `apps/mobile/lib/i18n/messages/*.arb`.

#### Target-Specific Builds

```bash
# Build only for web
mise //packages/i18n:build:web

# Build only for mobile
mise //packages/i18n:build:mobile
```

### 3. Apply to Mobile

After assets are distributed to `apps/mobile/lib/i18n`, regenerate Dart localization classes.

```bash
cd apps/mobile
flutter gen-l10n
```

*Note: This generates Dart files in `apps/mobile/lib/i18n/generated/`.*

## Key Organization

### Web Output Structure

The build script organizes keys into nested groups:

```json
{
  "title": "Fullstack Starter",
  "common": {
    "loading": "Loading...",
    "error": "An error occurred",
    "save": "Save",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "delete": "Delete",
    "retry": "Retry"
  }
}
```

### Special Keys

- `appTitle` → Mapped to `title` in web output
- `loading`, `error`, `save`, `cancel`, `confirm`, `delete`, `retry` → Grouped under `common`
- All other keys → Top-level keys in web output

## Using Translations

### Web (Next.js)

```typescript
import { getMessages } from '@/lib/i18n/config';

export async function generateMetadata({ params: { locale } }) {
  const messages = getMessages(locale);

  return {
    title: messages.title,
  };
}

// In components
import { useTranslations } from 'next-intl';

function MyComponent() {
  const t = useTranslations('common');
  return <button>{t('save')}</button>;
}
```

### Mobile (Flutter)

```dart
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter/material.dart';

class MyWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: () {},
      child: Text(AppLocalizations.of(context)!.save),
    );
  }
}
```

## Adding New Translations

### Step 1: Add to Source Files

```json
// packages/i18n/src/en.arb
{
  "@@locale": "en",
  "newFeature": "New Feature",
  "@newFeature": {
    "description": "Label for new feature button"
  }
}

// packages/i18n/src/ko.arb
{
  "@@locale": "ko",
  "newFeature": "새로운 기능"
}

// packages/i18n/src/ja.arb
{
  "@@locale": "ja",
  "newFeature": "新機能"
}
```

### Step 2: Build

```bash
mise //packages/i18n:build
```

### Step 3: Update Mobile (if needed)

```bash
cd apps/mobile
flutter gen-l10n
```

### Step 4: Use in Code

```typescript
// Web
const t = useTranslations();
return <button>{t('newFeature')}</button>;

// Mobile
Text(AppLocalizations.of(context)!.newFeature)
```

## Best Practices

1. **Always include descriptions** (`@key`) for translators
2. **Keep keys descriptive** - use context (e.g., `button_save` vs `save`)
3. **Use consistent naming** across all locales
4. **Test all locales** after adding new translations
5. **Build frequently** to catch errors early
6. **Don't modify generated files** - they will be overwritten

## Troubleshooting

### Build Fails

```bash
# Clear build artifacts
rm -rf packages/i18n/dist apps/web/src/config/messages apps/mobile/lib/i18n/messages

# Rebuild
mise //packages/i18n:build
```

### Mobile Not Showing Translations

```bash
# Regenerate localization files
cd apps/mobile
flutter clean
flutter pub get
flutter gen-l10n
```

### Web Shows Keys Instead of Text

1. Check that the build ran successfully
2. Verify the locale code matches (e.g., `en` vs `en-US`)
3. Check that the messages directory exists and contains JSON files
