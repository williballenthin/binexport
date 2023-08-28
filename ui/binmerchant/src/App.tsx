import './App.css';
import { Fragment, Suspense } from 'react';
import {
  RecoilRoot,
  atom,
  selector,
  useRecoilState,
  useRecoilValue,
} from 'recoil';
import { BinExport2 } from './BinExport2';
import Long from 'long';

function Meta({meta}: {meta: BinExport2.IMeta | null | undefined}) {
  if (meta) {
    return (
      <div>
        <dl>
          <dt>arch</dt>
          <dd>{meta.architectureName}</dd>

          <dt>executable id</dt>
          <dd>{meta.executableId}</dd>

          <dt>executeable name</dt>
          <dd>{meta.executableName}</dd>
        </dl>
      </div>
    )
  } else {
    return (
      <dl></dl>
    )
  }
}

function Expression({be, index, expr, childrenByIndex}: {be: BinExport2, index: number, expr: BinExport2.IExpression, childrenByIndex: Record<number, Array<number>>}) {
  if (expr.type == null) {
    return (<div>error: no expression type</div>)
  };

  const childrenIndices = childrenByIndex[index];

  const children = childrenIndices.map((childIndex, index) => (
    <Expression be={be} index={childIndex} expr={be.expression[childIndex]} childrenByIndex={childrenByIndex} key={index} />
  ));

  switch (expr.type) {
    case BinExport2.Expression.Type.SIZE_PREFIX:
      return (<span className="expression size-prefix">{children}</span>);
    case BinExport2.Expression.Type.IMMEDIATE_FLOAT:
      console.assert(children.length === 0, "error: unexpected children");
      return (<span className="expression immediate-float">{expr.immediate?.toString()}</span>)
    case BinExport2.Expression.Type.IMMEDIATE_INT:
      console.assert(children.length === 0, "error: unexpected children");
      return (<span className="expression immediate-int">{expr.immediate?.toString(16).toUpperCase()}h</span>)
    case BinExport2.Expression.Type.REGISTER:
      console.assert(children.length === 0, "error: unexpected children");
      return (<span className="expression register">{expr.symbol}</span>)
    case BinExport2.Expression.Type.SYMBOL:
      console.assert(children.length === 0, "error: unexpected children");
      return (<span className="expression symbol">{expr.symbol}</span>)
    case BinExport2.Expression.Type.OPERATOR:
      if (children.length === 1) {
        return (<span className="expression operator">{expr.symbol}{children[0]}</span>)
      } else {
        // like reg+number
        // like reg+reg+number
        return (<span className="expression operator">
          {children.map((child, index) => (
            <Fragment key={index}>
              {!! index && expr.symbol}
              {child}
            </Fragment>
          ))}
          </span>)
      }
    case BinExport2.Expression.Type.DEREFERENCE:
      console.assert(children.length === 1, "error: unexpected children");
      return (<span className="expression dereference">[{children[0]}]</span>)
    default:
      return (<div>error: unexpected expression type</div>)
  }
}

function Operand({be, op}: {be: BinExport2, op: BinExport2.IOperand}) {
  if (op.expressionIndex == null) {
    return (<div>error: operand has no expression</div>);
  }

  const childrenByIndex: Record<number, Array<number>> = {0: []};
  op.expressionIndex.forEach((exprIndex) => {
    childrenByIndex[exprIndex] = []; 
    const expr = be.expression[exprIndex];
    if (expr.parentIndex != null && expr.parentIndex !== exprIndex) {
      childrenByIndex[expr.parentIndex].push(exprIndex);
    }
  });

  const childIndex0 = op.expressionIndex[0];

  return (
    <span className="operand">
      <Expression be={be} index={childIndex0} expr={be.expression[childIndex0]} childrenByIndex={childrenByIndex} />
    </span>
  )
}

function Instruction({be, address, insn}: {be: BinExport2, address: Long, insn: BinExport2.IInstruction}) {
  if (insn.mnemonicIndex == null) {
    return (<div>error: instruction has no mnemonic</div>);
  }

  const mnem = be.mnemonic[insn.mnemonicIndex];

  return (
    <span className="instruction">
      <span className="address" id={address.toString(0x10)}>
        {address.toString(16).toUpperCase()}
      </span>

      <span className="bytes"></span>

      <span className="mnemonic">{mnem.name}</span>

      <span className="operands">
        {insn.operandIndex?.map((opIndex, index) => (
          <Fragment key={index}>
            {!! index && ", "}
            <Operand be={be} op={be.operand[opIndex]} key={index} />
          </Fragment>
        ))}
      </span>

      <span className="comment"></span>
    </span>
  )
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

function getInstructionAddress(insn: BinExport2.IInstruction): Long | null {
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

function BasicBlock({be, bb}: {be: BinExport2, bb: BinExport2.IBasicBlock}) {
  if (bb.instructionIndex == null) {
    return (<div>error: basic block has no instruction index</div>);
  }

  let address: Long = new Long(0);
  const instructions = [];
  for (const insnIndex of getBasicBlockInstructionIndices(bb)) {
    const insn = be.instruction[insnIndex];

    const iaddr = getInstructionAddress(insn);
    if (iaddr != null) {
      address = iaddr;
    }

    instructions.push(<Instruction be={be} insn={be.instruction[insnIndex]} address={address} key={address.toString(16)} />)

    if (insn.rawBytes != null) {
      address = address.add(new Long(insn.rawBytes.length));
    }
  }

  return (
    <div className="basic-block">
      {instructions}
    </div>
  )
}

function FlowGraph({be, fg}: {be: BinExport2, fg: BinExport2.IFlowGraph}) {
  if (fg.basicBlockIndex == null) {
    return (<div>error: flow graph has no basic block index</div>);
  }

  return (
    <div className="flow-graph">
      {fg.basicBlockIndex.map((bbIndex, index) => (
        <BasicBlock be={be} bb={be.basicBlock[bbIndex]} key={index} />
      ))}
    </div>
  )
}

const sha256State = atom({
  key: "sha256State",
  default: "0501d09a219131657c54dba71faf2b9d793e466f2c7fdf6b0b3c50ec5b866b2a",
});

const binExportValue = selector({
  key: 'binExportState',
  get: async ({get}) => {
    const sha256 = get(sha256State);
    const raw_be = await (await fetch(`/data/${sha256}.BinExport`)).arrayBuffer();

    return BinExport2.decode(new Uint8Array(raw_be));
  },
});

function App({be}: {be: BinExport2}) {
  //const be: BinExport2 = useRecoilValue(binExportValue)

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

  const entryIndex = getFlowGraphByAddress(Long.fromString("0x7ffb612c260C", true, 16));
  if (entryIndex == null) {
    throw new Error("entry is null");
  }
  console.log("entry", entryIndex);

  for (const section of be.section) {
    //console.log(section.address?.toString(0x10), section.size?.toString(0x10));
  }

  for (const library of be.library) {
    //console.log(library.name, library.loadAddress?.toString(0x10));
  }

  const entry = be.flowGraph[entryIndex];

  return (
    <RecoilRoot>
      <Suspense fallback={<div>Loading...</div>}>
        <div className="App">
          <Meta meta={be.metaInformation} />
          <FlowGraph be={be} fg={entry} />
        </div>
      </Suspense>
    </RecoilRoot>
  );
}

export default App;
