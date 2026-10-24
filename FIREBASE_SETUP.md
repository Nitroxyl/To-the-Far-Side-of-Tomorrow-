# Santara Fieldwork — Firebase setup

This integration links **two separate GitHub Pages repositories** to **one Firebase project**. The GM's private fieldwork data remains in local browser storage. Only the explicitly published, player-safe snapshot is uploaded to Firestore at `santara_publication/current`. The player website listens for changes and imports them automatically; individual player notes remain local.

## 1. Create or select one Firebase project

Visit https://console.firebase.google.com/ and create a project, or choose an existing project you want to use for Santara. Under **Project settings → Your apps**, register a **Web app**. You can use the **same Firebase web app configuration** for both sites, since both repositories connect to the same backend. Copy the configuration object (fields such as `apiKey`, `authDomain`, `projectId`, `appId`).

## 2. Add the same web config to both repositories

Edit `firebase-config.js` on the GM site **and** the player site. Replace the four `PASTE_...` placeholders with the values from the Firebase console. If the console provided `messagingSenderId` or `storageBucket`, you may uncomment those lines and enter them too. The config is public information, **not a service account key**. Never copy a private key into these files.

## 3. Enable the required Firebase services

In **Build → Firestore Database**, create a database. Choose the correct location for your needs, then deploy the security rules from `firestore.rules` in the GM repository. Do not use permissive test-mode rules in production.

In **Build → Authentication → Sign-in method**, enable **Google**. Under **Authentication → Settings → Authorized domains**, include `nitroxyl.github.io` (and localhost if testing there). You may need to add this domain manually.

## 4. Set your GM UID in Firestore security rules

1. Open your GM GitHub Pages website and use the **Sign in with Google** button in its Firestore panel.
2. Return to Firebase Console → **Authentication → Users** and find your Google account's **User UID**.
3. Open Firebase Console → **Firestore Database → Rules** and paste the `firestore.rules` contents. Replace `PASTE_GM_AUTH_UID` with your exact UID, then **Publish** the rules.
4. Signing in using any other Google account must **not** grant publishing permissions. Only your UID can write `santara_publication/current`.

If you reuse a Firebase project with existing collections, **merge the Santara match block into the existing rules** instead of replacing the entire ruleset, or you may break unrelated applications. Rules committed to GitHub are **not automatically deployed** to Firebase.

## 5. Publish an update

1. In the GM console, edit each location/request/Pokémon that should be visible. Check **Publish to players**; don't reveal `Hidden`, `Secret`, or `Locked` records.
2. Open **Publish to players** in the GM dashboard to review the preview.
3. Sign in to the Firestore panel and click **Publish visible records**, then confirm.
4. On the player website, the **Live Pokédex** panel should show that it synced the publication. Players do not need to sign in or import any file. Reloading the page also fetches the latest published snapshot.

The publication is a **replacement snapshot**, not a history of events. If you untick a record and publish again, it will disappear from the synchronized records in player browsers. Their local, manually created records remain untouched. Keep backups of local notes.

## 6. Test the permissions

- Open the Player Pokédex in an incognito window. It should receive the GM publication without signing in.
- Uncheck one published test entry, publish again, and check that it disappears from synchronized player records.
- Sign out of the GM panel and verify the Publish button is disabled.
- Sign in as a different Google user. Its attempt to publish should fail with `permission-denied`.
- Restore your original entries and publish again.

## Major privacy warning: your GM repository is public

**The GM site's current `index.html` includes private campaign seed information inside the HTML. Firestore rules cannot hide this.** Simply adding a login button also cannot secure those secrets, because anyone can read the public HTML source. Set the GM GitHub repository to private and **do not rely on public GitHub Pages to protect the GM site**. On standard GitHub Pages hosting, a private repository does not automatically mean the deployed website is private. Use a private/local copy for GM work or move the GM's private seed records to a properly authenticated backend before hosting publicly. If secrets were previously on the public repository, they may remain in public forks/caches or repository history.

## Troubleshooting

- **Offline mode**: one or more `firebase-config.js` placeholders hasn't been replaced.
- **Permission denied on publish**: Firestore rules weren't deployed, the UID doesn't match your account, or you're signed into the wrong Google account.
- **Popup blocked/unauthorized domain**: add the GitHub Pages host to Firebase Authentication Authorized domains and try signing in again.
- **No changes on player site**: both sites must use the same Firebase `projectId`; confirm both sites are deployed and publication was successful.
- **Your GM edits disappeared on another device**: this integration **does not cloud-save GM private data**; GM storage is still browser-local. Export GM backups until a separate private, authenticated cloud-save feature is built.
- **Existing other Firebase app stopped working**: merge rather than replace its Firestore rules (see step 4).
