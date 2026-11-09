import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assert-stack.mjs');

const git = (cwd, ...args) => {
    const r = spawnSync('git', args, {cwd, encoding: 'utf8'});
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
};

const commitFile = (cwd, file, content, message) => {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), {recursive: true});
    fs.writeFileSync(path.join(cwd, file), content);
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-q', '-m', message);
};

const assertStack = (cwd, ...args) => spawnSync(process.execPath, [script, ...args], {cwd, encoding: 'utf8'});

// A repo with a tagged upstream commit and a two-commit stack, declared by
// --write and committed as the STACK.json-only tip. Returns the repo dir.
const makeRepo = () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'assert-stack-'));
    git(cwd, 'init', '-q', '-b', 'main');
    git(cwd, 'config', 'user.email', 't@example.com');
    git(cwd, 'config', 'user.name', 'T');
    git(cwd, 'config', 'commit.gpgsign', 'false');
    git(cwd, 'config', 'tag.gpgsign', 'false');
    commitFile(cwd, 'base.txt', 'one\ntwo\nthree\n', 'upstream');
    git(cwd, 'tag', 'v1.0.0');
    git(cwd, 'checkout', '-q', '-b', 'ftrprf/v1.0.0');
    commitFile(cwd, 'a.txt', 'alpha\n', 'feat(ftrprf): a');
    commitFile(cwd, 'src/b.txt', 'beta\n', 'fix(ftrprf): b');
    const w = assertStack(cwd, '--write', '--tag', 'v1.0.0');
    assert.equal(w.status, 0, w.stderr);
    commitFile(cwd, 'ftrprf/STACK.json', fs.readFileSync(path.join(cwd, 'ftrprf/STACK.json'), 'utf8'),
        'chore(ftrprf): update STACK.json');
    return cwd;
};

const withRepo = fn => {
    const cwd = makeRepo();
    try {
        return fn(cwd);
    } finally {
        fs.rmSync(cwd, {recursive: true, force: true});
    }
};

const rejects = (r, reason) => {
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, reason);
};

// Rewrites STACK.json in a new tip commit, replacing the previous one.
const restamp = (cwd, mutate) => {
    const file = path.join(cwd, 'ftrprf/STACK.json');
    const stack = JSON.parse(fs.readFileSync(file, 'utf8'));
    mutate(stack);
    fs.writeFileSync(file, JSON.stringify(stack, null, 4));
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-q', '--amend', '--no-edit');
};

const makeTarball = (cwd, pkg) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assert-stack-tgz-'));
    fs.mkdirSync(path.join(dir, 'package'));
    fs.writeFileSync(path.join(dir, 'package/package.json'), JSON.stringify(pkg));
    const file = path.join(dir, 'pkg.tgz');
    const r = spawnSync('tar', ['-czf', file, '-C', dir, 'package']);
    assert.equal(r.status, 0);
    return file;
};

test('passes on the declared stack', () => withRepo(cwd => {
    const r = assertStack(cwd);
    assert.equal(r.status, 0, r.stderr);
}));

test('fails closed when STACK.json is not committed at HEAD', () => withRepo(cwd => {
    git(cwd, 'reset', '-q', '--hard', 'HEAD~1');
    rejects(assertStack(cwd), /not committed at HEAD/);
}));

test('fails on an extra commit', () => withRepo(cwd => {
    commitFile(cwd, 'evil.js', 'x\n', 'feat(ftrprf): sneaky');
    rejects(assertStack(cwd), /may appear once, as the tip/);
}));

test('fails on an extra commit before the STACK.json commit', () => withRepo(cwd => {
    const stackJson = fs.readFileSync(path.join(cwd, 'ftrprf/STACK.json'), 'utf8');
    git(cwd, 'reset', '-q', '--hard', 'HEAD~1');
    commitFile(cwd, 'evil.js', 'x\n', 'feat(ftrprf): sneaky');
    commitFile(cwd, 'ftrprf/STACK.json', stackJson, 'chore(ftrprf): update STACK.json');
    rejects(assertStack(cwd), /3 stack commit\(s\), STACK\.json declares 2/);
}));

test('fails on a merge commit', () => withRepo(cwd => {
    git(cwd, 'checkout', '-q', '-b', 'side', 'v1.0.0');
    commitFile(cwd, 'side.txt', 's\n', 'side');
    git(cwd, 'checkout', '-q', 'ftrprf/v1.0.0');
    git(cwd, 'merge', '-q', '--no-ff', '-m', 'merge side', 'side');
    rejects(assertStack(cwd), /merge commits in v1\.0\.0\.\.HEAD/);
}));

test('fails on a changed patch', () => withRepo(cwd => {
    // Rewrite commit b with different content but the same subject and paths.
    const oldB = git(cwd, 'rev-parse', 'HEAD~1');
    git(cwd, 'checkout', '-q', oldB);
    fs.writeFileSync(path.join(cwd, 'src/b.txt'), 'tampered\n');
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-q', '--amend', '--no-edit');
    const tampered = git(cwd, 'rev-parse', 'HEAD');
    git(cwd, 'checkout', '-q', 'ftrprf/v1.0.0');
    git(cwd, 'rebase', '-q', '--onto', tampered, oldB, 'ftrprf/v1.0.0');
    rejects(assertStack(cwd), /patch-id .* differs from declared/);
}));

test('fails on a changed touched path', () => withRepo(cwd => {
    restamp(cwd, s => {
        s.commits[1].paths = ['src/other.txt'];
    });
    rejects(assertStack(cwd), /touched paths/);
}));

test('fails on a changed subject', () => withRepo(cwd => {
    restamp(cwd, s => {
        s.commits[0].subject = 'feat(ftrprf): renamed';
    });
    rejects(assertStack(cwd), /subject differs/);
}));

test('fails on reordered declared commits', () => withRepo(cwd => {
    restamp(cwd, s => {
        s.commits.reverse();
    });
    rejects(assertStack(cwd), /differs/);
}));

test('fails on a wrong base', () => withRepo(cwd => {
    git(cwd, 'checkout', '-q', 'v1.0.0');
    commitFile(cwd, 'base.txt', 'one\ntwo\nthree\nfour\n', 'later upstream');
    git(cwd, 'tag', 'v1.0.1');
    git(cwd, 'checkout', '-q', 'ftrprf/v1.0.0');
    restamp(cwd, s => {
        s.upstreamTag = 'v1.0.1';
    });
    rejects(assertStack(cwd), /merge-base of HEAD and v1\.0\.1/);
}));

test('fails when the upstream tag does not exist', () => withRepo(cwd => {
    restamp(cwd, s => {
        s.upstreamTag = 'v9.9.9';
    });
    rejects(assertStack(cwd), /does not exist/);
}));

test('fails on malformed STACK.json', () => withRepo(cwd => {
    restamp(cwd, s => {
        s.commits[0].patchId = 'nope';
    });
    rejects(assertStack(cwd), /malformed/);
}));

test('fails when a STACK.json-only commit is not the tip', () => withRepo(cwd => {
    commitFile(cwd, 'ftrprf/STACK.json', `${fs.readFileSync(path.join(cwd, 'ftrprf/STACK.json'), 'utf8')}\n`,
        'chore(ftrprf): update STACK.json');
    rejects(assertStack(cwd), /may appear once/);
}));

test('fails when the STACK.json-only tip lacks the chore(ftrprf) prefix', () => withRepo(cwd => {
    git(cwd, 'commit', '-q', '--amend', '-m', 'fix: sneaky');
    rejects(assertStack(cwd), /must have a "chore\(ftrprf\)" subject/);
}));

test('a chore(ftrprf) commit touching other paths gets no exemption', () => withRepo(cwd => {
    commitFile(cwd, 'x.txt', 'x\n', 'chore(ftrprf): update STACK.json');
    rejects(assertStack(cwd), /stack commit\(s\)|may appear once/);
}));

test('--tarball passes when ftrprfSourceSha equals HEAD', () => withRepo(cwd => {
    const head = git(cwd, 'rev-parse', 'HEAD');
    const r = assertStack(cwd, '--tarball', makeTarball(cwd, {name: 'x', ftrprfSourceSha: head}));
    assert.equal(r.status, 0, r.stderr);
}));

test('--tarball fails on an SHA mismatch', () => withRepo(cwd => {
    const sha = git(cwd, 'rev-parse', 'HEAD~1');
    rejects(assertStack(cwd, '--tarball', makeTarball(cwd, {ftrprfSourceSha: sha})), /does not equal HEAD/);
}));

test('--tarball fails when ftrprfSourceSha is missing or abbreviated', () => withRepo(cwd => {
    rejects(assertStack(cwd, '--tarball', makeTarball(cwd, {name: 'x'})), /missing or not a full SHA/);
    const short = git(cwd, 'rev-parse', '--short', 'HEAD');
    rejects(assertStack(cwd, '--tarball', makeTarball(cwd, {ftrprfSourceSha: short})), /missing or not a full SHA/);
}));

test('--tarball fails on an unreadable tarball', () => withRepo(cwd => {
    rejects(assertStack(cwd, '--tarball', path.join(cwd, 'missing.tgz')), /cannot read/);
}));

test('--previous prints a range-diff', () => withRepo(cwd => {
    git(cwd, 'branch', 'prev', 'HEAD~1');
    const r = assertStack(cwd, '--previous', 'prev');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /feat\(ftrprf\): a/);
}));

test('--previous rejects option-looking and unknown refs', () => withRepo(cwd => {
    rejects(assertStack(cwd, '--previous', '--output=x'), /not a usable ref/);
    assert.equal(assertStack(cwd, '--previous', 'nope').status, 1);
}));

test('rejects unknown arguments', () => withRepo(cwd => {
    rejects(assertStack(cwd, '--bogus'), /unknown argument/);
}));
