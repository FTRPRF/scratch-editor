const test = require('tap').test;
const VirtualMachine = require('../../src/index');
const sb3 = require('../../src/serialization/sb3');

// FTRPRF: a 15 save must keep the procedure shape the 12.x chain (scratch-blocks
// 1.x) writes, so a project saved here still loads correctly after a rollback.
// See keepLegacyProcedureShape in src/serialization/sb3.js.

const costume = () => [{
    name: 'leeg',
    assetId: 'cd21514d0531fdffb22204e0ec5ed84a',
    md5ext: 'cd21514d0531fdffb22204e0ec5ed84a.svg',
    dataFormat: 'svg',
    rotationCenterX: 0,
    rotationCenterY: 0
}];

const mutation = (proccode, ids, names, defaults) => ({
    tagName: 'mutation',
    children: [],
    proccode,
    argumentids: JSON.stringify(ids),
    argumentnames: JSON.stringify(names),
    argumentdefaults: JSON.stringify(defaults),
    warp: 'false'
});

// One sprite as the 12.7.1 chain saves it: a definition with a shadow
// prototype taking a string/number and a boolean argument, a definition
// without arguments, and a call.
const makeLegacyProject = () => ({
    targets: [
        {
            isStage: true,
            name: 'Stage',
            variables: {},
            lists: {},
            broadcasts: {},
            blocks: {},
            comments: {},
            currentCostume: 0,
            costumes: costume(),
            sounds: [],
            volume: 100,
            layerOrder: 0
        },
        {
            isStage: false,
            name: 'Sprite1',
            variables: {},
            lists: {},
            broadcasts: {},
            blocks: {
                define: {
                    opcode: 'procedures_definition',
                    next: 'say',
                    parent: null,
                    inputs: {custom_block: [1, 'proto']},
                    fields: {},
                    shadow: false,
                    topLevel: true,
                    x: 10,
                    y: 20
                },
                proto: {
                    opcode: 'procedures_prototype',
                    next: null,
                    parent: 'define',
                    inputs: {argN: [1, 'repN'], argB: [1, 'repB']},
                    fields: {},
                    shadow: true,
                    topLevel: false,
                    mutation: mutation('spring %s als %b', ['argN', 'argB'], ['hoogte', 'klaar'], ['', 'false'])
                },
                repN: {
                    opcode: 'argument_reporter_string_number',
                    next: null,
                    parent: 'proto',
                    inputs: {},
                    fields: {VALUE: ['hoogte', null]},
                    shadow: true,
                    topLevel: false
                },
                repB: {
                    opcode: 'argument_reporter_boolean',
                    next: null,
                    parent: 'proto',
                    inputs: {},
                    fields: {VALUE: ['klaar', null]},
                    shadow: true,
                    topLevel: false
                },
                say: {
                    opcode: 'looks_say',
                    next: null,
                    parent: 'define',
                    inputs: {MESSAGE: [3, 'useN', [10, 'hallo']]},
                    fields: {},
                    shadow: false,
                    topLevel: false
                },
                useN: {
                    opcode: 'argument_reporter_string_number',
                    next: null,
                    parent: 'say',
                    inputs: {},
                    fields: {VALUE: ['hoogte', null]},
                    shadow: false,
                    topLevel: false
                },
                define2: {
                    opcode: 'procedures_definition',
                    next: null,
                    parent: null,
                    inputs: {custom_block: [1, 'proto2']},
                    fields: {},
                    shadow: false,
                    topLevel: true,
                    x: 300,
                    y: 20
                },
                proto2: {
                    opcode: 'procedures_prototype',
                    next: null,
                    parent: 'define2',
                    inputs: {},
                    fields: {},
                    shadow: true,
                    topLevel: false,
                    mutation: mutation('Exercise blocks', [], [], [])
                },
                call: {
                    opcode: 'procedures_call',
                    next: null,
                    parent: null,
                    inputs: {argN: [1, [10, '3']]},
                    fields: {},
                    shadow: false,
                    topLevel: true,
                    x: 10,
                    y: 200,
                    mutation: mutation('spring %s als %b', ['argN', 'argB'], [], [])
                }
            },
            comments: {},
            currentCostume: 0,
            costumes: costume(),
            sounds: [],
            volume: 100,
            layerOrder: 1,
            visible: true,
            x: 0,
            y: 0,
            size: 100,
            direction: 90,
            draggable: false,
            rotationStyle: 'all around'
        }
    ],
    monitors: [],
    extensions: [],
    meta: {semver: '3.0.0', vm: '12.7.1', agent: ''}
});

const loadAndSave = async json => {
    const vm = new VirtualMachine();
    await vm.loadProject(JSON.stringify(json));
    return JSON.parse(vm.toJSON());
};

const sprite = project => project.targets.find(target => target.name === 'Sprite1');

test('a 15 save keeps the 12.x procedure-prototype shape', async t => {
    const vm = new VirtualMachine();
    await vm.loadProject(JSON.stringify(makeLegacyProject()));
    const runtimeBlocks = vm.runtime.targets.find(target => target.sprite.name === 'Sprite1').blocks;
    t.equal(runtimeBlocks.getBlock('proto').shadow, false, 'precondition: the load repair unshadows the prototype');
    t.same(runtimeBlocks.getBlock('proto').inputs, {}, 'precondition: the load repair drops the argument shadows');

    const saved = JSON.parse(vm.toJSON());
    const blocks = sprite(saved).blocks;

    t.same(blocks.define.inputs.custom_block, [1, 'proto'], 'custom_block is a shadow input');
    t.equal(blocks.define2.inputs.custom_block[0], 1, 'also without arguments');
    t.equal(blocks.proto.shadow, true, 'prototype is a shadow');
    t.equal(blocks.proto.topLevel, false, 'prototype is not top level');
    t.equal(blocks.proto2.shadow, true, 'argument-less prototype is a shadow');
    t.same(blocks.proto2.inputs, {}, 'argument-less prototype has no inputs');
    t.same(blocks.proto.mutation, makeLegacyProject().targets[1].blocks.proto.mutation, 'mutation unchanged');

    t.same(Object.keys(blocks.proto.inputs).sort(), ['argB', 'argN'], 'one input per argument id');
    t.same(blocks.proto.inputs.argN, [1, 'proto_argN'], 'string/number input, derived id');
    t.same(blocks.proto.inputs.argB, [1, 'proto_argB'], 'boolean input, derived id');
    t.same(blocks.proto_argN, {
        opcode: 'argument_reporter_string_number',
        next: null,
        parent: 'proto',
        inputs: {},
        fields: {VALUE: ['hoogte', null]},
        shadow: true,
        topLevel: false
    }, 'string/number reporter in the 12.x shape');
    t.same(blocks.proto_argB, {
        opcode: 'argument_reporter_boolean',
        next: null,
        parent: 'proto',
        inputs: {},
        fields: {VALUE: ['klaar', null]},
        shadow: true,
        topLevel: false
    }, 'boolean reporter in the 12.x shape');
    t.equal(blocks.useN.shadow, false, 'a used argument reporter is untouched');

    t.equal(runtimeBlocks.getBlock('proto').shadow, false, 'the runtime prototype is not changed by the save');
    t.same(runtimeBlocks.getBlock('proto').inputs, {}, 'the runtime prototype inputs are not changed by the save');
    t.notOk(runtimeBlocks.getBlock('proto_argN'), 'no reporter is added to the runtime');
    t.equal(runtimeBlocks.getBlock('define').inputs.custom_block.shadow, null, 'runtime custom_block unchanged');
    t.end();
});

test('saving a 15 save again is byte-identical (idempotent)', async t => {
    const first = await loadAndSave(makeLegacyProject());
    const second = await loadAndSave(first);
    const third = await loadAndSave(second);
    const text = project => JSON.stringify(sprite(project).blocks);
    t.equal(text(second), text(first), 'second save equals the first');
    t.equal(text(third), text(second), 'third save equals the second');
    t.end();
});

test('serializeBlocks keeps an argument reporter the VM already holds', t => {
    // As in a project authored in this editor before a reload: Blockly's
    // events put the prototype's reporter in the VM.
    const blocks = sb3.deserializeBlocks({
        define: {opcode: 'procedures_definition',
            next: null,
            parent: null,
            inputs: {custom_block: [2, 'proto']},
            fields: {},
            shadow: false,
            topLevel: true,
            x: 0,
            y: 0},
        proto: {opcode: 'procedures_prototype',
            next: null,
            parent: 'define',
            inputs: {},
            fields: {},
            shadow: false,
            topLevel: false,
            mutation: mutation('a %s %b', ['s', 'b'], ['x', 'y'], ['', 'false'])}
    });
    blocks.live = {id: 'live',
        opcode: 'argument_reporter_string_number',
        next: null,
        parent: 'proto',
        inputs: {},
        fields: {VALUE: {name: 'VALUE', value: 'x'}},
        shadow: true,
        topLevel: false};
    blocks.proto.inputs.s = {name: 's', block: 'live', shadow: 'live'};

    const [serialized] = sb3.serializeBlocks(blocks);
    t.same(serialized.proto.inputs.s, [1, 'live'], 'existing reporter kept');
    t.same(serialized.proto.inputs.b, [1, 'proto_b'], 'missing reporter re-created');
    t.equal(serialized.proto_b.opcode, 'argument_reporter_boolean', '%b slot is boolean');
    t.notOk(serialized.proto_s, 'no duplicate for the existing reporter');
    t.end();
});

test('serializeBlocks leaves a top-level prototype alone', t => {
    const blocks = sb3.deserializeBlocks({
        proto: {opcode: 'procedures_prototype',
            next: null,
            parent: null,
            inputs: {},
            fields: {},
            shadow: false,
            topLevel: true,
            x: 5,
            y: 6,
            mutation: mutation('a %s', ['s'], ['x'], [''])}
    });
    const [serialized] = sb3.serializeBlocks(blocks);
    t.equal(serialized.proto.shadow, false, 'not made a shadow');
    t.equal(serialized.proto.topLevel, true, 'keeps its position');
    t.same(Object.keys(serialized), ['proto'], 'no reporter added');
    t.end();
});

test('serializeBlocks writes an orphan prototype as the 12.x chain holds it', t => {
    // Older editors left prototypes without a parent behind: not top level,
    // a shadow in the 12.x chain.
    const blocks = sb3.deserializeBlocks({
        proto: {opcode: 'procedures_prototype',
            next: null,
            inputs: {},
            fields: {},
            shadow: true,
            topLevel: false,
            mutation: mutation('a %b', ['b'], ['y'], ['false'])}
    });
    t.equal(blocks.proto.shadow, false, 'precondition: the load repair unshadows it');
    const [serialized] = sb3.serializeBlocks(blocks);
    t.equal(serialized.proto.shadow, true, 'a shadow again');
    t.equal(serialized.proto.topLevel, false, 'not top level');
    t.same(serialized.proto.inputs.b, [1, 'proto_b'], 'its argument reporter re-created');
    t.equal(serialized.proto_b.opcode, 'argument_reporter_boolean', '%b slot is boolean');
    t.end();
});

test('serializeBlocks ignores an escaped placeholder in the proccode', t => {
    // "\%b" is label text (scratch-blocks and the sb2 parser skip it), so the
    // one real argument is the %s and its reporter is a string/number one.
    const blocks = sb3.deserializeBlocks({
        define: {opcode: 'procedures_definition',
            next: null,
            parent: null,
            inputs: {custom_block: [1, 'proto']},
            fields: {},
            shadow: false,
            topLevel: true,
            x: 0,
            y: 0},
        proto: {opcode: 'procedures_prototype',
            next: null,
            parent: 'define',
            inputs: {},
            fields: {},
            shadow: true,
            topLevel: false,
            mutation: mutation('\\%b %s', ['s'], ['x'], [''])}
    });
    t.equal(blocks.proto.mutation.proccode, '\\%b %s', 'precondition: the proccode keeps its backslash');
    const [serialized] = sb3.serializeBlocks(blocks);
    t.same(serialized.proto.inputs.s, [1, 'proto_s'], 'its argument reporter re-created');
    t.equal(serialized.proto_s.opcode, 'argument_reporter_string_number', '%s slot is string/number');
    t.same(serialized.proto_s.fields, {VALUE: ['x', null]}, 'named after the argument');
    t.end();
});

// A sprite as gui 15's Make-a-Block modal leaves it in the VM, before any
// reload: Blockly's create events put the prototype and its argument reporters
// in as NON-shadow blocks (inputs without a shadow), next to a script that uses
// an argument reporter dragged out of the definition. Fields carry
// id: undefined, as the event adapter (src/engine/adapter.js) writes them.
const adapterField = (name, value, attribs = {}) => ({name, id: attribs.id, value});
const addMadeIn15Blocks = blocks => {
    const add = block => blocks.createBlock(Object.assign({
        next: null,
        inputs: {},
        fields: {},
        shadow: false,
        topLevel: false
    }, block));
    add({id: 'define',
        opcode: 'procedures_definition',
        next: 'say',
        parent: null,
        topLevel: true,
        x: 0,
        y: 0,
        inputs: {custom_block: {name: 'custom_block', block: 'proto', shadow: null}}});
    add({id: 'proto',
        opcode: 'procedures_prototype',
        parent: 'define',
        inputs: {
            argS: {name: 'argS', block: 'repS', shadow: null},
            argN: {name: 'argN', block: 'repN', shadow: null},
            argB: {name: 'argB', block: 'repB', shadow: null}
        },
        mutation: mutation('zeg %s keer %n als %b', ['argS', 'argN', 'argB'],
            ['tekst', 'aantal', 'klaar'], ['', '', 'false'])});
    add({id: 'repS',
        opcode: 'argument_reporter_string_number',
        parent: 'proto',
        fields: {VALUE: adapterField('VALUE', 'tekst')}});
    add({id: 'repN',
        opcode: 'argument_reporter_string_number',
        parent: 'proto',
        fields: {VALUE: adapterField('VALUE', 'aantal')}});
    add({id: 'repB',
        opcode: 'argument_reporter_boolean',
        parent: 'proto',
        fields: {VALUE: adapterField('VALUE', 'klaar')}});
    add({id: 'msg',
        opcode: 'text',
        parent: 'say',
        shadow: true,
        fields: {TEXT: adapterField('TEXT', 'hallo')}});
    add({id: 'say',
        opcode: 'looks_say',
        parent: 'define',
        inputs: {MESSAGE: {name: 'MESSAGE', block: 'useS', shadow: 'msg'}}});
    add({id: 'useS',
        opcode: 'argument_reporter_string_number',
        parent: 'say',
        fields: {VALUE: adapterField('VALUE', 'tekst')}});
    add({id: 'loose',
        opcode: 'argument_reporter_boolean',
        parent: null,
        topLevel: true,
        x: 100,
        y: 100,
        fields: {VALUE: adapterField('VALUE', 'klaar')}});
};

const madeIn15Vm = async () => {
    const project = makeLegacyProject();
    project.targets[1].blocks = {};
    const vm = new VirtualMachine();
    await vm.loadProject(JSON.stringify(project));
    const target = vm.runtime.targets.find(t => t.sprite && t.sprite.name === 'Sprite1');
    addMadeIn15Blocks(target.blocks);
    return {vm, runtimeBlocks: target.blocks};
};

test('argument reporters made in 15 are saved as 12.x shadows', async t => {
    const {vm, runtimeBlocks} = await madeIn15Vm();
    t.equal(runtimeBlocks.getBlock('repS').shadow, false, 'precondition: 15 holds a non-shadow reporter');

    const blocks = sprite(JSON.parse(vm.toJSON())).blocks;
    t.same(blocks.define.inputs.custom_block, [1, 'proto'], 'custom_block is a shadow input');
    t.equal(blocks.proto.shadow, true, 'prototype is a shadow');
    t.same(blocks.proto.inputs, {argS: [1, 'repS'], argN: [1, 'repN'], argB: [1, 'repB']},
        'every argument input is a shadow input of the existing reporter');
    for (const [id, opcode, name] of [
        ['repS', 'argument_reporter_string_number', 'tekst'],
        ['repN', 'argument_reporter_string_number', 'aantal'],
        ['repB', 'argument_reporter_boolean', 'klaar']
    ]) {
        t.same(blocks[id], {
            opcode,
            next: null,
            parent: 'proto',
            inputs: {},
            fields: {VALUE: [name, null]},
            shadow: true,
            topLevel: false
        }, `${id} is a 12.x shadow reporter`);
    }
    t.notOk(blocks.proto_argS || blocks.proto_argN || blocks.proto_argB, 'no duplicate reporter is made');

    t.equal(blocks.useS.shadow, false, 'a reporter dragged into a script stays a normal block');
    t.same(blocks.say.inputs.MESSAGE, [3, 'useS', [10, 'hallo']], 'its input stays a block over a shadow');
    t.equal(blocks.loose.shadow, false, 'a loose top-level reporter stays a normal block');
    t.equal(blocks.loose.topLevel, true, 'and keeps its place');

    for (const id of ['proto', 'repS', 'repN', 'repB', 'useS']) {
        t.equal(runtimeBlocks.getBlock(id).shadow, false, `runtime ${id} is not changed by the save`);
    }
    t.same(runtimeBlocks.getBlock('proto').inputs.argS, {name: 'argS', block: 'repS', shadow: null},
        'runtime prototype input is not changed by the save');
    t.end();
});

test('a 15-made custom block round-trips (load in 15, save) to a stable shape', async t => {
    const {vm} = await madeIn15Vm();
    const first = JSON.parse(vm.toJSON());
    const second = await loadAndSave(first);
    const third = await loadAndSave(second);
    const blocks = sprite(second).blocks;
    t.same(blocks.proto.inputs, {argS: [1, 'proto_argS'], argN: [1, 'proto_argN'], argB: [1, 'proto_argB']},
        'after a reload the reporters are re-created as shadows');
    t.equal(blocks.proto_argB.opcode, 'argument_reporter_boolean', '%b slot is boolean');
    t.equal(blocks.useS.shadow, false, 'the reporter in the script is still a normal block');
    // The first save keeps the reporter ids the 15 editor gave; the load
    // repair drops them, so only the ids differ from the first save on.
    const withoutIds = project => {
        const b = JSON.parse(JSON.stringify(sprite(project).blocks));
        const rename = {repS: 'proto_argS', repN: 'proto_argN', repB: 'proto_argB'};
        for (const [from, to] of Object.entries(rename)) {
            if (b[from]) {
                b[to] = b[from];
                delete b[from];
            }
        }
        for (const input of Object.values(b.proto.inputs)) input[1] = rename[input[1]] || input[1];
        return Object.keys(b).sort()
            .map(id => [id, b[id]]);
    };
    t.same(withoutIds(second), withoutIds(first), 'same shape as the first save, apart from reporter ids');
    t.equal(JSON.stringify(sprite(third).blocks), JSON.stringify(sprite(second).blocks),
        'saving again is byte-identical');
    t.end();
});

test('serializeBlocks drops a shadow obscured by a prototype reporter', t => {
    const blocks = {
        proto: {id: 'proto',
            opcode: 'procedures_prototype',
            next: null,
            parent: null,
            inputs: {s: {name: 's', block: 'rep', shadow: 'under'}},
            fields: {},
            shadow: false,
            topLevel: false,
            mutation: mutation('a %s', ['s'], ['x'], [''])},
        rep: {id: 'rep',
            opcode: 'argument_reporter_string_number',
            next: null,
            parent: 'proto',
            inputs: {},
            fields: {VALUE: {name: 'VALUE', value: 'x'}},
            shadow: false,
            topLevel: false},
        under: {id: 'under',
            opcode: 'argument_reporter_string_number',
            next: null,
            parent: 'proto',
            inputs: {},
            fields: {VALUE: {name: 'VALUE', value: 'x'}},
            shadow: true,
            topLevel: false}
    };
    const [serialized] = sb3.serializeBlocks(blocks);
    t.same(serialized.proto.inputs.s, [1, 'rep'], 'a shadow input of the reporter');
    t.equal(serialized.rep.shadow, true, 'the reporter is a shadow');
    t.notOk(serialized.under, 'the obscured shadow is not left behind');
    t.ok(blocks.under, 'the runtime blocks are not changed');
    t.equal(blocks.rep.shadow, false, 'the runtime reporter is not changed');
    t.end();
});
