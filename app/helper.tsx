import { Buffer } from 'buffer';

function littleEndianToInt(b: Buffer): number {
    return b.readUIntLE(0, b.length);
}

function intToLittleEndian(n: number, length: number): Buffer {
    const buffer = Buffer.alloc(length);
    buffer.writeUIntLE(n, 0, length);
    return buffer;
}

function readVarint(s: Buffer): [number, number] {
    const i = s[0];
    let value: number;
    let bytesRead: number;

    if (i === 0xfd) {
        value = s.readUInt16LE(1);
        bytesRead = 3;
    } else if (i === 0xfe) {
        value = s.readUInt32LE(1);
        bytesRead = 5;
    } else if (i === 0xff) {
        value = Number(s.readBigUInt64LE(1));
        bytesRead = 9;
    } else {
        value = i;
        bytesRead = 1;
    }

    return [value, bytesRead];
}

function encodeVarint(i: number): Buffer {
    if (i < 0xfd) {
        return Buffer.from([i]);
    } else if (i < 0x10000) {
        return Buffer.concat([Buffer.from([0xfd]), intToLittleEndian(i, 2)]);
    } else if (i < 0x100000000) {
        return Buffer.concat([Buffer.from([0xfe]), intToLittleEndian(i, 4)]);
    } else if (i < 0x10000000000000000) {
        return Buffer.concat([Buffer.from([0xff]), intToLittleEndian(i, 8)]);
    } else {
        throw new Error(`integer too large: ${i}`);
    }
}

class Script {
    cmds: (Buffer | number)[];

    constructor(cmds: (Buffer | number)[]) {
        this.cmds = cmds;
    }

    static parse(s: Buffer): Script {
        debugger
        let offset = 0;
        const [length, bytesRead] = readVarint(s);
        offset += bytesRead;

        const cmds: (Buffer | number)[] = [];
        let count = 0;

        while (count < length) {
            const currentByte = s[offset];
            offset++;
            count++;

            if (currentByte >= 1 && currentByte <= 75) {
                const n = currentByte;
                cmds.push(s.slice(offset, offset + n));
                offset += n;
                count += n;
            } else if (currentByte === 76) {
                // OP_PUSHDATA1
                const dataLength = s[offset];
                offset++;
                cmds.push(s.slice(offset, offset + dataLength));
                offset += dataLength;
                count += dataLength + 1;
            } else if (currentByte === 77) {
                // OP_PUSHDATA2
                const dataLength = s.readUInt16LE(offset);
                offset += 2;
                cmds.push(s.slice(offset, offset + dataLength));
                offset += dataLength;
                count += dataLength + 2;
            } else {
                // Opcode
                cmds.push(currentByte);
            }
        }

        if (count !== length) {
            throw new SyntaxError('parsing script failed');
        }

        return new Script(cmds);
    }

    rawSerialize(): Buffer {
        let result = Buffer.alloc(0);

        for (const cmd of this.cmds) {
            if (typeof cmd === 'number') {
                result = Buffer.concat([result, intToLittleEndian(cmd, 1)]);
            } else {
                const length = cmd.length;
                if (length < 75) {
                    result = Buffer.concat([result, intToLittleEndian(length, 1)]);
                } else if (length > 75 && length < 0x100) {
                    result = Buffer.concat([
                        result,
                        intToLittleEndian(76, 1),
                        intToLittleEndian(length, 1)
                    ]);
                } else if (length >= 0x100 && length <= 520) {
                    result = Buffer.concat([
                        result,
                        intToLittleEndian(77, 1),
                        intToLittleEndian(length, 2)
                    ]);
                } else {
                    throw new Error('too long an cmd');
                }
                result = Buffer.concat([result, cmd]);
            }
        }

        return result;
    }

    serialize(): Buffer {
        debugger

        const result = this.rawSerialize();
        const total = result.length;
        return Buffer.concat([encodeVarint(total), result]);
    }
}

export default Script;
export { littleEndianToInt, intToLittleEndian, readVarint, encodeVarint };