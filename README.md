# Mesa Arcana

**English** | [Português (Brasil)](README.pt-BR.md)

A tabletop RPG campaign organizer for game masters and players, with session journals, characters, messaging, and session preparation. Works on desktop and mobile, with local storage and optional synchronization through Supabase.

## Features

- **Campaign:** sessions, shared summaries, and individual player journals.
- **GM Screen:** secrets, private NPC sheets, locations, clues, preparation for the next session, and files.
- **Planned NPCs:** prepare characters privately and review their public cards before revealing them.
- **Characters:** the campaign cast, descriptions, photos, and notes by each player.
- **Messages:** NPC conversations, group chats, and contact permissions for each player.
- **Player:** character portrait, uploaded character sheet image, notes, inventory, relationships, and personal files.
- **World:** locations, items, rules, and factions, with search and enlarged image viewing.
- **Appearance:** light and dark themes, with your preference saved in the browser.
- **Multiple devices:** GM access through a GM invitation and player access through an invitation and PIN.

The GM can view player character sheets, but only the player who owns a profile can change its portrait and character sheet image.

## Running Locally

Requires **Node.js 20 or later**. The build and local server do not require additional packages.

From the project root, run:

```sh
node tools/build.mjs
node tools/serve.mjs
```

Open [http://localhost:4174/](http://localhost:4174/). To access the app from a phone, use the computer's IP address on the same port, with both devices connected to the same network. The computer must stay on and allow the connection through its firewall.

Set the `PORT` environment variable to use a different port. If npm is installed, the equivalent commands are `npm run build` and `npm start`.

## Tables and Synchronization

Without Supabase, data stays in the browser used to access the app. To share a table and use messaging across devices:

1. Create a Supabase project and run [`supabase-setup.sql`](supabase-setup.sql) in its SQL editor.
2. In **Configurações** (Settings), enter your Supabase project URL and public key.
3. As the GM, select **Convidar jogadores** (Invite players) to make the table available online and get an invitation.
4. To join as a player, validate the invitation and enter your character name and PIN. Confirm the PIN on your first visit.
5. To access the table as the GM on another device, generate and use a GM invitation.

Use only the public key in these settings. Administrative keys, such as `service_role`, must not be placed in the browser or committed to the repository.

### Data and Privacy

Private GM content is separated from the table's public data and uploaded to Supabase in a vault encrypted with the master key. Planned NPCs remain in this private area until revealed.

Keep your GM invitation and player PIN safe. Clearing browser data, switching browsers, or using a private window creates a separate browser session and may require signing in again. Theme preferences are also saved per browser.

User-created campaigns are not written into the published website files. Website hosting and the Supabase database are separate services. Publishing the code does not replace database permissions or the protection of invitations and PINs.

## Current Status

The app is under development. Local automated checks have passed, and GM and player flows across devices have been tested manually during development. After deployment, check access, invitations, and synchronization again using the final website address.
