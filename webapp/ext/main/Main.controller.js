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
        oldKeyMap:  { PlantId: "OldPlantId", SendWh: "OldSendWh", ReceiveWh: "OldReceiveWh" },
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
        oldKeyMap:  { PlantId: "OldPlantId", MatGroup: "OldMatGroup" },
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
        oldKeyMap:  { ExpenseType: "OldExpenseType", GlAccount: "OldGlAccount" },
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
        oldKeyMap:  { BranchId: "OldBranchId", CustGroup: "OldCustGroup", MaterialGrp: "OldMaterialGrp" },
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
        this._aCachedAll      = null; // cache toàn bộ data sau lần fetch đầu
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
        this.getView().setModel(
          new JSONModel({ rows: [], env1Label: "", env2Label: "", summary: "" }),
          "cmp"
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

      // ─── Load pending requests (APPROVED + ACTIVE) ───────────────────────────
      //   _loadRequests(bForceRefresh): nếu đã có cache và không force → chỉ filter lại.
      //   _fetchAllRequests(): fetch từ server, build cache, cập nhật KPI.
      //   _applyRequestFilters(): filter client-side từ cache, cập nhật vm>/requests.

      _loadRequests: async function (bForceRefresh) {
        if (!bForceRefresh && this._aCachedAll) {
          // Có cache → chỉ filter lại, không fetch
          this._applyRequestFilters(this._aCachedAll);
          return;
        }
        await this._fetchAllRequests();
      },

      _fetchAllRequests: async function () {
        const oView = this.getView();
        oView.setBusy(true);

        const oDate = this.byId("dateFilter");
        const dFrom = oDate.getDateValue();
        const dTo   = oDate.getSecondDateValue();

        try {
          // ── Step 1: Fetch APPROVED + ACTIVE requests từ ZC_CONF_REQ_H ────────
          const aParts = ["(Status eq 'APPROVED' or Status eq 'ACTIVE')"];
          if (dFrom) aParts.push("CreatedAt ge " + dFrom.toISOString());
          if (dTo)   aParts.push("CreatedAt le " + dTo.toISOString());

          const sHdrUrl = _BASE_URL + "ZC_CONF_REQ_H" +
            "?$filter=" + encodeURIComponent(aParts.join(" and ")) +
            "&$select=ReqId,EnvId,Status,ModuleId,ReqTitle,CreatedBy,CreatedAt,Reason" +
            "&$orderby=CreatedAt desc&$top=500";

          const oHdrResp = await fetch(sHdrUrl, { headers: _FETCH_HDR });
          if (!oHdrResp.ok) throw new Error("ZC_CONF_REQ_H fetch failed: " + oHdrResp.status);
          const aReqs = (await oHdrResp.json()).value || [];

          // ── Step 2: Fetch tất cả *_req tables để lấy change summary + module ──
          const oChanges = {};

          await Promise.all(Object.keys(_SERVICES).map(async function (sKey) {
            const oSvc = _SERVICES[sKey];
            try {
              const oResp = await fetch(oSvc.reqUrl + "?$top=2000", { headers: _FETCH_HDR });
              if (!oResp.ok) return;
              const aItems = (await oResp.json()).value || [];

              aItems.forEach(function (item) {
                if (!item.ReqId) return;
                const sRId = item.ReqId;
                if (!oChanges[sRId]) {
                  oChanges[sRId] = { moduleKey: sKey, keyInfo: "", allChanges: [] };
                }
                if (!oChanges[sRId].moduleKey) {
                  oChanges[sRId].moduleKey = sKey;
                }
                if (!oChanges[sRId].keyInfo) {
                  oChanges[sRId].keyInfo = oSvc.keyFields
                    .map(function (f) { return item[f] || "-"; }).join(" / ");
                }
                oSvc.diffFields.forEach(function (d) {
                  const sOld = item[d.old]  != null ? String(item[d.old])  : "";
                  const sNew = item[d.field] != null ? String(item[d.field]) : "";
                  if (sOld !== sNew) {
                    oChanges[sRId].allChanges.push({ field: d.field, old: sOld, new: sNew });
                  }
                });
              });
            } catch (e) {
              console.warn("Fetch req table " + sKey + " failed:", e);
            }
          }));

          Object.keys(oChanges).forEach(function (sRId) {
            const o = oChanges[sRId];
            o.changeCount = o.allChanges.length;
            if (o.allChanges.length === 0) {
              o.changeSummary = "";
            } else {
              const f = o.allChanges[0];
              o.changeSummary = f.field + ": " + (f.old || "∅") + " → " + (f.new || "∅");
              if (o.allChanges.length > 1) {
                o.changeSummary += "  (+" + (o.allChanges.length - 1) + " nữa)";
              }
            }
          });

          // ── Step 3: Build enriched list ───────────────────────────────────────
          const aAll = aReqs.map(function (r) {
            const oC = oChanges[r.ReqId] || {};
            const sEffectiveModule = oC.moduleKey || r.ModuleId || "";
            return Object.assign({}, r, {
              ModuleId:       sEffectiveModule,
              _keyInfo:       oC.keyInfo       || "-",
              _changeSummary: oC.changeSummary || "",
              _changeCount:   oC.changeCount   || 0,
              _createdAtFmt:  _formatDate(r.CreatedAt),
              _nextEnv:       _getNextEnv(r.EnvId) || "",
              _hasChanges:    (oC.changeCount  || 0) > 0,
            });
          });

          // ── Step 4: KPI counts (luôn tính trên toàn bộ data, không filter module) ──
          const oKpiModel = this.getView().getModel("kpi");
          oKpiModel.setProperty("/atDev",     aAll.filter(function (i) { return i.EnvId === "DEV"; }).length);
          oKpiModel.setProperty("/atQas",     aAll.filter(function (i) { return i.EnvId === "QAS"; }).length);
          oKpiModel.setProperty("/atPrd",     aAll.filter(function (i) { return i.EnvId === "PRD"; }).length);
          oKpiModel.setProperty("/total",     aAll.length);
          oKpiModel.setProperty("/mmCount",   aAll.filter(function (i) { return i.ModuleId === "MM";   }).length);
          oKpiModel.setProperty("/mmssCount", aAll.filter(function (i) { return i.ModuleId === "MMSS"; }).length);
          oKpiModel.setProperty("/fiCount",   aAll.filter(function (i) { return i.ModuleId === "FI";   }).length);
          oKpiModel.setProperty("/sdCount",   aAll.filter(function (i) { return i.ModuleId === "SD";   }).length);

          aAll.forEach((r) => {
            if (r.ReqId && r.ModuleId) this._oReqModuleMap[r.ReqId] = r.ModuleId;
          });

          // Lưu cache
          this._aCachedAll = aAll;

          // ── Step 5: Apply filters ─────────────────────────────────────────────
          this._applyRequestFilters(aAll);
        } catch (e) {
          console.error("_fetchAllRequests failed:", e);
          MessageBox.error("Không thể tải dữ liệu: " + (e.message || e));
        } finally {
          oView.setBusy(false);
        }
      },

      _applyRequestFilters: function (aAll) {
        const sModule = this._sSelectedModule || "";
        let aResult = aAll.slice();

        if (sModule) {
          aResult = aResult.filter(function (i) { return i.ModuleId === sModule; });
        }

        const sEnv = this.byId("envSegment").getSelectedKey();
        if (sEnv) {
          aResult = aResult.filter(function (i) { return i.EnvId === sEnv; });
        }

        const sQuery = (this.byId("searchField").getValue() || "").toLowerCase();
        if (sQuery) {
          aResult = aResult.filter(function (i) {
            return (String(i.ReqId     || "")).toLowerCase().includes(sQuery) ||
                   (String(i.CreatedBy || "")).toLowerCase().includes(sQuery) ||
                   (String(i.ReqTitle  || "")).toLowerCase().includes(sQuery) ||
                   (String(i._keyInfo  || "")).toLowerCase().includes(sQuery);
          });
        }

        aResult.sort(function (a, b) {
          if (a.Status !== b.Status) return a.Status === "APPROVED" ? -1 : 1;
          return new Date(b.CreatedAt) - new Date(a.CreatedAt);
        });

        this.getView().getModel("vm").setProperty("/requests", aResult);
      },

      // ─── Filter events ────────────────────────────────────────────────────────

      onFilter: function () {
        // Date filter thay đổi → cần fetch lại (date filter là server-side)
        const oDate = this.byId("dateFilter");
        const bHasDate = !!(oDate.getDateValue() || oDate.getSecondDateValue());
        if (bHasDate) {
          this._aCachedAll = null; // invalidate cache khi có date filter
        }
        this._loadRequests();
      },

      onSearch: function () {
        // Search là client-side → chỉ filter lại từ cache
        if (this._aCachedAll) {
          this._applyRequestFilters(this._aCachedAll);
        } else {
          this._loadRequests();
        }
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
        // Clear filter → dùng cache nếu có
        if (this._aCachedAll) {
          this._applyRequestFilters(this._aCachedAll);
        } else {
          this._loadRequests();
        }
      },

      // ─── KPI Tile press → quick ENV filter ──────────────────────────────────

      onKpiTilePress: function (oEvent) {
        const sEnv = oEvent.getSource().data("env");
        this.byId("envSegment").setSelectedKey(sEnv);
        const oKpi = this.getView().getModel("kpi");
        if (oKpi.getProperty("/isAuditMode")) {
          const sMod = this._sSelectedModule || "MM";
          oKpi.setProperty("/isAuditMode",   false);
          oKpi.setProperty("/selectedModule", sMod);
          oKpi.setProperty("/selectedLabel",  _SERVICES[sMod].label);
          this.byId("moduleTabBar").setSelectedKey(sMod);
        }
        // ENV filter là client-side → dùng cache
        if (this._aCachedAll) {
          this._applyRequestFilters(this._aCachedAll);
        } else {
          this._loadRequests();
        }
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

        // Tab switch là client-side filter → dùng cache, không fetch lại
        if (this._aCachedAll) {
          this._applyRequestFilters(this._aCachedAll);
        } else {
          this._loadRequests();
        }
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

        // Guard: items with a zero/null UUID have no header record — nothing to show
        const sNullUuid = "00000000-0000-0000-0000-000000000000";
        if (!oItem.ReqId || oItem.ReqId === sNullUuid) {
          MessageBox.warning("Không tìm thấy Request ID cho record này.\nRecord có thể được tạo thủ công ngoài luồng request.");
          return;
        }

        const bIsPromote = !!oItem._nextEnv; // có nextEnv → còn promote được
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
          previewTab: "RECORDS",
          devNode: { exists: false, current: false, label: "", by: "", at: "", status: "", statusState: "None" },
          qasNode: { exists: false, current: false, label: "", by: "", at: "", status: "", statusState: "None" },
          prdNode: { exists: false, current: false, label: "", by: "", at: "", status: "", statusState: "None" },
        });

        this.byId("previewTableContainer") && this.byId("previewTableContainer").destroyItems();
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

          // Render journey UI
          this._buildJourneyUI(oNodes);

          // Apply changed-only filter if active
          const bFilter = oModel.getProperty("/showChangedOnly");
          const aDisplay = bFilter ? aLines.filter(function (l) { return l.changed; }) : aLines;
          oModel.setProperty("/linesDisplay", aDisplay);

          // Build dynamic preview table
          this._buildPreviewTable(aDisplay);

          if (oHeader.ReqTitle)  oModel.setProperty("/confName", oHeader.ReqTitle);
          if (oHeader.Reason)    oModel.setProperty("/reason",   oHeader.Reason);
          if (oHeader.CreatedBy) oModel.setProperty("/by",       oHeader.CreatedBy);
          oModel.setProperty("/promoteEnabled", true);
        }).catch((e) => {
          console.error(e);
          const oContainer = this.byId("previewTableContainer");
          if (oContainer) {
            oContainer.destroyItems();
            oContainer.addItem(new sap.m.Text({ text: "Lỗi tải dữ liệu — vui lòng đóng và thử lại." }));
          }
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
            .map(function (f) { return (oItem[f] || "-"); })
            .join(" / ");

          // Build key field diffs (for detecting changes in value-help key fields)
          const aKeyFieldDiffs = oSvc.keyFields.map(function (f) {
            const sNew = oItem[f] != null ? String(oItem[f]) : "-";
            const sOldField = oSvc.oldKeyMap && oSvc.oldKeyMap[f];
            const sOld = (sOldField && oItem[sOldField] != null) ? String(oItem[sOldField]) : sNew;
            return { field: f, newVal: sNew, oldVal: sOld, changed: sOld !== sNew };
          });

          // Dùng ActionType từ backend: C=create, U=update, X=delete
          // Fallback: tự detect nếu không có ActionType
          let sRowType = "UNCHANGED";
          const sActionType = (oItem.ActionType || "").toUpperCase();
          if      (sActionType === "C") sRowType = "ADDED";
          else if (sActionType === "X") sRowType = "DELETED";
          else if (sActionType === "U") sRowType = "MODIFIED";

          // Build field diffs
          const aFields = oSvc.diffFields.map(function (d) {
            const sOld = oItem[d.old]   != null ? String(oItem[d.old])   : "";
            const sNew = oItem[d.field]  != null ? String(oItem[d.field]) : "";
            return { field: d.field, oldVal: sOld, newVal: sNew, changed: sOld !== sNew };
          });

          // Nếu không có ActionType, fallback detect
          if (!sActionType) {
            const bAnyChanged  = aFields.some(function (f) { return f.changed; });
            const bAllOldEmpty = aFields.every(function (f) { return !f.oldVal || f.oldVal === "false" || f.oldVal === "0"; });
            const bAllNewEmpty = aFields.every(function (f) { return !f.newVal || f.newVal === "false" || f.newVal === "0"; });
            if (bAnyChanged) {
              if (bAllOldEmpty) sRowType = "ADDED";
              else if (bAllNewEmpty) sRowType = "DELETED";
              else sRowType = "MODIFIED";
            }
          }

          const bChanged = sRowType !== "UNCHANGED";

          aRows.push({
            keyInfo:       sKeyInfo,
            rowType:       sRowType,
            changed:       bChanged,
            changedCount:  aFields.filter(function (f) { return f.changed; }).length,
            totalFields:   aFields.length,
            fields:        aFields,
            keyFieldDiffs: aKeyFieldDiffs,
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

      // ─── Email notification (fire-and-forget) ────────────────────────────────
      // Sends notification to external mail-service on Render.com.
      // Failures are silently ignored and do NOT affect app logic.

      _MAIL_SERVICE_URL: "https://abap19-mail-206.onrender.com/api/notify",
      _MAIL_SERVICE_KEY: "abap19-mail-secret-key-change-me",

      _sendMailNotification: function (oPayload) {
        try {
          fetch(this._MAIL_SERVICE_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": this._MAIL_SERVICE_KEY
            },
            body: JSON.stringify(oPayload || {})
          }).catch(function () { /* silently ignore */ });
        } catch (e) { /* silently ignore */ }
      },

      _getCurrentUser: function () {
        try {
          if (sap && sap.ushell && sap.ushell.Container) {
            var oService = sap.ushell.Container.getService("UserInfo");
            if (oService && oService.getUser) {
              return oService.getUser().getId() || "unknown";
            }
          }
        } catch (e) { /* ignore */ }
        return "unknown";
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

      onPreviewTabSelect: function (oEvent) {
        const sKey = oEvent.getParameter("key");
        this._oDetailDialog.getModel("detail").setProperty("/previewTab", sKey);
      },

      onToggleChangedOnly: function (oEvent) {
        const bPressed = oEvent.getSource().getPressed();
        const oModel = this._oDetailDialog.getModel("detail");
        const aAll = oModel.getProperty("/lines");
        oModel.setProperty("/showChangedOnly", bPressed);
        const aFiltered = bPressed ? aAll.filter(function (l) { return l.changed; }) : aAll;
        oModel.setProperty("/linesDisplay", aFiltered);
        this._buildPreviewTable(aFiltered);
      },

      // ─── Build Promote Journey UI (render bằng HTML trực tiếp) ──────────────

      _buildJourneyUI: function (oNodes) {
        const oContainer = this.byId("journeyContainer");
        if (!oContainer) return;
        oContainer.destroyItems();

        const _nodeCfg = {
          DEV: { accentColor: "#E9730C", lightBg: "#FFF4EC", borderColor: "#F5A66D", label: "DEV" },
          QAS: { accentColor: "#0070F2", lightBg: "#EEF4FF", borderColor: "#91B9F7", label: "QAS" },
          PRD: { accentColor: "#107E3E", lightBg: "#F0FAF3", borderColor: "#7DC9A0", label: "PRD" },
        };

        const _statusLabel = { "Active": "Active", "Promoted": "Promoted", "Rolled Back": "Rolled Back" };
        const _statusColor = { "Success": "#107E3E", "Warning": "#E9730C", "Error": "#BB0000", "None": "#89919A" };

        const aEnvs = [
          { key: "DEV", node: oNodes.dev },
          { key: "QAS", node: oNodes.qas },
          { key: "PRD", node: oNodes.prd },
        ];

        let sHtml = '<div style="display:flex;align-items:center;justify-content:center;padding:1.25rem 1rem;gap:0;width:100%">';

        aEnvs.forEach(function (oEnv, i) {
          const oCfg  = _nodeCfg[oEnv.key];
          const oNode = oEnv.node;

          // Card style
          let sCardBg     = "#FAFAFA";
          let sCardBorder = "#E8E8E8";
          let sCircleBg   = "#E0E0E0";
          let sCircleBorder = "#C8C8C8";
          let sCircleShadow = "none";
          let sIconHtml   = "○";

          if (oNode.current) {
            sCardBg       = oCfg.lightBg;
            sCardBorder   = oCfg.borderColor;
            sCircleBg     = oCfg.accentColor;
            sCircleBorder = oCfg.accentColor;
            sCircleShadow = "0 0 0 5px " + oCfg.accentColor + "33";
            sIconHtml     = '<span style="color:#fff;font-size:1.2rem;font-weight:700">●</span>';
          } else if (oNode.exists) {
            sCardBg       = oCfg.lightBg;
            sCardBorder   = oCfg.borderColor;
            sCircleBg     = oCfg.accentColor;
            sCircleBorder = oCfg.accentColor;
            sIconHtml     = '<span style="color:#fff;font-size:1rem">✓</span>';
          } else {
            sIconHtml = '<span style="color:#BDC3CA;font-size:1.2rem">○</span>';
          }

          // Status text
          let sStatusHtml = "";
          if (oNode.exists && oNode.status) {
            const sColor = _statusColor[oNode.statusState] || "#89919A";
            sStatusHtml = '<div style="margin-top:0.375rem;font-size:0.75rem;font-weight:600;color:' + sColor + ';background:' + sColor + '18;border-radius:4px;padding:0.1rem 0.5rem;display:inline-block">' + oNode.status + '</div>';
          }

          // Meta
          let sMetaHtml = "";
          if (oNode.exists) {
            if (oNode.by) sMetaHtml += '<div style="font-size:0.7rem;color:#89919A;margin-top:0.25rem">' + oNode.by + '</div>';
            if (oNode.at) sMetaHtml += '<div style="font-size:0.7rem;color:#89919A">' + oNode.at + '</div>';
          }

          sHtml += '<div style="display:flex;flex-direction:column;align-items:center;padding:0.875rem 0.75rem;border-radius:10px;border:1.5px solid ' + sCardBorder + ';background:' + sCardBg + ';min-width:9rem;flex:1;max-width:12rem">';
          sHtml += '<div style="width:3rem;height:3rem;border-radius:50%;background:' + sCircleBg + ';border:2.5px solid ' + sCircleBorder + ';box-shadow:' + sCircleShadow + ';display:flex;align-items:center;justify-content:center;margin-bottom:0.5rem">' + sIconHtml + '</div>';
          sHtml += '<div style="font-size:1rem;font-weight:700;color:#32363A">' + oCfg.label + '</div>';
          sHtml += sStatusHtml;
          sHtml += sMetaHtml;
          sHtml += '</div>';

          // Arrow connector
          if (i < 2) {
            const bNextExists = i === 0 ? oNodes.qas.exists : oNodes.prd.exists;
            const sArrowColor = bNextExists ? "#0070F2" : "#D9D9D9";
            sHtml += '<div style="flex:0 0 2.5rem;display:flex;align-items:center;justify-content:center;padding:0 0.25rem">';
            sHtml += '<span style="color:' + sArrowColor + ';font-size:1.5rem;font-weight:300">›</span>';
            sHtml += '</div>';
          }
        });

        sHtml += '</div>';

        oContainer.addItem(new sap.ui.core.HTML({ content: sHtml, sanitizeContent: false }));

        // Rollback button cho PRD current — thêm riêng vì cần event handler
        if (oNodes.prd.current) {
          const oRbBtn = new sap.m.Button({
            text: "↩ Rollback PRD",
            type: "Reject",
            icon: "sap-icon://undo",
            press: this.onNodeRollbackPress.bind(this),
          });
          oRbBtn.data("env", "PRD");
          oRbBtn.addStyleClass("sapUiSmallMarginTop");
          oContainer.addItem(oRbBtn);
        }
      },
      //   Columns: Action | key fields | diff fields (cell UPDATE hiện old→new)

      _buildPreviewTable: function (aRows) {
        const oContainer = this.byId("previewTableContainer");
        if (!oContainer) return;
        oContainer.destroyItems();

        const oSvc = this._oCurrentSvc;
        if (!oSvc || !aRows || !aRows.length) {
          const sap_m = sap.m || sap.ui.require("sap/m/Text");
          oContainer.addItem(new sap.m.Text({ text: "Không có dữ liệu." }));
          return;
        }

        // Build columns: Action + key fields + diff fields
        const aColumns = [];

        // Action column
        aColumns.push(new sap.m.Column({
          width: "6rem",
          hAlign: "Center",
          header: new sap.m.Text({ text: "Action" }),
        }));

        // Key field columns
        oSvc.keyFields.forEach(function (sField) {
          aColumns.push(new sap.m.Column({
            width: "7rem",
            header: new sap.m.Text({ text: sField }),
          }));
        });

        // Diff field columns
        oSvc.diffFields.forEach(function (d) {
          aColumns.push(new sap.m.Column({
            header: new sap.m.Text({ text: d.field }),
          }));
        });

        // Build rows
        const aItems = aRows.map(function (oRow) {
          const oCLI = new sap.m.ColumnListItem({
            highlight: oRow.rowType === "ADDED"    ? "Success" :
                       oRow.rowType === "DELETED"  ? "Error"   :
                       oRow.rowType === "MODIFIED" ? "Warning" : "None",
          });

          // Cell 1: Action badge
          const sText  = oRow.rowType === "ADDED"    ? "CREATE"  :
                         oRow.rowType === "DELETED"  ? "DELETE"  :
                         oRow.rowType === "MODIFIED" ? "UPDATE"  : "—";
          const sState = oRow.rowType === "ADDED"    ? "Success" :
                         oRow.rowType === "DELETED"  ? "Error"   :
                         oRow.rowType === "MODIFIED" ? "Warning" : "None";
          oCLI.addCell(new sap.m.ObjectStatus({
            text: sText, state: sState,
            inverted: oRow.rowType !== "UNCHANGED",
          }));

          // Key field cells — plain text, nhưng nếu MODIFIED và field thay đổi thì hiện old→new
          const aKeyDiffs = oRow.keyFieldDiffs || oRow.keyInfo.split(" / ").map(function (v) {
            return { newVal: v, oldVal: v, changed: false };
          });
          aKeyDiffs.forEach(function (oKF) {
            if (oRow.rowType === "MODIFIED" && oKF.changed) {
              const oBox = new sap.m.HBox({ alignItems: "Center" });
              oBox.addItem(new sap.m.ObjectStatus({ text: oKF.oldVal || "(trống)", state: "Error" }));
              oBox.addItem(new sap.ui.core.Icon({
                src: "sap-icon://navigation-right-arrow",
                color: "#E9730C", size: "0.75rem", style: "margin: 0 0.25rem",
              }));
              oBox.addItem(new sap.m.ObjectStatus({ text: oKF.newVal || "(trống)", state: "Success" }));
              oCLI.addCell(oBox);
            } else {
              oCLI.addCell(new sap.m.Text({ text: oKF.newVal || "-" }));
            }
          });

          // Diff field cells
          // CREATE → chỉ newVal (xanh) | DELETE → chỉ oldVal (đỏ) | MODIFIED → luôn hiện old → new
          oRow.fields.forEach(function (oField) {
            if (oRow.rowType === "ADDED") {
              oCLI.addCell(new sap.m.ObjectStatus({
                text: oField.newVal || "(trống)",
                state: "Success",
              }));
            } else if (oRow.rowType === "DELETED") {
              oCLI.addCell(new sap.m.ObjectStatus({
                text: oField.oldVal || "(trống)",
                state: "Error",
              }));
            } else if (oRow.rowType === "MODIFIED" && oField.changed) {
              // Field thực sự thay đổi → hiện old → new
              const oBox = new sap.m.HBox({ alignItems: "Center" });
              oBox.addItem(new sap.m.ObjectStatus({
                text: oField.oldVal || "(trống)",
                state: "Error",
              }));
              oBox.addItem(new sap.ui.core.Icon({
                src: "sap-icon://navigation-right-arrow",
                color: "#E9730C", size: "0.75rem",
                style: "margin: 0 0.25rem",
              }));
              oBox.addItem(new sap.m.ObjectStatus({
                text: oField.newVal || "(trống)",
                state: "Success",
              }));
              oCLI.addCell(oBox);
            } else {
              oCLI.addCell(new sap.m.Text({
                text: oField.newVal || "(trống)",
              }));
            }
          });

          return oCLI;
        });

        const oTable = new sap.m.Table({
          id: this.getView().getId() + "--previewTable",
          inset: false,
          noDataText: "Không có thay đổi nào.",
          columns: aColumns,
          items: aItems,
        });

        oContainer.addItem(oTable);
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

          // === Email notification (fire-and-forget) ===
          this._sendMailNotification({
            event: "ROLLED_BACK",
            reqId: sReqId,
            reqTitle: this._oCurrentItem.ReqTitle || sReqId,
            module: this._oCurrentItem.ModuleId || "",
            envId: sEnvId,
            triggeredBy: this._getCurrentUser()
          });

          this._aCachedAll = null;
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

                // === Email notification (fire-and-forget) ===
                this._sendMailNotification({
                  event: "ROLLED_BACK",
                  reqId: sReqId,
                  reqTitle: oItem.ReqTitle || sReqId,
                  module: oItem.ModuleId || "",
                  envId: sEnvId,
                  triggeredBy: this._getCurrentUser()
                });

                this._aCachedAll = null;
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

                // === Email notification (fire-and-forget) ===
                this._sendMailNotification({
                  event: "PROMOTED",
                  reqId: oItem.ReqId,
                  reqTitle: oItem.ReqTitle || oItem.ReqId,
                  module: oItem.ModuleId || "",
                  envId: sNextEnv,
                  triggeredBy: this._getCurrentUser()
                });

                this._aCachedAll = null;
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
        this._aCachedAll = null; // invalidate cache → force fetch lại
        this._loadRequests();
        MessageToast.show("Refreshed");
      },

      // ─── Environment Comparison ───────────────────────────────────────────────

      onEnvCompareOpen: function () {
        if (!this._oEnvCompareDialog) {
          Fragment.load({
            id:         this.getView().getId(),
            name:       "zgsp26.conf.mng.itadmin.ext.main.fragment.EnvCompare",
            controller: this,
          }).then((oDialog) => {
            this._oEnvCompareDialog = oDialog;
            this.getView().addDependent(oDialog);
            // Reset result when opening
            this.getView().getModel("cmp").setData({ rows: [], allRows: [], env1Label: "", env2Label: "", summary: "", diffsOnly: false });
            oDialog.open();
          });
        } else {
          this.getView().getModel("cmp").setData({ rows: [], allRows: [], env1Label: "", env2Label: "", summary: "", diffsOnly: false });
          this._oEnvCompareDialog.open();
        }
      },

      onEnvCompareRun: async function () {
        const sModule = this.byId("cmpModule").getSelectedKey();
        const sEnv1   = this.byId("cmpEnv1").getSelectedKey();
        const sEnv2   = this.byId("cmpEnv2").getSelectedKey();
        const oCmpModel = this.getView().getModel("cmp");

        if (!sModule || !sEnv1 || !sEnv2) {
          MessageToast.show("Please select a config and two environments.");
          return;
        }
        if (sEnv1 === sEnv2) {
          MessageToast.show("Please select two different environments.");
          return;
        }

        const oSvc = _SERVICES[sModule];
        oCmpModel.setData({ rows: [], env1Label: sEnv1, env2Label: sEnv2, summary: "Loading..." });

        try {
          // Fetch both envs in parallel — use url (main config table, latest version per row)
          const [oResp1, oResp2] = await Promise.all([
            fetch(oSvc.url + "?$filter=" + encodeURIComponent("EnvId eq '" + sEnv1 + "'") + "&$top=500", { headers: _FETCH_HDR }),
            fetch(oSvc.url + "?$filter=" + encodeURIComponent("EnvId eq '" + sEnv2 + "'") + "&$top=500", { headers: _FETCH_HDR }),
          ]);

          const aData1 = oResp1.ok ? ((await oResp1.json()).value || []) : [];
          const aData2 = oResp2.ok ? ((await oResp2.json()).value || []) : [];

          // Build lookup map for env2: composite business key → record
          const oMap2 = {};
          aData2.forEach(function (item) {
            const sKey = oSvc.keyFields.map(function (f) { return item[f] || ""; }).join("|");
            // Keep the record with the highest VersionNo per business key
            if (!oMap2[sKey] || (item.VersionNo || 0) > (oMap2[sKey].VersionNo || 0)) {
              oMap2[sKey] = item;
            }
          });

          // Build lookup map for env1 (also keep highest version per key)
          const oMap1 = {};
          aData1.forEach(function (item) {
            const sKey = oSvc.keyFields.map(function (f) { return item[f] || ""; }).join("|");
            if (!oMap1[sKey] || (item.VersionNo || 0) > (oMap1[sKey].VersionNo || 0)) {
              oMap1[sKey] = item;
            }
          });

          const aRows = [];
          let iDiff = 0;

          // Compare env1 records against env2
          Object.keys(oMap1).forEach(function (sKey) {
            const oR1   = oMap1[sKey];
            const oR2   = oMap2[sKey];
            const sInfo = oSvc.keyFields.map(function (f) { return f + ": " + (oR1[f] || "-"); }).join(" | ");

            oSvc.diffFields.forEach(function (d) {
              const sVal1  = oR1[d.field] != null ? String(oR1[d.field]) : "";
              const sVal2  = oR2 ? (oR2[d.field] != null ? String(oR2[d.field]) : "") : "";
              const bSame  = oR2 && sVal1 === sVal2;
              const sStatus = bSame ? "Same" : (oR2 ? "Different" : "Only in " + sEnv1);
              if (!bSame) iDiff++;
              aRows.push({
                keyInfo:    sInfo,
                field:      d.field,
                val1:       sVal1 || (sStatus === "Only in " + sEnv2 ? "—" : sVal1),
                val2:       sVal2 || (sStatus === "Only in " + sEnv1 ? "—" : sVal2),
                val1State:  bSame ? "None" : (oR2 ? "Warning" : "Success"),
                val2State:  bSame ? "None" : (oR2 ? "Warning" : "Error"),
                status:     sStatus,
                statusState: bSame ? "Success" : (oR2 ? "Warning" : "Error"),
              });
            });
          });

          // Records only in env2 (not in env1)
          Object.keys(oMap2).forEach(function (sKey) {
            if (oMap1[sKey]) return;
            const oR2   = oMap2[sKey];
            const sInfo = oSvc.keyFields.map(function (f) { return f + ": " + (oR2[f] || "-"); }).join(" | ");
            oSvc.diffFields.forEach(function (d) {
              iDiff++;
              aRows.push({
                keyInfo:    sInfo,
                field:      d.field,
                val1:       "—",
                val2:       oR2[d.field] != null ? String(oR2[d.field]) : "",
                val1State:  "Error",
                val2State:  "Success",
                status:     "Only in " + sEnv2,
                statusState: "Error",
              });
            });
          });

          const iTotalKeys = Object.keys(oMap1).length + Object.keys(oMap2).filter(function (k) { return !oMap1[k]; }).length;
          const bDiffsOnly = oCmpModel.getProperty("/diffsOnly");
          oCmpModel.setData({
            rows:      bDiffsOnly ? aRows.filter(function (r) { return r.status !== "Same"; }) : aRows,
            allRows:   aRows,
            env1Label: sEnv1,
            env2Label: sEnv2,
            diffsOnly: bDiffsOnly,
            summary:   iTotalKeys + " record(s) compared — " + iDiff + " difference(s) found.",
          });

        } catch (e) {
          console.error("EnvCompare failed:", e);
          oCmpModel.setProperty("/summary", "Error loading data: " + (e.message || e));
        }
      },

      onEnvCompareDiffsOnly: function (oEvent) {
        const bOn = oEvent.getParameter("state");
        const oCmpModel = this.getView().getModel("cmp");
        const aAll = oCmpModel.getProperty("/allRows") || [];
        oCmpModel.setProperty("/diffsOnly", bOn);
        oCmpModel.setProperty("/rows", bOn ? aAll.filter(function (r) { return r.status !== "Same"; }) : aAll);
      },

      onEnvCompareClose: function () {
        if (this._oEnvCompareDialog) { this._oEnvCompareDialog.close(); }
      },

    });
  }
);
