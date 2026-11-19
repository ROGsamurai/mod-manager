# RTCGO Manager Bridge

A small BepInEx plugin that lets the Real TCG Overhaul Mod Manager reset the
prices of several Enhanced Prefab Loader bundles at once while the game runs.
It calls EPL's public API (`IBundleMaintenanceService.ResetPrices`), the same
reset as EPL's "Force Price Reset" button, once per bundle.

## Build

```
cd bridge/RTCGOManagerBridge
dotnet build -c Release -p:GameDir="C:\Path\To\TCG Card Shop Simulator"
```

The project references BepInEx, EnhancedPrefabLoader.API and the game's Unity
assemblies from that folder; nothing is copied into the output except
`RTCGOManagerBridge.dll`. If EnhancedPrefabLoader.API.dll lives elsewhere,
change its HintPath in the .csproj.

A Release build also copies the DLL to `assets\bridge\`, which is where the
manager ships it from. Build it before running BUILD.bat (BUILD.bat warns if
it is missing).

## Install

Players never install it by hand. Every time a .json is saved in the EPL .json
Editor, the manager puts `RTCGOManagerBridge.dll` in
`<game>\BepInEx\plugins\RTCGOManagerBridge\` if it is not there, or replaces
it if the shipped copy changed (an existing copy elsewhere under plugins is
updated in place). If the game has the DLL loaded, Windows blocks the
replacement; the next save after the game closes puts it in. The manager does
not list the folder as an untracked mod.

## How it talks to the manager

Files in `BepInEx\config\RTCGOManager\`:

| File | Written by | Contents |
|---|---|---|
| `bridge.json` | plugin, every 5 s | version, when the game started, last seen, whether EPL finished loading |
| `price-reset.request.json` | manager | `{ "id": "...", "bundleIds": ["bundle_..."] }` |
| `price-reset.result.json` | plugin | `{ "id", "ready", "error", "results": [{ bundleId, name, status, error }] }` |

`status` is `reset`, `no-price-data`, `not-loaded`, `uninstalled` or `error`.
The plugin deletes the heartbeat when the game closes and ignores any request
left over from an earlier session.
