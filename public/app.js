const reasonLabels = {
  missed_submission: "Missed submission",
  unanswered_message: "Awaiting reply",
  ec_deadline: "EC evidence due",
  no_activity_14d: "No activity (14d)"
};

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

  container.innerHTML = `
    <div class="panel">
      <header>
        <h3>${caseData.student?.name || "Unknown student"}</h3>
        <div class="meta">
          <span>Course: ${caseData.student?.course || "–"}</span>
          <span>Stage: ${caseData.student?.stage || "–"}</span>
          <span>Status: ${caseData.status || "–"}</span>
        </div>
        <p>${caseData.overview || "No overview available."}</p>
        ${renderReasonChips(caseData.reasons)}
        <div class="meta">
          <span>Next action due: ${formatDate(caseData.nextActionDue)}</span>
          <span>Follow-up date: ${formatDateOnly(caseData.followUpDate)}</span>
          <span>Email alias: ${caseData.emailAlias || "Not set"}</span>
        </div>
      </header>

      <section class="timeline">${renderTimeline(caseData.timeline)}</section>

      ${
        options.allowNote
          ? `<form class="note-form" data-case-id="${caseData.id}">
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
    </div>
  `;

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

  intakeList.innerHTML = "";
  (dashboard.intakeQueue || []).forEach((item) => {
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

  emailList.innerHTML = "";
  (dashboard.unmatchedEmails || []).forEach((item) => {
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

export async function renderAdvisorDashboard() {
  const params = new URLSearchParams(window.location.search);
  const advisorId = params.get("advisorId") || "adv-lee";
  const queueList = document.getElementById("advisor-queue-list");
  const heading = document.getElementById("advisor-heading");

  const dashboard = await fetchJSON(`/api/dashboards/advisor/${advisorId}`);

  const firstCaseAdvisor = dashboard.cases.find(
    (caseItem) => caseItem.advisor?.name
  )?.advisor?.name;
  if (firstCaseAdvisor) {
    heading.textContent = `${firstCaseAdvisor} — My Advisees`;
  }

  queueList.innerHTML = "";
  dashboard.queue.forEach((item, index) => {
    const li = document.createElement("li");
    li.innerHTML = renderQueueItem(item);
    li.addEventListener("click", async () => {
      [...queueList.children].forEach((el) => el.classList.remove("active"));
      li.classList.add("active");
      await showCaseDetail("advisor-case-detail", item.id, {
        allowNote: true,
        authorId: advisorId
      });
    });
    queueList.appendChild(li);

    if (index === 0) {
      li.classList.add("active");
      showCaseDetail("advisor-case-detail", item.id, {
        allowNote: true,
        authorId: advisorId
      });
    }
  });

  if (!dashboard.queue.length) {
    queueList.innerHTML =
      "<li>No cases assigned. Enjoy the quiet while it lasts.</li>";
  }
}

export function renderIntakeForm() {
  const form = document.getElementById("intake-form");
  const success = document.getElementById("intake-success");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    success.classList.add("hidden");

    const formData = new FormData(form);
    const payload = {
      lecturerName: formData.get("lecturerName"),
      studentEmail: formData.get("studentEmail"),
      summary: formData.get("summary")
    };

    try {
      await fetchJSON("/api/intake", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      form.reset();
      success.classList.remove("hidden");
    } catch (error) {
      alert(`Unable to submit intake: ${error.message}`);
    }
  });
}
