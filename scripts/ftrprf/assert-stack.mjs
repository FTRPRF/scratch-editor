#!/usr/bin/env node
// Proves that a branch is exactly "upstream tag + the declared FTRPRF stack".
//
// Usage (run from the fork's checkout):
//   node scripts/ftrprf/assert-stack.mjs [--previous <branch>] [--tarball <tgz>]
//   node scripts/ftrprf/assert-stack.mjs --write [--tag <upstream tag>]
//
// The check exits 0 only when ALL of these hold (it fails closed on anything
// it cannot read or parse):
//   - ftrprf/STACK.json, read from the HEAD commit (not the working tree), is
//     well formed and names an upstream tag that exists;
//   - the merge-base of HEAD and that tag is the tag commit;
//   - there are no merge commits in tag..HEAD;
//   - the commits in tag..HEAD, minus at most one trailing "chore(ftrprf)"
//     commit that touches only ftrprf/STACK.json, match STACK.json one to one,
//     in order, by subject, `git patch-id --stable` and touched paths;
//   - with --tarball, the packed package.json's ftrprfSourceSha equals HEAD.
// With --previous it also prints `git range-diff <tag> <previous> HEAD`.
//
// A commit cannot contain its own patch-id, so STACK.json is committed after
// the stack it declares: that one STACK.json-only commit, which must be the
// tip, is the only commit allowed outside the declaration. A STACK.json-only
// commit in any other position (or without the chore(ftrprf) subject prefix)
// is an error.
//
// --write regenerates ftrprf/STACK.json in the working tree from tag..HEAD
// (ignoring a trailing STACK.json-only commit). Commit the result as
// "chore(ftrprf): update STACK.json".
//
// Known limit: patch-id --stable ignores whitespace, so a whitespace-only
// edit to a declared commit is not detected by this check.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';

const STACK_FILE = 'ftrprf/STACK.json';
const TAG_RE = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const PATCH_ID_RE = /^[0-9a-f]{40}$/;
const CHORE_PREFIX = 'chore(ftrprf)';

class CheckError extends Error {}

const fail = message => {
    throw new CheckError(message);
};

const git = (args, input) => {
    const r = spawnSync('git', args, {encoding: 'utf8', input, maxBuffer: 256 * 1024 * 1024});
    if (r.error || r.status !== 0) {
        fail(`git ${args.join(' ')} failed: ${r.error ? r.error.message : r.stderr.trim()}`);
    }
    return r.stdout;
};

const lines = text => text.split('\n').filter(Boolean);

const assertRef = (name, value) => {
    if (typeof value !== 'string' || value === '' || value.startsWith('-') || /[\0\s]/.test(value)) {
        fail(`${name} is not a usable ref: ${JSON.stringify(value)}`);
    }
};

const touchedPaths = sha =>
    git(['diff-tree', '--root', '--no-commit-id', '--no-renames', '--name-only', '-r', '-z', sha])
        .split('\0')
        .filter(Boolean)
        .sort();

const patchId = sha => {
    const diff = git(['diff-tree', '--root', '--no-renames', '-p', sha]);
    const out = git(['patch-id', '--stable'], diff).trim();
    const [id, ...rest] = out.split(/\s+/);
    if (!PATCH_ID_RE.test(id || '') || rest.length !== 1 || rest[0] !== sha) {
        fail(`could not compute a patch-id for ${sha}`);
    }
    return id;
};

const isStackFileOnly = paths => paths.length === 1 && paths[0] === STACK_FILE;

/**
 * Validates the shape of a parsed STACK.json.
 * @param {*} stack - the parsed JSON
 * @returns {object} the same stack, once validated
 */
const validateStack = stack => {
    if (!stack || typeof stack !== 'object' || Array.isArray(stack)) fail('STACK.json is not an object');
    if (typeof stack.upstreamTag !== 'string' || !TAG_RE.test(stack.upstreamTag)) {
        fail(`STACK.json upstreamTag is invalid: ${JSON.stringify(stack.upstreamTag)}`);
    }
    if (!Array.isArray(stack.commits)) fail('STACK.json commits is not an array');
    stack.commits.forEach((c, i) => {
        const ok = c && typeof c === 'object' &&
            typeof c.subject === 'string' && c.subject !== '' &&
            typeof c.patchId === 'string' && PATCH_ID_RE.test(c.patchId) &&
            Array.isArray(c.paths) && c.paths.length > 0 && c.paths.every(p => typeof p === 'string' && p);
        if (!ok) fail(`STACK.json commits[${i}] is malformed`);
    });
    return stack;
};

const readDeclaredStack = () => {
    let raw;
    try {
        raw = git(['show', `HEAD:${STACK_FILE}`]);
    } catch (e) {
        fail(`${STACK_FILE} is not committed at HEAD (${e.message})`);
    }
    try {
        return validateStack(JSON.parse(raw));
    } catch (e) {
        if (e instanceof CheckError) throw e;
        return fail(`${STACK_FILE} is not valid JSON: ${e.message}`);
    }
};

const resolveTag = tag => {
    const r = spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`], {encoding: 'utf8'});
    const sha = r.stdout.trim();
    if (r.status !== 0 || !SHA_RE.test(sha)) fail(`upstream tag ${tag} does not exist`);
    return sha;
};

/**
 * Checks the shape of tag..HEAD (base, no merges) and returns its commits in
 * order, oldest first, with the trailing STACK.json-only commit split off.
 * @param {string} tag - the upstream tag name
 * @returns {{tagSha: string, head: string, stack: object[], stackCommit: (object|null)}} the range
 */
const readRange = tag => {
    const tagSha = resolveTag(tag);
    const head = git(['rev-parse', '--verify', 'HEAD^{commit}']).trim();

    const mbRes = spawnSync('git', ['merge-base', tagSha, head], {encoding: 'utf8'});
    if (mbRes.status !== 0 || mbRes.stdout.trim() !== tagSha) {
        fail(`merge-base of HEAD and ${tag} is ${mbRes.stdout.trim() || '(none)'}, not the tag commit ${tagSha}`);
    }

    const merges = lines(git(['rev-list', '--merges', `${tagSha}..${head}`]));
    if (merges.length) fail(`merge commits in ${tag}..HEAD: ${merges.join(', ')}`);

    const shas = lines(git(['rev-list', '--reverse', `${tagSha}..${head}`]));
    const commits = shas.map(sha => ({
        sha,
        subject: git(['log', '-1', '--format=%s', sha]).replace(/\n$/, ''),
        paths: touchedPaths(sha)
    }));

    const only = commits.filter(c => isStackFileOnly(c.paths));
    let stackCommit = null;
    if (only.length) {
        const tip = commits[commits.length - 1];
        if (only.length > 1 || only[0] !== tip) {
            fail(`a ${STACK_FILE}-only commit may appear once, as the tip (found ${only.map(c => c.sha).join(', ')})`);
        }
        if (!tip.subject.startsWith(CHORE_PREFIX)) {
            fail(`the ${STACK_FILE}-only tip ${tip.sha} must have a "${CHORE_PREFIX}" subject, got "${tip.subject}"`);
        }
        stackCommit = tip;
    }
    const stack = stackCommit ? commits.slice(0, -1) : commits;
    return {tagSha, head, stack, stackCommit};
};

const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

const check = ({previous, tarball}) => {
    const declared = readDeclaredStack();
    const {tagSha, head, stack} = readRange(declared.upstreamTag);

    if (stack.length !== declared.commits.length) {
        fail(`${declared.upstreamTag}..HEAD has ${stack.length} stack commit(s), STACK.json declares ${declared.commits.length}`);
    }
    stack.forEach((c, i) => {
        const want = declared.commits[i];
        const where = `commit ${i + 1} (${c.sha.slice(0, 9)} "${c.subject}")`;
        if (c.subject !== want.subject) fail(`${where}: subject differs from declared "${want.subject}"`);
        if (!sameList(c.paths, [...want.paths].sort())) {
            fail(`${where}: touched paths [${c.paths.join(', ')}] differ from declared [${[...want.paths].sort().join(', ')}]`);
        }
        const id = patchId(c.sha);
        if (id !== want.patchId) fail(`${where}: patch-id ${id} differs from declared ${want.patchId}`);
    });

    if (tarball !== undefined) {
        const r = spawnSync('tar', ['-xzOf', tarball, 'package/package.json'], {encoding: 'utf8'});
        if (r.error || r.status !== 0) fail(`cannot read package/package.json from ${tarball}`);
        let sha;
        try {
            sha = JSON.parse(r.stdout).ftrprfSourceSha;
        } catch {
            fail(`package/package.json in ${tarball} is not valid JSON`);
        }
        if (typeof sha !== 'string' || !SHA_RE.test(sha)) fail(`ftrprfSourceSha in ${tarball} is missing or not a full SHA`);
        if (sha !== head) fail(`ftrprfSourceSha ${sha} does not equal HEAD ${head}`);
    }

    if (previous !== undefined) {
        assertRef('--previous', previous);
        process.stdout.write(git(['range-diff', tagSha, previous, head]));
    }
    console.log(`ok: ${declared.upstreamTag} + ${stack.length} declared commit(s), HEAD ${head}`);
};

const write = ({tag}) => {
    let upstreamTag = tag;
    if (upstreamTag === undefined) {
        try {
            upstreamTag = JSON.parse(fs.readFileSync(STACK_FILE, 'utf8')).upstreamTag;
        } catch {
            fail(`pass --tag <upstream tag>, or have an existing ${STACK_FILE} to read it from`);
        }
    }
    if (typeof upstreamTag !== 'string' || !TAG_RE.test(upstreamTag)) fail(`invalid upstream tag ${upstreamTag}`);
    const {stack} = readRange(upstreamTag);
    const out = {
        upstreamTag,
        commits: stack.map(c => ({subject: c.subject, patchId: patchId(c.sha), paths: c.paths}))
    };
    fs.mkdirSync('ftrprf', {recursive: true});
    fs.writeFileSync(STACK_FILE, `${JSON.stringify(out, null, 4)}\n`);
    console.log(`wrote ${STACK_FILE}: ${upstreamTag} + ${out.commits.length} commit(s)`);
};

const parseArgs = argv => {
    const opts = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--write') opts.write = true;
        else if (a === '--previous' || a === '--tarball' || a === '--tag') {
            const v = argv[++i];
            if (v === undefined) fail(`${a} needs a value`);
            opts[a.slice(2)] = v;
        } else fail(`unknown argument ${a}`);
    }
    return opts;
};

const main = () => {
    try {
        const opts = parseArgs(process.argv.slice(2));
        if (opts.write) write(opts);
        else check(opts);
        return 0;
    } catch (e) {
        if (!(e instanceof CheckError)) throw e;
        console.error(`assert-stack: ${e.message}`);
        return 1;
    }
};

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname)) {
    process.exitCode = main();
}
