/**
 * NotificationService (IT Admin) — polls ZC_CONF_REQ_H for APPROVED status
 * and surfaces them as in-app notifications (bell icon + popover).
 *
 * Business rules:
 *  - Notify only when a request transitions to APPROVED
 *    (manager đã approve → IT Admin cần promote lên môi trường tiếp theo).
 *  - Unread notifications persist until the user explicitly reads them.
 *  - Read notifications are pruned after 7 days.
 *  - On page open, "missed" transitions (changed while app was closed) are
 *    detected by comparing ChangedAt against the last successful poll time.
 *  - Max 50 notifications kept (newest first).
 *
 * Usage:
 *   NotificationService.init(sSapClient);   // start polling, returns JSONModel
 *   NotificationService.getModel();         // JSONModel bound to bell
 *   NotificationService.markRead(sId);
 *   NotificationService.markAllRead();
 *   NotificationService.clearAll();
 *   NotificationService.destroy();          // stop polling on exit
 */
sap.ui.define(
  ["sap/ui/model/json/JSONModel"],
  function (JSONModel) {
    "use strict";

    // ── localStorage keys (separate from catalog app to avoid collision) ──
    var SEEN_KEY      = "itadmin_notif_seen_v2";   // { ReqId|EnvId: lastSeenStatus }
    var NOTIF_KEY     = "itadmin_notif_list_v2";   // notification array
    var LAST_POLL_KEY = "itadmin_last_poll_v2";    // ISO timestamp

    var POLL_MS     = 30000;                        // poll every 30 s
    var MAX_NOTIFS  = 50;
    var TTL_READ_MS = 7 * 24 * 60 * 60 * 1000;    // 7 days for read notifications
    var SERVICE_URL = "/sap/opu/odata4/sap/zui_conf_req/srvd/sap/zsd_conf_req/0001/";

    // IT Admin chỉ cần biết khi request được APPROVED
    // (manager đã duyệt → IT Admin có thể promote lên môi trường tiếp theo)
    var NOTIFY_STATUSES = ["APPROVED"];

    var MODULE_LABELS = {
      MM:   "MM Route",
      MMSS: "Safe Stock",
      FI:   "FI Limit",
      SD:   "SD Price",
    };

    // ── private state ────────────────────────────────────────────────────
    var _oModel      = null;
    var _iTimer      = null;
    var _sSapClient  = "324";
    var _mSeen       = {};    // { "ReqId|EnvId": lastSeenStatus }
    var _lastPollISO = null;

    // ── persistence helpers ──────────────────────────────────────────────
    function _loadState() {
      try { _mSeen = JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch (e) { _mSeen = {}; }
      _lastPollISO = localStorage.getItem(LAST_POLL_KEY) || null;
    }

    function _saveState() {
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(_mSeen));
        localStorage.setItem(LAST_POLL_KEY, _lastPollISO || new Date().toISOString());
        if (_oModel) {
          localStorage.setItem(NOTIF_KEY, JSON.stringify(
            _oModel.getProperty("/notifications") || []
          ));
        }
      } catch (e) {}
    }

    function _loadSavedNotifications() {
      try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || "[]"); } catch (e) { return []; }
    }

    // ── TTL pruning ──────────────────────────────────────────────────────
    function _pruneExpired(aNotifs) {
      var cutoff = Date.now() - TTL_READ_MS;
      return aNotifs.filter(function (n) {
        if (!n.read) return true;
        return (n.createdAt || 0) > cutoff;
      });
    }

    // ── formatting ───────────────────────────────────────────────────────
    function _formatTime(sIso) {
      if (!sIso) return "";
      try {
        return new Date(sIso).toLocaleString("vi-VN", {
          day:    "2-digit",
          month:  "2-digit",
          hour:   "2-digit",
          minute: "2-digit",
        });
      } catch (e) { return sIso; }
    }

    function _buildNotif(oReq) {
      var sModLabel = MODULE_LABELS[oReq.ModuleId] || oReq.ModuleId || "?";
      var sEnv      = oReq.EnvId || "DEV";
      // Stable composite id: prevents duplicates on reload
      var sId = oReq.ReqId + "|" + sEnv + "|APPROVED";
      return {
        id:       sId,
        ReqId:    oReq.ReqId,
        EnvId:    sEnv,
        ModuleId: oReq.ModuleId || "",
        title:    oReq.ReqTitle || oReq.ReqId,
        message:  "Approved at " + sEnv + " — [" + sModLabel + "] ready to promote",
        icon:     "sap-icon://accept",
        state:    "Success",
        time:     _formatTime(oReq.ChangedAt),
        createdAt: Date.now(),
        read:     false,
      };
    }

    // ── core poll ────────────────────────────────────────────────────────
    function _poll(bInitialCatchup) {
      var sFilter = "";
      if (bInitialCatchup && _lastPollISO) {
        var oCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        var oSince  = new Date(_lastPollISO) < oCutoff ? oCutoff : new Date(_lastPollISO);
        sFilter = "&$filter=ChangedAt ge " + oSince.toISOString();
      }

      var sUrl = SERVICE_URL +
        "ZC_CONF_REQ_H?$select=ReqId,ReqTitle,ModuleId,EnvId,Status,ChangedAt" +
        "&$orderby=ChangedAt desc&$top=200" +
        sFilter +
        "&sap-client=" + _sSapClient;

      fetch(sUrl, {
        credentials: "include",
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (data) {
          var aItems  = data.value || [];
          var aNotifs = _oModel.getProperty("/notifications") || [];
          var bChanged = false;

          aItems.forEach(function (oReq) {
            // Use ReqId + EnvId as the composite key
            // (same request can be APPROVED at DEV, then again at QAS)
            var sKey  = oReq.ReqId + "|" + (oReq.EnvId || "DEV");
            var sPrev = _mSeen[sKey];

            if (sPrev === undefined) {
              // Never seen — record current status
              _mSeen[sKey] = oReq.Status;
              bChanged = true;
              // On catchup: if already APPROVED → notify (may have been approved while away)
              if (bInitialCatchup && NOTIFY_STATUSES.indexOf(oReq.Status) !== -1) {
                var oNew = _buildNotif(oReq);
                if (!aNotifs.some(function (n) { return n.id === oNew.id; })) {
                  aNotifs.unshift(oNew);
                }
              }
              return;
            }

            // Known request — check for APPROVED transition
            if (sPrev !== oReq.Status && NOTIFY_STATUSES.indexOf(oReq.Status) !== -1) {
              _mSeen[sKey] = oReq.Status;
              bChanged = true;
              var oNew = _buildNotif(oReq);
              if (!aNotifs.some(function (n) { return n.id === oNew.id; })) {
                aNotifs.unshift(oNew);
              }
            } else if (sPrev !== oReq.Status) {
              // Update seen map even for non-notify status changes
              _mSeen[sKey] = oReq.Status;
              bChanged = true;
            }
          });

          if (bChanged || bInitialCatchup) {
            aNotifs = _pruneExpired(aNotifs);
            if (aNotifs.length > MAX_NOTIFS) { aNotifs = aNotifs.slice(0, MAX_NOTIFS); }
            _oModel.setProperty("/notifications", aNotifs);
            _oModel.setProperty("/unreadCount", aNotifs.filter(function (n) { return !n.read; }).length);
            _lastPollISO = new Date().toISOString();
            _saveState();
          }
        })
        .catch(function (e) { console.warn("[ITAdmin NotificationService] poll error:", e); });
    }

    // ── public API ───────────────────────────────────────────────────────
    return {
      init: function (sSapClient) {
        _sSapClient = sSapClient || "324";
        _loadState();

        var aSaved = _pruneExpired(_loadSavedNotifications());

        if (!_oModel) {
          _oModel = new JSONModel({
            notifications: aSaved,
            unreadCount:   aSaved.filter(function (n) { return !n.read; }).length,
          });
        } else {
          var aCurrent = _oModel.getProperty("/notifications") || [];
          if (aCurrent.length === 0 && aSaved.length > 0) {
            _oModel.setProperty("/notifications", aSaved);
            _oModel.setProperty("/unreadCount", aSaved.filter(function (n) { return !n.read; }).length);
          }
        }

        // Initial catchup: detect missed approvals since last visit
        _poll(true);

        // Regular polling
        if (_iTimer) { clearInterval(_iTimer); }
        _iTimer = setInterval(function () { _poll(false); }, POLL_MS);

        return _oModel;
      },

      getModel: function () { return _oModel; },

      markRead: function (sId) {
        if (!_oModel) return;
        var aOld = _oModel.getProperty("/notifications") || [];
        var bFound = aOld.some(function (n) { return n.id === sId && !n.read; });
        if (!bFound) return;
        var aNotifs = aOld.map(function (n) {
          return (n.id === sId && !n.read) ? Object.assign({}, n, { read: true }) : n;
        });
        _oModel.setProperty("/notifications", aNotifs);
        _oModel.setProperty("/unreadCount", aNotifs.filter(function (n) { return !n.read; }).length);
        _saveState();
      },

      markAllRead: function () {
        if (!_oModel) return;
        var aNotifs = (_oModel.getProperty("/notifications") || []).map(function (n) {
          return n.read ? n : Object.assign({}, n, { read: true });
        });
        _oModel.setProperty("/notifications", aNotifs);
        _oModel.setProperty("/unreadCount", 0);
        _saveState();
      },

      clearAll: function () {
        if (!_oModel) return;
        _oModel.setProperty("/notifications", []);
        _oModel.setProperty("/unreadCount", 0);
        _saveState();
      },

      destroy: function () {
        if (_iTimer) { clearInterval(_iTimer); _iTimer = null; }
        _saveState();
      },
    };
  }
);
