sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "zgsp26/conf/mng/itadmin/ext/main/NotificationService",
  ],
  function (Controller, MessageToast, MessageBox, Fragment, JSONModel, NotificationService) {
    "use strict";

    // ─── OData service base URL ───────────────────────────────────────────────
    const _BASE_URL    = "/sap/opu/odata4/sap/zui_conf_req/srvd/sap/zsd_conf_req/0001/";
    const _AUDIT_URL   = "/sap/opu/odata4/sap/zui_audit_log/srvd/sap/zsd_audit_log/0001/AuditLog";
    const _FETCH_HDR   = { "Accept": "application/json", "X-Requested-With": "XMLHttpRequest" };
    const _ENV_ORDER   = { DEV: 1, QAS: 2, PRD: 3 };

    function _getSapClient() {
      try {
        var sUrl = window.location.href;
        var oMatch = sUrl.match(/[?&]sap-client=(\d+)/);
        if (oMatch) return oMatch[1];
      } catch (e) {}
      return "324"; // default client
    }

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
        return new Date(sIso).toLocaleDateString("en-GB", {
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
        this._aCachedAll      = null;
        this._oReqModuleMap   = {};
        // FCL layout model — start with both columns visible
        this.getView().setModel(
          new JSONModel({ layout: "TwoColumnsMidExpanded", showDetail: false }),
          "fcl"
        );
        this.getView().setModel(
          new JSONModel({
            atDev: 0, atQas: 0, atPrd: 0, total: 0,
            mmCount: 0, mmssCount: 0, fiCount: 0, sdCount: 0,
            selectedModule: "MM", selectedLabel: _SERVICES["MM"].label, selectedVer: "-",
          }),
          "kpi"
        );
        this.getView().setModel(
          new JSONModel({ requests: [], auditEntries: [], auditDisplay: [] }),
          "vm"
        );
        // Notification model — managed by NotificationService (APPROVED-only polling)
        this.getView().setModel(
          NotificationService.init(_getSapClient()),
          "notif"
        );
        this.getView().setModel(
          new JSONModel({ rows: [], allRows: [], diffsOnly: false, totalKeys: 0, diffCount: 0 }),
          "cmp"
        );
        this.getView().setModel(
          new JSONModel({
            isAuditDefault: true,
            reqId: "", module: "", confName: "", by: "", reason: "",
            curEnv: "", nextEnv: "",
            isPromoteMode: false, promoteEnabled: false,
            lines: [], linesDisplay: [], journey: [],
            showChangedOnly: false,
            activeTab: "PREVIEW",
            devNode: { exists: false, current: false, label: "", by: "", at: "", status: "", statusState: "None" },
            qasNode: { exists: false, current: false, label: "", by: "", at: "", status: "", statusState: "None" },
            prdNode: { exists: false, current: false, label: "", by: "", at: "", status: "", statusState: "None" },
          }),
          "detail"
        );
        this._loadRequests();
        this._loadAuditTrail();
      },

      onExit: function () {
        NotificationService.destroy();
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

      onNotifPopoverClose: function () {
        // nothing needed — popover closes itself
      },

      // Click notification item → mark read + navigate to module tab + close popover
      onNotifItemPress: function (oEvent) {
        const oCtx  = oEvent.getSource().getBindingContext("notif");
        if (!oCtx) return;
        const oItem = oCtx.getObject();

        // Mark as read
        NotificationService.markRead(oItem.id);

        // Navigate to the request's module tab
        const sMod = oItem.ModuleId;
        if (sMod && _SERVICES[sMod]) {
          this._sSelectedModule = sMod;
          this.byId("moduleTabBar").setSelectedKey(sMod);
          const oKpi = this.getView().getModel("kpi");
          oKpi.setProperty("/selectedModule", sMod);
          oKpi.setProperty("/selectedLabel",  _SERVICES[sMod].label);
          this.getView().getModel("detail").setProperty("/isAuditDefault", true);
          this._loadRequests();
        }

        if (this._oNotifPopover) { this._oNotifPopover.close(); }
      },

      onNotifMarkAllRead: function () {
        NotificationService.markAllRead();
      },

      onNotifClearAll: function () {
        NotificationService.clearAll();
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
                o.changeSummary += "  (+" + (o.allChanges.length - 1) + " more)";
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
          MessageBox.error("Failed to load data: " + (e.message || e));
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

        // Clear list selection and revert right panel to Audit Trail default
        const oReqList = this.byId("requestList");
        if (oReqList) oReqList.removeSelections(true);
        this.getView().getModel("detail").setProperty("/isAuditDefault", true);

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
          // Step 1: Lấy ReqTitle + Reason từ ZC_CONF_REQ_H để join vào log entries
          const oReqTitleMap = {};
          try {
            const oHdrResp = await fetch(
              _BASE_URL + "ZC_CONF_REQ_H?$select=ReqId,ReqTitle,Reason&$top=5000",
              { headers: _FETCH_HDR }
            );
            if (oHdrResp.ok) {
              ((await oHdrResp.json()).value || []).forEach(function (h) {
                if (h.ReqId) oReqTitleMap[h.ReqId] = { title: h.ReqTitle || "-", reason: h.Reason || "" };
              });
            }
          } catch (e) { console.warn("Header title fetch failed", e); }

          // Step 2: Lấy audit log thực sự từ ZAUDITLOG (chỉ có APPROVE/PROMOTE/ROLLBACK)
          const sAuditUrl = _AUDIT_URL + "?$orderby=ChangedAt desc&$top=2000";
          const oAuditResp = await fetch(sAuditUrl, { headers: _FETCH_HDR });
          if (!oAuditResp.ok) throw new Error("AuditLog fetch failed");
          const aLogs = (await oAuditResp.json()).value || [];

          // Step 3: Group log entries by reqId + opType + envId + minute
          // opType buckets PROMOTE/ROLLBACK as their own operation — prevents them
          // from merging with each other or with APPROVE items even within the same minute.
          const oGroups = {};
          aLogs.forEach(function (log) {
            const sMinute = (log.ChangedAt || "").substring(0, 16); // "2026-04-21T10:30"
            const sOp = (log.ActionType === "ROLLBACK") ? "ROLLBACK"
                      : (log.ActionType === "PROMOTE")  ? "PROMOTE"
                      : "APPROVE";
            const sKey = (log.ReqId || "") + "|" + sOp + "|" + (log.EnvId || "") + "|" + sMinute;
            const oHdr = oReqTitleMap[log.ReqId] || {};

            if (!oGroups[sKey]) {
              oGroups[sKey] = {
                groupKey:     sKey,
                reqId:        log.ReqId     || "-",
                moduleId:     log.ModuleId  || "?",
                actionType:   sOp,
                envId:        log.EnvId     || "-",
                changedBy:    log.ChangedBy || "-",
                changedAt:    _formatDate(log.ChangedAt),
                changedAtRaw: log.ChangedAt || "",
                reqTitle:     oHdr.title    || "-",
                reqReason:    oHdr.reason   || "",
                rowCount:     0,
                _rows:        [],
              };
            }

            oGroups[sKey].rowCount++;
            oGroups[sKey]._rows.push({
              logId:      log.LogId     || "-",
              tableName:  log.TableName || "-",
              objectKey:  log.ObjectKey || "-",
              oldData:    log.OldData   || "",
              newData:    log.NewData   || "",
              itemAction: (function () {
                var at  = log.ActionType || "";
                var old = (log.OldData || "").trim();
                var nw  = (log.NewData || "").trim();
                if (at === "PROMOTE" || at === "ROLLBACK") {
                  if (!old || old === "{}") return "CREATE";
                  if (!nw  || nw  === "{}") return "DELETE";
                  return "UPDATE";
                }
                return at || "-";
              }()),
            });
          });

          // Chuyển object → array, sort mới nhất lên đầu
          const aAudit = Object.values(oGroups).sort(function (a, b) {
            return (b.changedAtRaw > a.changedAtRaw) ? 1 : -1;
          });

          this.getView().getModel("vm").setProperty("/auditEntries", aAudit);
          this._applyAuditFilters();
        } catch (e) {
          console.error(e);
          MessageBox.error("Failed to load Audit Trail: " + (e.message || e));
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

        const sAction = this.byId("auditActionFilter").getSelectedKey();
        if (sAction) aResult = aResult.filter(function (i) { return i.actionType === sAction; });

        const sQuery = (this.byId("auditSearch").getValue() || "").toLowerCase();
        if (sQuery) {
          aResult = aResult.filter(function (i) {
            return (i.reqId     || "").toLowerCase().includes(sQuery) ||
                   (i.changedBy || "").toLowerCase().includes(sQuery) ||
                   (i.reqTitle  || "").toLowerCase().includes(sQuery) ||
                   (i.tableName || "").toLowerCase().includes(sQuery);
          });
        }

        this.getView().getModel("vm").setProperty("/auditDisplay", aResult);
      },

      onAuditFilter: function () { this._applyAuditFilters(); },
      onAuditSearch: function () { this._applyAuditFilters(); },

      onAuditClearFilter: function () {
        this.byId("auditModuleFilter").setSelectedKey("");
        this.byId("auditEnvFilter").setSelectedKey("");
        this.byId("auditActionFilter").setSelectedKey("");
        this.byId("auditSearch").setValue("");
        this._applyAuditFilters();
      },

      onAuditRefresh: function () { this._loadAuditTrail(); },

      onAuditDiffPress: async function (oEvent) {
        const oCtx  = oEvent.getSource().getParent().getBindingContext("vm");
        if (!oCtx) return;
        const oItem = oCtx.getObject();
        await this._openAuditDiffForItem(oItem);
      },

      _openAuditDiffForItem: async function (oItem) {

        // oItem là 1 group — _rows chứa tất cả config rows của action đó
        const aRows = oItem._rows || [];

        // Parse tất cả rows thành danh sách diff entries để hiện trong dialog
        // Lọc ZCONFREQH: chỉ dùng cho workflow tracking, không phải config data
        const aDiffEntries = aRows.filter(function (oRow) {
          return oRow.tableName !== "ZCONFREQH";
        }).map(function (oRow) {
          var _parseFields = function (sJson) {
            if (!sJson) return [];
            try {
              var oData = JSON.parse(sJson);
              return Object.keys(oData).map(function (k) {
                return { field: k, value: oData[k] != null ? String(oData[k]) : "" };
              });
            } catch (e) {
              return [{ field: "raw", value: sJson }];
            }
          };

          var aOld = _parseFields(oRow.oldData);
          var aNew = _parseFields(oRow.newData);

          // Đánh dấu field thay đổi
          var oOldMap = {};
          aOld.forEach(function (r) { oOldMap[r.field] = r.value; });
          aNew.forEach(function (r) { r.changed = (oOldMap[r.field] !== r.value); });
          var oNewMap = {};
          aNew.forEach(function (r) { oNewMap[r.field] = r.value; });
          aOld.forEach(function (r) { r.changed = (oNewMap[r.field] !== r.value); });

          // Thêm placeholder cho field chỉ có ở old
          Object.keys(oOldMap).forEach(function (k) {
            if (!oNewMap.hasOwnProperty(k)) {
              aNew.push({ field: k, value: "", changed: true });
            }
          });

          return {
            tableName:  oRow.tableName  || "-",
            objectKey:  oRow.objectKey  || "-",
            itemAction: oRow.itemAction || "-",
            oldFields:  aOld,
            newFields:  aNew,
            hasChanges: aNew.some(function (f) { return f.changed; }) ||
                        aOld.some(function (f) { return f.changed; }),
          };
        });

        const oDiffModel = new JSONModel({
          title:      (oItem.actionType || "-") + " · " + (oItem.reqTitle || "-"),
          actionType: oItem.actionType || "-",
          moduleId:   oItem.moduleId   || "-",
          envId:      oItem.envId      || "-",
          changedBy:  oItem.changedBy  || "-",
          changedAt:  oItem.changedAt  || "-",
          reqTitle:   oItem.reqTitle   || "-",
          reqReason:  oItem.reqReason  || "",
          rowCount:   aDiffEntries.length,
          entries:    aDiffEntries,
        });

        if (!this._oAuditDiffDialog) {
          this._oAuditDiffDialog = await Fragment.load({
            id:         this.getView().getId(),
            name:       "zgsp26.conf.mng.itadmin.ext.main.fragment.AuditDiffDialog",
            controller: this,
          });
          this.getView().addDependent(this._oAuditDiffDialog);
        }
        this._oAuditDiffDialog.setModel(oDiffModel, "diff");
        this._oAuditDiffDialog.open();
      },

      onAuditDiffClose: function () {
        if (this._oAuditDiffDialog) this._oAuditDiffDialog.close();
      },

      // ─── List selection → open detail panel ──────────────────────────────────

      onRequestListSelect: function (oEvent) {
        // selectionChange fires twice when switching items: once for deselection (selected=false)
        // and once for selection (selected=true). Skip the deselection event.
        if (oEvent.getParameter("selected") === false) return;

        const oLI = oEvent.getParameter("listItem");
        if (!oLI || !oLI.getBindingContext) return;
        const oCtx = oLI.getBindingContext("vm");
        const oItem = oCtx ? oCtx.getObject() : null;
        if (!oItem) return;

        this._oCurrentItem = oItem;
        const sNullUuid = "00000000-0000-0000-0000-000000000000";
        if (!oItem.ReqId || oItem.ReqId === sNullUuid) {
          MessageBox.warning("Request ID not found for this record.");
          return;
        }
        this._openDetailPanel(oItem, !!oItem._nextEnv);
      },

      onAuditListSelect: function (oEvent) {
        if (oEvent.getParameter("selected") === false) return;
        const oLI = oEvent.getParameter("listItem");
        if (!oLI || !oLI.getBindingContext) return;
        const oCtx = oLI.getBindingContext("vm");
        if (!oCtx) return;
        const oItem = oCtx.getObject();
        // Bỏ selection ngay để lần click tiếp theo vào cùng item vẫn fire event
        const oList = this.byId("auditList");
        if (oList) oList.removeSelections(true);
        this._openAuditDiffForItem(oItem);
      },

      // ─── Detail back (close mid column) ──────────────────────────────────────

      onDetailBack: function () {
        // Stay two-column — revert right panel to Audit Trail default view
        this.getView().getModel("detail").setProperty("/isAuditDefault", true);
        const oList = this.byId("requestList");
        if (oList) oList.removeSelections(true);
      },

      // ─── Row action → open detail (legacy entry point kept for compat) ────────

      onActionPress: function (oEvent) {
        const oCtx  = oEvent.getSource().getParent().getBindingContext("vm");
        if (!oCtx) return;
        const oItem = oCtx.getObject();
        this._oCurrentItem = oItem;
        const sNullUuid = "00000000-0000-0000-0000-000000000000";
        if (!oItem.ReqId || oItem.ReqId === sNullUuid) {
          MessageBox.warning("Request ID not found for this record.\nThis record may have been created manually outside the request flow.");
          return;
        }
        this._openDetailPanel(oItem, !!oItem._nextEnv);
      },

      // ─── Detail panel (inline FCL mid column) ─────────────────────────────────

      _openDetailPanel: async function (oItem, bIsPromote, bAutoRollback) {
        const sReqId   = oItem.ReqId;
        const sModule  = oItem.ModuleId;
        const sCurEnv  = oItem.EnvId  || "DEV";
        const sNextEnv = _getNextEnv(sCurEnv) || "—";

        // Cancellation token — increment a counter so any in-flight fetch
        // for a previously-clicked item discards its result.
        this._iDetailSeq = (this._iDetailSeq || 0) + 1;
        const iSeq = this._iDetailSeq;

        this._oCurrentSvc = _SERVICES[sModule];

        // Populate the detail model (it lives on the View, not on a dialog)
        const oModel = this.getView().getModel("detail");
        oModel.setData({
          reqId:    sReqId,
          module:   sModule,
          confName: "-",
          by:       oItem.CreatedBy || "-",
          reason:   "-",
          curEnv:   sCurEnv,
          nextEnv:  sNextEnv,
          isPromoteMode:       !!bIsPromote,
          promoteEnabled:      false,
          lines: [], linesDisplay: [], journey: [],
          showChangedOnly: false,
          devNode: { exists: false, current: false, label: "", by: "", at: "", status: "", statusState: "None" },
          qasNode: { exists: false, current: false, label: "", by: "", at: "", status: "", statusState: "None" },
          prdNode: { exists: false, current: false, label: "", by: "", at: "", status: "", statusState: "None" },
        });

        // Clear dynamic containers
        const oPreview = this.byId("previewTableContainer");
        if (oPreview) oPreview.destroyItems();
        const oJourney = this.byId("journeyContainer");
        if (oJourney) oJourney.destroyItems();

        // Reset tab to Preview (first tab — shows what changed)
        const oTabBar = this.byId("detailTabBar");
        if (oTabBar) oTabBar.setSelectedKey("PREVIEW");

        // Open FCL mid column and switch right panel to request detail
        this.getView().getModel("fcl").setProperty("/layout", "TwoColumnsMidExpanded");
        this.getView().getModel("detail").setProperty("/isAuditDefault", false);

        Promise.all([
          this._fetchConfigLines(sReqId, sModule),
          this._fetchJourney(sReqId, sCurEnv),
          this._fetchReqHeader(sReqId, sCurEnv),
        ]).then(([aLines, aJourney, oHeader]) => {
          // Discard result if user already clicked a different item
          if (this._iDetailSeq !== iSeq) return;

          oModel.setProperty("/lines",   aLines);
          oModel.setProperty("/journey", aJourney);

          const oNodes = _buildJourneyNodes(aJourney);
          oModel.setProperty("/devNode", oNodes.dev);
          oModel.setProperty("/qasNode", oNodes.qas);
          oModel.setProperty("/prdNode", oNodes.prd);

          this._buildJourneyUI(oNodes);

          const bFilter  = oModel.getProperty("/showChangedOnly");
          const aDisplay = bFilter ? aLines.filter(function (l) { return l.changed; }) : aLines;
          oModel.setProperty("/linesDisplay", aDisplay);
          this._buildPreviewTable(aDisplay);

          if (oHeader.ReqTitle)  oModel.setProperty("/confName", oHeader.ReqTitle);
          if (oHeader.Reason)    oModel.setProperty("/reason",   oHeader.Reason);
          if (oHeader.CreatedBy) oModel.setProperty("/by",       oHeader.CreatedBy);
          oModel.setProperty("/promoteEnabled", true);
        }).catch((e) => {
          if (this._iDetailSeq !== iSeq) return;
          console.error(e);
          const oContainer = this.byId("previewTableContainer");
          if (oContainer) {
            oContainer.destroyItems();
            oContainer.addItem(new sap.m.Text({ text: "Error loading data — please close and try again." }));
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
            versionNo:     oItem.VersionNo != null ? oItem.VersionNo : null,
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

      onDetailTabSelect: function (oEvent) {
        const sKey = oEvent.getParameter("key");
        this.getView().getModel("detail").setProperty("/activeTab", sKey);
      },

      onPreviewTabSelect: function (oEvent) {
        const sKey = oEvent.getParameter("key");
        this.getView().getModel("detail").setProperty("/previewTab", sKey);
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
        const bChangedOnly = this.getView().getModel("detail").getProperty("/showChangedOnly");

        if (!oSvc || !aRows || !aRows.length) {
          const sMsg = bChangedOnly
            ? "No changed rows — all records are identical to the current configuration."
            : "No data.";
          oContainer.addItem(new sap.m.MessageStrip({
            text: sMsg,
            type: bChangedOnly ? "Information" : "None",
            showIcon: bChangedOnly,
          }));
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

        // Version column
        aColumns.push(new sap.m.Column({
          width: "5.5rem",
          hAlign: "Center",
          header: new sap.m.Text({ text: "Ver." }),
        }));

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
              oBox.addItem(new sap.m.ObjectStatus({ text: oKF.oldVal || "(empty)", state: "Error" }));
              const oArrow1 = new sap.ui.core.Icon({ src: "sap-icon://navigation-right-arrow", color: "#E9730C", size: "0.75rem" });
              oArrow1.addStyleClass("sapUiTinyMarginBeginEnd");
              oBox.addItem(oArrow1);
              oBox.addItem(new sap.m.ObjectStatus({ text: oKF.newVal || "(empty)", state: "Success" }));
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
                text: oField.newVal || "(empty)",
                state: "Success",
              }));
            } else if (oRow.rowType === "DELETED") {
              oCLI.addCell(new sap.m.ObjectStatus({
                text: oField.oldVal || "(empty)",
                state: "Error",
              }));
            } else if (oRow.rowType === "MODIFIED" && oField.changed) {
              // Field thực sự thay đổi → hiện old → new
              const oBox = new sap.m.HBox({ alignItems: "Center" });
              oBox.addItem(new sap.m.ObjectStatus({ text: oField.oldVal || "(empty)", state: "Error" }));
              const oArrow2 = new sap.ui.core.Icon({ src: "sap-icon://navigation-right-arrow", color: "#E9730C", size: "0.75rem" });
              oArrow2.addStyleClass("sapUiTinyMarginBeginEnd");
              oBox.addItem(oArrow2);
              oBox.addItem(new sap.m.ObjectStatus({ text: oField.newVal || "(empty)", state: "Success" }));
              oCLI.addCell(oBox);
            } else {
              oCLI.addCell(new sap.m.Text({
                text: oField.newVal || "(empty)",
              }));
            }
          });

          // Version cell — hiển thị VersionNo của record
          const sVer = oRow.versionNo != null ? "v" + oRow.versionNo : "—";
          oCLI.addCell(new sap.m.ObjectStatus({
            text: sVer,
            state: oRow.versionNo != null ? "Information" : "None",
            inverted: oRow.versionNo != null,
          }));

          return oCLI;
        });

        const oTable = new sap.m.Table({
          inset: false,
          noDataText: "No changes.",
          columns: aColumns,
          items: aItems,
        });

        oContainer.addItem(oTable);
      },

      // ─── Dialog: Quick rollback từ table row ─────────────────────────────────
      //   Nhấn nút ↩ trực tiếp ở bảng → check order → mở dialog ở chế độ confirm

      onQuickRollbackPress: async function () {
        const oItem = this._oCurrentItem;
        if (!oItem) return;

        const oView = this.getView();
        oView.setBusy(true);
        const sBlockingEnv = await this._checkRollbackOrder(oItem.ReqId, oItem.EnvId);
        oView.setBusy(false);

        if (sBlockingEnv) {
          MessageBox.warning(
            "Cannot rollback " + oItem.EnvId + " right now!\n\n" +
            "ENV " + sBlockingEnv + " is still ACTIVE for the same request.\n" +
            "You must rollback " + sBlockingEnv + " first.\n\n" +
            "Required order: PRD → QAS → DEV",
            { title: "Rollback Order Violation", actions: [MessageBox.Action.CLOSE] }
          );
          return;
        }

        this._showRollbackConfirm(oItem.ReqId, oItem.EnvId);
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
            "Cannot rollback " + sEnv + " right now!\n\n" +
            "ENV " + sBlockingEnv + " is still ACTIVE for the same request.\n" +
            "You must rollback " + sBlockingEnv + " first.\n\n" +
            "Required order: PRD → QAS → DEV",
            { title: "Rollback Order Violation", actions: [MessageBox.Action.CLOSE] }
          );
          return;
        }

        this._showRollbackConfirm(sReqId, sEnv);
      },

      // ─── Rollback confirmation dialog ─────────────────────────────────────────

      _showRollbackConfirm: function (sReqId, sEnvId) {
        const fnClose = function (oDialog) { oDialog.close(); oDialog.destroy(); };

        const oDialog = new sap.m.Dialog({
          title: "Confirm Rollback — " + sEnvId,
          type:  "Message",
          state: "Warning",
          content: [
            new sap.m.Text({
              text: "Data at " + sEnvId + " will revert to old values.\nThis action cannot be undone!",
              wrapping: true,
            }),
          ],
          buttons: [
            new sap.m.Button({
              text: "Cancel",
              type: "Default",
              press: function () { fnClose(oDialog); },
            }),
            new sap.m.Button({
              text: "Rollback",
              type: "Reject",
              icon: "sap-icon://undo",
              press: async () => {
                fnClose(oDialog);
                this.onDetailBack();
                const oView = this.getView();
                oView.setBusy(true);
                try {
                  await this._execBoundAction(sReqId, sEnvId, "rollback");
                  this._sendMailNotification({
                    event: "ROLLED_BACK",
                    reqId: sReqId,
                    reqTitle: (this._oCurrentItem && this._oCurrentItem.ReqTitle) || sReqId,
                    module:   (this._oCurrentItem && this._oCurrentItem.ModuleId) || "",
                    envId:    sEnvId,
                    triggeredBy: this._getCurrentUser(),
                  });
                  this._aCachedAll = null;
                  this._loadRequests();
                  this._loadAuditTrail();
                  MessageBox.success("Rollback successful — ENV: " + sEnvId + ".");
                } catch (e) {
                  console.error(e);
                  MessageBox.error("Rollback failed: " + (e.message || e));
                } finally {
                  oView.setBusy(false);
                }
              },
            }),
          ],
        });

        this.getView().addDependent(oDialog);
        oDialog.open();
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
            "Cannot rollback " + sEnvId + " right now!\n\n" +
            "ENV " + sBlockingEnv + " is still APPROVED for the same request.\n" +
            "You must rollback " + sBlockingEnv + " first.\n\n" +
            "Required order: PRD → QAS → DEV",
            { title: "Rollback Order Violation", actions: [MessageBox.Action.CLOSE] }
          );
          return;
        }

        MessageBox.confirm(
          "Rollback this configuration?\n" +
          "REQ_ID: " + sReqId + " — ENV: " + sEnvId + "\n\n" +
          "Data will revert to old values (OldXxx). This action cannot be undone.",
          {
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.CANCEL,
            onClose: async (sResult) => {
              if (sResult !== MessageBox.Action.OK) return;
              this.onDetailBack();
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
                // Reload audit trail để hiện snapshot rollback mới ngay lập tức
                this._loadAuditTrail();
                MessageBox.success("Rollback successful — ENV: " + sEnvId + ".");
              } catch (e) {
                console.error(e);
                MessageBox.error("Rollback failed: " + (e.message || e));
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
          MessageBox.warning("This request is already at PRD — cannot promote further.");
          return;
        }

        const sTitle = oItem.ReqTitle || oItem.ReqId;

        MessageBox.confirm(
          "Promote " + sCurEnv + " → " + sNextEnv + "?\n" +
          sTitle + "\n\n" +
          "Config lines will be copied to " + sNextEnv + ".",
          {
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.OK,
            onClose: async (sResult) => {
              if (sResult !== MessageBox.Action.OK) return;
              this.onDetailBack();
              const oView = this.getView();
              oView.setBusy(true);
              try {
                await this._execBoundAction(oItem.ReqId, sCurEnv, "promote");

                // === Email notification (fire-and-forget) ===
                this._sendMailNotification({
                  event: "PROMOTED",
                  reqId: oItem.ReqId,
                  reqTitle: sTitle,
                  module: oItem.ModuleId || "",
                  envId: sNextEnv,
                  triggeredBy: this._getCurrentUser()
                });

                this._aCachedAll = null;
                this._loadRequests();
                // Reload audit trail để hiện snapshot mới ngay lập tức
                this._loadAuditTrail();
                MessageBox.success("Promote successful to " + sNextEnv + ".");
              } catch (e) {
                console.error(e);
                MessageBox.error("Promote failed: " + (e.message || e));
              } finally {
                oView.setBusy(false);
              }
            },
          }
        );
      },

      // ─── Dialog: Close (alias for FCL back) ──────────────────────────────────

      onDialogClose: function () {
        this.onDetailBack();
      },

      // ─── Refresh ──────────────────────────────────────────────────────────────

      onRefresh: function () {
        this._aCachedAll = null; // invalidate cache → force fetch lại
        this._loadRequests();
        MessageToast.show("Refreshed");
      },

      // ─── Environment Comparison ───────────────────────────────────────────────

      onEnvCompareOpen: function () {
        // If a request is currently open in the detail panel, pre-select its module
        const bHasRequest = !this.getView().getModel("detail").getProperty("/isAuditDefault")
                            && !!this._oCurrentItem;
        const sDefaultModule = bHasRequest ? (this._oCurrentItem.ModuleId || "") : "";

        const _openAndRun = () => {
          // Reset data first
          this.getView().getModel("cmp").setData({
            rows: [], allRows: [], diffsOnly: false,
            totalKeys: 0, diffCount: 0,
          });
          this._oEnvCompareDialog.open();
          // Auto-fill module and run compare when opened from a selected request
          if (sDefaultModule) {
            const oCmpModule = this.byId("cmpModule");
            if (oCmpModule) {
              oCmpModule.setSelectedKey(sDefaultModule);
              this.onEnvCompareRun();
            }
          }
        };

        if (!this._oEnvCompareDialog) {
          Fragment.load({
            id:         this.getView().getId(),
            name:       "zgsp26.conf.mng.itadmin.ext.main.fragment.EnvCompare",
            controller: this,
          }).then((oDialog) => {
            this._oEnvCompareDialog = oDialog;
            this.getView().addDependent(oDialog);
            _openAndRun();
          });
        } else {
          _openAndRun();
        }
      },

      onEnvCompareRun: async function () {
        const sModule   = this.byId("cmpModule").getSelectedKey();
        const oCmpModel = this.getView().getModel("cmp");

        if (!sModule) {
          MessageToast.show("Please select a Config module.");
          return;
        }

        const oSvc = _SERVICES[sModule];
        oCmpModel.setProperty("/rows", []);

        try {
          // Fetch DEV, QAS, PRD song song
          const [oRDev, oRQas, oRPrd] = await Promise.all([
            fetch(oSvc.url + "?$filter=" + encodeURIComponent("EnvId eq 'DEV'") + "&$top=500", { headers: _FETCH_HDR }),
            fetch(oSvc.url + "?$filter=" + encodeURIComponent("EnvId eq 'QAS'") + "&$top=500", { headers: _FETCH_HDR }),
            fetch(oSvc.url + "?$filter=" + encodeURIComponent("EnvId eq 'PRD'") + "&$top=500", { headers: _FETCH_HDR }),
          ]);

          const _toMap = async function (oResp) {
            const oMap = {};
            if (!oResp.ok) return oMap;
            ((await oResp.json()).value || []).forEach(function (item) {
              const sKey = oSvc.keyFields.map(function (f) { return item[f] || ""; }).join("|");
              if (!oMap[sKey] || (item.VersionNo || 0) > (oMap[sKey].VersionNo || 0)) {
                oMap[sKey] = item;
              }
            });
            return oMap;
          };

          const [oMapDev, oMapQas, oMapPrd] = await Promise.all([
            _toMap(oRDev), _toMap(oRQas), _toMap(oRPrd),
          ]);

          // Union of all business keys across 3 envs
          const oAllKeys = {};
          [oMapDev, oMapQas, oMapPrd].forEach(function (oMap) {
            Object.keys(oMap).forEach(function (k) { oAllKeys[k] = true; });
          });

          const aAllRows = [];
          let iDiffRecords = 0;

          Object.keys(oAllKeys).forEach(function (sKey) {
            const oRec   = oMapDev[sKey] || oMapQas[sKey] || oMapPrd[sKey];
            const sInfo  = oSvc.keyFields.map(function (f) { return oRec[f] || "-"; }).join(" / ");
            const bHasDev = !!oMapDev[sKey];
            const bHasQas = !!oMapQas[sKey];
            const bHasPrd = !!oMapPrd[sKey];

            // Tính sync status cho toàn record
            let bRecordDiff = false;
            oSvc.diffFields.forEach(function (d) {
              const sD = String(oMapDev[sKey]?.[d.field] ?? "");
              const sQ = String(oMapQas[sKey]?.[d.field] ?? "");
              const sP = String(oMapPrd[sKey]?.[d.field] ?? "");
              if (sD !== sQ || sQ !== sP) bRecordDiff = true;
            });
            if (!bHasDev || !bHasQas || !bHasPrd) bRecordDiff = true;
            if (bRecordDiff) iDiffRecords++;

            const sSyncText  = bRecordDiff ? "Different" : "Identical";
            const sSyncState = bRecordDiff ? "Warning"   : "Success";
            const sRowHL     = bRecordDiff ? "Warning"   : "None";

            // ── Version row — luôn là row đầu tiên của mỗi record group ──────
            const sDevVer = bHasDev ? ("v" + (oMapDev[sKey].VersionNo || 0)) : "—";
            const sQasVer = bHasQas ? ("v" + (oMapQas[sKey].VersionNo || 0)) : "—";
            const sPrdVer = bHasPrd ? ("v" + (oMapPrd[sKey].VersionNo || 0)) : "—";
            const aVerVals = [sDevVer, sQasVer, sPrdVer].filter(function (v) { return v !== "—"; });
            const sVerMode = aVerVals.length ? aVerVals.slice().sort(function (a, b) {
              return aVerVals.filter(function (v) { return v === b; }).length
                   - aVerVals.filter(function (v) { return v === a; }).length;
            })[0] : "";
            const _verState = function (sVal, bExists) {
              if (!bExists) return "Error";
              if (sVal === sVerMode) return "None";
              return "Warning";
            };
            aAllRows.push({
              keyInfo:       sInfo,
              field:         "Version",
              devVal:        sDevVer,
              qasVal:        sQasVer,
              prdVal:        sPrdVer,
              devState:      _verState(sDevVer, bHasDev),
              qasState:      _verState(sQasVer, bHasQas),
              prdState:      _verState(sPrdVer, bHasPrd),
              _showKey:      true,
              _syncText:     sSyncText,
              _syncState:    sSyncState,
              _rowHighlight: sRowHL,
              _isDiff:       bRecordDiff,
            });

            // Build 1 row per diff field
            oSvc.diffFields.forEach(function (d, idx) {
              const sDevVal = bHasDev ? String(oMapDev[sKey][d.field] ?? "") : "—";
              const sQasVal = bHasQas ? String(oMapQas[sKey][d.field] ?? "") : "—";
              const sPrdVal = bHasPrd ? String(oMapPrd[sKey][d.field] ?? "") : "—";

              // Majority vote: giá trị nào xuất hiện nhiều nhất là "chuẩn"
              // ENV có giá trị lệch → highlight Warning; ENV không tồn tại → Error
              const aVals  = [sDevVal, sQasVal, sPrdVal].filter(function (v) { return v !== "—"; });
              const sMode  = aVals.sort((a, b) =>
                aVals.filter(v => v === b).length - aVals.filter(v => v === a).length
              )[0];

              const _state = function (sVal, bExists) {
                if (!bExists) return "Error";
                if (sVal === sMode) return "None";
                return "Warning";
              };

              aAllRows.push({
                keyInfo:      sInfo,
                field:        d.field,
                devVal:       sDevVal,
                qasVal:       sQasVal,
                prdVal:       sPrdVal,
                devState:     _state(sDevVal, bHasDev),
                qasState:     _state(sQasVal, bHasQas),
                prdState:     _state(sPrdVal, bHasPrd),
                _showKey:     false,
                _syncText:    "",
                _syncState:   "None",
                _rowHighlight: sRowHL,
                _isDiff:      bRecordDiff,
              });
            });
          });

          // Sort: khác nhau lên trước, đồng nhất xuống sau
          aAllRows.sort(function (a, b) {
            if (a._isDiff === b._isDiff) return (a.keyInfo > b.keyInfo ? 1 : -1);
            return a._isDiff ? -1 : 1;
          });

          const bDiffsOnly = oCmpModel.getProperty("/diffsOnly");
          oCmpModel.setData({
            rows:      bDiffsOnly ? aAllRows.filter(function (r) { return r._isDiff; }) : aAllRows,
            allRows:   aAllRows,
            diffsOnly: bDiffsOnly,
            totalKeys: Object.keys(oAllKeys).length,
            diffCount: iDiffRecords,
          });

        } catch (e) {
          console.error("EnvCompare failed:", e);
          MessageToast.show("Compare error: " + (e.message || e));
        }
      },

      onEnvCompareDiffsOnly: function (oEvent) {
        const bOn       = oEvent.getParameter("state");
        const oCmpModel = this.getView().getModel("cmp");
        const aAll      = oCmpModel.getProperty("/allRows") || [];
        oCmpModel.setProperty("/diffsOnly", bOn);
        oCmpModel.setProperty("/rows", bOn ? aAll.filter(function (r) { return r._isDiff; }) : aAll);
      },

      onEnvCompareClose: function () {
        if (this._oEnvCompareDialog) { this._oEnvCompareDialog.close(); }
      },

    });
  }
);
