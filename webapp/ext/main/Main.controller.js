sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
  ],
  function (Controller, MessageToast, MessageBox, Fragment, JSONModel) {
    "use strict";

    // ─── OData service base URL ───────────────────────────────────────────────
    const _BASE_URL    = "/sap/opu/odata4/sap/zui_conf_req/srvd/sap/zsd_conf_req/0001/";
    const _FETCH_HDR   = { "Accept": "application/json", "X-Requested-With": "XMLHttpRequest" };
    const _ENV_ORDER   = { DEV: 1, QAS: 2, PRD: 3 };

    // ─── Service config per module ────────────────────────────────────────────
    // url    → main config table (bảng chính) — used for the list
    // reqUrl → request items table (bảng req)  — used for dialog change preview
    const _SERVICES = {
      MM: {
        label: "MM Routes",
        url:    "/sap/opu/odata4/sap/zui_mm_route_conf/srvd/sap/zsd_mm_route_conf/0001/MMRouteMain",
        reqUrl: "/sap/opu/odata4/sap/zui_mm_route_conf/srvd/sap/zsd_mm_route_conf/0001/MMRouteConf",
        entityKey: "ItemId",
        keyFields:  ["PlantId", "SendWh", "ReceiveWh"],
        diffFields: [
          { field: "TransMode",   old: "OldTransMode"   },
          { field: "IsAllowed",   old: "OldIsAllowed"   },
          { field: "InspectorId", old: "OldInspectorId" },
        ],
      },
      MMSS: {
        label: "MM Safe Stock",
        url:    "/sap/opu/odata4/sap/zui_mm_safe_stock/srvd/sap/zsd_mm_safe_stock/0001/MMSafeStockMain",
        reqUrl: "/sap/opu/odata4/sap/zui_mm_safe_stock/srvd/sap/zsd_mm_safe_stock/0001/MMSafeStock",
        entityKey: "ItemId",
        keyFields:  ["PlantId", "MatGroup"],
        diffFields: [
          { field: "MinQty", old: "OldMinQty" },
        ],
      },
      FI: {
        label: "FI Limit",
        url:    "/sap/opu/odata4/sap/zui_fi_limit_conf/srvd/sap/zsd_fi_limit_conf/0001/FILimitMain",
        reqUrl: "/sap/opu/odata4/sap/zui_fi_limit_conf/srvd/sap/zsd_fi_limit_conf/0001/FILimitConf",
        entityKey: "ItemId",
        keyFields:  ["ExpenseType", "GlAccount"],
        diffFields: [
          { field: "AutoApprLim", old: "OldAutoApprLim" },
          { field: "Currency",    old: "OldCurrency"    },
        ],
      },
      SD: {
        label: "SD Price",
        url:    "/sap/opu/odata4/sap/zsd_sd_price_conf/srvd/sap/zsd_sd_price_conf/0001/SDPriceMain",
        reqUrl: "/sap/opu/odata4/sap/zsd_sd_price_conf/srvd/sap/zsd_sd_price_conf/0001/SDPriceConf",
        entityKey: "ItemId",
        keyFields:  ["BranchId", "CustGroup", "MaterialGrp"],
        diffFields: [
          { field: "MaxDiscount", old: "OldMaxDiscount" },
          { field: "MinOrderVal", old: "OldMinOrderVal" },
          { field: "ApproverGrp", old: "OldApproverGrp" },
          { field: "Currency",    old: "OldCurrency"    },
          { field: "ValidFrom",   old: "OldValidFrom"   },
          { field: "ValidTo",     old: "OldValidTo"     },
        ],
      },
    };

    function _buildJourneyNodes(aJourney) {
      const oMap = {};
      aJourney.forEach(function (j) { oMap[j.envId] = j; });
      function _node(sEnv) {
        const j = oMap[sEnv];
        if (!j) return { exists: false, current: false, label: "", by: "", at: "", status: "", statusState: "None" };
        let sDisplay = j.status, sState = "None";
        if      (j.status === "ACTIVE")       { sDisplay = "Active";      sState = "Success"; }
        else if (j.status === "PROMOTED")     { sDisplay = "Promoted";    sState = "Warning"; }
        else if (j.status === "ROLLED_BACK")  { sDisplay = "Rolled Back"; sState = "Error";   }
        return {
          exists: true,
          current: j.isCurrent,
          label: j.isCurrent ? "(Current)" : "Done",
          by: j.by, at: j.at,
          status: sDisplay, statusState: sState,
        };
      }
      return { dev: _node("DEV"), qas: _node("QAS"), prd: _node("PRD") };
    }

    function _getNextEnv(sEnv) {
      return sEnv === "DEV" ? "QAS" : sEnv === "QAS" ? "PRD" : null;
    }

    function _formatDate(sIso) {
      if (!sIso) return "-";
      try {
        return new Date(sIso).toLocaleDateString("vi-VN", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        });
      } catch (e) { return sIso; }
    }

    return Controller.extend("zgsp26.conf.mng.itadmin.ext.main.Main", {

      // ─── Lifecycle ────────────────────────────────────────────────────────────

      onInit: function () {
        this._sSelectedModule = "MM";
        this._oVersionData    = {};
        this._oReqModuleMap   = {};
        this.getView().setModel(
          new JSONModel({
            atDev: 0, atQas: 0, atPrd: 0, total: 0,
            mmCount: 0, mmssCount: 0, fiCount: 0, sdCount: 0,
            selectedModule: "MM", selectedLabel: _SERVICES["MM"].label, selectedVer: "-",
            isAuditMode: false,
          }),
          "kpi"
        );
        this.getView().setModel(
          new JSONModel({ requests: [], auditEntries: [], auditDisplay: [] }),
          "vm"
        );
        this.getView().setModel(
          new JSONModel({ count: 0, items: [] }),
          "notif"
        );
        // Load danh sách đã đọc từ localStorage
        try {
          this._oSeenNotifs = new Set(JSON.parse(localStorage.getItem("itadmin_seen_notifs") || "[]"));
        } catch (e) { this._oSeenNotifs = new Set(); }

        this._loadRequests();
        this._loadModuleVersions();
        this._startNotifPolling();
      },

      onExit: function () {
        if (this._iNotifTimer) { clearInterval(this._iNotifTimer); }
      },

      // ─── Notification polling ─────────────────────────────────────────────────

      _startNotifPolling: function () {
        this._pollNotifications();
        this._iNotifTimer = setInterval(this._pollNotifications.bind(this), 60000); // 60s
      },

      _pollNotifications: async function () {
        try {
          // Fetch tất cả req có Status='ACTIVE' (manager đã approve)
          // Chỉ bắt req vừa được manager duyệt ở DEV (chưa promote).
          // Khi promote lên QAS/PRD cũng tạo record ACTIVE nhưng EnvId != DEV → không bắt.
          const sUrl = _BASE_URL + "ZC_CONF_REQ_H" +
            "?$filter=" + encodeURIComponent("Status eq 'ACTIVE' and EnvId eq 'DEV'") +
            "&$select=ReqId,EnvId,ReqTitle,CreatedBy,CreatedAt&$top=200&$orderby=CreatedAt desc";
          const oResp = await fetch(sUrl, { headers: _FETCH_HDR });
          if (!oResp.ok) return;
          const aAll = (await oResp.json()).value || [];

          // Chỉ lấy những item chưa đọc
          const aNew = aAll.filter((h) => !this._oSeenNotifs.has(h.ReqId + "|" + h.EnvId));

          const oMap = this._oReqModuleMap;
          this.getView().getModel("notif").setData({
            count: aNew.length,
            items: aNew.map(function (h) {
              const sMod = oMap[h.ReqId] || "";
              return {
                key:         h.ReqId + "|" + h.EnvId,
                reqId:       h.ReqId,
                envId:       h.EnvId,
                moduleId:    sMod,
                moduleLabel: sMod && _SERVICES[sMod] ? _SERVICES[sMod].label : "",
                title:       h.ReqTitle || h.ReqId,
                description: "Đã được duyệt — ENV: " + (h.EnvId || "-"),
                by:          h.CreatedBy || "-",
                at:          _formatDate(h.CreatedAt),
              };
            }),
          });
        } catch (e) { console.warn("Notif poll failed:", e); }
      },

      // ─── Notification handlers ────────────────────────────────────────────────

      onNotifBellPress: function (oEvent) {
        const oButton = oEvent.getSource();
        if (!this._oNotifPopover) {
          Fragment.load({
            id:         this.getView().getId(),
            name:       "zgsp26.conf.mng.itadmin.ext.main.fragment.NotifPopover",
            controller: this,
          }).then((oPopover) => {
            this._oNotifPopover = oPopover;
            this.getView().addDependent(oPopover);
            oPopover.openBy(oButton);
          });
        } else {
          this._oNotifPopover.openBy(oButton);
        }
      },

      onNotifItemPress: function (oEvent) {
        const oItem = oEvent.getSource().getBindingContext("notif").getObject();
        this._markNotifRead(oItem.key);
        if (this._oNotifPopover) { this._oNotifPopover.close(); }
      },

      onNotifItemClose: function (oEvent) {
        const oItem = oEvent.getSource().getBindingContext("notif").getObject();
        this._markNotifRead(oItem.key);
      },

      onNotifMarkAllRead: function () {
        const aItems = this.getView().getModel("notif").getProperty("/items") || [];
        aItems.forEach((i) => this._oSeenNotifs.add(i.key));
        this._saveSeenNotifs();
        this.getView().getModel("notif").setData({ count: 0, items: [] });
        if (this._oNotifPopover) { this._oNotifPopover.close(); }
      },

      onNotifGoToModule: function (oEvent) {
        const oItem = oEvent.getSource().getParent().getBindingContext("notif").getObject();
        const sMod  = oItem.moduleId;
        if (!sMod || !_SERVICES[sMod]) {
          MessageToast.show("Không xác định được module của request này.");
          return;
        }
        // Chuyển sang tab module tương ứng
        this._sSelectedModule = sMod;
        this.byId("moduleTabBar").setSelectedKey(sMod);
        const oKpi = this.getView().getModel("kpi");
        oKpi.setProperty("/isAuditMode",   false);
        oKpi.setProperty("/selectedModule", sMod);
        oKpi.setProperty("/selectedLabel",  _SERVICES[sMod].label);
        const vNo = this._oVersionData[sMod];
        oKpi.setProperty("/selectedVer", vNo != null ? "v." + vNo : "-");
        this._loadRequests();
        this._markNotifRead(oItem.key);
        if (this._oNotifPopover) { this._oNotifPopover.close(); }
      },

      _markNotifRead: function (sKey) {
        this._oSeenNotifs.add(sKey);
        this._saveSeenNotifs();
        const oNotif = this.getView().getModel("notif");
        const aItems = (oNotif.getProperty("/items") || []).filter((i) => i.key !== sKey);
        oNotif.setProperty("/items", aItems);
        oNotif.setProperty("/count", aItems.length);
      },

      _saveSeenNotifs: function () {
        try {
          // Giữ tối đa 500 entries gần nhất để tránh localStorage overflow
          const aEntries = [...this._oSeenNotifs];
          if (aEntries.length > 500) {
            const aPruned = aEntries.slice(aEntries.length - 500);
            this._oSeenNotifs = new Set(aPruned);
          }
          localStorage.setItem("itadmin_seen_notifs", JSON.stringify([...this._oSeenNotifs]));
        } catch (e) { /* ignore */ }
      },

      // ─── Module versions ──────────────────────────────────────────────────────
      //   Version của mỗi module = số lần config của module đó bị thay đổi
      //   tại mỗi env (promote hoặc rollback đều tính là +1 version).
      //
      //   Cách tính:
      //     1. Fetch reqUrl của từng module → map ReqId → ModuleId
      //     2. Fetch toàn bộ ZC_CONF_REQ_H (select ReqId, EnvId)
      //     3. Đếm số records per (ModuleId, EnvId) → đó là version

      _loadModuleVersions: async function () {
        // Chỉ build ReqId → ModuleId map cho notification polling.
        // Version strip được tính từ max VersionNo trong _loadRequests.
        try {
          const oReqModuleMap = {};
          this._oReqModuleMap = oReqModuleMap;
          await Promise.all(Object.keys(_SERVICES).map(async function (sKey) {
            try {
              const oResp = await fetch(
                _SERVICES[sKey].reqUrl + "?$select=ReqId&$top=5000",
                { headers: _FETCH_HDR }
              );
              if (!oResp.ok) return;
              ((await oResp.json()).value || []).forEach(function (item) {
                if (item.ReqId && !oReqModuleMap[item.ReqId]) {
                  oReqModuleMap[item.ReqId] = sKey;
                }
              });
            } catch (e) { console.warn("Version map " + sKey, e); }
          }));
        } catch (e) {
          console.warn("_loadModuleVersions failed:", e);
        }
      },

      // ─── Load + deduplicate requests ─────────────────────────────────────────
      //   Step 1: fetch config items from module tables (approved data).
      //   Step 2: fetch ZC_CONF_REQ_H (no status filter) to get the actual
      //           current EnvId per ReqId — promote creates new header records
      //           but module table records keep the original EnvId.
      //   Override item.EnvId with the highest env found in ZC_CONF_REQ_H so
      //   the journey column reflects the real promote position.

      _loadRequests: async function () {
        const oView = this.getView();
        oView.setBusy(true);

        const sModule = this._sSelectedModule || "";
        const oDate   = this.byId("dateFilter");
        const dFrom   = oDate.getDateValue();
        const dTo     = oDate.getSecondDateValue();
        // Always fetch ALL modules so KPI counts are always accurate.
        // Module tab filter is applied client-side after KPI computation.
        const aModuleKeys = Object.keys(_SERVICES);

        try {
          // ── Step 1: module config tables ────────────────────────────────────
          const aFetches = aModuleKeys.map(async function (sKey) {
            const oSvc   = _SERVICES[sKey];
            const aParts = [];
            if (dFrom) aParts.push("CreatedAt ge " + dFrom.toISOString());
            if (dTo)   aParts.push("CreatedAt le " + dTo.toISOString());
            const sFilter = aParts.length ? "&$filter=" + encodeURIComponent(aParts.join(" and ")) : "";
            const sUrl = oSvc.url + "?$top=500" + sFilter;
            try {
              const oResp = await fetch(sUrl, { headers: _FETCH_HDR });
              if (!oResp.ok) return [];
              const aItems = (await oResp.json()).value || [];
              return aItems.map(function (item) {
                const sKeyInfo = oSvc.keyFields
                  .map(function (f) { return item[f] || "-"; }).join(" / ");
                return Object.assign({
                  ModuleId: sKey,
                  _keyInfo: sKeyInfo,
                  _createdAtFmt: _formatDate(item.CreatedAt),
                  _versionDisplay: item.VersionNo != null ? "v." + item.VersionNo : "-",
                }, item);
              });
            } catch (e) {
              console.warn("Fetch " + sKey + " failed:", e);
              return [];
            }
          });

          const aAll = (await Promise.all(aFetches)).reduce(function (acc, a) {
            return acc.concat(a);
          }, []);

          // One representative item per (ReqId + Module) — cross-module dedup would
          // incorrectly drop records when the same ReqId exists in multiple modules.
          const oMap = {};
          aAll.forEach(function (item) {
            const sKey = item.ReqId + "|" + item.ModuleId;
            const existing = oMap[sKey];
            if (!existing || (_ENV_ORDER[item.EnvId] || 0) > (_ENV_ORDER[existing.EnvId] || 0)) {
              oMap[sKey] = item;
            }
          });

          // ── Step 2: ZC_CONF_REQ_H → real current EnvId (no status filter) ─
          if (Object.keys(oMap).length) {
            try {
              const sHdrUrl = _BASE_URL + "ZC_CONF_REQ_H" +
                "?$select=ReqId,EnvId&$top=2000";
              const oHdrResp = await fetch(sHdrUrl, { headers: _FETCH_HDR });
              if (oHdrResp.ok) {
                const aHdrs = (await oHdrResp.json()).value || [];
                // Highest EnvId per ReqId from header table
                const oEnvMap = {};
                aHdrs.forEach(function (h) {
                  const cur = oEnvMap[h.ReqId];
                  if (!cur || (_ENV_ORDER[h.EnvId] || 0) > (_ENV_ORDER[cur] || 0)) {
                    oEnvMap[h.ReqId] = h.EnvId;
                  }
                });
                // Override EnvId for all (ReqId|Module) entries that have a header record
                Object.keys(oMap).forEach(function (sMapKey) {
                  const sReqId = oMap[sMapKey].ReqId;
                  if (oEnvMap[sReqId]) oMap[sMapKey].EnvId = oEnvMap[sReqId];
                });
              }
            } catch (e) {
              console.warn("ZC_CONF_REQ_H env override failed:", e);
            }
          }

          // Chỉ giữ items có ReqId hợp lệ — giống logic list bên dưới
          const aDeduped = Object.values(oMap).filter(function (i) { return !!i.ReqId; });

          // ── KPI: đếm unique ReqId giống list (trước khi apply ENV/search filter) ──
          // Dùng setProperty thay vì setData để không xóa các field khác
          // (selectedModule, selectedVerDev/Qas/Prd, isAuditMode, ...)
          const oKpiModel = this.getView().getModel("kpi");
          oKpiModel.setProperty("/atDev",     aDeduped.filter(function (i) { return i.EnvId    === "DEV";  }).length);
          oKpiModel.setProperty("/atQas",     aDeduped.filter(function (i) { return i.EnvId    === "QAS";  }).length);
          oKpiModel.setProperty("/atPrd",     aDeduped.filter(function (i) { return i.EnvId    === "PRD";  }).length);
          oKpiModel.setProperty("/total",     aDeduped.length);
          oKpiModel.setProperty("/mmCount",   aDeduped.filter(function (i) { return i.ModuleId === "MM";   }).length);
          oKpiModel.setProperty("/mmssCount", aDeduped.filter(function (i) { return i.ModuleId === "MMSS"; }).length);
          oKpiModel.setProperty("/fiCount",   aDeduped.filter(function (i) { return i.ModuleId === "FI";   }).length);
          oKpiModel.setProperty("/sdCount",   aDeduped.filter(function (i) { return i.ModuleId === "SD";   }).length);

          // ── Max VersionNo per module → cập nhật version strip ──────────────
          const oMaxVer = {};
          Object.keys(_SERVICES).forEach(function (sKey) { oMaxVer[sKey] = 0; });
          aDeduped.forEach(function (i) {
            if (i.ModuleId && (i.VersionNo || 0) > (oMaxVer[i.ModuleId] || 0)) {
              oMaxVer[i.ModuleId] = i.VersionNo || 0;
            }
          });
          this._oVersionData = oMaxVer;
          if (sModule && _SERVICES[sModule]) {
            const vNo = oMaxVer[sModule];
            oKpiModel.setProperty("/selectedVer", vNo != null ? "v." + vNo : "-");
          }

          let aResult = aDeduped.slice();

          // Client-side: Module tab filter
          if (sModule) {
            aResult = aResult.filter(function (i) { return i.ModuleId === sModule; });
          }

          // Client-side: ENV filter (uses overridden EnvId)
          const sEnv = this.byId("envSegment").getSelectedKey();
          if (sEnv) {
            aResult = aResult.filter(function (i) { return i.EnvId === sEnv; });
          }

          // Client-side: Search
          const sQuery = (this.byId("searchField").getValue() || "").toLowerCase();
          if (sQuery) {
            aResult = aResult.filter(function (i) {
              return (String(i.ReqId     || "")).toLowerCase().includes(sQuery) ||
                     (String(i.CreatedBy || "")).toLowerCase().includes(sQuery) ||
                     (String(i._keyInfo  || "")).toLowerCase().includes(sQuery);
            });
          }

          aResult.sort(function (a, b) { return (b.VersionNo || 0) - (a.VersionNo || 0); });
          this.getView().getModel("vm").setProperty("/requests", aResult);
        } catch (e) {
          console.error("_loadRequests failed:", e);
          MessageBox.error("Không thể tải dữ liệu: " + (e.message || e));
        } finally {
          oView.setBusy(false);
        }
      },

      // ─── Filter events ────────────────────────────────────────────────────────

      onFilter: function () {
        this._loadRequests();
      },

      onSearch: function () {
        this._loadRequests();
      },

      onClearFilter: function () {
        this._sSelectedModule = "MM";
        this.byId("moduleTabBar").setSelectedKey("MM");
        this.byId("envSegment").setSelectedKey("");
        this.byId("dateFilter").setValue("");
        this.byId("searchField").setValue("");
        const oKpi = this.getView().getModel("kpi");
        oKpi.setProperty("/isAuditMode", false);
        oKpi.setProperty("/selectedModule", "MM");
        oKpi.setProperty("/selectedLabel",  _SERVICES["MM"].label);
        const vNo = this._oVersionData["MM"];
        oKpi.setProperty("/selectedVer", vNo != null ? "v." + vNo : "-");
        this._loadRequests();
      },

      onTabSelect: function (oEvent) {
        const sKey = oEvent.getParameter("key");
        const oKpi = this.getView().getModel("kpi");

        if (sKey === "AUDIT") {
          oKpi.setProperty("/isAuditMode", true);
          oKpi.setProperty("/selectedModule", "");
          this._sSelectedModule = "";
          this._loadAuditTrail();
          return;
        }

        oKpi.setProperty("/isAuditMode", false);
        this._sSelectedModule = sKey;

        if (this._sSelectedModule) {
          const vNo = this._oVersionData[this._sSelectedModule];
          oKpi.setProperty("/selectedModule", this._sSelectedModule);
          oKpi.setProperty("/selectedLabel",  _SERVICES[this._sSelectedModule].label);
          oKpi.setProperty("/selectedVer",    vNo != null ? "v." + vNo : "-");
        } else {
          oKpi.setProperty("/selectedModule", "");
        }

        this._loadRequests();
      },

      // ─── Audit Trail ──────────────────────────────────────────────────────────

      _loadAuditTrail: async function () {
        const oView = this.getView();
        oView.setBusy(true);
        try {
          // Step 1: ReqId → {moduleId, versionNo} từ bảng chính (url) của từng module
          // Dùng url (main table) thay vì reqUrl (req table) vì reqUrl luôn có VersionNo=1
          const oReqMap = {};
          const aModFetches = Object.keys(_SERVICES).map(async function (sKey) {
            try {
              const oResp = await fetch(
                _SERVICES[sKey].url + "?$select=ReqId,VersionNo&$top=5000",
                { headers: _FETCH_HDR }
              );
              if (!oResp.ok) return;
              ((await oResp.json()).value || []).forEach(function (item) {
                if (!item.ReqId) return;
                const cur = oReqMap[item.ReqId];
                if (!cur || (item.VersionNo || 0) > (cur.versionNo || 0)) {
                  oReqMap[item.ReqId] = { moduleId: sKey, versionNo: item.VersionNo || 0 };
                }
              });
            } catch (e) { console.warn("Audit module " + sKey, e); }
          });
          await Promise.all(aModFetches);

          // Step 2: toàn bộ ZC_CONF_REQ_H (all statuses, sort mới nhất lên trước)
          const sUrl = _BASE_URL + "ZC_CONF_REQ_H" +
            "?$select=ReqId,EnvId,Status,CreatedBy,CreatedAt,ReqTitle" +
            "&$orderby=CreatedAt desc&$top=2000";
          const oResp = await fetch(sUrl, { headers: _FETCH_HDR });
          if (!oResp.ok) throw new Error("ZC_CONF_REQ_H fetch failed");
          const aHdrs = (await oResp.json()).value || [];

          // Step 3: join + map sang audit entries
          const aAudit = aHdrs.map(function (h) {
            const oMod = oReqMap[h.ReqId] || {};
            return {
              reqId:     h.ReqId      || "-",
              envId:     h.EnvId      || "-",
              status:    h.Status     || "-",
              createdBy: h.CreatedBy  || "-",
              createdAt: _formatDate(h.CreatedAt),
              reqTitle:  h.ReqTitle   || "-",
              moduleId:  oMod.moduleId  || "?",
              versionNo: oMod.versionNo != null ? "v." + oMod.versionNo : "-",
            };
          });

          this.getView().getModel("vm").setProperty("/auditEntries", aAudit);
          this._applyAuditFilters();
        } catch (e) {
          console.error(e);
          MessageBox.error("Không thể tải Audit Trail: " + (e.message || e));
        } finally {
          oView.setBusy(false);
        }
      },

      _applyAuditFilters: function () {
        const aAll = this.getView().getModel("vm").getProperty("/auditEntries") || [];
        let aResult = aAll.slice();

        const sModule = this.byId("auditModuleFilter").getSelectedKey();
        if (sModule) aResult = aResult.filter(function (i) { return i.moduleId === sModule; });

        const sEnv = this.byId("auditEnvFilter").getSelectedKey();
        if (sEnv) aResult = aResult.filter(function (i) { return i.envId === sEnv; });

        const sStatus = this.byId("auditStatusFilter").getSelectedKey();
        if (sStatus) aResult = aResult.filter(function (i) { return i.status === sStatus; });

        const sQuery = (this.byId("auditSearch").getValue() || "").toLowerCase();
        if (sQuery) {
          aResult = aResult.filter(function (i) {
            return (i.reqId    || "").toLowerCase().includes(sQuery) ||
                   (i.createdBy|| "").toLowerCase().includes(sQuery) ||
                   (i.reqTitle || "").toLowerCase().includes(sQuery);
          });
        }

        this.getView().getModel("vm").setProperty("/auditDisplay", aResult);
      },

      onAuditFilter: function () { this._applyAuditFilters(); },
      onAuditSearch: function () { this._applyAuditFilters(); },

      onAuditClearFilter: function () {
        this.byId("auditModuleFilter").setSelectedKey("");
        this.byId("auditEnvFilter").setSelectedKey("");
        this.byId("auditStatusFilter").setSelectedKey("");
        this.byId("auditSearch").setValue("");
        this._applyAuditFilters();
      },

      onAuditRefresh: function () { this._loadAuditTrail(); },

      // ─── Row action → open dialog ─────────────────────────────────────────────

      onActionPress: function (oEvent) {
        const oCtx  = oEvent.getSource().getParent().getBindingContext("vm");
        const oItem = oCtx.getObject(); // plain JS object from JSONModel
        this._oCurrentItem = oItem;

        const bIsPromote = oItem.EnvId !== "PRD";
        this._openDetailDialog(oItem, bIsPromote);
      },

      // ─── Detail dialog ────────────────────────────────────────────────────────

      _openDetailDialog: async function (oItem, bIsPromote, bAutoRollback) {
        const sReqId   = oItem.ReqId;
        const sModule  = oItem.ModuleId;
        const sCurEnv  = oItem.EnvId  || "DEV";
        const sNextEnv = _getNextEnv(sCurEnv) || "—";

        if (!this._oDetailDialog) {
          this._oDetailDialog = await Fragment.load({
            id: this.getView().getId(),
            name: "zgsp26.conf.mng.itadmin.ext.main.fragment.DetailDialog",
            controller: this,
          });
          this._oDetailDialog.setModel(
            new JSONModel({
              reqId: "", module: "", confName: "", by: "", reason: "",
              curEnv: "", nextEnv: "",
              isPromoteMode: false, isRollbackMode: false, promoteEnabled: false,
              lines: [], journey: [],
            }),
            "detail"
          );
          this.getView().addDependent(this._oDetailDialog);
        }

        this._oCurrentSvc = _SERVICES[sModule];

        this._oDetailDialog.getModel("detail").setData({
          reqId:    sReqId,
          module:   sModule,
          confName: "-",
          by:       oItem.CreatedBy || "-",
          reason:   "-",
          curEnv:   sCurEnv,
          nextEnv:  sNextEnv,
          isPromoteMode:       !!bIsPromote,
          promoteEnabled:      false,
          showRollbackConfirm: !!bAutoRollback,
          rollbackTargetEnv:   bAutoRollback ? sCurEnv : "",
          lines: [], linesDisplay: [], journey: [],
          showChangedOnly: false,
          devNode: { exists: false, current: false, label: "", by: "", at: "", status: "", statusState: "None" },
          qasNode: { exists: false, current: false, label: "", by: "", at: "", status: "", statusState: "None" },
          prdNode: { exists: false, current: false, label: "", by: "", at: "", status: "", statusState: "None" },
        });

        this.byId("previewTable").setNoDataText("Loading config changes...");
        this._oDetailDialog.open();

        Promise.all([
          this._fetchConfigLines(sReqId, sModule),
          this._fetchJourney(sReqId, sCurEnv),
          this._fetchReqHeader(sReqId, sCurEnv),
        ]).then(([aLines, aJourney, oHeader]) => {
          const oModel = this._oDetailDialog.getModel("detail");
          oModel.setProperty("/lines",   aLines);
          oModel.setProperty("/journey", aJourney);

          // Build journey stepper nodes
          const oNodes = _buildJourneyNodes(aJourney);
          oModel.setProperty("/devNode", oNodes.dev);
          oModel.setProperty("/qasNode", oNodes.qas);
          oModel.setProperty("/prdNode", oNodes.prd);

          // Apply changed-only filter if active
          const bFilter = oModel.getProperty("/showChangedOnly");
          oModel.setProperty("/linesDisplay", bFilter
            ? aLines.filter(function (l) { return l.changed; })
            : aLines
          );

          if (oHeader.ReqTitle)  oModel.setProperty("/confName", oHeader.ReqTitle);
          if (oHeader.Reason)    oModel.setProperty("/reason",   oHeader.Reason);
          if (oHeader.CreatedBy) oModel.setProperty("/by",       oHeader.CreatedBy);
          this.byId("previewTable").setNoDataText(
            aLines.length ? "" : "Không có thay đổi nào."
          );
          oModel.setProperty("/promoteEnabled", true);
        }).catch((e) => {
          console.error(e);
          this.byId("previewTable").setNoDataText("Lỗi tải dữ liệu — vui lòng đóng và thử lại.");
        });
      },

      // ─── Promote journey (all envs of same ReqId) ─────────────────────────────

      _fetchJourney: async function (sReqId, sCurrentEnv) {
        const sUrl = _BASE_URL + "ZC_CONF_REQ_H" +
          "?$filter=" + encodeURIComponent("ReqId eq " + sReqId) +
          "&$select=EnvId,Status,CreatedBy,CreatedAt&$top=10";
        try {
          const oResp = await fetch(sUrl, { headers: _FETCH_HDR });
          if (!oResp.ok) return [];
          const aItems = ((await oResp.json()).value || []);
          aItems.sort((a, b) => (_ENV_ORDER[a.EnvId] || 9) - (_ENV_ORDER[b.EnvId] || 9));
          return aItems.map(function (item) {
            return {
              envId:     item.EnvId || "-",
              status:    item.Status || "-",
              by:        item.CreatedBy || "-",
              at:        _formatDate(item.CreatedAt),
              isCurrent: item.EnvId === sCurrentEnv,
            };
          });
        } catch (e) {
          console.warn("Journey fetch failed:", e);
          return [];
        }
      },

      // ─── Request header (ReqTitle, Reason) from ZC_CONF_REQ_H ────────────────

      _fetchReqHeader: async function (sReqId, sEnvId) {
        const sUrl = _BASE_URL + "ZC_CONF_REQ_H" +
          "?$filter=" + encodeURIComponent("ReqId eq " + sReqId + " and EnvId eq '" + sEnvId + "'") +
          "&$select=ReqTitle,Reason,CreatedBy&$top=1";
        try {
          const oResp = await fetch(sUrl, { headers: _FETCH_HDR });
          if (!oResp.ok) return {};
          const aItems = (await oResp.json()).value || [];
          return aItems[0] || {};
        } catch (e) {
          console.warn("_fetchReqHeader failed:", e);
          return {};
        }
      },

      // ─── Config lines ─────────────────────────────────────────────────────────

      _fetchConfigLines: async function (sReqId, sModuleId) {
        const aKeys = sModuleId ? [sModuleId] : Object.keys(_SERVICES);
        for (const sKey of aKeys) {
          const oSvc = _SERVICES[sKey];
          if (!oSvc) continue;
          try {
            const oResp = await fetch(oSvc.reqUrl + "?$filter=" + encodeURIComponent("ReqId eq " + sReqId), { headers: _FETCH_HDR });
            if (!oResp.ok) continue;
            const aItems = ((await oResp.json()).value || []);
            if (!aItems.length) continue;
            this._oCurrentSvc = oSvc;
            return this._normalizeLines(aItems, oSvc);
          } catch (e) {
            console.warn("Service " + sKey + " failed:", e);
          }
        }
        return [];
      },

      _normalizeLines: function (aItems, oSvc) {
        const aRows = [];
        aItems.forEach(function (oItem) {
          const sKeyInfo = oSvc.keyFields
            .map(function (f) { return f + ": " + (oItem[f] || "-"); })
            .join(" | ");
          oSvc.diffFields.forEach(function (d) {
            const sOld = oItem[d.old]   != null ? String(oItem[d.old])   : "";
            const sNew = oItem[d.field]  != null ? String(oItem[d.field]) : "";
            aRows.push({
              keyInfo: sKeyInfo, field: d.field,
              oldVal: sOld, newVal: sNew,
              changed: sOld !== sNew,
              entityPath: oSvc.reqUrl + "(" + oSvc.entityKey + "=" + oItem[oSvc.entityKey] + ",IsActiveEntity=true)",
            });
          });
        });
        return aRows;
      },

      // ─── Execute a bound OData V4 action directly via fetch ──────────────────
      //   Bypasses the OData V4 model's bindList+requestContexts which fails for
      //   ZC_CONF_REQ_H (model auto-filters by IsActiveEntity for draft entities,
      //   or the entity isn't in the local metadata document).

      _execBoundAction: async function (sReqId, sEnvId, sActionName) {
        // Step 1: obtain CSRF token (required for POST in SAP OData)
        let sToken = "";
        try {
          const oHead = await fetch(_BASE_URL, {
            method: "HEAD",
            headers: Object.assign({}, _FETCH_HDR, { "X-CSRF-Token": "Fetch" }),
          });
          sToken = oHead.headers.get("x-csrf-token") || oHead.headers.get("X-CSRF-Token") || "";
        } catch (e) {
          console.warn("CSRF fetch failed, continuing without token:", e);
        }

        // Step 2: POST to bound action URL
        //   ZC_CONF_REQ_H entity keys = ReqId (Edm.Guid) + EnvId (String) + IsActiveEntity (Edm.Boolean)
        //   BE added EnvId as a key property → must include all 3 keys in the URL.
        const sFqn = "com.sap.gateway.srvd.zsd_conf_req.v0001." + sActionName;
        const sUrl = _BASE_URL + "ZC_CONF_REQ_H(ReqId=" + sReqId + ",EnvId='" + sEnvId + "',IsActiveEntity=true)/" + sFqn;

        const oResp = await fetch(sUrl, {
          method: "POST",
          headers: Object.assign({}, _FETCH_HDR, {
            "Content-Type": "application/json",
            "X-CSRF-Token": sToken,
          }),
          body: JSON.stringify({}),
        });

        if (!oResp.ok) {
          let sMsg = "HTTP " + oResp.status;
          try {
            const oBody = await oResp.json();
            sMsg = (oBody.error && oBody.error.message) || sMsg;
          } catch (e) { /* ignore JSON parse error */ }
          throw new Error(sMsg);
        }
      },

      // ─── Rollback order validation ────────────────────────────────────────────

      _checkRollbackOrder: async function (sReqId, sCurrentEnv) {
        if (sCurrentEnv === "PRD") return null;
        const aHigher = sCurrentEnv === "DEV" ? ["QAS", "PRD"] : ["PRD"];
        const sFilter = "ReqId eq " + sReqId + " and (" +
          aHigher.map(function (e) { return "EnvId eq '" + e + "'"; }).join(" or ") + ")";
        const sUrl = _BASE_URL + "ZC_CONF_REQ_H?$filter=" +
          encodeURIComponent(sFilter) + "&$select=EnvId&$top=3";
        try {
          const oResp = await fetch(sUrl, { headers: _FETCH_HDR });
          if (!oResp.ok) return null;
          const aItems = ((await oResp.json()).value || []);
          if (!aItems.length) return null;
          for (const sEnv of (sCurrentEnv === "DEV" ? ["PRD", "QAS"] : ["PRD"])) {
            if (aItems.some(function (i) { return i.EnvId === sEnv; })) return sEnv;
          }
          return aItems[0].EnvId;
        } catch (e) {
          console.warn("Rollback order check failed:", e);
          return null;
        }
      },

      // ─── Dialog: Toggle changed-only filter ──────────────────────────────────

      onToggleChangedOnly: function (oEvent) {
        const bPressed = oEvent.getSource().getPressed();
        const oModel = this._oDetailDialog.getModel("detail");
        const aAll = oModel.getProperty("/lines");
        oModel.setProperty("/showChangedOnly", bPressed);
        oModel.setProperty("/linesDisplay",
          bPressed ? aAll.filter(function (l) { return l.changed; }) : aAll
        );
        this.byId("previewTable").setNoDataText(
          (bPressed && !aAll.some(function (l) { return l.changed; }))
            ? "Không có thay đổi nào." : ""
        );
      },

      // ─── Dialog: Quick rollback từ table row ─────────────────────────────────
      //   Nhấn nút ↩ trực tiếp ở bảng → check order → mở dialog ở chế độ confirm

      onQuickRollbackPress: async function (oEvent) {
        const oCtx  = oEvent.getSource().getParent().getBindingContext("vm");
        const oItem = oCtx.getObject();
        this._oCurrentItem = oItem;

        const oView = this.getView();
        oView.setBusy(true);
        const sBlockingEnv = await this._checkRollbackOrder(oItem.ReqId, oItem.EnvId);
        oView.setBusy(false);

        if (sBlockingEnv) {
          MessageBox.warning(
            "Không thể rollback " + oItem.EnvId + " lúc này!\n\n" +
            "ENV " + sBlockingEnv + " vẫn đang ACTIVE với cùng request.\n" +
            "Phải rollback " + sBlockingEnv + " trước.\n\n" +
            "Thứ tự bắt buộc: PRD → QAS → DEV",
            { title: "Rollback Order Violation", actions: [MessageBox.Action.CLOSE] }
          );
          return;
        }

        // Mở dialog với confirm panel đã sẵn sàng (bAutoRollback = true)
        const bIsPromote = oItem.EnvId !== "PRD";
        await this._openDetailDialog(oItem, bIsPromote, true);
      },

      // ─── Dialog: Rollback node button — hiện confirm panel inline ────────────

      onNodeRollbackPress: async function (oEvent) {
        const sEnv   = oEvent.getSource().data("env");
        const sReqId = this._oCurrentItem.ReqId;

        const oView = this.getView();
        oView.setBusy(true);
        const sBlockingEnv = await this._checkRollbackOrder(sReqId, sEnv);
        oView.setBusy(false);

        if (sBlockingEnv) {
          MessageBox.warning(
            "Không thể rollback " + sEnv + " lúc này!\n\n" +
            "ENV " + sBlockingEnv + " vẫn đang ACTIVE với cùng request.\n" +
            "Phải rollback " + sBlockingEnv + " trước.\n\n" +
            "Thứ tự bắt buộc: PRD → QAS → DEV",
            { title: "Rollback Order Violation", actions: [MessageBox.Action.CLOSE] }
          );
          return;
        }

        const oModel = this._oDetailDialog.getModel("detail");
        oModel.setProperty("/rollbackTargetEnv",   sEnv);
        oModel.setProperty("/showRollbackConfirm", true);
      },

      // ─── Dialog: Xác nhận rollback (từ inline confirm panel) ─────────────────

      onRollbackConfirm: async function () {
        const oModel = this._oDetailDialog.getModel("detail");
        const sEnvId = oModel.getProperty("/rollbackTargetEnv");
        const sReqId = this._oCurrentItem.ReqId;

        oModel.setProperty("/showRollbackConfirm", false);
        this._oDetailDialog.close();

        const oView = this.getView();
        oView.setBusy(true);
        try {
          await this._execBoundAction(sReqId, sEnvId, "rollback");
          this._loadRequests();
          MessageBox.success("Đã rollback thành công — ENV: " + sEnvId + ".");
        } catch (e) {
          console.error(e);
          MessageBox.error("Rollback thất bại: " + (e.message || e));
        } finally {
          oView.setBusy(false);
        }
      },

      // ─── Dialog: Hủy rollback ─────────────────────────────────────────────────

      onRollbackCancel: function () {
        this._oDetailDialog.getModel("detail").setProperty("/showRollbackConfirm", false);
      },

      // ─── Dialog: Rollback ─────────────────────────────────────────────────────

      onDialogRollback: async function () {
        const oItem  = this._oCurrentItem;
        const sReqId = oItem.ReqId;
        const sEnvId = oItem.EnvId || "DEV";

        const oView = this.getView();
        oView.setBusy(true);
        const sBlockingEnv = await this._checkRollbackOrder(sReqId, sEnvId);
        oView.setBusy(false);

        if (sBlockingEnv) {
          MessageBox.warning(
            "Không thể rollback " + sEnvId + " lúc này!\n\n" +
            "Môi trường " + sBlockingEnv + " vẫn đang APPROVED với cùng request.\n" +
            "Phải rollback " + sBlockingEnv + " trước.\n\n" +
            "Thứ tự bắt buộc: PRD → QAS → DEV",
            { title: "Rollback Order Violation", actions: [MessageBox.Action.CLOSE] }
          );
          return;
        }

        MessageBox.confirm(
          "Rollback configuration này?\n" +
          "REQ_ID: " + sReqId + " — ENV: " + sEnvId + "\n\n" +
          "Dữ liệu sẽ được revert về giá trị cũ (OldXxx). Hành động không thể hoàn tác.",
          {
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.CANCEL,
            onClose: async (sResult) => {
              if (sResult !== MessageBox.Action.OK) return;
              this._oDetailDialog.close();
              oView.setBusy(true);
              try {
                await this._execBoundAction(sReqId, sEnvId, "rollback");
                this._loadRequests();
                MessageBox.success("Đã rollback thành công — ENV: " + sEnvId + ".");
              } catch (e) {
                console.error(e);
                MessageBox.error("Rollback thất bại: " + (e.message || e));
              } finally {
                oView.setBusy(false);
              }
            },
          }
        );
      },

      // ─── Dialog: Promote ──────────────────────────────────────────────────────

      onDialogPromote: function () {
        const oItem    = this._oCurrentItem;
        const sCurEnv  = oItem.EnvId || "DEV";
        const sNextEnv = _getNextEnv(sCurEnv);

        if (!sNextEnv) {
          MessageBox.warning("Request này đã ở PRD — không thể promote thêm.");
          return;
        }

        MessageBox.confirm(
          "Promote " + sCurEnv + " → " + sNextEnv + "?\n" +
          "REQ_ID: " + oItem.ReqId + "\n\n" +
          "Các dòng cấu hình sẽ được copy sang " + sNextEnv + " với EnvId mới.",
          {
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.OK,
            onClose: async (sResult) => {
              if (sResult !== MessageBox.Action.OK) return;
              this._oDetailDialog.close();
              const oView = this.getView();
              oView.setBusy(true);
              try {
                await this._execBoundAction(oItem.ReqId, sCurEnv, "promote");
                this._loadRequests();
                MessageBox.success("Đã promote thành công lên " + sNextEnv + ".");
              } catch (e) {
                console.error(e);
                MessageBox.error("Promote thất bại: " + (e.message || e));
              } finally {
                oView.setBusy(false);
              }
            },
          }
        );
      },

      // ─── Dialog: Close ────────────────────────────────────────────────────────

      onDialogClose: function () {
        this._oDetailDialog.close();
      },

      // ─── Refresh ──────────────────────────────────────────────────────────────

      onRefresh: function () {
        this._loadRequests();
        MessageToast.show("Refreshed");
      },

    });
  }
);
