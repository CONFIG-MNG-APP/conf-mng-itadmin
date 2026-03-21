sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
  ],
  function (Controller, MessageToast, MessageBox, Filter, FilterOperator, Fragment, JSONModel) {
    "use strict";

    // ─── Service config per module ─────────────────────────────────────────
    const _SERVICES = {
      MM: {
        label: "MM Routes",
        url: "/sap/opu/odata4/sap/zui_mm_route_conf/srvd/sap/zsd_mm_route_conf/0001/MMRouteConf",
        keyFields:  ["RouteId", "Plant"],
        diffFields: [
          { field: "Carrier",   old: "OldCarrier"   },
          { field: "ShipType",  old: "OldShipType"  },
          { field: "ValidFrom", old: "OldValidFrom" },
          { field: "ValidTo",   old: "OldValidTo"   },
        ],
      },
      MMSS: {
        label: "MM Safe Stock",
        url: "/sap/opu/odata4/sap/zui_mm_safe_stock/srvd/sap/zsd_mm_safe_stock/0001/MMSafeStock",
        keyFields:  ["Material", "Plant"],
        diffFields: [
          { field: "SafetyStock",  old: "OldSafetyStock"  },
          { field: "ReorderPoint", old: "OldReorderPoint" },
          { field: "MinLotSize",   old: "OldMinLotSize"   },
        ],
      },
      FI: {
        label: "FI Limit",
        url: "/sap/opu/odata4/sap/zui_fi_limit_conf/srvd/sap/zsd_fi_limit_conf/0001/FILimitConf",
        keyFields:  ["CostCenter", "GLAccount"],
        diffFields: [
          { field: "LimitAmount", old: "OldLimitAmount" },
          { field: "Currency",    old: "OldCurrency"    },
          { field: "ValidFrom",   old: "OldValidFrom"   },
          { field: "ValidTo",     old: "OldValidTo"     },
        ],
      },
      SD: {
        label: "SD Price",
        url: "/sap/opu/odata4/sap/zui_sd_price_conf/srvd/sap/zsd_sd_price_conf/0001/SDPriceConf",
        keyFields:  ["Material", "SalesOrg"],
        diffFields: [
          { field: "Price",     old: "OldPrice"     },
          { field: "Currency",  old: "OldCurrency"  },
          { field: "ValidFrom", old: "OldValidFrom" },
          { field: "ValidTo",   old: "OldValidTo"   },
        ],
      },
    };

    const _AUDIT_URL = "/sap/opu/odata4/sap/zui_audit_log/srvd/sap/zsd_audit_log/0001/AuditLog";

    function _getNextEnv(sEnv) {
      return sEnv === "DEV" ? "QAS" : sEnv === "QAS" ? "PRD" : null;
    }

    function _envState(sEnv) {
      return sEnv === "PRD" ? "Error" : sEnv === "QAS" ? "Warning" : "Success";
    }

    return Controller.extend("zgsp26.conf.mng.itadmin.ext.main.Main", {

      // ─── Filter ───────────────────────────────────────────────────────────

      onFilter: function () {
        this._applyFilter();
      },

      onClearFilter: function () {
        this.byId("statusFilter").setSelectedKey("APPROVED");
        this.byId("moduleFilter").setSelectedKey("");
        this.byId("envFilter").setSelectedKey("");
        this._applyFilter();
      },

      _applyFilter: function () {
        const sStatus = this.byId("statusFilter").getSelectedKey();
        const sModule = this.byId("moduleFilter").getSelectedKey();
        const sEnv    = this.byId("envFilter").getSelectedKey();

        const aFilters = [];
        if (sStatus) aFilters.push(new Filter("Status",   FilterOperator.EQ, sStatus));
        if (sModule) aFilters.push(new Filter("ModuleId", FilterOperator.EQ, sModule));
        if (sEnv)    aFilters.push(new Filter("EnvId",    FilterOperator.EQ, sEnv));

        this.byId("requestTable").getBinding("items").filter(aFilters);
      },

      // ─── Row press → detail dialog ────────────────────────────────────────

      onRowPress: async function (oEvent) {
        const oCtx = oEvent.getSource().getBindingContext();
        this._oCurrentCtx = oCtx;

        const sReqId      = oCtx.getProperty("ReqId");
        const sTitle      = oCtx.getProperty("ReqTitle");
        const sModule     = oCtx.getProperty("ModuleId");
        const sCurEnv     = oCtx.getProperty("EnvId");
        const sNextEnv    = _getNextEnv(sCurEnv) || "—";
        const sStatus     = oCtx.getProperty("Status");
        const sApprovedBy = oCtx.getProperty("ApprovedBy") || "-";
        const sApprovedAt = oCtx.getProperty("ApprovedAt") || "-";

        // Create dialog once
        if (!this._oDetailDialog) {
          this._oDetailDialog = await Fragment.load({
            id: this.getView().getId(),
            name: "zgsp26.conf.mng.itadmin.ext.main.fragment.DetailDialog",
            controller: this,
          });
          this._oDetailDialog.setModel(
            new JSONModel({ title: "", lines: [], auditLines: [], nextEnv: "" }),
            "detail"
          );
          this.getView().addDependent(this._oDetailDialog);
        }

        const oModel = this._oDetailDialog.getModel("detail");

        // Header info
        oModel.setProperty("/title", sTitle);
        oModel.setProperty("/nextEnv", sNextEnv);
        oModel.setProperty("/lines", []);
        oModel.setProperty("/auditLines", []);

        this.byId("dlgReqId").setText(sReqId);
        this.byId("dlgApprovedBy").setText(sApprovedBy);
        this.byId("dlgApprovedAt").setText(sApprovedAt);

        const _statusLabel = { APPROVED:"Approved", A:"Approved", ACTIVE:"Active", ROLLED_BACK:"Rolled Back", REJECTED:"Rejected", DRAFT:"Draft", SUBMITTED:"Submitted" };
        const _statusState = { APPROVED:"Warning", A:"Warning", ACTIVE:"Success", ROLLED_BACK:"Error", REJECTED:"Error", DRAFT:"None", SUBMITTED:"Information" };

        const oSts = this.byId("dlgStatus");
        oSts.setText(_statusLabel[sStatus] || sStatus);
        oSts.setState(_statusState[sStatus] || "None");

        const oCurEnvCtl = this.byId("dlgCurEnv");
        oCurEnvCtl.setText(sCurEnv);
        oCurEnvCtl.setState(_envState(sCurEnv));

        const oNextEnvCtl = this.byId("dlgNextEnv");
        oNextEnvCtl.setText(sNextEnv);
        oNextEnvCtl.setState(sNextEnv !== "—" ? _envState(sNextEnv) : "None");

        // Update column headers
        this.byId("colSourceHeader").setText(sCurEnv + " (source)");
        this.byId("colTargetHeader").setText(sNextEnv !== "—" ? sNextEnv + " (target)" : "Snapshot");

        // Show/hide action buttons
        const bApproved     = sStatus === "APPROVED" || sStatus === "A";
        const bActive       = sStatus === "ACTIVE";
        const bActiveMidway = bActive && sCurEnv !== "PRD";
        this.byId("dlgPromoteBtn").setVisible((bApproved || bActiveMidway) && sNextEnv !== "—");
        this.byId("dlgRollbackBtn").setVisible(bApproved || bActive);

        // Reset tables
        this.byId("previewTable").setNoDataText("Loading config changes...");
        this.byId("auditTable").setNoDataText("Loading audit trail...");

        this._oDetailDialog.open();

        // Fetch data in parallel
        Promise.all([
          this._fetchConfigLines(sReqId, sModule, sCurEnv, sNextEnv),
          this._fetchAuditLines(sReqId),
        ]).then(([aLines, aAudit]) => {
          oModel.setProperty("/lines", aLines);
          oModel.setProperty("/auditLines", aAudit);
          this.byId("previewTable").setNoDataText(
            aLines.length ? "" : "No config changes found."
          );
          this.byId("auditTable").setNoDataText(
            aAudit.length ? "" : "No audit records found."
          );
        }).catch(e => {
          console.error(e);
          this.byId("previewTable").setNoDataText("Failed to load: " + (e.message || e));
        });
      },

      // ─── Fetch config lines (Preview Changes tab) ─────────────────────────

      _fetchConfigLines: async function (sReqId, sModuleId, sCurEnv, sNextEnv) {
        const aKeys = sModuleId ? [sModuleId] : Object.keys(_SERVICES);

        for (const sKey of aKeys) {
          const oSvc = _SERVICES[sKey];
          if (!oSvc) continue;
          try {
            // ReqId is Edm.Guid in OData V4 — no quotes
            const sUrl = oSvc.url + "?$filter=ReqId eq " + sReqId;
            const oResp = await fetch(sUrl, {
              headers: { "Accept": "application/json", "X-Requested-With": "XMLHttpRequest" },
            });
            if (!oResp.ok) continue;
            const oData = await oResp.json();
            const aItems = oData.value || [];
            if (!aItems.length) continue;
            return this._normalizeLines(aItems, oSvc, sCurEnv, sNextEnv);
          } catch (e) {
            console.warn("Service " + sKey + " failed:", e);
          }
        }
        return [];
      },

      _normalizeLines: function (aItems, oSvc, sCurEnv, sNextEnv) {
        const aRows = [];
        aItems.forEach(function (oItem) {
          const sKey = oSvc.keyFields
            .map(function (f) { return f + ": " + (oItem[f] || "-"); })
            .join(" | ");

          oSvc.diffFields.forEach(function (d) {
            const sSource = String(oItem[d.field] || "");
            const sTarget = String(oItem[d.old]   || "");
            aRows.push({
              keyInfo:   sKey,
              field:     d.field,
              action:    "UPDATE",
              sourceVal: sSource,
              targetVal: sTarget,
              changed:   sSource !== sTarget,
            });
          });
        });
        return aRows;
      },

      // ─── Fetch audit trail ────────────────────────────────────────────────

      _fetchAuditLines: async function (sReqId) {
        try {
          const sUrl = _AUDIT_URL + "?$filter=ReqId eq " + sReqId + "&$orderby=ChangedAt desc";
          const oResp = await fetch(sUrl, {
            headers: { "Accept": "application/json", "X-Requested-With": "XMLHttpRequest" },
          });
          if (!oResp.ok) return [];
          const oData = await oResp.json();
          return oData.value || [];
        } catch (e) {
          console.warn("Audit log fetch failed:", e);
          return [];
        }
      },

      // ─── Dialog buttons ───────────────────────────────────────────────────

      onDialogClose: function () {
        this._oDetailDialog.close();
      },

      onDialogPromote: function () {
        const sCurEnv  = this._oCurrentCtx.getProperty("EnvId");
        const sNextEnv = _getNextEnv(sCurEnv);
        this._oDetailDialog.close();
        this._executePromote([this._oCurrentCtx], sCurEnv, sNextEnv, () => {
          this.byId("requestTable").getBinding("items").refresh();
        });
      },

      onDialogRollback: function () {
        // First click: switch to Rollback Preview tab so IT Admin sees impact
        const oTabs = this.byId("detailTabs");
        if (oTabs.getSelectedKey() !== "rollback") {
          oTabs.setSelectedKey("rollback");
          MessageToast.show("Review the Rollback Preview tab, then click Rollback again to confirm.");
          return;
        }
        // Second click (already on rollback tab): execute
        this._oDetailDialog.close();
        this._executeAction("rollback", [this._oCurrentCtx], () => {
          this.byId("requestTable").getBinding("items").refresh();
        });
      },

      // ─── Toolbar: Promote / Rollback (multi-select) ───────────────────────

      onPromote: function () {
        const aSelected = this.byId("requestTable").getSelectedItems();
        if (!aSelected.length) {
          MessageToast.show("Please select at least one request");
          return;
        }
        const aInvalid = aSelected.filter(o => {
          const s = o.getBindingContext().getProperty("Status");
          const e = o.getBindingContext().getProperty("EnvId");
          const bApproved = s === "A" || s === "APPROVED";
          const bActiveMidway = s === "ACTIVE" && e !== "PRD";
          return !bApproved && !bActiveMidway;
        });
        if (aInvalid.length) {
          MessageBox.warning("Only 'Approved' or 'Active' (non-PRD) requests can be promoted.");
          return;
        }
        const aCtxs = aSelected.map(o => o.getBindingContext());
        // All selected must have same EnvId for batch promote
        const sCurEnv  = aCtxs[0].getProperty("EnvId");
        const sNextEnv = _getNextEnv(sCurEnv);
        this._executePromote(aCtxs, sCurEnv, sNextEnv, () => {
          this.byId("requestTable").getBinding("items").refresh();
        });
      },

      onRollback: function () {
        const aSelected = this.byId("requestTable").getSelectedItems();
        if (!aSelected.length) {
          MessageToast.show("Please select at least one request");
          return;
        }
        const aInvalid = aSelected.filter(o => {
          const s = o.getBindingContext().getProperty("Status");
          return s !== "A" && s !== "APPROVED" && s !== "ACTIVE";
        });
        if (aInvalid.length) {
          MessageBox.warning("Only 'Approved' or 'Active' requests can be rolled back.");
          return;
        }
        const aCtxs = aSelected.map(o => o.getBindingContext());
        this._executeAction("rollback", aCtxs, () => {
          this.byId("requestTable").getBinding("items").refresh();
        });
      },

      // ─── Promote (with TargetEnv) ─────────────────────────────────────────

      _executePromote: function (aContexts, sCurEnv, sNextEnv, fnSuccess) {
        if (!sNextEnv) {
          MessageBox.warning("This request is already at PRD — no further environment to promote.");
          return;
        }
        MessageBox.confirm(
          "Promote " + aContexts.length + " request(s)?\n" +
          sCurEnv + " → " + sNextEnv + "\nConfig data will be copied to " + sNextEnv + ".",
          {
            onClose: async (sResult) => {
              if (sResult !== "OK") return;
              const oView = this.getView();
              oView.setBusy(true);
              try {
                for (const oCtx of aContexts) {
                  // TODO: thêm setParameter("TargetEnv", sNextEnv) sau khi BE khai báo param trong BDEF
                  await oCtx.getModel().bindContext(
                    "com.sap.gateway.srvd.zsd_conf_req.v0001.promote(...)",
                    oCtx
                  ).execute("$auto");
                }
                fnSuccess();
                MessageBox.success(
                  "Promoted " + aContexts.length + " request(s) from " +
                  sCurEnv + " to " + sNextEnv + "."
                );
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

      // ─── Rollback ─────────────────────────────────────────────────────────

      _executeAction: function (sAction, aContexts, fnSuccess) {
        MessageBox.confirm(
          "Rollback " + aContexts.length + " request(s)?\n⚠ This will restore the previous configuration values.",
          {
            emphasizedAction: "Cancel",
            onClose: async (sResult) => {
              if (sResult !== "OK") return;
              const oView = this.getView();
              oView.setBusy(true);
              try {
                for (const oCtx of aContexts) {
                  await oCtx.getModel().bindContext(
                    "com.sap.gateway.srvd.zsd_conf_req.v0001." + sAction + "(...)",
                    oCtx
                  ).execute("$auto");
                }
                fnSuccess();
                MessageBox.success("Rollback completed for " + aContexts.length + " request(s).");
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

      // ─── Refresh ──────────────────────────────────────────────────────────

      onRefresh: function () {
        this.byId("requestTable").getBinding("items").refresh();
        MessageToast.show("Refreshed");
      },

    });
  }
);
