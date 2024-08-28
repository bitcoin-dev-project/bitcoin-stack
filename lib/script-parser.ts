export function parseScript(scriptHex: string): Array<{ type: string; value: string }> {
    const script = Buffer.from(scriptHex, 'hex');
    const result: Array<{ type: string; value: string }> = [];
    let i = 0;

    while (i < script.length) {
        const opcode = script[i];
        i++;

        if (opcode <= 0x4b) {
            // Push data
            const data = script.slice(i, i + opcode).toString('hex');
            result.push({ type: 'data', value: data });
            i += opcode;
        } else {
            // Opcode
            result.push({ type: 'opcode', value: getOpcodeName(opcode) });
        }
    }

    return result;
}

function getOpcodeName(opcode: number): string {
    // This is a simplified version. You should expand this to cover all opcodes.
    const opcodeNames: { [key: number]: string } = {
        0x76: 'OP_DUP',
        0xa9: 'OP_HASH160',
        0x88: 'OP_EQUALVERIFY',
        0xac: 'OP_CHECKSIG',
        // Add more opcodes as needed
    };

    return opcodeNames[opcode] || `OP_UNKNOWN_${opcode.toString(16)}`;
}