#!/usr/bin/env node

const { spawnSync } = require('child_process');

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    shell: false,
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    const details = stderr || stdout || `${cmd} ${args.join(' ')} failed`;
    throw new Error(details);
  }

  return (result.stdout || '').trim();
}

function runAllowFailure(cmd, args) {
  return spawnSync(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    shell: false,
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getEnv(name, required = true) {
  const value = process.env[name];
  if (!value && required) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildDeploymentsUrl(projectId, teamId) {
  const url = new URL('https://api.vercel.com/v6/deployments');
  url.searchParams.set('projectId', projectId);
  url.searchParams.set('limit', '30');
  if (teamId) url.searchParams.set('teamId', teamId);
  return url.toString();
}

function getReadyState(deployment) {
  return deployment?.readyState || deployment?.state || 'UNKNOWN';
}

function getDisplayUrl(deployment) {
  if (!deployment) return '';
  if (Array.isArray(deployment.alias) && deployment.alias.length > 0) {
    return `https://${deployment.alias[0]}`;
  }
  if (deployment.url) {
    return `https://${deployment.url}`;
  }
  return '';
}

function pickDeploymentByCommit(deployments, commitSha) {
  return deployments.find(dep => dep?.meta?.githubCommitSha === commitSha);
}

async function fetchDeployments(apiUrl, token) {
  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.deployments || [];
}

async function main() {
  const token = getEnv('VERCEL_TOKEN');
  const projectId = getEnv('VERCEL_PROJECT_ID');
  const teamId = getEnv('VERCEL_TEAM_ID', false);

  const pollMs = Number(process.env.VERCEL_POLL_MS || 5000);
  const timeoutMs = Number(process.env.VERCEL_TIMEOUT_MS || 600000);

  const commitMessage = process.argv.slice(2).join(' ').trim() || `chore: deploy ${new Date().toISOString()}`;

  console.log('\n[1/5] Checking git repository...');
  const inRepo = run('git', ['rev-parse', '--is-inside-work-tree'], { capture: true });
  if (inRepo !== 'true') {
    throw new Error('Current directory is not a git repository.');
  }

  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true });
  console.log(`- Branch: ${branch}`);

  console.log('\n[2/5] Staging and committing changes (if any)...');
  run('git', ['add', '-A']);

  const stagedCheck = runAllowFailure('git', ['diff', '--cached', '--quiet']);
  const hasStagedChanges = stagedCheck.status !== 0;

  if (hasStagedChanges) {
    run('git', ['commit', '-m', commitMessage]);
    console.log(`- Commit created: ${commitMessage}`);
  } else {
    console.log('- No staged changes to commit.');
  }

  const commitSha = run('git', ['rev-parse', 'HEAD'], { capture: true });
  console.log(`- HEAD: ${commitSha}`);

  console.log('\n[3/5] Pushing to GitHub...');
  run('git', ['push', 'origin', branch]);
  console.log('- Push complete.');

  console.log('\n[4/5] Polling Vercel for deployment status...');
  const apiUrl = buildDeploymentsUrl(projectId, teamId);
  const startedAt = Date.now();

  let deployment = null;
  let lastState = '';

  while (Date.now() - startedAt < timeoutMs) {
    const deployments = await fetchDeployments(apiUrl, token);
    deployment = pickDeploymentByCommit(deployments, commitSha);

    if (!deployment) {
      console.log(`- Waiting for deployment linked to commit ${commitSha.slice(0, 8)}...`);
      await sleep(pollMs);
      continue;
    }

    const state = getReadyState(deployment);
    if (state !== lastState) {
      console.log(`- Vercel state: ${state}`);
      lastState = state;
    }

    if (state === 'READY') {
      break;
    }

    if (state === 'ERROR' || state === 'CANCELED') {
      break;
    }

    await sleep(pollMs);
  }

  console.log('\n[5/5] Result');

  if (!deployment) {
    console.log('VERCEL_UPDATED=unknown');
    console.log(`- No deployment found for commit ${commitSha}.`);
    console.log('- This usually means Git integration is not connected for this repo/project, or deployment is still queued beyond timeout.');
    process.exit(2);
  }

  const finalState = getReadyState(deployment);
  const deploymentUrl = getDisplayUrl(deployment);

  console.log(`- Commit: ${commitSha}`);
  console.log(`- State: ${finalState}`);
  if (deploymentUrl) console.log(`- URL: ${deploymentUrl}`);

  if (finalState === 'READY') {
    console.log('VERCEL_UPDATED=yes');
    process.exit(0);
  }

  console.log('VERCEL_UPDATED=no');
  process.exit(1);
}

main().catch(err => {
  console.error('\nScript failed:');
  console.error(err.message || err);
  process.exit(1);
});
