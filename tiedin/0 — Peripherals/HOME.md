---
cssclasses: ["unms-dashboard"]
---

# Workspace

```datacorejsx
const { ProspectKPIs } = await dc.require(dc.headerLink("0 — Peripherals/4 — Views/ProspectKPIs.md", "ProspectKPIs"));
const { TaskMatrix } = await dc.require(dc.headerLink("0 — Peripherals/4 — Views/TaskMatrix.md", "TaskMatrix"));
const { TaskKanban } = await dc.require(dc.headerLink("0 — Peripherals/4 — Views/TaskKanban.md", "TaskKanban"));
const { PipelineTable } = await dc.require(dc.headerLink("0 — Peripherals/4 — Views/PipelineTable.md", "PipelineTable"));
const { PlaybookNotesFeed } = await dc.require(dc.headerLink("0 — Peripherals/4 — Views/PlaybookNotesFeed.md", "PlaybookNotesFeed"));

return function HomeDashboard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px", padding: "10px 0" }}>
      
      {/* KPI Block */}
      <section>
        <ProspectKPIs />
      </section>

      {/* Operations Grid: Matrix & Pipeline */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div>
          <h3 style={{ fontSize: "14px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Priority Matrix</h3>
          <TaskMatrix />
        </div>
        <div>
          <h3 style={{ fontSize: "14px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Active Pipeline (Limit: 5)</h3>
          <PipelineTable status="Qualified" limit={5} />
        </div>
      </section>

      {/* Task Kanban */}
      <section>
        <h3 style={{ fontSize: "14px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Task Board</h3>
        <TaskKanban />
      </section>

      {/* Playbook Feed */}
      <section>
        <h3 style={{ fontSize: "14px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Recent Insights</h3>
        <PlaybookNotesFeed limit={3} />
      </section>

    </div>
  );
};
```
