import { string, custom } from '@recoiljs/refine';
import {
  DefaultValue,
  RecoilValueReadOnly,
  atom,
  selector,
} from 'recoil';
import { BinExport2 } from './BinExport2';
import Long from 'long';
import { urlSyncEffect } from 'recoil-sync';

function ensureLong(v: number | Long): Long  {
  if (Long.isLong(v)) {
    return v;
  } else if (Number.isInteger(v)) {
    return Long.fromString(v.toString(0x10), true, 0x10);
  } else {
    throw new Error("unexpected type");
  }
}

export function getInstructionAddress(insn: BinExport2.IInstruction): Long | null {
  if (insn.address == null) {
    return null;
  } else if (Long.isLong(insn.address)) {
    return insn.address;
  } else if (Number.isInteger(insn.address) && insn.address !== 0x0) {
    // I'm quite sure how unsafe integers are being passed back here.
    // but translating them to strings and then back to longs seems to work.
    return Long.fromString(insn.address.toString(0x10), true, 0x10);
  } else if (Number.isInteger(insn.address) && insn.address === 0x0) {
    return null;
  } else {
    return null;
  }
}

function* getBasicBlockInstructionIndices(bb: BinExport2.IBasicBlock) {
  if (!bb.instructionIndex) {
    return;
  }

  for (const insnRange of bb.instructionIndex) {
    if (insnRange.endIndex != null && insnRange.beginIndex != null) {
      for (let insnIndex = insnRange.beginIndex; insnIndex < insnRange.endIndex; insnIndex++) {
        yield insnIndex;
      }
    } else if (insnRange.beginIndex != null) {
      yield insnRange.beginIndex;
    } else {
    }
  }

  return;
}

export function getFlowGraphAddress(be: BinExport2, fgIndex: number): Long | null {
  const fg = be.flowGraph[fgIndex];

  const bbIndex = fg.entryBasicBlockIndex;
  if (bbIndex == null) {
    return null;
  }
  const bb = be.basicBlock[bbIndex];
  if (bb.instructionIndex == null) {
    return null;
  }
  const ii = bb.instructionIndex[0];
  if (ii.beginIndex == null) {
    return null;
  }
  const insnIndex = ii.beginIndex;

  const insn = be.instruction[insnIndex];

  const insnAddress = getInstructionAddress(insn);
  if (insnAddress == null) {
    // this might be the case if the prior instruction has an address and size.
    return null;
  }

  return insnAddress
}

const sha256State = atom({
  key: "sha256State",
  default: "0501d09a219131657c54dba71faf2b9d793e466f2c7fdf6b0b3c50ec5b866b2a",
  effects: [
    urlSyncEffect({ 
      history: "push",
      syncDefault: true,
      itemKey: "sha256",
      refine: string() 
    }),
  ]
});

const binExportValue = selector({
  key: 'binExportValue',
  get: async ({get}) => {
    const sha256 = get(sha256State);
    const raw_be = await (await fetch(`/data/${sha256}.BinExport`)).arrayBuffer();

    const be = BinExport2.decode(new Uint8Array(raw_be));
    console.log(be);

    return be;
  },
});

const defaultAddressValue = selector({
  key: 'defaultAddressValue',
  get: ({get}) => {
    const be = get(binExportValue);
    const address = getFlowGraphAddress(be, 0);
    if (address == null) {
      throw new Error("first function has no address");
    }
    return address;
  },
});

const currentAddressState = atom({
  key: "addressState",
  default: defaultAddressValue,
  effects: [
    urlSyncEffect({ 
      history: "push",
      syncDefault: true,
      itemKey: "address",
      refine: custom(x => Long.isLong(x) ? x : null),
      read: ({read}) => {
        const v = read("address");

        if (v instanceof DefaultValue) {
          return Long.fromNumber(0);
        }

        return Long.fromString(read("address") as any, true, 0x10);
      },
      write: ({write, read}, newValue) => {
        write("address", newValue.toString(0x10))
      },
    })
  ]
});

const binExportIndexValue = selector({
  key: "binExportIndexValue",
  get: ({get}) => {
    const be: BinExport2 = get(binExportValue)

    // from address (as hex) to insn index
    const insnByAddress: Record<string, number> = {};
    for (const [index, insn] of be.instruction.entries()) {
      const iaddr = getInstructionAddress(insn);
      if (iaddr == null) {
        continue;
      }

      insnByAddress[iaddr.toString(16)] = index;
    }

    // from insn index to bb index
    const bbByInsn: Record<number, number> = {};
    for (const [index, bb] of be.basicBlock.entries()) {
      if (bb.instructionIndex == null) {
        continue;
      }

      const ii = bb.instructionIndex[0];
      if (ii.beginIndex == null) {
        continue
      }

      bbByInsn[ii.beginIndex] = index;
    }

    const fgByBb: Record<number, number> = {};
    for (const [index, fg] of be.flowGraph.entries()) {
      if (fg.entryBasicBlockIndex == null) {
        continue
      }

      fgByBb[fg.entryBasicBlockIndex] = index;
    }

    function getFlowGraphByAddress(address: Long): number | null {
      const insnIndex = insnByAddress[address.toString(16)];
      if (insnIndex == null) {
        return null;
      }

      const bbIndex = bbByInsn[insnIndex];
      if (bbIndex == null) {
        return null;
      }

      const fgIndex = fgByBb[bbIndex];
      if (fgIndex == null) {
        return null;
      }

      return fgIndex;
    }

    return {
      getFlowGraphByAddress
    }
  }
})

const functionListValue = selector({
  key: 'functionListValue',
  get: ({get}) => {
    const be = get(binExportValue);

    const addresses: Long[] = [];
    for (const fgIndex of be.flowGraph.keys()) {
      const fgAddress = getFlowGraphAddress(be, fgIndex);
      if (fgAddress == null) {
        continue;
      }

      addresses.push(fgAddress);
    }
    
    return addresses;
  },
});

export interface IExpression {
  index: number;
  type: BinExport2.Expression.Type;
  symbol?: string;
  immediate?: Long;
  isRelocation: boolean;
  children: IExpression[];
}

export interface IOperand {
  index: number;
  expression: IExpression;
}

export interface IInstruction {
  index: number;
  address: Long;
  callTargets: Long[];
  mnemonic: string;
  operands: IOperand[];
  rawBytes: Uint8Array;
  comments: BinExport2.IComment[]; // TODO
}

export interface IBasicBlock {
  index: number;
  instructions: IInstruction[];
}

export interface IFlowGraph {
  index: number;
  basicBlocks: IBasicBlock[];
  entryBasicBlockIndex: number;
}

const currentFlowGraphValue: RecoilValueReadOnly<IFlowGraph | null> = selector({
  key: 'currentFlowGraph',
  get: ({get}) => {
    const be = get(binExportValue);
    const currentAddress = get(currentAddressState);
    const beIndex = get(binExportIndexValue);

    try {
      const fgIndex = beIndex.getFlowGraphByAddress(currentAddress);
      if (fgIndex == null) {
        throw new Error("missing flow graph");
      }
      const fg = be.flowGraph[fgIndex];

      if (fg.basicBlockIndex == null) {
        throw new Error("missing basic block");
      }

      if (fg.entryBasicBlockIndex == null) {
        throw new Error("missing basic block entry");
      }

      if (fg.edge == null) {
        throw new Error("missing edge");
      }

      const addressesByInsn: Record<number, Long> = {};
      let address: Long = new Long(0);

      for (const bbIndex of fg.basicBlockIndex) {
        const bb = be.basicBlock[bbIndex];

        for (const insnIndex of getBasicBlockInstructionIndices(bb)) {
          const insn = be.instruction[insnIndex];

          const iaddr = getInstructionAddress(insn);
          if (iaddr != null) {
            // instruction has an explicit address,
            // such as if it was not-contiguous with prior bb,
            // so use that.
            address = iaddr;
          }

          addressesByInsn[insnIndex] = address;

          if (insn.rawBytes != null) {
            address = address.add(new Long(insn.rawBytes.length));
          }
        }
      }

      return {
        index: fgIndex,
        entryBasicBlockIndex: fg.entryBasicBlockIndex,
        basicBlocks: fg.basicBlockIndex.map((bbIndex) => {
          const bb = be.basicBlock[bbIndex];

          if (bb.instructionIndex == null) {
            throw new Error("missing instructions");
          }

          return {
            index: bbIndex,
            instructions: [...getBasicBlockInstructionIndices(bb)].map((insnIndex) => {
              const insn = be.instruction[insnIndex];

              if (insn.callTarget == null) {
                throw new Error("missing call target");
              }

              if (insn.mnemonicIndex == null) {
                throw new Error("missing mnemonic");
              }

              const mnem = be.mnemonic[insn.mnemonicIndex];
              if (mnem.name == null) {
                throw new Error("missing name");
              }

              if (insn.operandIndex == null) {
                throw new Error("missing operands");
              }

              if (insn.rawBytes == null) {
                throw new Error("missing bytes");
              }

              if (insn.commentIndex == null) {
                throw new Error("missing comments");
              }

              return {
                index: insnIndex,
                address: addressesByInsn[insnIndex],
                callTargets: insn.callTarget.map(ensureLong),
                mnemonic: mnem.name,
                operands: insn.operandIndex.map((opIndex) => {
                  const op = be.operand[opIndex];
                  if (op == null) {
                    throw new Error("operand not found");
                  }

                  if (op.expressionIndex == null) {
                    throw new Error("missing expressions");
                  }

                  const childrenByIndex: Record<number, Array<number>> = {0: []};
                  op.expressionIndex.forEach((exprIndex) => {
                    childrenByIndex[exprIndex] = []; 
                    const expr = be.expression[exprIndex];
                    if (expr.parentIndex != null && expr.parentIndex !== exprIndex) {
                      childrenByIndex[expr.parentIndex].push(exprIndex);
                    }
                  });

                  function buildExpressions(exprIndex: number): IExpression {
                    const expr = be.expression[exprIndex];

                    if (expr.type == null) {
                      throw new Error("missing type");
                    }

                    if (expr.isRelocation == null) {
                      throw new Error("missing relocation");
                    }

                    const ret: IExpression = {
                      index: exprIndex,
                      type: expr.type,
                      isRelocation: expr.isRelocation,
                      children: childrenByIndex[exprIndex].map(buildExpressions),
                    };

                    if (Object.hasOwn(expr, "symbol")) {
                      if (expr.symbol == null) {
                        throw new Error("missing symbol");
                      }
                      ret.symbol = expr.symbol;
                    }

                    if (Object.hasOwn(expr, "immediate")) {
                      if (expr.immediate == null) {
                        throw new Error("missing immediate");
                      }
                      ret.immediate = ensureLong(expr.immediate);
                    }

                    return ret;
                  }

                  return {
                    index: opIndex,
                    expression: buildExpressions(op.expressionIndex[0]),
                  }
                }),
                rawBytes: insn.rawBytes,
                comments: insn.commentIndex.map((commentIndex) => {
                  const comment = be.comment[commentIndex];
                  if (comment == null) {
                    throw new Error("comment not found");
                  }

                  return comment;
                }),
              }
            })
          }
        }),
      }
    } catch (e) {
      console.error("error: ", e);
      return null;
    }
  },
})

export const model = {
    sha256: sha256State,
    be: binExportValue,
    functionList: functionListValue,
    currentAddress: currentAddressState,
    currentFlowGraph: currentFlowGraphValue,
}