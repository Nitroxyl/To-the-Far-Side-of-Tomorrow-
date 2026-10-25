# Legacy accounts and delegated GM permissions

## Why existing accounts were denied
The original Player Dex, Pokémon Manager and Trainer Passport used different Firebase access gates. Only the founding GM UID was recognized as GM, while an old Trainer account without a `santara_player_access/{uid}` approval was denied by the newer Pokémon Manager. **Do not create a second account**: the original Firebase UID should be preserved to keep Trainer Cards and Pokémon under one identity.

## New Account & GM Access page
Both GM and Player Fieldwork sidebars now link to **Account & GM access** (`account-access.html`). This page works for accounts that are not yet approved and supports both email/password and Google sign-in.

For the **existing/main email**:

1. Sign into the Account Access page using **the same provider used when this account was created**. If you originally used email/password, use email/password; if you used Google, use Google. These two actions can resolve to different Firebase UIDs unless the provider accounts are explicitly linked.
2. Confirm your **email** and **Firebase UID**. Use **Copy UID** if needed.
3. If unverified, verify the email and click **I have verified my email**. Older accounts can reuse their existing credentials.
4. Click **Request access with this account**. This creates a verified `santara_access_requests/{uid}` document; an account without a request cannot be delegated full GM authority.
5. Sign out and sign back in with the **founding GM account** (the previously configured, immutable bootstrap UID) on the GM Account Access page. The root account can click **Approve Trainer** or **Grant GM access** for the matching verified request. GM access also allows the old account to use the Player Dex without a separate Trainer approval.
6. Sign back into the **main account** and reload Player Fieldwork → My Pokémon, Trainer Cards, and GM Fieldwork → Trainer Pokémon / Trainer approvals / publishing.

If the main account already *is* the founding GM UID, it is automatically recognized; it needs no new approval document or delegated role.

If you no longer control the founding GM identity, an administrator with Firebase Console access must recover that identity or provision the role through a trusted administrative process. **The public webpage intentionally cannot grant itself GM permissions.**

## Firestore rules — publish before merging webpages
The GM repository includes an updated `firestore.rules`. Copy the **entire file from this feature branch** into **Firebase Console → Firestore Database → Rules → Publish**, then merge the GM and Player PRs and allow GitHub Pages to deploy.

The founding GM stays hardcoded as the root of trust. An additional GM is authorized only if:
- the person is signed in with Firebase Auth and has a verified email;
- `santara_gm_accounts/{theirUid}` exists with `enabled: true`;
- its `email` exactly equals their signed-in verified email; and
- the role record was created by the founding GM, after the target user submitted a verified access request.

Only the founding GM can create/update/delete delegated GM records. Delegated GMs can manage ordinary Trainer approvals, Pokémon, custom content, and published records through the existing GM permissions. The founding GM can revoke any delegated record; revocation is enforced by Firestore rules even if the website remains open.

## Testing
- Sign into a verified old main account **without** an approval record: the account status must show its existing UID and offer a request, not a new registration.
- With the founding GM, approve the old account as a Trainer; verify Player Dex, My Pokémon and Trainer Passport access.
- Grant delegated GM to that same verified UID; verify GM Pokémon and publication permissions.
- Sign in with a different unapproved UID: no GM access and no ability to write `santara_gm_accounts`.
- Revoke the delegated GM role and confirm GM-only Firestore actions fail; normal Trainer access remains if separately approved.
- If the user signs in via a different provider that resolves to a different UID, use the original provider. Do not transfer data between UIDs without an explicit migration.

Static JS syntax and rules delimiter checks were performed. Live Firebase rule compilation, authentication and permission tests still need verification after publishing.
