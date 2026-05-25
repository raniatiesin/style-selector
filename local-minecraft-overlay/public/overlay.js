const formatMillis = (ms) => {
  const totalMs = Number(ms || 0);
  if (!totalMs) return '--:--';
  const totalSeconds = Math.floor(totalMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
};

async function refresh() {
  try {
    const res = await fetch('/stats', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();

    setText('totalRuns', data?.totals?.totalRuns ?? 0);
    setText('completedRuns', data?.totals?.completedRuns ?? 0);
    setText('avgIgt', formatMillis(data?.averages?.avgFinalIgtCompleted));
    setText('bestIgt', formatMillis(data?.bests?.bestFinalIgt));
    setText('avgNether', formatMillis(data?.averages?.avgEnterNetherIgt));
    setText('avgEnd', formatMillis(data?.averages?.avgEnterEndIgt));
  } catch (error) {
    // Silent for overlays
  }
}

refresh();
setInterval(refresh, 2000);
