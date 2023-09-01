// TODO:
import React, { useEffect, useState, Fragment } from "react";
import ReactDOM from 'react-dom/client';
import { RecoilRoot } from 'recoil'
import * as dagre from "@dagrejs/dagre";

import { IFlowGraph, IBasicBlock } from "./Model";
import { BasicBlock, Instruction } from "./Linear";
import { BinExport2 } from "./BinExport2";
import "./Graph.css";

export class Pannable extends React.Component<{ children: JSX.Element | null }, any> {
    foreground_ref: React.RefObject<any>;
    background_ref: React.RefObject<any>;

    constructor(props: any) {
        super(props);
        this.foreground_ref = React.createRef();
        this.background_ref = React.createRef();
    }

    render() {
        return (
            <div ref={this.background_ref} style={{ width: "100%", height: "100%" }}>
                <div ref={this.foreground_ref} style={{ width: "100%", height: "100%" }}>
                    {this.props.children}
                </div>
            </div>
        );
    }

    componentDidMount() {
        // via: https://codepen.io/loxks/details/KKpVvVW
        let isDown = false;

        // the position of the cursor at the start of a drag.
        let startX = 0;
        let startY = 0;

        // the position of the foreground at the start of a drag.
        // this is updated when a drag completes.
        let x = 0;
        let y = 0;

        let zoom = 1.0;

        // TODO: enable scrolling
        // TODO: enable touch interactions

        this.background_ref.current.addEventListener("mousedown", (e: MouseEvent) => {
            isDown = true;
            this.background_ref.current.classList.add("active");
            this.background_ref.current.style.userSelect = "none";
            // TODO: style: set cursor: grabbing

            startX = e.pageX;
            startY = e.pageY;
        });

        const finish_drag = (e: MouseEvent) => {
            isDown = false;
            this.background_ref.current.classList.remove("active");

            const dx = e.pageX - startX;
            const dy = e.pageY - startY;

            y = y + dy;
            x = x + dx;
        };

        this.background_ref.current.addEventListener("mouseleave", (e: MouseEvent) => {
            if (!isDown) {
                return;
            }

            finish_drag(e);
        });

        this.background_ref.current.addEventListener("mouseup", (e: MouseEvent) => {
            finish_drag(e);
        });

        this.background_ref.current.addEventListener("mousemove", (e: MouseEvent) => {
            if (!isDown) {
                return;
            }
            e.preventDefault();

            const dx = e.pageX - startX;
            const dy = e.pageY - startY;

            this.foreground_ref.current.style.transform = `scale(${zoom}) translateX(${x + dx}px) translateY(${y + dy}px)`;
        });

        this.background_ref.current.addEventListener("wheel", (e: WheelEvent) => {
            e.preventDefault();

            let dz = 0;
            if (e.deltaY > 0) {
                dz = -0.01;
            } else {
                dz = 0.01;
            }
            zoom += dz;

            this.foreground_ref.current.style.transform = `scale(${zoom}) translateX(${x}px) translateY(${y}px)`;
        })
    }

    componentWillUnmount() {
        // TODO: detach handlers
    }
}

function graph_with_defaults(): dagre.graphlib.Graph {
    const g = new dagre.graphlib.Graph();

    g.setGraph({
        // Direction for rank nodes.
        // Can be TB, BT, LR, or RL, where T = top, B = bottom, L = left, and R = right.
        // default: TB
        rankdir: "TB",
        // Alignment for rank nodes.
        // Can be UL, UR, DL, or DR, where U = up, D = down, L = left, and R = right.
        // default: undefined
        align: "UL",
        // Number of pixels that separate nodes horizontally in the layout.
        // default: 50
        nodesep: 50,
        // Number of pixels that separate edges horizontally in the layout.
        // default: 10
        edgesep: 10,
        // Number of pixels between each rank in the layout.
        // default: 50
        ranksep: 50,
        // Number of pixels to use as a margin around the left and right of the graph.
        // default: 0
        marginx: 100,
        // Number of pixels to use as a margin around the top and bottom of the graph.
        // default: 0
        marginy: 100,
        // If set to greedy, uses a greedy heuristic for finding a feedback arc set for a graph.
        // A feedback arc set is a set of edges that can be removed to make a graph acyclic.
        // default: undefined
        acyclicer: undefined,
        // Type of algorithm to assigns a rank to each node in the input graph.
        // Possible values: network-simplex, tight-tree or longest-path
        // default: network-simplex
        ranker: "network-simplex",
    });

    g.setDefaultEdgeLabel(function () {
        return {};
    });

    return g;
}

interface Point {
    x: number;
    y: number;
}

interface INodeDimensions {
    index: number;
    height: number;
    width: number;
}

interface INodeLayout {
    index: number;
    height: number;
    width: number;
    x: number;
    y: number;
}

interface IPoint {
    x: number;
    y: number;
}

interface IEdgeLayout {
    points: IPoint[];
    type: BinExport2.FlowGraph.Edge.Type;
    source: number;
    target: number;
}

interface ILayout {
    nodes: INodeLayout[];
    edges: IEdgeLayout[];
}

var foo = 0;

function timeout(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function animationframe() {
    return new Promise(resolve => requestAnimationFrame(resolve));
}

export async function layoutFlowGraph(fg: IFlowGraph): Promise<ILayout> {
    console.log("layout");
    const scratch = document.getElementById('scratch') as HTMLElement;
    const div = document.createElement("div");
    div.id = `scratch-${foo}`;
    foo += 1;
    scratch.appendChild(div)

    const root = ReactDOM.createRoot(div);

    root.render(
        <React.StrictMode>
            <RecoilRoot>
                <div className="graph-flow-graph flow-graph" style={{ height: "100%", width: "100%" }}>
                    {fg.basicBlocks.map((bb) => (
                        <BasicBlock bb={bb} key={bb.index} />
                    ))}
                </div>
            </RecoilRoot>
        </React.StrictMode>
    );
    // long enough for react to render the contents.
    // hack.
    await timeout(60);
    // await animationframe();
    // await animationframe();

    const bbDimensions: Record<number, INodeDimensions> = {};
    [...div.getElementsByClassName("basic-block")].forEach(bb1 => {
        const bb = bb1 as HTMLElement

        const bbIndex_ = bb.dataset.bbIndex;
        if (bbIndex_ === undefined) {
            return;
        }
        const bbIndex = parseInt(bbIndex_);

        bbDimensions[bbIndex] = {
            index: bbIndex,
            height: bb.offsetHeight,
            width: bb.offsetWidth,
        };
    });

    root.unmount();

    const g = graph_with_defaults();
    for (const bb of fg.basicBlocks) {
        g.setNode(bb.index.toString(), bbDimensions[bb.index]);
    }
    for (const e of fg.edges) {
        g.setEdge(e.sourceBasicBlockIndex.toString(), e.targetBasicBlockIndex.toString(), {
            weight: e.type === BinExport2.FlowGraph.Edge.Type.CONDITION_FALSE ? 1 : 0.5,
            minlen: 1,
            width: 0,
            height: 0,
            labelpos: "r",
            labeloffset: 10,

            type: e.type,
            source: e.sourceBasicBlockIndex,
            target: e.targetBasicBlockIndex,
        });
    }

    dagre.layout(g);
    const nodes: INodeLayout[] = g.nodes().map((v) => g.node(v) as INodeLayout);
    const edges: IEdgeLayout[] = g.edges().map((v) => g.edge(v) as IEdgeLayout);

    return {
        nodes,
        edges,
    };
}

export function GraphBasicBlock({bb, layout}: {bb: IBasicBlock, layout: INodeLayout}) {
    if (layout === undefined) {
        return (<></>);
    }
    return (
        <div 
            className="basic-block" 
            style={{
                top: layout.y - layout.height / 2, 
                left: layout.x - layout.width / 2,
                position: "absolute",
                height: layout.height,
                width: layout.width,
                // place BB (z-index 1) over edges (z-index 0)
                zIndex: 1,
            }}>
            {bb.instructions.map((insn) => (
                <Instruction insn={insn} key={insn.index} />
            ))}
        </div>
    )
}

function GraphEdges({layout}: {layout: IEdgeLayout}) {
    let className = "";
    switch (layout.type) {
        case BinExport2.FlowGraph.Edge.Type.CONDITION_FALSE:
            className = "edge edge-condition-false";
            break;
        case BinExport2.FlowGraph.Edge.Type.CONDITION_TRUE:
            className = "edge edge-condition-true";
            break;
        case BinExport2.FlowGraph.Edge.Type.UNCONDITIONAL:
            className = "edge edge-unconditional";
            break;
        case BinExport2.FlowGraph.Edge.Type.SWITCH:
            className = "edge edge-switch";
            break;
        default:
            className = "edge edge-unknown";
            break;
    }

    const points = layout.points.map(point => `${point.x},${point.y}`).join(" ");

    return (
        <svg className={className}>
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9.5" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" />
                </marker>
            </defs>
            <polyline points={points} markerEnd="url(#arrowhead)"></polyline>
        </svg>
    );
};

function edgeLayoutKey(edge: IEdgeLayout): string {
    return `${edge.source}-${edge.target}-${edge.type}`

}

export function FlowGraph({fg}: {fg: IFlowGraph}) {
    const [layout, setLayout] = useState<ILayout>();

    useEffect(() => {
        layoutFlowGraph(fg).then((layout) => {
            setLayout(layout);
        });
    }, [setLayout, fg])

    if (layout === undefined) {
        return (
            <div className="flow-graph">
                {fg.basicBlocks.map((bb) => (
                    <BasicBlock bb={bb} key={bb.index} />
                ))}
            </div>
        )
    } else {
        const nodeLayoutsByIndex: Record<number, INodeLayout> = {};
        layout.nodes.forEach(node => {
            nodeLayoutsByIndex[node.index] = node;
        })

        return (
            <div className="graph-view" style={{ height: "100%", width: "100%" }}>
                <Pannable key={fg.index}>
                    <Fragment>
                        {/* order of these elements is important, because they draw on top of each other, due to fixed layout */}

                        {/* this is just a large element for the mouse to grab. assume 100k pixels is big enough :-) */}
                        <div style={{height: "100000px", width: "100000px", position: "fixed", top: "-50000px", left: "-50000px"}} />

                        <div className="flow-graph">
                            {layout.edges.map((edge) => (
                                <GraphEdges layout={edge} key={edgeLayoutKey(edge)} />
                            ))}

                            {fg.basicBlocks.map((bb) => (
                                <GraphBasicBlock bb={bb} layout={nodeLayoutsByIndex[bb.index]} key={bb.index} />
                            ))}
                        </div>
                    </Fragment>
                </Pannable>
            </div>
       )
    }
}