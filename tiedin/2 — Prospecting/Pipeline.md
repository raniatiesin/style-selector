# Active Pipeline

```datacorejsx
const { ProspectKPIs } = await dc.require(dc.headerLink("0 — Peripherals/4 — Views/ProspectKPIs.md", "ProspectKPIs"));
const { PipelineTable } = await dc.require(dc.headerLink("0 — Peripherals/4 — Views/PipelineTable.md", "PipelineTable"));

return function ProspectingDashboard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingTop: "12px" }}>
      
      {/* KPI Block */}
      <section>
        <ProspectKPIs />
      </section>

      {/* Main CRM Tools */}
      <section style={{ display: "flex", gap: "12px" }}>
        <button style={{ padding: "6px 12px", background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: "4px", fontSize: "12px" }}>
          🔄 Refresh (GET prospects_inbox)
        </button>
        <button style={{ padding: "6px 12px", background: "#111", color: "#fff", border: "1px solid #111", borderRadius: "4px", fontSize: "12px" }}>
          ↳ Merge Inbox to Master
        </button>
        <button style={{ padding: "6px 12px", background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: "4px", fontSize: "12px" }}>
          ☁️ Sync to n8n (POST)
        </button>
      </section>

      {/* Pipeline Table */}
      <section>
        <PipelineTable limit={50} />
      </section>

    </div>
  );
};
```
