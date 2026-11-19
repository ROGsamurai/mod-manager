// RTCGO Manager Bridge
//
// Lets the Real TCG Overhaul Mod Manager ask the running game to reset the
// prices of several Enhanced Prefab Loader bundles at once, the same reset
// EPL's "Force Price Reset" button does for one bundle.
//
// Everything goes through EPL's public API (EnhancedPrefabLoader.API):
//   Epl.Api.Services.BundleMaintenanceService.ResetPrices(bundleId)
//   Epl.Api.BundleRegistry.BundleInfo
// No reflection, no game calls of its own.
//
// How it talks to the manager: plain files in BepInEx/config/RTCGOManager/.
//   bridge.json                  heartbeat, rewritten every few seconds while the game runs
//   price-reset.request.json     written by the manager: { id, bundleIds[] }
//   price-reset.result.json      written here: { id, ready, results[] }
// The request is read and deleted on the main thread, so EPL is only ever
// called from Unity's main thread.

using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using BepInEx;
using BepInEx.Logging;
using EnhancedPrefabLoader.API;
using EnhancedPrefabLoader.API.Models;
using UnityEngine;

namespace RTCGOManagerBridge
{
    [BepInPlugin(Guid, Name, Version)]
    [BepInDependency("EnhancedPrefabLoader", BepInDependency.DependencyFlags.HardDependency)]
    public class Plugin : BaseUnityPlugin
    {
        public const string Guid = "com.rtcgo.managerbridge";
        public const string Name = "RTCGO Manager Bridge";
        public const string Version = "1.0.2";

        private const float PollSeconds = 1f;
        private const float HeartbeatSeconds = 5f;

        internal static ManualLogSource Log;

        private string _dir, _requestPath, _resultPath, _heartbeatPath;
        private float _nextPoll, _nextHeartbeat;
        private string _startedAt;

        private void Awake()
        {
            Log = Logger;
            _dir = Path.Combine(Paths.ConfigPath, "RTCGOManager");
            _requestPath = Path.Combine(_dir, "price-reset.request.json");
            _resultPath = Path.Combine(_dir, "price-reset.result.json");
            _heartbeatPath = Path.Combine(_dir, "bridge.json");
            _startedAt = DateTime.UtcNow.ToString("o");
            try { Directory.CreateDirectory(_dir); }
            catch (Exception e) { Log.LogError($"Could not create {_dir}: {e.Message}"); }
            // A request left over from an earlier session is stale: drop it.
            TryDelete(_requestPath);
            WriteHeartbeat();
            Log.LogInfo($"{Name} {Version} ready, watching {_dir}");
        }

        private void OnDestroy()
        {
            // Tell the manager the game is gone instead of letting the heartbeat age out.
            TryDelete(_heartbeatPath);
        }

        private void Update()
        {
            float now = Time.unscaledTime;
            if (now >= _nextHeartbeat) { _nextHeartbeat = now + HeartbeatSeconds; WriteHeartbeat(); }
            if (now < _nextPoll) return;
            _nextPoll = now + PollSeconds;
            if (!File.Exists(_requestPath)) return;

            PriceResetRequest request;
            try
            {
                string json = File.ReadAllText(_requestPath);
                TryDelete(_requestPath);
                request = JsonUtility.FromJson<PriceResetRequest>(json);
            }
            catch (Exception e)
            {
                // Probably caught mid-write; it is read again on the next poll.
                Log.LogDebug($"Price reset request not readable yet: {e.Message}");
                return;
            }
            if (request == null) return;
            WriteResult(Handle(request));
        }

        private PriceResetResult Handle(PriceResetRequest request)
        {
            var result = new PriceResetResult { id = request.id, finishedAt = DateTime.UtcNow.ToString("o") };
            if (!Epl.IsAvailable || Epl.Api == null || !Epl.Api.IsBundleLoadingComplete)
            {
                result.ready = false;
                result.error = "Enhanced Prefab Loader has not finished loading its bundles yet. Try again in a moment.";
                return result;
            }
            result.ready = true;

            var registry = Epl.Api.BundleRegistry?.BundleInfo;
            var maintenance = Epl.Api.Services.BundleMaintenanceService;
            var seen = new HashSet<string>();
            foreach (string bundleId in request.bundleIds ?? new string[0])
            {
                // The id is passed exactly as the .json has it: EPL's registry
                // keys are not trimmed or case-folded either.
                if (string.IsNullOrEmpty(bundleId) || !seen.Add(bundleId)) continue;
                var entry = new PriceResetEntry { bundleId = bundleId };
                try
                {
                    BundleInfo info = null;
                    if (registry != null) registry.TryGetValue(bundleId, out info);
                    entry.name = info?.Name;
                    // Called exactly like EPL's own Force Price Reset button: no
                    // checks first. The checks below only explain a "false".
                    if (maintenance.ResetPrices(bundleId)) entry.status = "reset";
                    else if (info == null) entry.status = "not-loaded";
                    else if (maintenance.IsUninstalled(bundleId)) entry.status = "uninstalled";
                    else if (!info.IsLoaded) entry.status = "not-loaded";
                    else entry.status = "no-price-data";
                }
                catch (Exception e)
                {
                    entry.status = "error";
                    entry.error = e.Message;
                    Log.LogError($"Price reset failed for bundle '{bundleId}': {e}");
                }
                Log.LogInfo($"Price reset '{bundleId}'{(entry.name != null ? $" ({entry.name})" : "")}: {entry.status}");
                result.results.Add(entry);
            }
            int done = result.results.FindAll(r => r.status == "reset").Count;
            Log.LogInfo($"Price reset requested by the mod manager: {done} of {result.results.Count} bundles reset");
            return result;
        }

        // Written by hand, not with JsonUtility: for a plugin assembly Unity's
        // serializer drops the list of nested [Serializable] entries, so the
        // manager got an empty results list even though the reset worked.
        private void WriteResult(PriceResetResult r)
        {
            var sb = new StringBuilder();
            sb.Append("{\n  \"id\": ").Append(Str(r.id))
              .Append(",\n  \"ready\": ").Append(r.ready ? "true" : "false")
              .Append(",\n  \"error\": ").Append(Str(r.error))
              .Append(",\n  \"finishedAt\": ").Append(Str(r.finishedAt))
              .Append(",\n  \"results\": [");
            for (int i = 0; i < r.results.Count; i++)
            {
                var e = r.results[i];
                sb.Append(i == 0 ? "\n    " : ",\n    ")
                  .Append("{ \"bundleId\": ").Append(Str(e.bundleId))
                  .Append(", \"name\": ").Append(Str(e.name))
                  .Append(", \"status\": ").Append(Str(e.status))
                  .Append(", \"error\": ").Append(Str(e.error)).Append(" }");
            }
            sb.Append(r.results.Count > 0 ? "\n  ]\n}\n" : "]\n}\n");
            WriteAtomic(_resultPath, sb.ToString());
        }

        private static string Str(string v)
        {
            if (v == null) return "null";
            var sb = new StringBuilder(v.Length + 2).Append('"');
            foreach (char c in v)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            return sb.Append('"').ToString();
        }

        private void WriteHeartbeat()
        {
            var hb = new Heartbeat
            {
                version = Version,
                startedAt = _startedAt,
                lastSeen = DateTime.UtcNow.ToString("o"),
                eplReady = Epl.IsAvailable && Epl.Api != null && Epl.Api.IsBundleLoadingComplete,
            };
            WriteAtomic(_heartbeatPath,
                "{\n  \"version\": " + Str(hb.version) + ",\n  \"startedAt\": " + Str(hb.startedAt) +
                ",\n  \"lastSeen\": " + Str(hb.lastSeen) + ",\n  \"eplReady\": " + (hb.eplReady ? "true" : "false") + "\n}\n");
        }

        private static void WriteAtomic(string path, string text)
        {
            try
            {
                string tmp = path + ".tmp";
                File.WriteAllText(tmp, text);
                if (File.Exists(path)) File.Delete(path);
                File.Move(tmp, path);
            }
            catch (Exception e) { Log.LogWarning($"Could not write {Path.GetFileName(path)}: {e.Message}"); }
        }

        private static void TryDelete(string path)
        {
            try { if (File.Exists(path)) File.Delete(path); } catch { /* the manager may hold it for a moment */ }
        }
    }

    [Serializable]
    public class PriceResetRequest
    {
        public string id;
        public string[] bundleIds;
    }

    [Serializable]
    public class PriceResetEntry
    {
        public string bundleId;
        public string name;
        public string status;   // reset | no-price-data | not-loaded | uninstalled | error
        public string error;
    }

    [Serializable]
    public class PriceResetResult
    {
        public string id;
        public bool ready;
        public string error;
        public string finishedAt;
        public List<PriceResetEntry> results = new List<PriceResetEntry>();
    }

    [Serializable]
    public class Heartbeat
    {
        public string version;
        public string startedAt;
        public string lastSeen;
        public bool eplReady;
    }
}
