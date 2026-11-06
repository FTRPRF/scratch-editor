import filterToolboxXml from '../../../src/lib/ftrprf/filter-toolbox-xml';

const TOOLBOX = [
    '<xml id="toolbox-xml" style="display: none">',
    '<category name="Motion" id="motion" colour="#4C97FF">',
    '<block type="motion_movesteps"></block>',
    '<block type="motion_turnright"></block>',
    '<sep gap="36"></sep>',
    '<block type="motion_gotoxy"></block>',
    '</category>',
    '<category name="Looks" id="looks" colour="#9966FF">',
    '<block type="looks_say"></block>',
    '</category>',
    '<category name="Variables" id="data" colour="#FF8C1A" custom="VARIABLE"></category>',
    '<category name="My Blocks" id="myBlocks" colour="#FF6680" custom="PROCEDURE"></category>',
    '</xml>'
].join('');

const parse = xml => new DOMParser().parseFromString(xml, 'text/xml');
const categoryIds = xml => Array.from(parse(xml).getElementsByTagName('category')).map(c => c.getAttribute('id'));
const blockTypes = xml => Array.from(parse(xml).getElementsByTagName('block')).map(b => b.getAttribute('type'));

describe('filterToolboxXml', () => {
    test('empty useful list returns toolbox unchanged', () => {
        expect(filterToolboxXml(TOOLBOX, [])).toBe(TOOLBOX);
    });

    test('keeps only useful blocks and their categories', () => {
        const result = filterToolboxXml(TOOLBOX, ['motion_movesteps', 'motion_gotoxy']);
        expect(blockTypes(result)).toEqual(['motion_movesteps', 'motion_gotoxy']);
        expect(categoryIds(result)).toEqual(['motion', 'myBlocks']);
    });

    test('removes a separator left leading its category, keeps one that follows a block', () => {
        expect(parse(filterToolboxXml(TOOLBOX, ['motion_gotoxy'])).getElementsByTagName('sep').length).toBe(0);
        expect(parse(filterToolboxXml(TOOLBOX, ['motion_movesteps'])).getElementsByTagName('sep').length).toBe(1);
    });

    test('always keeps myBlocks category', () => {
        const result = filterToolboxXml(TOOLBOX, ['looks_say']);
        expect(categoryIds(result)).toEqual(['looks', 'myBlocks']);
    });

    test('unknown opcode in useful list does not throw and keeps no extra blocks', () => {
        let result;
        expect(() => {
            result = filterToolboxXml(TOOLBOX, ['not_a_real_opcode']);
        }).not.toThrow();
        expect(blockTypes(result)).toEqual([]);
        expect(categoryIds(result)).toEqual(['myBlocks']);
    });
});
