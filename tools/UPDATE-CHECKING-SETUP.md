# Mod update checking — setup

The manager never calls the Nexus API. A scheduled job in this repository calls
it once a day with **your** API key, writes `versions.json`, and the app reads
that static file. Users need no key and never contact Nexus, so the number of
users has no effect on API usage at all.

Nothing here is switched on until you finish step 5, and a build with the
feature disabled makes no network requests.

---

## 1. Create the repository

It can be private or public — `raw.githubusercontent.com` only serves files from
**public** repos without a token, so if you want the app to fetch it without
credentials, make it **public**. It only needs to contain `versions.json`,
`tools/` and `.github/`; the manager's source does not have to live there.

```
your-repo/
├─ .github/workflows/update-versions.yml
├─ tools/
│  ├─ build-versions.mjs
│  └─ tracked-mods.json
└─ versions.json          ← starts as {"mods":{}}, the job fills it
```

All four files are already in this source zip — copy them across as-is.

## 2. Get your API key

https://next.nexusmods.com/settings/api-keys → copy your **personal** key.

Do not put it anywhere else. It must never appear in the manager, in
`versions.json`, or in any commit.

## 3. Add it as a repository secret

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository
secret**

```
Name:   NEXUS_API_KEY
Secret: <paste your key>
```

Secrets are not readable by anyone who forks or clones the repo, and GitHub
masks them in job logs.

## 4. Allow the job to commit

Repo → **Settings** → **Actions** → **General** → **Workflow permissions** →
select **Read and write permissions**. Without this the job builds the file but
cannot push it.

## 5. Run it once by hand

**Actions** tab → *Update mod version list* → **Run workflow**. Tick
*full refresh* for the first run so every tracked mod is fetched.

Check the log: it prints each mod, the file count, and the total requests used.
A first run of 14 mods costs about 27 requests out of 20,000 per day.

Then open `versions.json` in the repo and copy its **Raw** URL. It looks like:

```
https://raw.githubusercontent.com/<user>/<repo>/main/versions.json
```

## 6. Point the manager at it

In the manager: **Settings → Mod Updates**

1. Paste the raw URL into *Version list URL*
2. Turn on *Check for mod updates*
3. Click **Check Now**

Installed mods with a newer published version get a pulsing version pill in
Installed Mods; clicking it opens that mod's Nexus page.

---

## Adding mods to track

`tools/tracked-mods.json` is a plain list:

```json
[ { "id": 577, "name": "Pokemon Expansions, Accessories, Figurines & Statues" } ]
```

Add an entry, commit, done. The job picks it up on its next run.

## What the job actually does

1. One call to `mods/updated.json?period=1w` — which mods in the game changed
2. For each **tracked** mod that changed: `mods/{id}.json` and
   `mods/{id}/files.json`
3. Writes mod id → version, plus every file with its own version, so a
   multi-file mod like the Pokemon pack reports per file rather than as a whole
4. Commits `versions.json` only if something changed

Roughly **5 requests on a normal day**. Mods that did not change are carried
over from the previous file without a request, and if any request fails the
previous data for that mod is kept rather than dropped.

`OLD_VERSION` and `DELETED` files are filtered out — they are still listed by
the API and would otherwise be reported as the newest available.

## If Nexus asks you to change anything

The whole Nexus-facing surface is `tools/build-versions.mjs`. Switching to an
application key means changing the `apikey` header there; nothing in the manager
changes, because the manager only ever reads the published file.
