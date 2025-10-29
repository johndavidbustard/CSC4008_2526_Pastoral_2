const reasonLabels = {
  missed_submission: "Missed submission",
  unanswered_message: "Awaiting reply",
  ec_deadline: "EC evidence due",
  no_activity_14d: "No activity (14d)"
};

const SUPPORT_EMAIL = "pastoral.support@qub.ac.uk";

function toDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.valueOf()) ? date : null;
}

function isToday(date) {
  if (!date) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isOverdue(date) {
  if (!date) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return date < now;
}

function formatDate(value) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDateOnly(value) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(value)
  );
}

function createMailtoLink({ to, cc = [], subject = "", body = "" }) {
  const params = new URLSearchParams();
  if (cc.length) {
    params.set("cc", cc.join(","));
  }
  if (subject) {
    params.set("subject", subject);
  }
  if (body) {
    params.set("body", body);
  }
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    return false;
  }
}

async function fetchJSON(url, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  return response.json();
}

function renderReasonChips(reasons = []) {
  if (!reasons.length) return "";
  return `<div>${reasons
    .map((reason) => `<span class="tag">${reasonLabels[reason] || reason}</span>`)
    .join("")}</div>`;
}

const triciaState = {
  queue: [],
  intake: [],
  unmatchedEmails: [],
  filter: "today",
  activeCaseId: null
};

function applyQueueFilter(queue, filter) {
  if (filter === "all") return queue;
  return queue.filter((item) => {
    const dueDate = toDate(item.nextActionDue);
    if (!dueDate) return false;
    if (filter === "today") return isToday(dueDate);
    if (filter === "overdue") return isOverdue(dueDate);
    return true;
  });
}

function renderTimeline(timeline = []) {
  if (!timeline.length) {
    return `<p>No timeline entries yet.</p>`;
  }

  return timeline
    .map((entry) => {
      const title =
        entry.type === "email_out"
          ? "Email sent"
          : entry.type === "email_in"
          ? "Email received"
          : entry.type === "meeting"
          ? "Meeting"
          : entry.type === "concern"
          ? "Lecturer concern"
          : "Note";
      const authorText = entry.authorName ? ` • ${entry.authorName}` : "";

      return `<article class="timeline-entry">
        <h4>${title}${authorText}</h4>
        <time>${formatDate(entry.timestamp)}</time>
        <p>${entry.summary}</p>
      </article>`;
    })
    .join("");
}

async function showCaseDetail(elementId, caseId, options = {}) {
  const container = document.getElementById(elementId);
  if (!container) return;

  container.classList.remove("empty");
  container.innerHTML = "<p>Loading case…</p>";

  const caseData = await fetchJSON(`/api/cases/${caseId}`);
  const advisorEmail = caseData.advisor?.email || null;
  const advisorName = caseData.advisor?.name || "advisor";
  const ownerEmail = caseData.owner?.email || SUPPORT_EMAIL;
  const studentName = caseData.student?.name || "the student";
  const requestUpdateLink = advisorEmail
    ? createMailtoLink({
        to: advisorEmail,
        cc: ownerEmail ? [ownerEmail] : [],
        subject: `Pastoral check-in: ${studentName}`,
        body: `Hi ${advisorName},%0D%0A%0D%0ACould you share a quick update on ${studentName}? I'm reviewing their case today and want to make sure we have the latest contact.%0D%0A%0D%0AThanks,%0D%0ATricia`
      })
    : null;
  const showRequestUpdate =
    options.allowRequestUpdate !== false && Boolean(requestUpdateLink);
  if (typeof advisorState !== "undefined" && advisorState.casesById) {
    advisorState.casesById[caseData.id] = caseData;
  }

  container.innerHTML = `
    <header class="case-header">
      <div>
        <h3>${caseData.student?.name || "Unknown student"}</h3>
        <p class="case-subtitle">
          ${caseData.student?.course || "Course unknown"} • ${
            caseData.student?.stage || "Stage not set"
          }
        </p>
      </div>
      <div class="case-toolbar">
        ${
          options.forward
            ? `<button class="button" type="button" data-forward-case>${
                options.forward.label || "Forward email to Tricia"
              }</button>`
            : ""
        }
        ${
          showRequestUpdate
            ? `<a class="button outline" href="${requestUpdateLink}">Request advisor update</a>`
            : ""
        }
        ${
          caseData.emailAlias
            ? `<button class="button outline" type="button" data-copy-alias="${caseData.emailAlias}">Copy case alias</button>`
            : ""
        }
      </div>
    </header>
    <div class="case-overview">
      <div>
        <p>${caseData.overview || "No overview available."}</p>
        ${renderReasonChips(caseData.reasons)}
      </div>
      <dl class="case-meta-grid">
        <div>
          <dt>Status</dt>
          <dd>${caseData.status || "Not set"}</dd>
        </div>
        <div>
          <dt>Next action due</dt>
          <dd>${formatDate(caseData.nextActionDue)}</dd>
        </div>
        <div>
          <dt>Follow-up date</dt>
          <dd>${formatDateOnly(caseData.followUpDate)}</dd>
        </div>
        <div>
          <dt>Advisor</dt>
          <dd>${caseData.advisor?.name || "Not assigned"}</dd>
        </div>
        <div>
          <dt>Advisor email</dt>
          <dd>${advisorEmail || "Not provided"}</dd>
        </div>
        <div>
          <dt>Case email alias</dt>
          <dd>${caseData.emailAlias || "Not set"}</dd>
        </div>
      </dl>
    </div>
    <section class="timeline">
      <h3>Timeline</h3>
      ${renderTimeline(caseData.timeline)}
    </section>
    ${
      options.allowNote
        ? `<form class="note-form" data-case-id="${caseData.id}">
            <div class="note-guidance">
              <strong>Tip:</strong> capture the agreed action and when you’ll follow up.
            </div>
            <label>
              Add note
              <textarea rows="4" name="content" placeholder="Record a quick note" required></textarea>
            </label>
            <label>
              Update follow-up date
              <input type="date" name="followUpDate" />
            </label>
            <button class="button" type="submit">Save note</button>
            <div class="notice hidden" data-note-success>Saved.</div>
            <div class="notice error hidden" data-note-error></div>
          </form>`
        : ""
    }
  `;

  const copyAliasButton = container.querySelector("[data-copy-alias]");
  if (copyAliasButton) {
    copyAliasButton.addEventListener("click", async () => {
      const alias = copyAliasButton.dataset.copyAlias;
      const success = await copyToClipboard(alias);
      if (success) {
        const originalText = copyAliasButton.textContent;
        copyAliasButton.textContent = "Alias copied";
        setTimeout(() => {
          copyAliasButton.textContent = originalText;
        }, 2000);
      }
    });
  }

  if (options.forward) {
    const forwardButton = container.querySelector("[data-forward-case]");
    if (forwardButton) {
      forwardButton.addEventListener("click", () => options.forward(caseData));
    }
  }

  if (options.allowNote) {
    const form = container.querySelector(".note-form");
    const successNotice = container.querySelector("[data-note-success]");
    const errorNotice = container.querySelector("[data-note-error]");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      successNotice.classList.add("hidden");
      errorNotice.classList.add("hidden");

      const formData = new FormData(form);
      const payload = {
        authorId: options.authorId,
        content: formData.get("content"),
        followUpDate: formData.get("followUpDate") || null
      };

      try {
        if (!payload.authorId) {
          throw new Error("Author not set for note.");
        }

        await fetchJSON(`/api/cases/${caseId}/notes`, {
          method: "POST",
          body: JSON.stringify(payload)
        });

        form.reset();
        successNotice.classList.remove("hidden");
        await showCaseDetail(elementId, caseId, options);
      } catch (error) {
        errorNotice.textContent = error.message || "Unable to save note.";
        errorNotice.classList.remove("hidden");
      }
    });
  }
}

function renderQueueItem(item) {
  return `
    <h3>${item.studentName || "Unknown student"}</h3>
    ${renderReasonChips(item.reasons)}
    <p>${item.overview || ""}</p>
    <div class="meta">
      <span>Next action: ${formatDate(item.nextActionDue)}</span>
      ${item.advisorName ? `<span>Advisor: ${item.advisorName}</span>` : ""}
    </div>
  `;
}

export async function renderTriciaDashboard() {
  const queueList = document.getElementById("queue-list");
  const intakeList = document.getElementById("intake-list");
  const emailList = document.getElementById("email-list");

  const dashboard = await fetchJSON("/api/dashboards/tricia");

  queueList.innerHTML = "";
  dashboard.queue.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = renderQueueItem(item);
    li.addEventListener("click", async () => {
      activeId = item.id;
      [...queueList.children].forEach((el) => el.classList.remove("active"));
      li.classList.add("active");
      await showCaseDetail("case-detail", item.id, {
        allowNote: true,
        authorId: "tricia"
      });
    });
    queueList.appendChild(li);
  });

  if (dashboard.queue.length) {
    queueList.firstElementChild?.classList.add("active");
    await showCaseDetail("case-detail", dashboard.queue[0].id, {
      allowNote: true,
      authorId: "tricia"
    });
  }

const advisorState = {
  advisorId: null,
  advisorEmail: null,
  queue: [],
  casesById: {},
  activeCaseId: null
};

let triciaFiltersBound = false;

function renderTriciaQueueItem(item) {
  const dueDate = toDate(item.nextActionDue);
  const dueBadge = dueDate
    ? isOverdue(dueDate)
      ? `<span class="pill pill-danger">Overdue</span>`
      : isToday(dueDate)
      ? `<span class="pill pill-warning">Due today</span>`
      : ""
    : "";

  return `
    <div class="queue-item-head">
      <div>
        <h3>${item.studentName || "Unknown student"}</h3>
        <p class="queue-overview">${item.overview || ""}</p>
      </div>
      <div class="queue-due">
        <span>${dueDate ? formatDate(item.nextActionDue) : "Not set"}</span>
        ${dueBadge}
      </div>
    </div>
    ${renderReasonChips(item.reasons)}
    <div class="meta">
      ${item.advisorName ? `<span>Advisor: ${item.advisorName}</span>` : ""}
      ${item.emailAlias ? `<span>Alias: ${item.emailAlias}</span>` : ""}
    </div>
    <div class="queue-actions">
      ${
        item.advisorEmail
          ? `<button type="button" class="button small outline" data-action="email-advisor">Email advisor</button>`
          : ""
      }
      ${
        item.emailAlias
          ? `<button type="button" class="button small outline" data-action="copy-alias">Copy alias</button>`
          : ""
      }
      <button type="button" class="button small" data-action="close-case">Mark complete</button>
    </div>
  `;
}

function highlightTriciaActiveCase() {
  const queueList = document.getElementById("queue-list");
  if (!queueList) return;
  [...queueList.children].forEach((li) => {
    li.classList.toggle("active", li.dataset.caseId === triciaState.activeCaseId);
  });
}

async function selectTriciaCase(caseId) {
  triciaState.activeCaseId = caseId;
  highlightTriciaActiveCase();
  await showCaseDetail("case-detail", caseId, {
    allowNote: true,
    authorId: "tricia"
  });
  highlightTriciaActiveCase();
}

async function handleTriciaAction(action, item, trigger) {
  if (action === "email-advisor" && item.advisorEmail) {
    const mailto = createMailtoLink({
      to: item.advisorEmail,
      cc: item.ownerEmail ? [item.ownerEmail] : [SUPPORT_EMAIL],
      subject: `Student update: ${item.studentName || "advisee"}`,
      body: `Hi ${item.advisorName || ""},\n\nCould you share a quick update on ${
        item.studentName || "this student"
      }?\n\nThanks,\nTricia`
    });
    window.open(mailto, "_blank");
    return;
  }

  if (action === "copy-alias" && item.emailAlias) {
    const success = await copyToClipboard(item.emailAlias);
    if (success && trigger) {
      const original = trigger.textContent;
      trigger.textContent = "Copied!";
      setTimeout(() => {
        trigger.textContent = original;
      }, 2000);
    }
    return;
  }

  if (action === "close-case") {
    const confirmed = window.confirm(
      "Mark this case complete? It will drop out of the action queue."
    );
    if (!confirmed) return;
    await fetchJSON(`/api/cases/${item.id}/close`, { method: "POST" });
    await renderTriciaDashboard();
  }
}

async function renderTriciaQueue() {
  const queueList = document.getElementById("queue-list");
  if (!queueList) return;

  const filtered = applyQueueFilter(triciaState.queue, triciaState.filter);
  queueList.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.innerHTML = "<p>No cases match this view.</p>";
    queueList.appendChild(empty);
    triciaState.activeCaseId = null;

    const detail = document.getElementById("case-detail");
    if (detail) {
      detail.classList.add("empty");
      detail.innerHTML = "<p>Select another filter or wait for new work.</p>";
    }
    return;
  }

  filtered.forEach((item) => {
    const li = document.createElement("li");
    li.dataset.caseId = item.id;
    li.innerHTML = renderTriciaQueueItem(item);
    li.addEventListener("click", () => {
      if (triciaState.activeCaseId !== item.id) {
        selectTriciaCase(item.id).catch(() => {});
      }
    });
    li.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        handleTriciaAction(button.dataset.action, item, button).catch(() => {});
      });
    });
    queueList.appendChild(li);
  });

  const hasActive = filtered.some((item) => item.id === triciaState.activeCaseId);
  const targetId = hasActive
    ? triciaState.activeCaseId
    : filtered.length
    ? filtered[0].id
    : null;

  if (targetId) {
    if (triciaState.activeCaseId !== targetId) {
      triciaState.activeCaseId = targetId;
      await selectTriciaCase(targetId);
    } else {
      highlightTriciaActiveCase();
    }
  }
}

function updateTriciaSummary() {
  const open = triciaState.queue.length;
  const dueToday = triciaState.queue.filter((item) => isToday(toDate(item.nextActionDue))).length;
  const overdue = triciaState.queue.filter((item) => isOverdue(toDate(item.nextActionDue))).length;

  const openEl = document.querySelector("[data-tricia-open]");
  const todayEl = document.querySelector("[data-tricia-today]");
  const overdueEl = document.querySelector("[data-tricia-overdue]");

  if (openEl) openEl.textContent = open;
  if (todayEl) todayEl.textContent = dueToday;
  if (overdueEl) overdueEl.textContent = overdue;
}

function renderTriciaIntakeList() {
  const intakeList = document.getElementById("intake-list");
  if (!intakeList) return;

  intakeList.innerHTML = "";
  if (!triciaState.intake.length) {
    intakeList.innerHTML = `<li class="empty-state"><p>No new lecturer submissions.</p></li>`;
    return;
  }

  triciaState.intake.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <h3>${item.studentEmail}</h3>
      <p>${item.summary}</p>
      <div class="meta">
        <span>Lecturer: ${item.lecturerName || "Not provided"}</span>
        <span>Submitted: ${formatDate(item.submittedAt)}</span>
        <span>Status: ${item.status}</span>
      </div>
    `;
    intakeList.appendChild(li);
  });
}

function renderTriciaEmailList() {
  const emailList = document.getElementById("email-list");
  if (!emailList) return;

  emailList.innerHTML = "";
  if (!triciaState.unmatchedEmails.length) {
    emailList.innerHTML = `<li class="empty-state"><p>All forwarded emails are linked. Nothing waiting.</p></li>`;
    return;
  }

  triciaState.unmatchedEmails.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <h3>${item.subject}</h3>
      <p>${item.preview}</p>
      <div class="meta">
        <span>From: ${item.from}</span>
        <span>Received: ${formatDate(item.timestamp)}</span>
      </div>
    `;
    emailList.appendChild(li);
  });
}

export async function renderTriciaDashboard() {
  const dashboard = await fetchJSON("/api/dashboards/tricia");
  const previousActive = triciaState.activeCaseId;

  triciaState.queue = dashboard.queue || [];
  triciaState.intake = dashboard.intakeQueue || [];
  triciaState.unmatchedEmails = dashboard.unmatchedEmails || [];

  if (!triciaState.queue.some((item) => item.id === previousActive)) {
    triciaState.activeCaseId = null;
  }

  if (!triciaFiltersBound) {
    const buttons = document.querySelectorAll("[data-queue-filter]");
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        buttons.forEach((btn) => btn.classList.remove("is-active"));
        button.classList.add("is-active");
        triciaState.filter = button.dataset.queueFilter || "all";
        renderTriciaQueue().catch(() => {});
      });
    });
    triciaFiltersBound = true;
  }

  updateTriciaSummary();
  renderTriciaIntakeList();
  renderTriciaEmailList();
  await renderTriciaQueue();
}

function renderAdvisorQueueItem(item) {
  const dueDate = toDate(item.nextActionDue);
  const dueBadge = dueDate
    ? isOverdue(dueDate)
      ? `<span class="pill pill-danger">Overdue</span>`
      : isToday(dueDate)
      ? `<span class="pill pill-warning">Due today</span>`
      : ""
    : "";

  return `
    <div class="queue-item-head">
      <div>
        <h3>${item.studentName || "Unknown student"}</h3>
        <p class="queue-overview">${item.overview || ""}</p>
      </div>
      <div class="queue-due">
        <span>${dueDate ? formatDate(item.nextActionDue) : "Not set"}</span>
        ${dueBadge}
      </div>
    </div>
    ${renderReasonChips(item.reasons)}
    <div class="queue-actions">
      <button type="button" class="button small" data-action="forward-case">Forward to Tricia</button>
    </div>
  `;
}

function highlightAdvisorActiveCase() {
  const queueList = document.getElementById("advisor-queue-list");
  if (!queueList) return;
  [...queueList.children].forEach((li) => {
    li.classList.toggle("active", li.dataset.caseId === advisorState.activeCaseId);
  });
}

function ensureForwardModal() {
  if (forwardModal.element) return;
  const element = document.getElementById("forward-modal");
  if (!element) return;

  forwardModal.element = element;
  forwardModal.composeButton = element.querySelector("[data-compose-email]");
  forwardModal.copyButton = element.querySelector("[data-copy-template]");
  forwardModal.feedback = element.querySelector("[data-modal-feedback]");
  forwardModal.subjectEl = element.querySelector("[data-template-subject]");
  forwardModal.bodyEl = element.querySelector("[data-template-body]");
  forwardModal.fileInput = element.querySelector("input[type='file']");

  element.querySelectorAll("[data-close-modal]").forEach((btn) =>
    btn.addEventListener("click", closeForwardModal)
  );
  element.addEventListener("click", (event) => {
    if (event.target === element) {
      closeForwardModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !element.classList.contains("hidden")) {
      closeForwardModal();
    }
  });
  if (forwardModal.fileInput) {
    forwardModal.fileInput.addEventListener("change", () => {
      if (!forwardModal.feedback) return;
      if (forwardModal.fileInput.files.length) {
        forwardModal.feedback.textContent = `${forwardModal.fileInput.files.length} file(s) ready to send.`;
        forwardModal.feedback.classList.remove("hidden");
        forwardModal.feedback.classList.remove("error");
      } else {
        forwardModal.feedback.classList.add("hidden");
        forwardModal.feedback.textContent = "";
      }
    });
  }
}

const forwardModal = {
  element: null,
  composeButton: null,
  copyButton: null,
  feedback: null,
  subjectEl: null,
  bodyEl: null,
  fileInput: null
};

function closeForwardModal() {
  if (!forwardModal.element) return;
  forwardModal.element.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function openForwardModal(caseRef) {
  ensureForwardModal();
  if (!forwardModal.element) return;

  const caseData =
    caseRef && typeof caseRef === "object"
      ? caseRef
      : advisorState.casesById[caseRef];
  if (!caseData) return;

  const subject = `Forwarded email: ${caseData.student?.name || caseData.id}`;
  const bodyText = `Hi Tricia,\n\nForwarding the latest email thread for ${
    caseData.student?.name || "this student"
  }.\n\nHighlights:\n- Include why you’re forwarding the message\n- Note any action you’re taking next\n\nThanks,\n${
    caseData.advisor?.name || "Advisor"
  }`;

  if (forwardModal.subjectEl) forwardModal.subjectEl.textContent = subject;
  if (forwardModal.bodyEl) {
    forwardModal.bodyEl.textContent = `${bodyText}\n\nCase alias: ${
      caseData.emailAlias || "Not set"
    }`;
  }
  if (forwardModal.feedback) {
    forwardModal.feedback.classList.add("hidden");
    forwardModal.feedback.classList.remove("error");
    forwardModal.feedback.textContent = "";
  }
  if (forwardModal.fileInput) {
    forwardModal.fileInput.value = "";
  }

  const triciaEmail = caseData.owner?.email || SUPPORT_EMAIL;
  const advisorEmail = caseData.advisor?.email || advisorState.advisorEmail;

  if (forwardModal.composeButton) {
    forwardModal.composeButton.onclick = () => {
      const mailto = createMailtoLink({
        to: triciaEmail,
        cc: advisorEmail ? [advisorEmail] : [],
        subject,
        body: `${bodyText}\n\nCase alias: ${caseData.emailAlias || "Not set"}`
      });
      window.open(mailto, "_blank");
    };
  }

  if (forwardModal.copyButton) {
    forwardModal.copyButton.onclick = async () => {
      const template = `Subject: ${subject}\n\n${bodyText}\n\nCase alias: ${
        caseData.emailAlias || "Not set"
      }`;
      const success = await copyToClipboard(template);
      if (forwardModal.feedback) {
        forwardModal.feedback.textContent = success
          ? "Template copied to clipboard."
          : "Copy failed — select the text above if needed.";
        forwardModal.feedback.classList.toggle("error", !success);
        forwardModal.feedback.classList.remove("hidden");
      }
    };
  }

  forwardModal.element.classList.remove("hidden");
  forwardModal.element.setAttribute("tabindex", "-1");
  forwardModal.element.focus();
  document.body.classList.add("modal-open");
}

async function selectAdvisorCase(caseId) {
  advisorState.activeCaseId = caseId;
  highlightAdvisorActiveCase();
  await showCaseDetail("advisor-case-detail", caseId, {
    allowNote: true,
    authorId: advisorState.advisorId,
    allowRequestUpdate: false,
    forward: {
      label: "Forward email to Tricia",
      handler: (caseData) => openForwardModal(caseData)
    }
  });
  highlightAdvisorActiveCase();
}

function updateAdvisorSummary() {
  const casesEl = document.querySelector("[data-advisor-cases]");
  const todayEl = document.querySelector("[data-advisor-today]");
  const unansweredEl = document.querySelector("[data-advisor-unanswered]");

  if (casesEl) casesEl.textContent = advisorState.queue.length;
  if (todayEl) {
    const dueToday = advisorState.queue.filter((item) => isToday(toDate(item.nextActionDue)))
      .length;
    todayEl.textContent = dueToday;
  }
  if (unansweredEl) {
    const unanswered = advisorState.queue.filter((item) =>
      (item.reasons || []).includes("unanswered_message")
    ).length;
    unansweredEl.textContent = unanswered;
  }
}

async function renderAdvisorQueue() {
  const queueList = document.getElementById("advisor-queue-list");
  if (!queueList) return;

  queueList.innerHTML = "";
  if (!advisorState.queue.length) {
    queueList.innerHTML =
      '<li class="empty-state"><p>No cases assigned. Enjoy the quiet while it lasts.</p></li>';
    advisorState.activeCaseId = null;
    const detail = document.getElementById("advisor-case-detail");
    if (detail) {
      detail.classList.add("empty");
      detail.innerHTML = "<p>You’re all clear. Forward new emails as they arrive.</p>";
    }
    return;
  }

  advisorState.queue.forEach((item) => {
    const li = document.createElement("li");
    li.dataset.caseId = item.id;
    li.innerHTML = renderAdvisorQueueItem(item);
    li.addEventListener("click", () => {
      if (advisorState.activeCaseId !== item.id) {
        selectAdvisorCase(item.id).catch(() => {});
      }
    });
    li.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (button.dataset.action === "forward-case") {
          openForwardModal(advisorState.casesById[item.id] || item);
        }
      });
    });
    queueList.appendChild(li);
  });

  const hasActive = advisorState.queue.some(
    (item) => item.id === advisorState.activeCaseId
  );
  const targetId = hasActive
    ? advisorState.activeCaseId
    : advisorState.queue.length
    ? advisorState.queue[0].id
    : null;

  if (targetId) {
    if (advisorState.activeCaseId !== targetId) {
      advisorState.activeCaseId = targetId;
      await selectAdvisorCase(targetId);
    } else {
      highlightAdvisorActiveCase();
    }
  }
}

export async function renderAdvisorDashboard() {
  const params = new URLSearchParams(window.location.search);
  const advisorId = params.get("advisorId") || "adv-lee";
  const dashboard = await fetchJSON(`/api/dashboards/advisor/${advisorId}`);

  advisorState.advisorId = advisorId;
  advisorState.queue = dashboard.queue || [];
  advisorState.casesById = Object.fromEntries(
    (dashboard.cases || []).map((caseItem) => [caseItem.id, caseItem])
  );
  advisorState.advisorEmail = null;

  const heading = document.getElementById("advisor-heading");
  const firstAdvisor = (dashboard.cases || []).find((caseItem) => caseItem.advisor?.name);
  if (heading && firstAdvisor) {
    heading.textContent = `${firstAdvisor.advisor.name} — My Advisees`;
    advisorState.advisorEmail = firstAdvisor.advisor.email || advisorState.advisorEmail;
  }

  updateAdvisorSummary();
  ensureForwardModal();
  await renderAdvisorQueue();
}

export function renderIntakeForm() {
  const form = document.getElementById("intake-form");
  const success = document.getElementById("intake-success");
  const progressLabel = form.querySelector("[data-progress-label]");
  const steps = [...form.querySelectorAll(".form-step")];
  let currentStep = 0;

  const labels = [
    "Step 1 of 2 • Lecturer details",
    "Step 2 of 2 • Concern summary"
  ];

  function setStep(index) {
    steps.forEach((step, idx) => {
      step.classList.toggle("is-active", idx === index);
    });
    currentStep = index;
    if (progressLabel) {
      progressLabel.textContent = labels[index] || labels[0];
    }
  }

  const nextButton = form.querySelector("[data-next-step]");
  const prevButton = form.querySelector("[data-prev-step]");

  nextButton?.addEventListener("click", () => {
    const requiredInputs = steps[currentStep].querySelectorAll("input[required]");
    for (const input of requiredInputs) {
      if (!input.reportValidity()) {
        return;
      }
    }
    setStep(1);
  });

  prevButton?.addEventListener("click", () => setStep(0));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    success.classList.add("hidden");

    const formData = new FormData(form);
    const payload = {
      lecturerName: formData.get("lecturerName"),
      studentEmail: formData.get("studentEmail"),
      summary: formData.get("summary")
    };
    const sendCopy = formData.get("copyTricia") === "on";

    try {
      await fetchJSON("/api/intake", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      form.reset();
      setStep(0);
      success.classList.remove("hidden");
      success.scrollIntoView({ behavior: "smooth", block: "center" });

      if (sendCopy) {
        const mailto = createMailtoLink({
          to: SUPPORT_EMAIL,
          subject: `Lecturer concern: ${payload.studentEmail || "student"}`,
          body: `Hi Tricia,\n\nI'm raising a concern about ${
            payload.studentEmail || "a student"
          }.\n\nSummary:\n${payload.summary}\n\nThanks,\n${payload.lecturerName || ""}`
        });
        window.open(mailto, "_blank");
      }
    } catch (error) {
      alert(`Unable to submit intake: ${error.message}`);
    }
  });

  setStep(0);
}
