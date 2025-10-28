# Pastoral Care Dashboard

> Central, **desktop-only** case management for pastoral support at QUB EEECS.  
> Two staff dashboards (Tricia + Advisors of Studies), lecturer intake, and automatic email capture into a single student case timeline. API-first, JSON-first, simple to run and evolve.

---

## 1) What this is

A web application that gives the Support Office (Tricia) and Advisors of Studies a **single place** to see and update each student’s pastoral “case file”: notes, emails, meetings, EC milestones, and contextual data (e.g., submissions/attendance when available). It replaces scattered email/Teams threads with a **central, searchable timeline** and **due-dated follow-ups** so nothing falls through the cracks.

**Out of scope (for now):** student-facing portal, mobile/tablet UI, intrusive risk scores.  
**In scope:** desktop-only staff UI, lecturer concern intake, auto-logging of email in/out, action-based queue, role-scoped access.

---

## 2) Goals

- **Centralise** communications and facts for each supported student.  
- **Reduce admin overhead** (one-click notes, templates, automatic email logging).  
- **Make next steps obvious** (Action Queue ordered by *next action due* with clear reasons).  
- **Respect privacy** (role-based access; least-privilege views).  
- **Stay simple & evolvable** (API-first, JSON-first; avoid heavy frameworks; easy backups).

---

## 3) Users & roles

- **Tricia (Support Office)** — full visibility; triage and coordination; owns the global action queue.  
- **Advisor of Studies** — sees only *their* advisees; records meetings/outcomes; collaborates with Tricia.  
- **Lecturer (restricted)** — submits a *Report Concern* form; cannot browse cases.

> No student UI. **Desktop only.**

---

## 4) Feature overview

- **Two dashboards**
  - **Tricia Dashboard:** global search; *Action needed soonest* queue; “New case”; filters (unanswered, follow-ups today, recently updated); dense list with inline actions (add note, assign, set follow-up, close).
  - **My Advisees (Advisor):** same patterns but auto-scoped to advisees; meetings due; recent updates; no browsing outside cohort.
- **Case file & timeline:** every note, email (outbound + inbound), meeting, EC milestone; required **follow-up date** on open/pending cases.
- **Lecturer intake:** quick *Report Concern* form (student lookup, concern type, details, attachment).
- **Automatic email capture**
  - **Outbound:** send from within a case (templates: check-in, meeting invite); message auto-logged to timeline.
  - **Inbound:** replies/forwards reach a dedicated mailbox/alias (e.g., `pastoral+<caseId>@…`) and are auto-attached to the correct case timeline. Unmatched mail lands in an **intake tray** for manual linking.
- **Prioritisation without flags:** neutral **reason chips** (e.g., `missed_submission`, `no_activity_14d`, `unanswered_message`, `ec_deadline`). The queue orders by **next action due**, then reason/date, then last activity. Staff can override at any time.

---

## 5) Architecture (high level)

**Desktop UI → REST API → JSON/NoSQL store**, plus integrations (SSO, Email, Canvas/attendance later). Modular, layered, and API-first.

- **UI (Desktop-only):** two role-specific dashboards, case view, intake form, SSO login. Keyboard-friendly, dense tables, pagination; **no mobile/tablet mode**.
- **REST API / Business logic**
  - *Case Management* (open/close, notes, assign, follow-up)
  - *Auth & Roles* (SSO + RBAC; Tricia=all, Advisor=own advisees, Lecturer=intake-only)
  - *Messaging Hub* (email out/in auto-logging to timeline)
  - *Data Integration* (start with CSV/manual; later Canvas/attendance connectors and scheduled jobs)
  - *Prioritisation* (neutral reason rules that order the queue; no visible risk scores)
- **Data layer (JSON-first):** Students, Cases (timelines), Users/Roles, Audit logs as JSON/NoSQL documents. Human-readable backups are straightforward.  
- **Integrations:** University SSO/AD; Email (SMTP + inbound capture); Canvas/attendance (later).

---

## 6) Technology choices

- **Backend:** Node.js + a minimal HTTP framework (e.g., Express) — lightweight, fast for I/O, easy JSON handling.  
- **Frontend:** server-rendered pages or a light SPA where useful; table/search libs for speed; desktop-first layouts.  
- **Data:** MongoDB (or compatible document store). Early dev may use JSON files behind a thin repository layer to swap later.  
- **Email:** SMTP for outbound; dedicated inbox/alias + parser for inbound capture.  
- **Auth:** University SSO/AD (OIDC/SAML) for login; server-enforced RBAC.

---

## 7) Desktop-only stance

The application is intended **exclusively for desktop/laptop use** by staff. It targets modern desktop browsers (Chrome/Edge/Firefox), optimised for **1920×1080+** with dense, keyboard-centric workflows. **No mobile/tablet support**; such devices show a “desktop required” notice.

---

## 8) Environment & security

- **Hosting:** Oracle Cloud (UK region).  
- **Exposure:** single public **HTTPS** endpoint; no HTTP fallback.  
- **Database:** **no public address**; reachable only from the app host via strict rules.  
- **Hardening:** minimal open ports; regular security updates; least-privilege access.  
- **Admin access:** named engineers via SSH keys and IP allow-listing; sessions audited.  
- **Secrets:** managed via CI/CD environment secrets; **never** committed to source.  
- **Observability:** centralised logs + basic metrics/alerts.  
- **Backup & recovery:** scheduled backups + periodic restore tests.

---

## 9) CI/CD

- **GitHub Actions** on a protected `main`: build → test (unit/e2e) → version → stage → production (approval required).  
- **Containerised releases** for consistency across environments.  
- **Rolling/blue-green** deployments with health checks and **automatic rollback** on failure.  
- **DB migrations** run idempotently as part of each release.  
- Pipeline can evolve as we learn, but guarantees remain: automated, tested, versioned, recoverable.

---

## 10) Developer setup

### Prereqs
- Node.js LTS  
- (Optional) Docker  
- MongoDB (local or via Docker)

### Get started
```bash
git clone <repo>
cd pastoral-dashboard
npm install
