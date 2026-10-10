# 上下午拜访日历 / Half-day Visit Calendar

Feishu Base dashboard widget. A seven-day calendar with morning and afternoon slots, linked contacts, date navigation and an in-widget editor. Saving returns to the calendar, not the native record/comment panel.

## Data and privacy

- Uses the official `@lark-base-open/js-sdk` in the currently opened Base.
- No application secret, access token, customer data, order data or production Base identifier is embedded.
- No application backend, payment or subscription is required by this code.
- Reads only the configured visit table and its linked contact table, subject to the current user's Feishu permissions. No business data is sent to a separate application server.
- Writes only the visit timestamp and selected contact record IDs. Configuration stores field/table identifiers, not customer data.
- Never creates customer records automatically. Canceling the editor does not create an unnamed record.
- Duplicate checks and stale-record checks are best effort; the SDK does not provide an atomic compare-and-swap transaction. Failed acknowledgements are not retried automatically.

## Existing schema

The initial configuration locates one table named **拜访计划** containing:

| Field | Type |
| --- | --- |
| 拜访时间 | Date/time |
| 约见客户 | Link to the existing contact table |

The linked table contains **姓名**, **当前所属支行**, **当前所属部门** and checkbox **测试记录**. An optional **客户搜索关键词** field is supported. Contact rows marked as test records are excluded. Do not rename or remove these fields before the first configuration. Once configured, identifiers are retained. When copying the Base, the plan mapping uses Feishu's `dataConditions` and resolves the linked table within the copy. Invalid mappings stop writes.

## Usage

1. Add the widget in a Feishu dashboard and save the detected configuration.
2. Make the component wide enough for seven columns. Below 700px it uses stacked days, with morning/afternoon side by side.
3. Use previous/next week or the date picker to navigate.
4. Click a morning/afternoon slot, choose the date/time and one or more linked contacts, then save.
5. Search supports branch abbreviations, department aliases and multiple space-separated keywords. It is not phonetic or typo-correcting search.
6. Click an existing visit to edit; deletion requires a second confirmation. All calendar times use **Asia/Shanghai**.

The primary interface supports Chinese, English and Japanese labels. Detailed schema diagnostics may retain original Chinese field names. Light/dark mode follows the host when its theme API is available.

## Build

```sh
npm ci
npm test
npm run build
```

`package.json` declares `output: dist`; `dist/index.html` and relative assets are included for official Feishu hosting review. A localhost development URL is **not** a deployed version and cannot be used from another device.

Tests cover date/time boundaries, search, saved configuration, copied identifier mapping, permissions, conflict/duplicate handling, uncertain save results and verified deletion. Browser acceptance was performed in Feishu with fictional demo records. Responsive browser simulation does not establish full compatibility with the native Feishu mobile App.

## Distribution

Submitted code is intended for Feishu's official review and hosting. Availability depends on approval. This repository contains program files and synthetic tests only; no real CRM export, screenshot, credentials or data snapshot is included.

The application code is publicly viewable for review. No additional open-source license grant is declared for the application. Third-party notices are preserved separately.
