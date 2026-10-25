# Fix: Pokémon request denied for authorized GM accounts

## Root cause
The live Player Pokémon Manager authorizes a verified delegated GM through `santara_gm_accounts/{uid}` and the founding GM through its bootstrap UID. However, the Firestore **create** rule for `santara_pokemon_requests` still required `approved()`. A GM who lacked a separate `santara_player_access/{uid}` record could view My Pokémon but was denied when submitting a new request.

This fix changes **only the create gate** from `approved()` to `member()`. `member()` is already defined as `gm() || approved()`. All existing request validations remain unchanged: the request must belong to the signed-in UID, start pending, contain the permitted fields and use a server timestamp. Players cannot self-grant GM roles or approve their own requests.

## Deployment — order matters
1. Open the GM pull request's **full `firestore.rules` file in its feature branch**, then copy it into Firebase Console → Firestore Database → Rules and **Publish**. GitHub commits do not publish Firestore rules.
2. Retry **My Pokémon → Request Pokémon** using the same previously failing account. A correctly authorized GM can now request a Pokémon without having to create a redundant Trainer approval record.
3. Merge both pull requests for improved diagnostic messages and GM review handling, then reload the Pokémon page using the updated sidebar link. If the form still shows permissions denied, open **Account & GM Access**, confirm this exact signed-in UID has either an enabled verified GM role or ordinary Trainer approval, and check that Firebase Console accepted/published the new rules.
4. On the GM website, review the incoming request and assign it. Verified GM requesters can be selected from the queue even if they have no standalone Trainer approval, including later editing their assigned Pokémon.

This is a narrowly scoped access correction. No existing Pokémon, Trainer Cards or custom content are migrated, modified or removed. Live Firebase deployment and security checks still need to be performed after publishing.
