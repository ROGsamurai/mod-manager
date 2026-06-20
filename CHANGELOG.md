Version 1.0.6
NEW
- Progress bars when enabling/disabling a mod, uninstalling a mod, and switching profiles — large mods (hundreds of files) now show a live percentage and bar instead of appearing frozen, and buttons lock during the operation to prevent double-clicks
- Support for Nexus's new download filename format that drops the trailing mod-ID/version/timestamp (e.g. "Collection Tracker v1.1.6.zip") while still parsing the old format
IMPROVED
- Mod-name parsing now strips trailing variant tags like "(HQ Base Game Sprites)" or "[Optional]" and reads a version that sits before the tag — same-name variants now correctly overwrite the existing mod instead of installing as a phantom second copy
- Update-vs-reinstall detection now falls back to the archive's download date when the filename has no version (or the same version): a newer archive of an already-installed mod is recognized as an update
- Build pinned to electron-builder 24.13.3 to reproduce the clean portable stub and avoid an antivirus false positive introduced by a newer builder version

Version 1.0.3
NEW
- Added global exclude patterns applied automatically to every mod install, import, and scan — shared phone-app icons, BepInEx auto-regenerated configs, and BepInEx cache files are never tracked
- Added Collection Tracker to the Known Mods Database — previously imported as an unknown ungrouped mod
- Added migration v9 that retroactively cleans every existing tracked mod against the exclude patterns on startup — corrupted file lists from earlier builds self-heal with no user action needed
- Added migration v10 that fixes mods placed in author groups from corrupted file lists — mods that no longer match their group's rule are returned to ungrouped, and any ungrouped mods that match a rule are auto-assigned (picks up Collection Tracker and any newly-added DB entries)
- Added migration v11 that re-runs the file cleanup with improved sidecar-detection logic (handles `.json` companions of another mod's signature in shared-parent layouts like DraX card-set addons)
- Added migration v12 that merges duplicate mod entries (case-insensitive name collision) — unions their file lists, reassigns group memberships, and removes the stale duplicate
-
IMPROVED
- Every mod's tracked file list is now sanitized through a single consolidated filter — removes files that logically belong to a different standalone mod, BepInEx-regenerated configs, and transient cache content
- excludePaths field removed from individual Known Mods Database entries since global patterns cover them cleanly
- Scanner now correctly handles mods whose signature is a top-level DLL in BepInEx/plugins/ — previously walked the entire plugins folder and slurped every sibling mod's files
- Scanner dedup now operates on exact signature files instead of parent folders — correctly handles both HIGH/ORIGINAL SATURATION variants (share exact signature → dedup) and sibling mods in shared-parent layouts (different signatures in the same folder → each detected)
- Scanner's foreign-path filter now handles shared-parent mod families (DraX DXCardSets, HellHound HH EPL Pokemons) correctly — each sibling mod now tracks only its own unique files instead of slurping the whole folder
- Scanner now unions all existing signature files into the tracked list — handles mods like Grading Overhaul whose signature points at a subfolder file but also installs a top-level helper DLL (GradeDataLifeSaver.dll)
- Phase 2 unknown-mod detection now skips folders already claimed by a Phase 1 match (case-insensitive) — prevents double-import when the disk folder name has different casing than the DB signature
- Install flow now detects case-insensitive name collisions and updates the existing mod entry instead of creating a duplicate
- Import flow (from scan results) also detects case-insensitive name collisions and updates instead of duplicating
- 8 Known Mods Database entries had `BepinEx` (lowercase i) typos in their signatures — normalized to `BepInEx` for consistency
- Grading Overhaul DB entry updated to version 3.3.0 with proper subfolder signature plus top-level helper DLL
-
FIXED
- Fixed Grading Overhaul and 13 other standalone plugins not being detected on Scan for Installed Mods — the pre-v1.0.3 scanner only detected the first top-level plugin DLL it encountered, then skipped the rest because they appeared to share a folder
- Fixed DraX card-set addons (Pokemon SV01/SV02/etc.) being merged into a single mod on scan — the dedup logic treated their shared parent folder (DXCardSets_prefabLoader/) as claimable, so the first sibling detected locked out all the others
- Fixed DraX Pokemon SV01 addon slurping SV02's (and other sibling card-sets') files during scan — fixed by a stronger foreign-path filter that understands sig-companion files in shared-parent layouts
- Fixed DraX card-set addons tracking shared Phone Overhaul icons (DXPokemon/Clear.png, DXPokemon/DraX's Pokestop.png) — added to global exclude patterns
- Fixed EndGame Overhaul getting imported twice — once as "EndGame Overhaul" (DB name, capital G) by Phase 1 signature match, then again as "Endgame Overhaul" (folder name on disk, lowercase g) by Phase 2's generic scan. Phase 2 dedup was case-sensitive and missed the duplicate.
- Fixed Fast Opening Pack (and other top-level plugin DLLs) being incorrectly auto-grouped into HellHound Mods on import — the scanner was slurping HellHound card-set files into Fast Opening Pack's tracked list, which then matched the HellHound path rule
- Fixed Collection Tracker being imported as an ungrouped unknown mod — added to the Known Mods Database and Main Core Mods auto-group rule
- Fixed iiTzSamurai content packs still tracking the 3 shared Pokemon Shop phone-app icons on fresh install (IBG.png, MyIcon.png, OBG.png) — the previous per-mod excludePaths filter only fired for 5 of the packs, leaving 01 Base / 02 Gym / 03 Neo Expansions still claiming those files
- Fixed 02 Pokemon Shop Textures still tracking BepInEx/config/shaklin.TextureReplacer.cfg — uninstalling would have tried to delete a BepInEx-regenerated config file
- Fixed mods imported or installed before v1.0.3 showing stale file lists — migrations v9 and v11 clean them automatically on first launch

Version 1.0.2
NEW
- Added Main Core Mods group auto-created for BepInEx framework, Enhanced Prefab Loader, Phone Overhaul, Grading Overhaul, Holographic Overhaul, and Collection Tracker — always pinned to the top of the Installed Mods list
- Added author-based auto-grouping rules: DraX Mods, HellHound Mods, Munchmatoast Mods, Knarf247 Mods, iiTzSamurai Mods
- Mods now auto-group on install or import based on name or file path signatures
- Added Re-apply Auto-Grouping button in Settings to run author detection against all currently-installed mods (respects manually-placed mods)
- Added Reset Tracked Mods button in Settings with confirmation dialog — clears the manager's tracking database without touching any files on disk
- Added subtle pulsing glow on mod panels in Downloaded Mods when updates are available
- Added pulsing glow on individual Update buttons and the Update All header button
- Mods waiting to be updated now float to the top of the Downloaded Mods list automatically
- Added colored outlines on Settings buttons: orange for actions, green for safe/diagnostic, blue for navigation
- Added 120 new HellHound Pokemon card sets to the Known Mods Database
- Added 14 iiTzSamurai content packs to the Known Mods Database (Base/Gym/Neo/Legendary/e-Card Expansions, Theme Decks, Plushies, Gameboy/N64 Games, Statues, Manga, Pokemon Shop Textures, RTCGO Custom TV)
- Added 00 Pokemon Shop Phone App entry to own the shared phone-app icons (IBG.png, MyIcon.png, OBG.png)
- Known Mods Database grew from 152 to 381 entries
-
IMPROVED
- Renamed "Suggested Mods" tab to "Recommended Mods" across all 10 languages
- Added excludePaths field to Known Mods Database entries — lets content packs avoid tracking files that logically belong to a different standalone mod
- Added walkDir field to Known Mods Database entries — lets mods with deep signature paths walk a wider parent folder for full file coverage
- Scan for Installed Mods now auto-detects container folders (parent folders shared by 2+ known mods like "Real TCG Overhaul" and "HH EPL Pokemons") and skips them instead of importing them as phantom mods
- Scan now correctly walks each mod's unique folder instead of shared parent folders
- Defensive foreign-path filter during scan excludes files that belong to another known mod's signature folder
- HIGH/ORIGINAL SATURATION mod pairs that share signature files are now deduplicated during scan — only one gets detected
- Raised vite chunk size warning limit to silence irrelevant build warnings for Electron apps
- Added Re-apply Auto-Grouping, Reset Tracked Mods, and 10 other UI strings translated across 9 languages (108 new translations)
-
FIXED
- Fixed critical file-slurping bug where mods sharing a parent folder tracked every sibling file — uninstalling one HellHound mod could delete all 120 others' assets
- Fixed ghost-mod false positives for 02 Pokemon Shop Textures, Poke Stop Pokemon Theme Pack, and Reviews Matter which used auto-regenerated BepInEx config files as their signature
- Fixed 02 Pokemon Shop Textures signature pointing at a non-existent path
- Fixed non-BepInEx mods falsely matching on BepInEx/config/ or BepInEx/cache/ leftover files after uninstall
- Fixed Portuguese UI translations not applying because the locale block was keyed as 'pt-BR' instead of 'pt'
- Fixed 12 Reset/Regroup UI translations misplaced inside the Portuguese MODS block instead of the UI block
- Fixed missing instructional translations in German, Chinese, Japanese, Korean, Russian for "BepInEx is ready", "Point this to the folder", and "Click + Add Archives"
- Fixed auto-grouping only matching on mod names — now also matches on file path patterns and explicit name sets
- Fixed OneDrive EPERM crashes when staging folder files were locked by cloud sync — retries up to 3 times with clear error messages
- Fixed bepinexHealthCheck crash when folders were locked — now shows "cannot read — file locked" instead of crashing
- Fixed Auto Lights zip extraction failure on Windows paths by adding 7-Zip fallback for node-stream-zip rejections
- Fixed stale temp folder cleanup to handle all three prefixes (_temp_extract_, _zip_temp_, _7z_temp_) plus legacy paths
- Fixed dead code: removed unused dialog:open-file IPC handler and openFileDialog preload binding
- Fixed unused imports SUPPORTED_LOCALES and THEMES in App.jsx
- Added process-level handlers for uncaughtException and unhandledRejection to prevent silent crashes
- 10 IPC handlers wrapped in try/catch guards to prevent renderer disconnection on errors
