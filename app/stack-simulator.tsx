"use client"
import React, { useState, useEffect } from "react";
import { ArrowDownCircle, ArrowUpCircle, Info, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as bitcoin from 'bitcoinjs-lib';
import bs58 from 'bs58';
import crypto from 'crypto';
import { parseScript } from '@/lib/script-parser';
import { ec as EC } from 'elliptic';

// Initialize the secp256k1 curve
const ec = new EC('secp256k1');

type StackItem = Buffer | boolean;

// Helper functions
const sha256 = (data: Buffer): Buffer => crypto.createHash('sha256').update(data).digest();
const ripemd160 = (data: Buffer): Buffer => crypto.createHash('ripemd160').update(data).digest();
const hash160 = (data: Buffer): Buffer => ripemd160(sha256(data));

function encodeNumber(num: number): Buffer {
    if (num === 0) {
        return Buffer.alloc(0);
    }
    const absNum = Math.abs(num);
    const negative = num < 0;
    const result: number[] = [];
    let currentNum = absNum;
    while (currentNum) {
        result.push(currentNum & 0xff);
        currentNum >>>= 8;
    }
    if (result[result.length - 1] & 0x80) {
        if (negative) {
            result.push(0x80);
        } else {
            result.push(0);
        }
    } else if (negative) {
        result[result.length - 1] |= 0x80;
    }
    return Buffer.from(result);
}

function decodeNumber(element: Buffer): number {
    if (element.length === 0) {
        return 0;
    }
    const bigEndian = Buffer.from(element).reverse();
    let result = 0;
    const negative = bigEndian[0] & 0x80;
    if (negative) {
        result = bigEndian[0] & 0x7f;
    } else {
        result = bigEndian[0];
    }
    for (let i = 1; i < bigEndian.length; i++) {
        result <<= 8;
        result += bigEndian[i];
    }
    if (negative) {
        return -result;
    } else {
        return result;
    }
}

const arithmeticOpcodes = ["OP_ADD", "OP_SUB", "OP_MUL", "OP_DIV"];

function opChecksig2(pubKey: Buffer, signature: Buffer, messageHash: Buffer): boolean {
    try {
      // Remove the last byte from the signature (it's the hash type)
    //   const signatureWithoutHashType = signature.slice(0, -1);
      const signatureWithoutHashType = signature
  
      // Convert the public key to a point on the curve
      const key = ec.keyFromPublic(pubKey);
  
      // Verify the signature
      return key.verify(messageHash, signatureWithoutHashType);
    } catch (error) {
      console.error('Error in opChecksig:', error);
      return false;
    }
  }
  

const StackSimulator = () => {
    const [stack, setStack] = useState<StackItem[]>([]);
    const [input, setInput] = useState<string>('0x');
    const [lastOperation, setLastOperation] = useState<string | null>(null);
    const [showHexInfo, setShowHexInfo] = useState(false);
    const [showChecksigModal, setShowChecksigModal] = useState(false);
    const [transactionHash, setTransactionHash] = useState('0x' + '00'.repeat(32));
    const [scriptHex, setScriptHex] = useState('');
    const [parsedScript, setParsedScript] = useState<Array<{ type: string; value: string }>>([]);
    const [activeTab, setActiveTab] = useState<'stack' | 'parser'>('stack');
    const [showChecksigExample, setShowChecksigExample] = useState(false);
    const exampleData = {
        z: '0x7c076ff316692a3d7eb3c3bb0f8b1488cf72e1afcd929e29307032997a838a3d',
        sec: '04887387e452b8eacc4acfde10d9aaf7f6d9a0f975aabb10d006e4da568744d06c61de6d95231cd89026e286df3b6ae4a894a3378e393e93a0f45b666329a0ae34',
        sig: '3045022000eff69ef2b1bd93a66ed5219add4fb51e11a840f404876325a1e8ffe0529a2c022100c7207fee197d27c618aea621406f6bf5ef6fca38681d82b2f06fddbdce6feab6'
    };

    const loadExampleData = () => {
        setTransactionHash(exampleData.z);
        setStack([
            Buffer.from(exampleData.sig, 'hex'),
            Buffer.from(exampleData.sec, 'hex')
        ]);
        setShowChecksigModal(true);
        setShowChecksigExample(false);
    };

    useEffect(() => {
        bitcoin.networks.testnet;
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value.length < 2) {
            setInput('0x');
        } else if (value.startsWith('0x')) {
            const hexPart = value.slice(2);
            if (/^[0-9A-Fa-f]*$/.test(hexPart)) {
                setInput(value);
            }
        }
    };

    const push = (): void => {
        if (input.length > 2) {
            const hexValue = input.slice(2);
            const stackItem = Buffer.from(hexValue, 'hex');
            setStack((prevStack) => [...prevStack, stackItem]);
            setInput('0x');
            setLastOperation("push");
        }
    };

    const pop = (): void => {
        if (stack.length > 0) {
            setStack((prevStack) => prevStack.slice(0, -1));
            setLastOperation("pop");
        }
    };

    const opcodes = [
        {
            name: "OP_ADD",
            execute: (stack: StackItem[]) => {
                if (stack.length < 2) return [...stack, Buffer.from("Error: Insufficient items")];
                const [b, a] = [stack.pop(), stack.pop()] as [Buffer, Buffer];
                const sum = decodeNumber(a) + decodeNumber(b);
                return [...stack, encodeNumber(sum)];
            }
        },
        {
            name: "OP_EQUAL",
            execute: (stack: StackItem[]) => {
                if (stack.length < 2) return [...stack, Buffer.from("Error: Insufficient items")];
                const [b, a] = [stack.pop(), stack.pop()] as [StackItem, StackItem];
                if (a instanceof Buffer && b instanceof Buffer) {
                    return [...stack, Buffer.compare(a, b) === 0];
                }
                return [...stack, a === b];
            }
        },
        {
            name: "OP_DUP",
            execute: (stack: StackItem[]) => {
                if (stack.length < 1) return [...stack, Buffer.from("Error: Insufficient items")];
                return [...stack, stack[stack.length - 1]];
            }
        },
        {
            name: "OP_HASH160",
            execute: (stack: StackItem[]) => {
                if (stack.length < 1) return [...stack, Buffer.from("Error: Insufficient items")];
                const element = stack.pop();
                if (element instanceof Buffer) {
                    return [...stack, hash160(element)];
                }
                return [...stack, Buffer.from("Error: Invalid input for OP_HASH160")];
            }
        },
        {
            name: "OP_CHECKSIG",
            execute: (stack: StackItem[]) => {
                if (stack.length < 2) return [...stack, Buffer.from("Error: Insufficient items")];
                setShowChecksigModal(true);
                return stack; // We'll execute the actual operation after getting the transaction hash
            }
        }
    ];

    const executeOpcode = (opcode: { name: string; execute: (stack: StackItem[]) => StackItem[] }): void => {
        const newStack = opcode.execute([...stack]);
        setStack(newStack);
        setLastOperation(opcode.name);
    };

    const executeCheckSig = () => {
        if (stack.length < 2) return;
        const [pubKey, signature] = [stack.pop(), stack.pop()] as [Buffer, Buffer];
        try {
            const messageHash = Buffer.from(transactionHash.slice(2), 'hex');
            const isValid = opChecksig2(pubKey, signature, messageHash);
            setStack([...stack, isValid]);
            setLastOperation("OP_CHECKSIG");
        } catch (error) {
            setStack([...stack, false]);
            setLastOperation("OP_CHECKSIG (failed)");
        }
        setShowChecksigModal(false);
    };

    const getItemColor = (item: StackItem): string => {
        if (typeof item === "boolean") {
            return item ? "bg-green-500 text-white" : "bg-red-500 text-white";
        }
        if (item instanceof Buffer && item.toString().startsWith("Error:")) {
            return "bg-red-500 text-white";
        }
        return "bg-[#5a6170] text-white"; // Changed from orange to #5a6170
    };

    const formatStackItem = (item: StackItem, showDecimal: boolean): JSX.Element => {
        if (item instanceof Buffer) {
            if (item.toString().startsWith("Error:")) {
                return <span>{item.toString()}</span>;
            }
            const hex = `0x${item.toString('hex')}`;
            if (showDecimal) {
                let decodedNumber;
                try {
                    decodedNumber = decodeNumber(item);
                    return (
                        <div>
                            <span className="font-mono">{hex}</span>
                            <span className="ml-2 text-xs">({decodedNumber})</span>
                        </div>
                    );
                } catch {
                    // If decoding fails, just show the hex
                    return <span className="font-mono">{hex}</span>;
                }
            } else {
                return <span className="font-mono">{hex}</span>;
            }
        }
        return <span>{item.toString()}</span>;
    };

    const handleScriptHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (/^[0-9A-Fa-f]*$/.test(value)) {
            setScriptHex(value);
        }
    };

    const parseScriptHex = () => {
        try {
            const result = parseScript(scriptHex);
            setParsedScript(result);
        } catch (error) {
            console.error("Error parsing script:", error);
            setParsedScript([{ type: 'error', value: (error as Error).message }]);
        }
    };

    return (
        <div className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="p-6 sm:p-10">
                <div className="mb-6 flex space-x-4">
                    <button
                        onClick={() => setActiveTab('stack')}
                        className={`px-4 py-2 rounded-md transition-colors ${activeTab === 'stack' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                    >
                        Stack Simulator
                    </button>
                    <button
                        onClick={() => setActiveTab('parser')}
                        className={`px-4 py-2 rounded-md transition-colors ${activeTab === 'parser' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                    >
                        Script Parser
                    </button>
                </div>

                {activeTab === 'parser' && (
                    <div className="space-y-4">
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                value={scriptHex}
                                onChange={handleScriptHexChange}
                                className="flex-grow px-3 py-2 border border-gray-300 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                placeholder="Enter script hex"
                            />
                            <motion.button
                                onClick={parseScriptHex}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50"
                            >
                                <Play className="inline-block w-5 h-5 mr-1" />
                                Parse Script
                            </motion.button>
                        </div>
                        <div className="border border-gray-300 rounded-md p-4 bg-gray-50 dark:bg-gray-700">
                            <div className="font-semibold mb-2 text-gray-800 dark:text-white">
                                Parsed Script:
                            </div>
                            <AnimatePresence>
                                {parsedScript.length === 0 ? (
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="text-gray-500 dark:text-gray-400 text-center py-2"
                                    >
                                        No script parsed yet
                                    </motion.p>
                                ) : (
                                    <div className="space-y-2">
                                        {parsedScript.map((item, index) => (
                                            <motion.div
                                                key={index}
                                                initial={{ opacity: 0, y: -20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 20 }}
                                                transition={{ duration: 0.2 }}
                                                className={`p-2 rounded-md ${item.type === 'opcode' ? 'bg-[#5a6170]' : item.type === 'data' ? 'bg-green-500' : 'bg-red-500'} text-white`}
                                            >
                                                <div className="font-mono">
                                                    {item.type}: {item.value}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                )}

                {activeTab === 'stack' && (
                    <div className="space-y-4">
                        <div className="flex space-x-2">
                            <div className="relative flex-grow">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    placeholder="0x (enter hex value)"
                                    onFocus={(e) => e.target.setSelectionRange(2, 2)}
                                />
                                <button
                                    onClick={() => setShowHexInfo(!showHexInfo)}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                >
                                    <Info size={20} />
                                </button>
                            </div>
                            <motion.button
                                onClick={push}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50"
                            >
                                <ArrowDownCircle className="inline-block w-5 h-5 mr-1" />
                                Push
                            </motion.button>
                            <motion.button
                                onClick={pop}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50"
                            >
                                <ArrowUpCircle className="inline-block w-5 h-5 mr-1" />
                                Pop
                            </motion.button>
                        </div>

                        {showHexInfo && (
                            <div className="p-3 bg-orange-100 text-orange-800 rounded-md">
                                <p className="text-sm">
                                    Enter values in hexadecimal format only (e.g., 0x01, 0xff). 
                                    The '0x' prefix is fixed to indicate hex input.
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mb-4">
                            {opcodes.map((opcode) => (
                                <motion.button
                                    key={opcode.name}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => executeOpcode(opcode)}
                                    className="px-2 py-1 bg-orange-100 text-orange-800 rounded-md hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-opacity-50 text-sm"
                                >
                                    {opcode.name}
                                </motion.button>
                            ))}
                        </div>

                        <div className="border border-gray-300 rounded-md p-4 bg-gray-50 dark:bg-gray-700">
                            <div className="font-semibold mb-2 text-gray-800 dark:text-white">
                                Stack <span className="font-normal text-sm">(Last-In-First-Out)</span>:
                            </div>
                            <AnimatePresence>
                                {stack.length === 0 ? (
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="text-gray-500 dark:text-gray-400 text-center py-2"
                                    >
                                        Stack is empty
                                    </motion.p>
                                ) : (
                                    <div className="space-y-2">
                                        {stack
                                            .slice()
                                            .reverse()
                                            .map((item, index) => (
                                                <motion.div
                                                    key={`${index}-${item}`}
                                                    initial={{ opacity: 0, y: -20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 20 }}
                                                    transition={{ duration: 0.2 }}
                                                    className={`p-2 rounded-md ${getItemColor(item)} overflow-hidden shadow-md`}
                                                >
                                                    <div className="truncate font-mono">
                                                        {formatStackItem(item, arithmeticOpcodes.includes(lastOperation || ''))}
                                                    </div>
                                                </motion.div>
                                            ))}
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                        {lastOperation && (
                            <div className="text-center text-gray-600 dark:text-gray-400">
                                Last operation: {lastOperation}
                            </div>
                        )}

                        <div className="mt-6">
                            <button
                                onClick={() => setShowChecksigExample(!showChecksigExample)}
                                className="text-orange-500 hover:text-orange-600 focus:outline-none"
                            >
                                {showChecksigExample ? 'Hide OP_CHECKSIG Example' : 'Show OP_CHECKSIG Example'}
                            </button>
                        </div>

                        <AnimatePresence>
                            {showChecksigExample && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md"
                                >
                                    <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-white">OP_CHECKSIG Example</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                                        Use this example to test the OP_CHECKSIG operation. Click "Load Example" to populate the stack and transaction hash.
                                    </p>
                                    <div className="space-y-4 text-sm">
                                        <div className="bg-gray-200 dark:bg-gray-600 p-3 rounded-md">
                                            <strong className="block text-gray-700 dark:text-gray-200 mb-1">Transaction Hash (z):</strong>
                                            <span className="font-mono text-gray-600 dark:text-gray-300 break-all">{exampleData.z}</span>
                                        </div>
                                        <div className="bg-gray-200 dark:bg-gray-600 p-3 rounded-md">
                                            <strong className="block text-gray-700 dark:text-gray-200 mb-1">Public Key (sec):</strong>
                                            <span className="font-mono text-gray-600 dark:text-gray-300 break-all">{exampleData.sec}</span>
                                        </div>
                                        <div className="bg-gray-200 dark:bg-gray-600 p-3 rounded-md">
                                            <strong className="block text-gray-700 dark:text-gray-200 mb-1">Signature (sig):</strong>
                                            <span className="font-mono text-gray-600 dark:text-gray-300 break-all">{exampleData.sig}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={loadExampleData}
                                        className="mt-6 px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50"
                                    >
                                        Load Example
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {showChecksigModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg">
                        <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-white">Transaction Hash for OP_CHECKSIG</h3>
                        <input
                            type="text"
                            value={transactionHash}
                            onChange={(e) => setTransactionHash(e.target.value)}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded mb-2 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white"
                            placeholder="Enter transaction hash (hex)"
                        />
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={() => setShowChecksigModal(false)}
                                className="px-3 py-1 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeCheckSig}
                                className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
                            >
                                Execute OP_CHECKSIG
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StackSimulator;