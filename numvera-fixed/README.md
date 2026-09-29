# Numvera Naija Stage 7

Stage 7 prepares Numvera for a polished Android release and a more confident product experience.

## Included

- Refined product language and interface positioning
- Android packaging configuration using Capacitor
- Application ID: `com.numvera.naija`
- Version: `1.0.0`
- Android HTTPS scheme
- Existing Supabase foundation
- Existing smart planning and workspace features
- Privacy policy draft
- Release preparation notes

## Local web preview

Open `index.html` for the browser experience. Supabase features require the configured project values in `js/config.js` and a deployed backend.

## Android build preparation

Install Node.js and Android Studio, then run:

```bash
npm install
npx cap add android
npm run android:sync
npx cap open android
```

In Android Studio:

1. Set the app label and icon.
2. Confirm the package ID is `com.numvera.naija`.
3. Configure a release signing key.
4. Build an Android App Bundle using the Release variant.
5. Test the bundle through Google Play internal testing.

The generated Android project is intentionally not included because Capacitor creates platform files during `npx cap add android`, and Android Studio must supply the local SDK and signing environment.

## Production checks before publishing

- Configure Supabase production URL and public key.
- Confirm authentication redirect URLs.
- Configure secure server environment variables in Vercel.
- Test file uploads and access permissions.
- Test account deletion and data removal.
- Test Android back navigation and file selection.
- Complete Play Console Data Safety and content declarations.
- Add a reviewed privacy policy and support contact.
- Test on physical Android devices.
