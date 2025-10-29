const express = require("express");
const path = require("path");
const { nanoid } = require("nanoid");
const { load, save } = require("./data/store");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

function sortByNextAction(a, b) {
  return new Date(a.nextActionDue) - new Date(b.nextActionDue);
}

function decorateCase(caseRecord, data) {
  const student = data.students.find((s) => s.id === caseRecord.studentId);
  const advisor = data.users.find((u) => u.id === caseRecord.advisorId);
  const owner = data.users.find((u) => u.id === caseRecord.ownerId);
  const timeline = [...(caseRecord.timeline || [])]
    .map((entry) => {
      const author = data.users.find((u) => u.id === entry.authorId);
      return {
        ...entry,
        authorName: author ? author.name : entry.authorId
      };
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return {
    id: caseRecord.id,
    status: caseRecord.status,
    nextActionDue: caseRecord.nextActionDue,
    followUpDate: caseRecord.followUpDate,
    reasons: caseRecord.reasons || [],
    overview: caseRecord.overview || "",
    emailAlias: caseRecord.emailAlias,
    student: student
      ? {
          id: student.id,
          name: student.name,
          course: student.course,
          stage: student.stage,
          email: student.email
        }
      : null,
    advisor: advisor
      ? {
          id: advisor.id,
          name: advisor.name,
          role: advisor.role,
          email: advisor.email
        }
      : null,
    owner: owner
      ? {
          id: owner.id,
          name: owner.name,
          role: owner.role,
          email: owner.email
        }
      : null,
    timeline
  };
}

function getData() {
  return load();
}

function persistData(data) {
  save(data);
}

app.get("/api/dashboards/tricia", (req, res) => {
  const data = getData();
  const cases = data.cases.map((c) => decorateCase(c, data)).sort(sortByNextAction);
  const queue = cases.map((c) => ({
    id: c.id,
    studentName: c.student?.name,
    nextActionDue: c.nextActionDue,
    reasons: c.reasons,
    overview: c.overview,
    advisorName: c.advisor?.name,
    advisorEmail: c.advisor?.email,
    ownerEmail: c.owner?.email,
    emailAlias: c.emailAlias
  }));

  res.json({
    queue,
    cases,
    intakeQueue: data.intakeQueue || [],
    unmatchedEmails: (data.emailInbox || []).filter(
      (item) => item.status === "unmatched"
    )
  });
});

app.get("/api/dashboards/advisor/:advisorId", (req, res) => {
  const { advisorId } = req.params;
  const data = getData();
  const cases = data.cases
    .filter((c) => c.advisorId === advisorId)
    .map((c) => decorateCase(c, data))
    .sort(sortByNextAction);

  res.json({
    advisorId,
    cases,
    queue: cases.map((c) => ({
      id: c.id,
      studentName: c.student?.name,
      nextActionDue: c.nextActionDue,
      reasons: c.reasons,
      overview: c.overview,
      ownerEmail: c.owner?.email,
      advisorEmail: c.advisor?.email,
      emailAlias: c.emailAlias
    }))
  });
});

app.get("/api/cases/:caseId", (req, res) => {
  const data = getData();
  const caseRecord = data.cases.find((c) => c.id === req.params.caseId);

  if (!caseRecord) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  res.json(decorateCase(caseRecord, data));
});

app.post("/api/cases/:caseId/notes", (req, res) => {
  const { content, authorId, followUpDate } = req.body || {};
  if (!content || !authorId) {
    res.status(400).json({ error: "content and authorId are required" });
    return;
  }

  const data = getData();
  const caseRecord = data.cases.find((c) => c.id === req.params.caseId);
  if (!caseRecord) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  const newNote = {
    id: `tl-${nanoid(6)}`,
    type: "note",
    timestamp: new Date().toISOString(),
    authorId,
    summary: content
  };

  caseRecord.timeline = [newNote, ...(caseRecord.timeline || [])];
  if (followUpDate) {
    caseRecord.followUpDate = followUpDate;
    caseRecord.nextActionDue = followUpDate;
  }

  persistData(data);
  res.status(201).json(decorateCase(caseRecord, data));
});

app.post("/api/cases/:caseId/close", (req, res) => {
  const data = getData();
  const caseRecord = data.cases.find((c) => c.id === req.params.caseId);
  if (!caseRecord) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  caseRecord.status = "closed";
  caseRecord.followUpDate = null;
  caseRecord.nextActionDue = null;
  persistData(data);

  res.json(decorateCase(caseRecord, data));
});

app.post("/api/intake", (req, res) => {
  const { studentEmail, lecturerName, summary } = req.body || {};
  if (!studentEmail || !summary) {
    res.status(400).json({ error: "studentEmail and summary are required" });
    return;
  }

  const data = getData();
  const record = {
    id: `intake-${nanoid(6)}`,
    studentEmail,
    lecturerName: lecturerName || "Unknown lecturer",
    summary,
    submittedAt: new Date().toISOString(),
    status: "new"
  };

  data.intakeQueue = [record, ...(data.intakeQueue || [])];
  persistData(data);

  res.status(201).json(record);
});

app.get("/api/email/inbox", (req, res) => {
  const data = getData();
  res.json(data.emailInbox || []);
});

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Pastoral Care Dashboard MVP running on http://localhost:${PORT}`);
});
