const STREAM_TABLE_CANDIDATES = ['GrossGauntlet', 'stream_metrics'];

function isMissingRelationError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');

  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /could not find the table|relation .* does not exist|table .* does not exist|not found/i.test(message)
  );
}

export async function resolveStreamTable(supabase) {
  let lastError = null;

  for (const tableName of STREAM_TABLE_CANDIDATES) {
    const { error } = await supabase
      .from(tableName)
      .select('date', { head: true, count: 'exact' })
      .limit(1);

    if (!error) {
      return tableName;
    }

    lastError = error;

    if (!isMissingRelationError(error)) {
      throw error;
    }
  }

  throw lastError || new Error('Could not resolve stream metrics table.');
}
