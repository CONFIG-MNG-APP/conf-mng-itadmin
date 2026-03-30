# IT Admin — Configuration Management

SAP Fiori custom application for IT Administrators to **promote** and **rollback** approved configuration requests across environments (DEV → QAS → PRD).

## Live URL

https://s40lp1.ucc.cit.tum.de/sap/bc/ui5_ui5/sap/zconfmngadmin?sap-client=324

---

## Overview

| Item | Value |
|------|-------|
| App ID | `zgsp26.conf.mng.itadmin` |
| BSP Application | `ZCONFMNGADMIN` |
| Semantic Object | `ITAdmin` |
| Action | `manage` |
| OData Service | `zui_conf_req / zsd_conf_req` v0001 |
| Main Entity | `ZC_CONF_REQ_H` |
| UI5 Version | ≥ 1.108.33 |
| Framework | SAP Fiori Elements FPM (Free Style) |

---

## Features

### KPI Dashboard
Four summary tiles showing **unique ReqId counts** per environment — consistent with the deduplicated request list below (only items with a valid `ReqId` are counted; ENV/search filters do not affect KPI totals):
- **DEV** — requests currently at DEV stage
- **QAS** — requests currently at QAS stage
- **PRD** — requests successfully promoted to PRD
- **Total** — all unique requests in the system

### Filter Bar
| Filter | Description |
|--------|-------------|
| Module | MM / MMSS / FI / SD |
| ENV | DEV / QAS / PRD |
| Date Range | Filter by `CreatedAt` |
| Search | REQ_ID, CreatedBy, Key Info |

### Request Table
Displays deduplicated requests (one row per `ReqId`) with:
- **Environment Journey** — visual `DEV → QAS → PRD` progress indicator
- **Action** — `Promote` button (if not at PRD) or `View` button (if at PRD)

### Detail Dialog
Opened when pressing Promote / View on a row:
- **Request Info** — module, config name, requester, reason
- **Promote Journey** — timeline of all environments this request has passed through, with status badges (`Active`, `Promoted`, `Rolled Back`)
- **Preview thay đổi** — diff table showing old vs. new values for each changed field

### Promote
Advances a request from its current environment to the next:
- DEV → QAS
- QAS → PRD

Executes OData V4 bound action: `com.sap.gateway.srvd.zsd_conf_req.v0001.promote`

### Rollback
Reverts configuration data to previous values (`OldXxx` fields).
Enforces mandatory rollback order: **PRD → QAS → DEV** — cannot rollback a lower env while a higher env is still `ACTIVE`.

Executes OData V4 bound action: `com.sap.gateway.srvd.zsd_conf_req.v0001.rollback`

---

## Supported Modules

| Module Key | Label | Key Fields | Diff Fields |
|------------|-------|------------|-------------|
| `MM` | MM Routes | PlantId, SendWh, ReceiveWh | TransMode, IsAllowed, InspectorId |
| `MMSS` | MM Safe Stock | PlantId, MatGroup | PlantId, MatGroup, MinQty |
| `FI` | FI Limit | ExpenseType, GlAccount | ExpenseType, GlAccount, AutoApprLim, Currency |
| `SD` | SD Price | BranchId, CustGroup, MaterialGrp | MaxDiscount, MinOrderVal, ApproverGrp, Currency, ValidFrom, ValidTo |

---

## Project Structure

```
conf-mng-itadmin/
├── webapp/
│   ├── ext/main/
│   │   ├── Main.view.xml              # Main page (KPI + filter + table)
│   │   ├── Main.controller.js         # All business logic
│   │   └── fragment/
│   │       ├── DetailDialog.fragment.xml   # Promote/Rollback dialog
│   │       └── EnvCompare.fragment.xml     # ENV comparison dialog
│   ├── annotations/annotation.xml
│   ├── localService/mainService/metadata.xml
│   ├── i18n/i18n.properties
│   ├── manifest.json
│   └── Component.js
├── ui5.yaml                           # Dev server config (proxy → s40lp1)
├── ui5-mock.yaml                      # Mock server config
├── ui5-deploy.yaml                    # Deploy to ABAP config
└── package.json
```

---

## Local Development

**Prerequisites:** Node.js ≥ 18, `@ui5/cli` ≥ 4, `@sap/ux-ui5-tooling`

```bash
npm install
```

### Start with live backend
```bash
npm start
# Opens: http://localhost:8080/test/flp.html#app-preview
# Proxies /sap/* → https://s40lp1.ucc.cit.tum.de (client 324)
```

### Start with mock data
```bash
npm run start-mock
```

---

## Build & Deploy

```bash
# Build only
npm run build

# Build + deploy to ABAP
npm run deploy

# Dry run (no actual deploy)
npm run deploy-test
```

Deploy target: `https://s40lp1.ucc.cit.tum.de` | BSP app: `ZCONFMNGADMIN`

---

## Data Flow

```
[Module Config Tables]           [ZC_CONF_REQ_H]
  MMRouteMain (MM)          ──▶  Real EnvId per ReqId
  MMSafeStockMain (MMSS)         (promote creates new header
  ZC_FI_LIMIT_CONF (FI)          records — module tables keep
  SDPriceMain (SD)               original EnvId)
        │
        ▼
  Deduplicate by ReqId
  (keep highest module EnvId)
        │
        ▼
  Override EnvId from
  ZC_CONF_REQ_H (real position)
        │
        ▼
  Apply filters (Module / ENV / Date / Search)
        │
        ├──▶ KPI tiles (count per env, before ENV/search filter)
        └──▶ Request table
```

---

## OData Services

| Service | Entity | Purpose |
|---------|--------|---------|
| `zui_conf_req/zsd_conf_req` | `ZC_CONF_REQ_H` | Request headers, promote/rollback actions |
| `zui_mm_route_conf/zsd_mm_route_conf` | `MMRouteMain`, `MMRouteConf` | MM route config + request items |
| `zui_mm_safe_stock/zsd_mm_safe_stock` | `MMSafeStockMain`, `MMSafeStock` | Safe stock config + request items |
| `zui_fi_limit_conf/zsd_fi_limit_conf` | `ZC_FI_LIMIT_CONF` | FI limit config |
| `zui_sd_price_conf/zsd_sd_price_conf` | `SDPriceMain`, `SDPriceConf` | SD price config + request items |

---

## Related Apps

| App | Role |
|-----|------|
| `config-manager-fiori` | Manager App — review & approve configuration requests |
| `conf-mm-routes-fiori` | MM Routes — submit MM route change requests |
| `conf-mm-safestock` | MM Safe Stock — submit safe stock change requests |
| `config-catalog-fiori` | Catalog — browse all config entries |
